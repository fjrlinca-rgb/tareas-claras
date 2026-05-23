import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  AttachmentRow, ParentType, MAX_FILE_BYTES,
  uploadAttachment, deleteAttachment, signedUrl,
  isAllowedFile, isImage, formatBytes,
} from "@/lib/attachments";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Paperclip, X, Trash2, Loader2, Download, Eye,
  FileText, FileImage, FileSpreadsheet, FileArchive, File as FileIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  parentType: ParentType;
  parentId: string;
  readOnly?: boolean;
  /** Permitir pegado / drop sobre todo el contenedor (incluido el textarea de descripción). */
  className?: string;
}

const fileIcon = (att: { mime_type?: string | null; file_name?: string }) => {
  if (isImage(att)) return FileImage;
  const ext = att.file_name?.split(".").pop()?.toLowerCase() ?? "";
  if (["xls","xlsx","csv"].includes(ext)) return FileSpreadsheet;
  if (["zip","rar","7z"].includes(ext)) return FileArchive;
  if (["pdf","doc","docx","txt"].includes(ext)) return FileText;
  return FileIcon;
};

interface PreviewItem extends AttachmentRow {
  _url?: string;
}

export const AttachmentsField = ({ parentType, parentId, readOnly, className }: Props) => {
  const { user } = useAuth();
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [uploading, setUploading] = useState<{ name: string; progress: number }[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("attachments")
      .select("*")
      .eq("parent_type", parentType)
      .eq("parent_id", parentId)
      .order("created_at", { ascending: true });
    if (error) return;
    const list = (data ?? []) as AttachmentRow[];
    // pre-firmar URLs de imágenes para thumbs
    const withUrls = await Promise.all(list.map(async (a) => {
      if (isImage(a)) return { ...a, _url: (await signedUrl(a)) ?? undefined };
      return a;
    }));
    setItems(withUrls);
  }, [parentType, parentId]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel(`att-${parentType}-${parentId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "attachments",
        filter: `parent_id=eq.${parentId}`,
      }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [parentType, parentId, load]);

  const handleFiles = useCallback(async (files: File[]) => {
    if (!user) return;
    const valid: File[] = [];
    for (const f of files) {
      if (f.size > MAX_FILE_BYTES) { toast.error(`"${f.name}" supera 20 MB`); continue; }
      if (!isAllowedFile(f)) { toast.error(`"${f.name}" tipo no permitido`); continue; }
      valid.push(f);
    }
    if (!valid.length) return;
    setUploading((u) => [...u, ...valid.map((f) => ({ name: f.name, progress: 30 }))]);
    for (const f of valid) {
      try {
        await uploadAttachment(f, parentType, parentId, user.id, user.email ?? null);
        setUploading((u) => u.filter((x) => x.name !== f.name));
      } catch (e: any) {
        toast.error(`Error subiendo ${f.name}: ${e.message ?? e}`);
        setUploading((u) => u.filter((x) => x.name !== f.name));
      }
    }
    load();
  }, [user, parentType, parentId, load]);

  const onPaste = useCallback((e: React.ClipboardEvent) => {
    if (readOnly) return;
    const files: File[] = [];
    const items = e.clipboardData?.items ?? [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f) {
          // Renombrar capturas genéricas
          const ext = (f.type.split("/")[1] || "png").split("+")[0];
          const named = f.name && f.name !== "image.png"
            ? f
            : new File([f], `captura-${Date.now()}.${ext}`, { type: f.type });
          files.push(named);
        }
      }
    }
    if (files.length) {
      e.preventDefault();
      handleFiles(files);
    }
  }, [handleFiles, readOnly]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (readOnly) return;
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) handleFiles(files);
  }, [handleFiles, readOnly]);

  const openZoom = async (att: AttachmentRow) => {
    if (att._url) { setZoomUrl(att._url); return; }
    const u = await signedUrl(att);
    if (u) setZoomUrl(u);
  };

  const handleDownload = async (att: AttachmentRow) => {
    const u = await signedUrl(att, 120);
    if (!u) { toast.error("No se pudo obtener el archivo"); return; }
    const a = document.createElement("a");
    a.href = u; a.download = att.file_name; a.target = "_blank";
    document.body.appendChild(a); a.click(); a.remove();
  };

  const handleDelete = async (att: AttachmentRow) => {
    if (!confirm(`¿Eliminar "${att.file_name}"?`)) return;
    try {
      await deleteAttachment(att);
      setItems((prev) => prev.filter((x) => x.id !== att.id));
    } catch (e: any) {
      toast.error(e.message ?? "Error al eliminar");
    }
  };

  return (
    <div
      className={cn("space-y-3", className)}
      onPaste={onPaste}
      onDragOver={(e) => { if (!readOnly) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {!readOnly && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs transition-colors",
            dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/20"
          )}
        >
          <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">
            Arrastra archivos aquí, pega con <kbd className="px-1 rounded bg-muted">Ctrl+V</kbd> o
          </span>
          <Button
            type="button" variant="outline" size="sm" className="h-7 text-xs"
            onClick={() => inputRef.current?.click()}
          >
            Adjuntar archivos
          </Button>
          <span className="text-muted-foreground ml-auto">Máx. 20 MB · imágenes, PDF, Office, ZIP</span>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
            onChange={(e) => {
              const fs = Array.from(e.target.files ?? []);
              if (fs.length) handleFiles(fs);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {uploading.length > 0 && (
        <div className="space-y-1.5">
          {uploading.map((u) => (
            <div key={u.name} className="flex items-center gap-2 text-xs">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span className="truncate flex-1">{u.name}</span>
              <Progress value={u.progress} className="w-24 h-1.5" />
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {items.map((att) => {
            const Icon = fileIcon(att);
            const img = isImage(att);
            return (
              <div
                key={att.id}
                className="group relative rounded-md border border-border bg-card overflow-hidden"
              >
                {img && att._url ? (
                  <button
                    type="button"
                    onClick={() => openZoom(att)}
                    className="block w-full aspect-square bg-muted overflow-hidden"
                  >
                    <img
                      src={att._url}
                      alt={att.file_name}
                      className="w-full h-full object-cover transition group-hover:scale-105"
                      loading="lazy"
                    />
                  </button>
                ) : (
                  <div className="aspect-square bg-muted/40 flex items-center justify-center">
                    <Icon className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
                <div className="p-2 text-[11px] space-y-0.5">
                  <p className="truncate font-medium" title={att.file_name}>{att.file_name}</p>
                  <p className="text-muted-foreground">{formatBytes(att.size_bytes)}</p>
                </div>
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  {img && (
                    <Button type="button" size="icon" variant="secondary" className="h-6 w-6"
                      onClick={() => openZoom(att)} aria-label="Ver">
                      <Eye className="h-3 w-3" />
                    </Button>
                  )}
                  <Button type="button" size="icon" variant="secondary" className="h-6 w-6"
                    onClick={() => handleDownload(att)} aria-label="Descargar">
                    <Download className="h-3 w-3" />
                  </Button>
                  {!readOnly && (user?.id === att.uploaded_by) && (
                    <Button type="button" size="icon" variant="destructive" className="h-6 w-6"
                      onClick={() => handleDelete(att)} aria-label="Eliminar">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!zoomUrl} onOpenChange={(o) => !o && setZoomUrl(null)}>
        <DialogContent className="max-w-4xl p-2 bg-background">
          {zoomUrl && (
            <div className="relative">
              <img src={zoomUrl} alt="" className="w-full max-h-[80vh] object-contain rounded" />
              <button
                onClick={() => setZoomUrl(null)}
                className="absolute top-2 right-2 rounded-full bg-background/80 hover:bg-background p-1.5"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
