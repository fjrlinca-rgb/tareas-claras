/**
 * Admin endpoints (replace Supabase Edge Functions):
 *   POST /api/admin/resolve-username  (public)
 *   POST /api/admin/users             supervisor
 *   PATCH /api/admin/users/:id        supervisor
 *   DELETE /api/admin/users/:id       supervisor
 *   POST /api/admin/companies         supervisor
 *   POST /api/admin/snapshot-reportes supervisor (or cron with auth)
 */
import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { withAuditClient } from "../middleware/audit.js";

const router = Router();

// Public: resolve a username/email to a usable identifier (kept for legacy frontends).
router.post("/resolve-username", async (req, res) => {
  const id = String(req.body?.username ?? "").trim();
  if (!id) return res.status(400).json({ error: "Usuario requerido" });
  if (id.includes("@")) return res.json({ email: id.toLowerCase() });
  const { rows } = await pool.query(
    "SELECT correo, activo FROM usuarios WHERE LOWER(usuario) = LOWER($1) LIMIT 1",
    [id]
  );
  const u = rows[0];
  if (!u) return res.status(404).json({ error: "Usuario no encontrado" });
  if (!u.activo) return res.status(403).json({ error: "Usuario inactivo" });
  res.json({ email: u.correo });
});

// Everything below requires supervisor.
router.use(requireAuth, requireRole("supervisor"), withAuditClient);

const userSchema = z.object({
  usuario: z.string().min(1).max(100),
  nombre: z.string().min(1).max(200),
  correo: z.string().email(),
  password: z.string().min(8).max(200),
  rol: z.enum(["cliente", "tecnico", "supervisor"]),
  activo: z.boolean().optional().default(true),
  company_id: z.string().uuid().nullable().optional(),
});

// List users (joins usuarios + profiles + companies so the UI gets everything in one call).
router.get("/users", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         u.id, u.usuario AS username, u.nombre AS full_name, u.correo AS email,
         u.rol, u.activo AS active, u.created_at,
         p.company_id,
         c.name AS company_name,
         COALESCE(c.puede_crear_ordenes, false) AS company_puede_crear_ordenes
       FROM usuarios u
       LEFT JOIN profiles p ON p.id = u.id
       LEFT JOIN companies c ON c.id = p.company_id
       ORDER BY u.created_at DESC`
    );
    res.json({ data: rows });
  } catch (e) { next(e); }
});

// List companies.
router.get("/companies", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, contact, email, active, puede_crear_ordenes, created_at
       FROM companies
       ORDER BY created_at DESC`
    );
    res.json({ data: rows });
  } catch (e) { next(e); }
});

router.patch("/companies/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const body = req.body ?? {};
    const map = {
      name: "name", contact: "contact", email: "email",
      active: "active", puede_crear_ordenes: "puede_crear_ordenes",
    };
    const sets = []; const params = [];
    for (const [k, col] of Object.entries(map)) {
      if (body[k] !== undefined) { params.push(body[k]); sets.push(`${col} = $${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: "Sin cambios" });
    params.push(id);
    const { rows } = await req.db.query(
      `UPDATE companies SET ${sets.join(",")} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: "No encontrada" });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete("/companies/:id", async (req, res, next) => {
  try {
    await req.db.query("DELETE FROM companies WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post("/users", async (req, res) => {
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const { usuario, nombre, correo, password, rol, activo, company_id } = parsed.data;

  const dup = await req.db.query(
    "SELECT 1 FROM usuarios WHERE LOWER(usuario) = LOWER($1) OR LOWER(correo) = LOWER($2)",
    [usuario, correo]
  );
  if (dup.rowCount) return res.status(400).json({ error: "Usuario o correo ya existe" });

  const hash = await bcrypt.hash(password, 12);
  const { rows } = await req.db.query(
    `INSERT INTO usuarios (usuario, nombre, correo, password_hash, rol, activo)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, usuario, nombre, correo, rol, activo`,
    [usuario, nombre, correo.toLowerCase(), hash, rol, activo]
  );
  const u = rows[0];

  await req.db.query(
    `INSERT INTO profiles (id, full_name, username, email, company_id, active)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (id) DO UPDATE SET
       full_name = EXCLUDED.full_name, username = EXCLUDED.username,
       email = EXCLUDED.email, company_id = EXCLUDED.company_id,
       active = EXCLUDED.active`,
    [u.id, nombre, usuario, correo.toLowerCase(), company_id ?? null, activo]
  );

  await req.db.query(
    `INSERT INTO user_roles (user_id, role) VALUES ($1, $2::app_role)
     ON CONFLICT (user_id, role) DO NOTHING`,
    [u.id, rol]
  );

  if (rol === "tecnico") {
    await req.db.query(
      `INSERT INTO technicians (email, name, active, created_by)
       VALUES ($1,$2,true,$3) ON CONFLICT (email) DO NOTHING`,
      [correo.toLowerCase(), nombre, req.user.id]
    );
  }
  res.status(201).json(u);
});

router.patch("/users/:id", async (req, res) => {
  const id = req.params.id;
  const body = req.body ?? {};
  const sets = [];
  const params = [];
  const map = { usuario: "usuario", nombre: "nombre", correo: "correo", rol: "rol", activo: "activo" };
  for (const [k, col] of Object.entries(map)) {
    if (body[k] !== undefined) { params.push(body[k]); sets.push(`${col} = $${params.length}`); }
  }
  if (body.password) {
    const hash = await bcrypt.hash(String(body.password), 12);
    params.push(hash); sets.push(`password_hash = $${params.length}`);
  }
  if (!sets.length) return res.status(400).json({ error: "Sin cambios" });
  params.push(id);
  const { rows } = await req.db.query(
    `UPDATE usuarios SET ${sets.join(",")} WHERE id = $${params.length}
     RETURNING id, usuario, nombre, correo, rol, activo`, params
  );
  if (!rows[0]) return res.status(404).json({ error: "No encontrado" });
  res.json(rows[0]);
});

router.delete("/users/:id", async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "No puedes eliminarte" });
  await req.db.query("DELETE FROM usuarios WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

// Companies + paired client user (replaces admin-create-company edge function)
router.post("/companies", async (req, res) => {
  const { name, contact, email, active = true, username, password } = req.body ?? {};
  if (!name) return res.status(400).json({ error: "Nombre requerido" });
  const { rows: cRows } = await req.db.query(
    `INSERT INTO companies (name, contact, email, active, created_by)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, contact ?? null, email ?? null, active, req.user.id]
  );
  const company = cRows[0];
  // Optionally provision a client user linked to the company.
  if (email && password) {
    const hash = await bcrypt.hash(String(password), 12);
    const { rows: uRows } = await req.db.query(
      `INSERT INTO usuarios (usuario, nombre, correo, password_hash, rol, activo)
       VALUES ($1,$2,$3,$4,'cliente',$5) RETURNING id`,
      [username || email, name, String(email).toLowerCase(), hash, active]
    );
    const uid = uRows[0].id;
    await req.db.query(
      `INSERT INTO profiles (id, full_name, username, email, company_id, active)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET company_id = EXCLUDED.company_id`,
      [uid, name, username || email, String(email).toLowerCase(), company.id, active]
    );
    await req.db.query(
      `INSERT INTO user_roles (user_id, role) VALUES ($1,'cliente'::app_role)
       ON CONFLICT DO NOTHING`, [uid]
    );
  }
  res.status(201).json(company);
});

// Snapshot reportes (replaces edge function snapshot-reportes)
router.post("/snapshot-reportes", async (req, res, next) => {
  try {
    const fecha = req.body?.fecha ?? null;
    const { rows } = await req.db.query(
      "SELECT generar_snapshot_diario($1::date) AS row",
      [fecha]
    );
    res.json({ data: rows[0].row });
  } catch (e) { next(e); }
});

export default router;
