import { v4 as uuidv4 } from "uuid";

export type ParentType = "ticket" | "orden" | "actividad";

export interface AttachmentRow {
  id: string;
  parent_type: ParentType;
  parent_id: string;
  bucket: string;
  path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  uploaded_by_email: string | null;
  created_at: string;
}

export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export const ALLOWED_EXT = [
  "jpg","jpeg","png","webp","gif",
  "pdf","doc","docx","xls","xlsx","txt","zip",
];
export const ALLOWED_MIME_PREFIXES = ["image/"];
export const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
]);

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001";

export function bucketFor(parentType: ParentType): string {
  if (parentType === "ticket") return "tickets-files";
  if (parentType === "orden") return "ordenes-files";
  return "actividades-files";
}

export function isAllowedFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ALLOWED_EXT.includes(ext)) return true;
  if (ALLOWED_MIME_PREFIXES.some((p) => file.type.startsWith(p))) return true;
  if (ALLOWED_MIMES.has(file.type)) return true;
  return false;
}

export function formatBytes(n: number | null | undefined): string {
  if (!n && n !== 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120);
}

// Note: userId / userEmail are now resolved server-side from the session.
export async function uploadAttachment(
  file: File,
  parentType: ParentType,
  parentId: string,
  _userId: string,
  _userEmail: string | null
): Promise<AttachmentRow> {
  const fd = new FormData();
  fd.append("file", file, sanitizeFilename(file.name));
  fd.append("parent_type", parentType);
  fd.append("parent_id", parentId);
  // keep unused vars referenced for backwards compat
  void uuidv4; void _userId; void _userEmail;

  const res = await fetch(`${API_URL}/api/uploads`, {
    method: "POST",
    credentials: "include",
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Error subiendo archivo");
  }
  return (await res.json()) as AttachmentRow;
}

export async function deleteAttachment(att: AttachmentRow): Promise<void> {
  await fetch(`${API_URL}/api/uploads/${att.id}`, {
    method: "DELETE",
    credentials: "include",
  });
}

export async function signedUrl(att: AttachmentRow, _expiresIn = 3600): Promise<string | null> {
  // Backend serves protected files at /api/uploads/:id (session-authenticated).
  return `${API_URL}/api/uploads/${att.id}`;
}

export function isImage(att: { mime_type?: string | null; file_name?: string }): boolean {
  if (att.mime_type?.startsWith("image/")) return true;
  const ext = att.file_name?.split(".").pop()?.toLowerCase() ?? "";
  return ["jpg","jpeg","png","webp","gif"].includes(ext);
}
