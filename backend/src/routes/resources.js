/**
 * CRUD genérico sobre tablas de negocio. Para Fase 1 exponemos lectura y
 * escritura básicas con auditoría (req.db) y validación de rol mínima.
 * Las rutas que necesiten lógica específica se moverán a archivos dedicados
 * en fases siguientes.
 */
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { withAuditClient } from "../middleware/audit.js";
import { getIO } from "../sockets/io.js";

const router = Router();
router.use(requireAuth, withAuditClient);

const TABLES = {
  tickets: { table: "entradas", broadcast: "entradas" },
  ordenes: { table: "ordenes_trabajo", broadcast: "ordenes_trabajo" },
  actividades: { table: "actividades_tecnicas", broadcast: "actividades_tecnicas" },
  technicians: { table: "technicians" },
  companies: { table: "companies" },
  notifications: { table: "notifications", broadcast: "notifications" },
  ticket_history: { table: "ticket_history" },
  historial_ordenes: { table: "historial_ordenes" },
  reportes_diarios: { table: "reportes_diarios" },
  attachments: { table: "attachments" },
};

function cfg(name) {
  const c = TABLES[name];
  if (!c) return null;
  return c;
}

// GET /api/:resource?limit=&offset=&order=col.desc&col=eq.value
router.get("/:resource", async (req, res) => {
  const c = cfg(req.params.resource);
  if (!c) return res.status(404).json({ error: "Recurso desconocido" });

  const limit = Math.min(Number(req.query.limit ?? 200), 1000);
  const offset = Number(req.query.offset ?? 0);
  const order = String(req.query.order ?? "created_at.desc");
  const [orderCol, orderDir] = order.split(".");
  const params = [];
  const where = [];
  for (const [k, v] of Object.entries(req.query)) {
    if (["limit","offset","order"].includes(k)) continue;
    const [op, val] = String(v).includes(".") ? String(v).split(/\.(.+)/) : ["eq", String(v)];
    if (!/^[a-zA-Z0-9_]+$/.test(k)) continue;
    params.push(val);
    if (op === "eq") where.push(`${k} = $${params.length}`);
    else if (op === "neq") where.push(`${k} <> $${params.length}`);
    else if (op === "ilike") where.push(`${k} ILIKE $${params.length}`);
    else if (op === "in") where.push(`${k} = ANY(string_to_array($${params.length}, ','))`);
  }
  const sql = `SELECT * FROM ${c.table}
               ${where.length ? "WHERE " + where.join(" AND ") : ""}
               ORDER BY ${/^[a-zA-Z0-9_]+$/.test(orderCol) ? orderCol : "created_at"}
                 ${orderDir === "asc" ? "ASC" : "DESC"}
               LIMIT ${limit} OFFSET ${offset}`;
  const { rows } = await req.db.query(sql, params);
  res.json(rows);
});

router.get("/:resource/:id", async (req, res) => {
  const c = cfg(req.params.resource);
  if (!c) return res.status(404).json({ error: "Recurso desconocido" });
  const { rows } = await req.db.query(`SELECT * FROM ${c.table} WHERE id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "No encontrado" });
  res.json(rows[0]);
});

function buildInsert(table, body) {
  const cols = Object.keys(body).filter((k) => /^[a-zA-Z0-9_]+$/.test(k));
  const vals = cols.map((_, i) => `$${i + 1}`);
  return {
    sql: `INSERT INTO ${table} (${cols.join(",")}) VALUES (${vals.join(",")}) RETURNING *`,
    params: cols.map((c) => body[c]),
  };
}

router.post("/:resource", async (req, res) => {
  const c = cfg(req.params.resource);
  if (!c) return res.status(404).json({ error: "Recurso desconocido" });
  const { sql, params } = buildInsert(c.table, req.body ?? {});
  const { rows } = await req.db.query(sql, params);
  if (c.broadcast) getIO()?.emit(c.broadcast, { type: "INSERT", row: rows[0] });
  res.status(201).json(rows[0]);
});

router.patch("/:resource/:id", async (req, res) => {
  const c = cfg(req.params.resource);
  if (!c) return res.status(404).json({ error: "Recurso desconocido" });
  const cols = Object.keys(req.body ?? {}).filter((k) => /^[a-zA-Z0-9_]+$/.test(k));
  if (!cols.length) return res.status(400).json({ error: "Sin cambios" });
  const sets = cols.map((c, i) => `${c} = $${i + 1}`);
  const params = cols.map((c) => req.body[c]);
  params.push(req.params.id);
  const { rows } = await req.db.query(
    `UPDATE ${c.table} SET ${sets.join(",")} WHERE id = $${params.length} RETURNING *`,
    params
  );
  if (!rows[0]) return res.status(404).json({ error: "No encontrado" });
  if (c.broadcast) getIO()?.emit(c.broadcast, { type: "UPDATE", row: rows[0] });
  res.json(rows[0]);
});

router.delete("/:resource/:id", async (req, res) => {
  const c = cfg(req.params.resource);
  if (!c) return res.status(404).json({ error: "Recurso desconocido" });
  const { rowCount, rows } = await req.db.query(
    `DELETE FROM ${c.table} WHERE id = $1 RETURNING *`, [req.params.id]
  );
  if (!rowCount) return res.status(404).json({ error: "No encontrado" });
  if (c.broadcast) getIO()?.emit(c.broadcast, { type: "DELETE", row: rows[0] });
  res.json({ ok: true });
});

export default router;
