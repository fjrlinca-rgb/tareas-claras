import { pool } from "../lib/db.js";

/**
 * Cuando hay usuario autenticado, fija los GUC `app.current_user_id` y
 * `app.current_user_email` sobre un cliente dedicado y lo expone como
 * `req.db` para que las rutas lo usen en lugar de `pool`.
 * Si la ruta no lo usa, se libera al finalizar.
 */
export async function withAuditClient(req, res, next) {
  if (!req.user) return next();
  const client = await pool.connect();
  try {
    await client.query("SELECT set_config('app.current_user_id', $1, false)", [req.user.id]);
    await client.query("SELECT set_config('app.current_user_email', $1, false)", [req.user.email ?? ""]);
    req.db = client;
    res.on("finish", () => client.release());
    res.on("close", () => { try { client.release(); } catch {} });
    next();
  } catch (e) {
    client.release();
    next(e);
  }
}
