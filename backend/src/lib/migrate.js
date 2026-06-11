// Simple forward-only SQL migration runner for PostgreSQL.
// Usage:
//   node src/lib/migrate.js up           # apply all pending migrations
//   node src/lib/migrate.js status       # list applied vs pending
//   node src/lib/migrate.js create <name># scaffold a new migration file
//
// Migrations live in backend/migrations/ as files named:
//   YYYYMMDDHHMMSS_<slug>.sql
// They are applied in lexicographic order, each inside a single transaction.

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { Client } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");

function listFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

async function ensureTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      version     TEXT PRIMARY KEY,
      checksum    TEXT NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

async function getApplied(client) {
  const { rows } = await client.query("SELECT version, checksum FROM public.schema_migrations ORDER BY version");
  return new Map(rows.map((r) => [r.version, r.checksum]));
}

async function cmdUp() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await ensureTable(client);
    const applied = await getApplied(client);
    const files = listFiles();
    let count = 0;
    for (const file of files) {
      const version = file.replace(/\.sql$/, "");
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      const checksum = sha256(sql);
      if (applied.has(version)) {
        if (applied.get(version) !== checksum) {
          throw new Error(`Checksum mismatch for ${file} — migrations are immutable once applied.`);
        }
        continue;
      }
      console.log(`▶ applying ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO public.schema_migrations(version, checksum) VALUES ($1,$2)",
          [version, checksum],
        );
        await client.query("COMMIT");
        count++;
        console.log(`  ✓ ${file}`);
      } catch (e) {
        await client.query("ROLLBACK");
        throw new Error(`Failed ${file}: ${e.message}`);
      }
    }
    console.log(count ? `Applied ${count} migration(s).` : "Nothing to apply.");
  } finally {
    await client.end();
  }
}

async function cmdStatus() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await ensureTable(client);
    const applied = await getApplied(client);
    const files = listFiles();
    console.log("Version".padEnd(40), "Status");
    console.log("-".repeat(60));
    for (const file of files) {
      const version = file.replace(/\.sql$/, "");
      console.log(version.padEnd(40), applied.has(version) ? "applied" : "PENDING");
    }
  } finally {
    await client.end();
  }
}

function cmdCreate(name) {
  if (!name) throw new Error("Provide a migration name, e.g. `npm run migrate:create -- add_index`");
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  if (!fs.existsSync(MIGRATIONS_DIR)) fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
  const file = path.join(MIGRATIONS_DIR, `${ts}_${slug}.sql`);
  fs.writeFileSync(file, `-- Migration: ${slug}\n-- Created: ${new Date().toISOString()}\n\nBEGIN;\n\n-- TODO: write your SQL here\n\nCOMMIT;\n`);
  console.log(`Created ${file}`);
}

const [, , cmd, ...rest] = process.argv;
try {
  if (cmd === "up") await cmdUp();
  else if (cmd === "status") await cmdStatus();
  else if (cmd === "create") cmdCreate(rest.join(" "));
  else {
    console.log("Usage: migrate.js <up|status|create <name>>");
    process.exit(1);
  }
} catch (e) {
  console.error("✗", e.message);
  process.exit(1);
}
