import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { requireAuth } from "../middleware/auth.js";
import { withAuditClient } from "../middleware/audit.js";

const UPLOADS_DIR = process.env.UPLOADS_DIR || "/opt/helpdesk/uploads";
const MAX_BYTES = Number(process.env.UPLOADS_MAX_BYTES ?? 20 * 1024 * 1024);
const INTERNAL_PREFIX = process.env.NGINX_INTERNAL_PREFIX || "/_protected_uploads";

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_EXT = new Set(["jpg","jpeg","png","webp","gif","pdf","doc","docx","xls","xlsx","txt","zip"]);

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const parentType = req.body.parent_type;
    const parentId = req.body.parent_id;
    if (!parentType || !parentId) return cb(new Error("parent_type/parent_id requeridos"));
    const bucket = parentType === "ticket" ? "tickets-files"
                : parentType === "orden"   ? "ordenes-files"
                : "actividades-files";
    const dir = path.join(UPLOADS_DIR, bucket, parentId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.\-]+/g, "_").slice(-120);
    cb(null, `${crypto.randomUUID()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = (file.originalname.split(".").pop() ?? "").toLowerCase();
    cb(null, ALLOWED_EXT.has(ext) || file.mimetype.startsWith("image/"));
  },
});

const router = Router();
router.use(requireAuth, withAuditClient);

// POST /api/uploads   multipart: file, parent_type, parent_id
router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Archivo requerido" });
  const { parent_type, parent_id } = req.body;
  const bucket = parent_type === "ticket" ? "tickets-files"
              : parent_type === "orden"   ? "ordenes-files"
              : "actividades-files";
  const relPath = `${parent_id}/${path.basename(req.file.path)}`;
  const { rows } = await req.db.query(
    `INSERT INTO attachments
       (parent_type, parent_id, bucket, path, file_name, mime_type, size_bytes, uploaded_by, uploaded_by_email)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [parent_type, parent_id, bucket, relPath, req.file.originalname,
     req.file.mimetype, req.file.size, req.user.id, req.user.email]
  );
  res.status(201).json(rows[0]);
});

// GET /api/uploads/:id   -> X-Accel-Redirect a Nginx (internal)
router.get("/:id", async (req, res) => {
  const { rows } = await req.db.query("SELECT * FROM attachments WHERE id = $1", [req.params.id]);
  const att = rows[0];
  if (!att) return res.status(404).json({ error: "No encontrado" });
  // Aquí podrías validar permisos por parent_type/parent_id según el rol.
  const internalPath = `${INTERNAL_PREFIX}/${att.bucket}/${att.path}`;
  res.setHeader("Content-Type", att.mime_type || "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename="${att.file_name.replace(/"/g,"")}"`);
  res.setHeader("X-Accel-Redirect", internalPath);
  res.end();
});

// DELETE /api/uploads/:id
router.delete("/:id", async (req, res) => {
  const { rows } = await req.db.query("SELECT * FROM attachments WHERE id = $1", [req.params.id]);
  const att = rows[0];
  if (!att) return res.status(404).json({ error: "No encontrado" });
  await req.db.query("DELETE FROM attachments WHERE id = $1", [att.id]);
  try { fs.unlinkSync(path.join(UPLOADS_DIR, att.bucket, att.path)); } catch {}
  res.json({ ok: true });
});

export default router;
