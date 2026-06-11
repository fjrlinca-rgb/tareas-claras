/**
 * Sustituye a las edge functions admin-create-user / admin-create-company /
 * admin-update-user. Sólo accesible por supervisores.
 */
import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { withAuditClient } from "../middleware/audit.js";

const router = Router();
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

router.post("/users", async (req, res) => {
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const { usuario, nombre, correo, password, rol, activo, company_id } = parsed.data;

  const dup = await req.db.query("SELECT 1 FROM usuarios WHERE LOWER(usuario) = LOWER($1)", [usuario]);
  if (dup.rowCount) return res.status(400).json({ error: "Usuario ya existe" });

  const hash = await bcrypt.hash(password, 12);
  const { rows } = await req.db.query(
    `INSERT INTO usuarios (usuario, nombre, correo, password_hash, rol, activo)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, usuario, nombre, correo, rol, activo`,
    [usuario, nombre, correo.toLowerCase(), hash, rol, activo]
  );
  const u = rows[0];

  await req.db.query(
    `INSERT INTO profiles (id, full_name, username, email, company_id, active)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name,
       username = EXCLUDED.username, email = EXCLUDED.email,
       company_id = EXCLUDED.company_id, active = EXCLUDED.active`,
    [u.id, nombre, usuario, correo.toLowerCase(), company_id ?? null, activo]
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

// Empresas
router.post("/companies", async (req, res) => {
  const { name, contact, email, active = true } = req.body ?? {};
  if (!name) return res.status(400).json({ error: "Nombre requerido" });
  const { rows } = await req.db.query(
    `INSERT INTO companies (name, contact, email, active, created_by)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, contact ?? null, email ?? null, active, req.user.id]
  );
  res.status(201).json(rows[0]);
});

export default router;
