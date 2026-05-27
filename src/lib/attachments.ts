import { supabase } from "@/integrations/supabase/client";

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

export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

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

export function bucketFor(parentType: ParentType): string {
  return parentType === "ticket" ? "tickets-files" : "ordenes-files";
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

export async function uploadAttachment(
  file: File,
  parentType: ParentType,
  parentId: string,
  userId: string,
  userEmail: string | null
): Promise<AttachmentRow> {
  const bucket = bucketFor(parentType);
  const safe = sanitizeFilename(file.name);
  const path = `${parentId}/${crypto.randomUUID()}-${safe}`;
  const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("attachments")
    .insert({
      parent_type: parentType,
      parent_id: parentId,
      bucket,
      path,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: userId,
      uploaded_by_email: userEmail,
    })
    .select("*")
    .single();
  if (error) {
    await supabase.storage.from(bucket).remove([path]);
    throw error;
  }
  return data as AttachmentRow;
}

export async function deleteAttachment(att: AttachmentRow): Promise<void> {
  await supabase.storage.from(att.bucket).remove([att.path]);
  await supabase.from("attachments").delete().eq("id", att.id);
}

export async function signedUrl(att: AttachmentRow, expiresIn = 3600): Promise<string | null> {
  const { data } = await supabase.storage.from(att.bucket).createSignedUrl(att.path, expiresIn);
  return data?.signedUrl ?? null;
}

export function isImage(att: { mime_type?: string | null; file_name?: string }): boolean {
  if (att.mime_type?.startsWith("image/")) return true;
  const ext = att.file_name?.split(".").pop()?.toLowerCase() ?? "";
  return ["jpg","jpeg","png","webp","gif"].includes(ext);
}
