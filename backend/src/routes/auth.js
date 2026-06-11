import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { pool } from "../lib/db.js";
import { signToken, COOKIE_NAME, cookieOptions } from "../lib/jwt.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const loginSchema = z.object({
  usuario: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

// POST /api/auth/login   { usuario, password }
router.post("/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });
  const { usuario, password } = parsed.data;

  const { rows } = await pool.query(
    `SELECT id, usuario, nombre, correo, rol, activo, password_hash
       FROM usuarios
      WHERE LOWER(usuario) = LOWER($1) OR LOWER(correo) = LOWER($1)
      LIMIT 1`,
    [usuario]
  );
  const u = rows[0];
  if (!u || !u.activo) return res.status(401).json({ error: "Credenciales inválidas" });

  const ok = await bcrypt.compare(password, u.password_hash ?? "");
  if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });

  const token = signToken({ sub: u.id, rol: u.rol, usuario: u.usuario });
  res.cookie(COOKIE_NAME, token, cookieOptions());
  res.json({
    user: { id: u.id, usuario: u.usuario, nombre: u.nombre, correo: u.correo, rol: u.rol },
  });
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: 0 });
  res.json({ ok: true });
});

// GET /api/auth/me
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
