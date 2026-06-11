/**
 * Generic CRUD API used by the frontend Supabase-compatibility shim.
 * Endpoints accept REAL table names from a whitelist.
 *
 *   POST   /api/db/:table/query   -> select with filters/order/limit/count
 *   POST   /api/db/:table         -> insert (single or array) returning rows
 *   PATCH  /api/db/:table         -> update with filters returning rows
 *   DELETE /api/db/:table         -> delete with filters returning rows
 *   POST   /api/rpc/:fn           -> call whitelisted SQL function
 */
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { withAuditClient } from "../middleware/audit.js";
import { getIO } from "../sockets/io.js";

const router = Router();
router.use(requireAuth, withAuditClient);

// Tables exposed via the generic API (real names).
const TABLES = new Set([
  "entradas",
  "ordenes_trabajo",
  "actividades_tecnicas",
  "technicians",
  "companies",
  "notifications",
  "ticket_history",
  "historial_ordenes",
  "reportes_diarios",
  "attachments",
  "profiles",
  "user_roles",
  "usuarios",
]);

// Tables that broadcast realtime change events.
const BROADCAST = new Set([
  "entradas",
  "ordenes_trabajo",
  "actividades_tecnicas",
  "notifications",
  "attachments",
  "companies",
  "ticket_history",
  "historial_ordenes",
  "technicians",
]);

// Whitelisted RPC functions.
const RPCS = new Set([
  "has_role",
  "puede_crear_ordenes",
  "generar_snapshot_diario",
]);

const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function assertTable(name) {
  if (!TABLES.has(name)) {
    const e = new Error("Recurso desconocido"); e.status = 404; throw e;
  }
  return name;
}

function buildWhere(filters = [], startIdx = 1) {
  const where = [];
  const params = [];
  let i = startIdx;
  for (const f of filters) {
    if (!f || !SAFE_IDENT.test(f.col)) continue;
    const { col, op, value } = f;
    switch (op) {
      case "eq":  where.push(`${col} = $${i++}`);  params.push(value); break;
      case "neq": where.push(`${col} <> $${i++}`); params.push(value); break;
      case "ilike": where.push(`${col} ILIKE $${i++}`); params.push(value); break;
      case "like":  where.push(`${col} LIKE $${i++}`);  params.push(value); break;
      case "gt":  where.push(`${col} > $${i++}`);  params.push(value); break;
      case "gte": where.push(`${col} >= $${i++}`); params.push(value); break;
      case "lt":  where.push(`${col} < $${i++}`);  params.push(value); break;
      case "lte": where.push(`${col} <= $${i++}`); params.push(value); break;
      case "is":
        if (value === null) where.push(`${col} IS NULL`);
        else if (value === true) where.push(`${col} IS TRUE`);
        else if (value === false) where.push(`${col} IS FALSE`);
        break;
      case "in": {
        const arr = Array.isArray(value) ? value : [];
        if (!arr.length) { where.push("FALSE"); break; }
        const placeholders = arr.map(() => `$${i++}`);
        where.push(`${col} IN (${placeholders.join(",")})`);
        params.push(...arr);
        break;
      }
      default: break;
    }
  }
  return { where, params };
}

router.post("/db/:table/query", async (req, res, next) => {
  try {
    const table = assertTable(req.params.table);
    const { filters = [], select = "*", order, limit, offset, count, head, single } = req.body ?? {};
    const cols = select === "*" || !select
      ? "*"
      : String(select).split(",").map((s) => s.trim()).filter((s) => SAFE_IDENT.test(s)).join(",") || "*";
    const { where, params } = buildWhere(filters);
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    let orderSql = "";
    if (order && SAFE_IDENT.test(order.col)) {
      orderSql = `ORDER BY ${order.col} ${order.ascending ? "ASC" : "DESC"} NULLS LAST`;
    }
    const limitSql = limit ? `LIMIT ${Math.min(Number(limit), 5000)}` : "";
    const offsetSql = offset ? `OFFSET ${Number(offset)}` : "";

    let total = null;
    if (count === "exact") {
      const r = await req.db.query(`SELECT COUNT(*)::int AS c FROM ${table} ${whereSql}`, params);
      total = r.rows[0].c;
    }
    let data = [];
    if (!head) {
      const sql = `SELECT ${cols} FROM ${table} ${whereSql} ${orderSql} ${limitSql} ${offsetSql}`;
      const r = await req.db.query(sql, params);
      data = r.rows;
    }
    if (single) {
      if (data.length > 1) return res.status(406).json({ error: "Multiple rows" });
      return res.json({ data: data[0] ?? null, count: total });
    }
    res.json({ data, count: total });
  } catch (e) { next(e); }
});

router.post("/db/:table", async (req, res, next) => {
  try {
    const table = assertTable(req.params.table);
    const body = req.body;
    const rowsIn = Array.isArray(body) ? body : [body];
    if (!rowsIn.length) return res.json({ data: [] });
    const cols = Object.keys(rowsIn[0]).filter((k) => SAFE_IDENT.test(k));
    if (!cols.length) return res.status(400).json({ error: "Sin columnas válidas" });
    const valuesSql = [];
    const params = [];
    let i = 1;
    for (const r of rowsIn) {
      valuesSql.push(`(${cols.map(() => `$${i++}`).join(",")})`);
      for (const c of cols) params.push(r[c] ?? null);
    }
    const sql = `INSERT INTO ${table} (${cols.join(",")}) VALUES ${valuesSql.join(",")} RETURNING *`;
    const { rows } = await req.db.query(sql, params);
    if (BROADCAST.has(table)) {
      for (const row of rows) getIO()?.emit(`table:${table}`, { eventType: "INSERT", new: row, old: null });
    }
    res.status(201).json({ data: rows });
  } catch (e) { next(e); }
});

router.patch("/db/:table", async (req, res, next) => {
  try {
    const table = assertTable(req.params.table);
    const { filters = [], values = {} } = req.body ?? {};
    const cols = Object.keys(values).filter((k) => SAFE_IDENT.test(k));
    if (!cols.length) return res.status(400).json({ error: "Sin valores" });
    const setParts = cols.map((c, idx) => `${c} = $${idx + 1}`);
    const params = cols.map((c) => values[c]);
    const { where, params: wp } = buildWhere(filters, params.length + 1);
    if (!where.length) return res.status(400).json({ error: "Filtros requeridos" });
    params.push(...wp);
    const sql = `UPDATE ${table} SET ${setParts.join(",")} WHERE ${where.join(" AND ")} RETURNING *`;
    const { rows } = await req.db.query(sql, params);
    if (BROADCAST.has(table)) {
      for (const row of rows) getIO()?.emit(`table:${table}`, { eventType: "UPDATE", new: row, old: null });
    }
    res.json({ data: rows });
  } catch (e) { next(e); }
});

router.delete("/db/:table", async (req, res, next) => {
  try {
    const table = assertTable(req.params.table);
    const { filters = [] } = req.body ?? {};
    const { where, params } = buildWhere(filters);
    if (!where.length) return res.status(400).json({ error: "Filtros requeridos" });
    const sql = `DELETE FROM ${table} WHERE ${where.join(" AND ")} RETURNING *`;
    const { rows } = await req.db.query(sql, params);
    if (BROADCAST.has(table)) {
      for (const row of rows) getIO()?.emit(`table:${table}`, { eventType: "DELETE", new: null, old: row });
    }
    res.json({ data: rows });
  } catch (e) { next(e); }
});

router.post("/rpc/:fn", async (req, res, next) => {
  try {
    const fn = req.params.fn;
    if (!RPCS.has(fn) || !SAFE_IDENT.test(fn)) return res.status(404).json({ error: "RPC desconocido" });
    const args = req.body ?? {};
    const keys = Object.keys(args);
    const params = keys.map((k) => args[k]);
    const named = keys.map((k, i) => `${k} := $${i + 1}`).join(",");
    const sql = `SELECT ${fn}(${named}) AS result`;
    const { rows } = await req.db.query(sql, params);
    res.json({ data: rows[0]?.result ?? null });
  } catch (e) { next(e); }
});

export default router;
