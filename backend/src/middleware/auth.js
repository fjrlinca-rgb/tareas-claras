import { verifyToken, COOKIE_NAME } from "../lib/jwt.js";
import { pool } from "../lib/db.js";

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: "No autenticado" });
    const payload = verifyToken(token);
    // Refrescar datos básicos por si el usuario fue desactivado.
    const { rows } = await pool.query(
      "SELECT id, usuario, nombre, correo, rol, activo FROM usuarios WHERE id = $1",
      [payload.sub]
    );
    const u = rows[0];
    if (!u || !u.activo) return res.status(401).json({ error: "Usuario inválido" });
    req.user = { id: u.id, usuario: u.usuario, nombre: u.nombre, email: u.correo, rol: u.rol };
    next();
  } catch {
    return res.status(401).json({ error: "Sesión inválida" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "No autenticado" });
    if (!roles.includes(req.user.rol)) return res.status(403).json({ error: "Sin permiso" });
    next();
  };
}
