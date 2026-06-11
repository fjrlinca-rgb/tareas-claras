import pg from "pg";
import "dotenv/config";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX ?? 20),
  idleTimeoutMillis: 30_000,
});

/**
 * Ejecuta `fn` con un cliente dedicado y los GUC de auditoría seteados
 * (current_user_id, current_user_email) para que los triggers/funciones
 * que llaman a current_setting('app.current_user_id') funcionen.
 */
export async function withUser(user, fn) {
  const client = await pool.connect();
  try {
    if (user?.id) {
      await client.query("SELECT set_config('app.current_user_id', $1, true)", [user.id]);
      await client.query("SELECT set_config('app.current_user_email', $1, true)", [user.email ?? ""]);
    }
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function q(text, params) {
  return pool.query(text, params);
}
