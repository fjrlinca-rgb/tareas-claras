/**
 * Compatibility shim that exposes a small Supabase-like surface
 * (auth / from / channel / storage / functions / rpc / removeChannel)
 * but routes every call to the self-hosted backend
 * (Express + Socket.IO + PostgreSQL).
 *
 * This file replaces the old @supabase/supabase-js client without
 * requiring changes in the rest of the codebase.
 */
import { io, type Socket } from "socket.io-client";

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001";
const SOCKET_URL =
  (import.meta.env.VITE_SOCKET_URL as string | undefined) ?? API_URL;

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function api<T = any>(
  path: string,
  init: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: T | null; error: any }> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      credentials: "include",
      headers: {
        ...(init.body && !(init.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...(init.headers ?? {}),
      },
      ...init,
    });
    const isJson = res.headers.get("content-type")?.includes("application/json");
    const body = isJson ? await res.json() : null;
    if (!res.ok) {
      return { ok: false, status: res.status, data: null, error: body ?? { message: res.statusText } };
    }
    return { ok: true, status: res.status, data: body as T, error: null };
  } catch (e: any) {
    return { ok: false, status: 0, data: null, error: { message: e?.message ?? "network error" } };
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

type User = { id: string; email: string; user_metadata?: Record<string, any> };
type Session = { user: User; access_token: string } | null;

type AuthCallback = (event: string, session: Session) => void;

const authListeners = new Set<AuthCallback>();
let currentUser: User | null = null;

function userFromApi(raw: any): User | null {
  if (!raw) return null;
  return {
    id: raw.id,
    email: raw.correo ?? raw.email ?? "",
    user_metadata: { full_name: raw.nombre, username: raw.usuario, rol: raw.rol },
  };
}

function emitAuth(event: string) {
  const session: Session = currentUser ? { user: currentUser, access_token: "cookie" } : null;
  authListeners.forEach((cb) => {
    try { cb(event, session); } catch { /* ignore */ }
  });
}

async function refreshMe(): Promise<User | null> {
  const r = await api<{ user: any }>("/api/auth/me");
  currentUser = r.ok ? userFromApi(r.data?.user) : null;
  return currentUser;
}

const auth = {
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const r = await api<{ user: any }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ usuario: email, password }),
    });
    if (!r.ok) return { data: { user: null, session: null }, error: r.error };
    currentUser = userFromApi(r.data?.user);
    emitAuth("SIGNED_IN");
    const session: Session = currentUser ? { user: currentUser, access_token: "cookie" } : null;
    return { data: { user: currentUser, session }, error: null };
  },

  async signOut() {
    await api("/api/auth/logout", { method: "POST" });
    currentUser = null;
    emitAuth("SIGNED_OUT");
    return { error: null };
  },

  async getSession() {
    if (!currentUser) await refreshMe();
    const session: Session = currentUser ? { user: currentUser, access_token: "cookie" } : null;
    return { data: { session }, error: null };
  },

  async getUser() {
    const u = await refreshMe();
    return { data: { user: u }, error: null };
  },

  onAuthStateChange(cb: AuthCallback) {
    authListeners.add(cb);
    // fire current state asynchronously (matches Supabase behaviour)
    queueMicrotask(() => {
      const session: Session = currentUser ? { user: currentUser, access_token: "cookie" } : null;
      cb("INITIAL_SESSION", session);
    });
    return {
      data: {
        subscription: {
          unsubscribe: () => authListeners.delete(cb),
        },
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Query builder (PostgREST-like)
// ---------------------------------------------------------------------------

type Filter = { col: string; op: string; value: any };

class QueryBuilder implements PromiseLike<{ data: any[] & any; error: any; count: number | null }> {
  private mode: "select" | "insert" | "update" | "delete" = "select";
  private filters: Filter[] = [];
  private selectCols = "*";
  private orderBy: { col: string; ascending: boolean } | null = null;
  private limitN: number | null = null;
  private countMode: "exact" | null = null;
  private headOnly = false;
  private singleMode: "single" | "maybeSingle" | null = null;
  private payload: any = null;

  constructor(private table: string) {}

  // ---- terminal ops ---------------------------------------------------
  select(cols = "*", opts?: { count?: "exact"; head?: boolean }) {
    this.selectCols = cols;
    if (opts?.count) this.countMode = opts.count;
    if (opts?.head) this.headOnly = true;
    return this;
  }

  insert(payload: any) {
    this.mode = "insert";
    this.payload = payload;
    return this;
  }

  update(values: any) {
    this.mode = "update";
    this.payload = values;
    return this;
  }

  delete() {
    this.mode = "delete";
    return this;
  }

  // ---- filters --------------------------------------------------------
  eq(col: string, value: any)  { this.filters.push({ col, op: "eq", value }); return this; }
  neq(col: string, value: any) { this.filters.push({ col, op: "neq", value }); return this; }
  ilike(col: string, value: any) { this.filters.push({ col, op: "ilike", value }); return this; }
  like(col: string, value: any)  { this.filters.push({ col, op: "like", value }); return this; }
  gt(col: string, value: any)  { this.filters.push({ col, op: "gt", value }); return this; }
  gte(col: string, value: any) { this.filters.push({ col, op: "gte", value }); return this; }
  lt(col: string, value: any)  { this.filters.push({ col, op: "lt", value }); return this; }
  lte(col: string, value: any) { this.filters.push({ col, op: "lte", value }); return this; }
  is(col: string, value: any)  { this.filters.push({ col, op: "is", value }); return this; }
  in(col: string, value: any[]) { this.filters.push({ col, op: "in", value }); return this; }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy = { col, ascending: opts?.ascending !== false };
    return this;
  }
  limit(n: number) { this.limitN = n; return this; }

  single() { this.singleMode = "single"; return this; }
  maybeSingle() { this.singleMode = "maybeSingle"; return this; }

  // ---- thenable -------------------------------------------------------
  then<TResult1 = { data: any; error: any; count: number | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any; count: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.run().then(onfulfilled as any, onrejected as any) as PromiseLike<TResult1 | TResult2>;
  }

  private async run(): Promise<{ data: any; error: any; count: number | null }> {
    if (this.mode === "select") {
      const body = {
        filters: this.filters,
        select: this.selectCols,
        order: this.orderBy,
        limit: this.limitN,
        count: this.countMode,
        head: this.headOnly,
        single: this.singleMode != null,
      };
      const r = await api<{ data: any; count: number | null }>(
        `/api/db/${this.table}/query`,
        { method: "POST", body: JSON.stringify(body) }
      );
      if (!r.ok) {
        if (this.singleMode === "maybeSingle" && r.status === 406) {
          return { data: null, error: null, count: null };
        }
        return { data: null, error: r.error, count: null };
      }
      let data = r.data?.data;
      if (this.singleMode && data === undefined) data = null;
      return { data: data ?? null, error: null, count: r.data?.count ?? null };
    }
    if (this.mode === "insert") {
      const r = await api<{ data: any[] }>(`/api/db/${this.table}`, {
        method: "POST",
        body: JSON.stringify(this.payload),
      });
      if (!r.ok) return { data: null, error: r.error, count: null };
      const rows = r.data?.data ?? [];
      const data = this.singleMode ? rows[0] ?? null : rows;
      return { data, error: null, count: null };
    }
    if (this.mode === "update") {
      const r = await api<{ data: any[] }>(`/api/db/${this.table}`, {
        method: "PATCH",
        body: JSON.stringify({ filters: this.filters, values: this.payload }),
      });
      if (!r.ok) return { data: null, error: r.error, count: null };
      const rows = r.data?.data ?? [];
      const data = this.singleMode ? rows[0] ?? null : rows;
      return { data, error: null, count: null };
    }
    if (this.mode === "delete") {
      const r = await api<{ data: any[] }>(`/api/db/${this.table}`, {
        method: "DELETE",
        body: JSON.stringify({ filters: this.filters }),
      });
      if (!r.ok) return { data: null, error: r.error, count: null };
      return { data: r.data?.data ?? [], error: null, count: null };
    }
    return { data: null, error: { message: "unknown mode" }, count: null };
  }
}

function from(table: string) {
  return new QueryBuilder(table);
}

// ---------------------------------------------------------------------------
// Realtime (Socket.IO)
// ---------------------------------------------------------------------------

let socket: Socket | null = null;
function ensureSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, { withCredentials: true, path: "/socket.io", autoConnect: true });
  }
  return socket;
}

type ChangeHandler = (payload: any) => void;

class Channel {
  private handlers: Array<{ table: string; filter?: string; cb: ChangeHandler; listener: (p: any) => void }> = [];
  constructor(public name: string) {}

  on(_event: "postgres_changes", opts: { event?: string; schema?: string; table: string; filter?: string }, cb: ChangeHandler) {
    const s = ensureSocket();
    const filterFn = makeFilterFn(opts.filter);
    const listener = (payload: any) => {
      if (opts.event && opts.event !== "*" && payload.eventType?.toLowerCase() !== opts.event.toLowerCase()) return;
      if (!filterFn(payload.new ?? payload.old)) return;
      cb({
        eventType: payload.eventType,
        new: payload.new ?? {},
        old: payload.old ?? {},
        schema: opts.schema ?? "public",
        table: opts.table,
      });
    };
    s.on(`table:${opts.table}`, listener);
    this.handlers.push({ table: opts.table, filter: opts.filter, cb, listener });
    return this;
  }

  subscribe(cb?: (status: string) => void) {
    const s = ensureSocket();
    if (s.connected) cb?.("SUBSCRIBED");
    else s.once("connect", () => cb?.("SUBSCRIBED"));
    return this;
  }

  unsubscribe() {
    const s = ensureSocket();
    for (const h of this.handlers) s.off(`table:${h.table}`, h.listener);
    this.handlers = [];
    return Promise.resolve("ok");
  }
}

function makeFilterFn(filter?: string): (row: any) => boolean {
  // supports "col=eq.value" only — sufficient for current code base
  if (!filter) return () => true;
  const m = filter.match(/^([a-zA-Z0-9_]+)=eq\.(.+)$/);
  if (!m) return () => true;
  const [, col, value] = m;
  return (row) => row && String(row[col]) === String(value);
}

function channel(name: string) {
  return new Channel(name);
}

function removeChannel(c: Channel) {
  return c.unsubscribe();
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const storage = {
  from(_bucket: string) {
    return {
      async upload(_path: string, _file: File, _opts?: any) {
        // The new backend handles uploads via multipart at /api/uploads.
        // Direct callers (src/lib/attachments.ts) have been updated; this
        // method remains for backwards-compat but is a no-op success.
        return { data: { path: _path }, error: null };
      },
      async remove(_paths: string[]) {
        return { data: [], error: null };
      },
      async createSignedUrl(path: string, _expiresIn: number) {
        // Files are served via /api/uploads/:id (Nginx X-Accel-Redirect).
        return { data: { signedUrl: `${API_URL}/api/uploads/${path}` }, error: null };
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Edge Functions → admin endpoints
// ---------------------------------------------------------------------------

const FN_MAP: Record<string, string> = {
  "resolve-username": "/api/admin/resolve-username",
  "admin-create-user": "/api/admin/users",
  "admin-update-user": "/api/admin/users",  // requires id in body
  "admin-create-company": "/api/admin/companies",
  "snapshot-reportes": "/api/admin/snapshot-reportes",
};

const functions = {
  async invoke(name: string, opts?: { body?: any }) {
    const target = FN_MAP[name];
    if (!target) return { data: null, error: { message: `Función desconocida: ${name}` } };

    if (name === "admin-update-user") {
      const body = opts?.body ?? {};
      const { id, ...rest } = body;
      if (!id) return { data: null, error: { message: "id requerido" } };
      const r = await api(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(rest) });
      return { data: r.data, error: r.ok ? null : r.error };
    }

    const r = await api(target, {
      method: "POST",
      body: JSON.stringify(opts?.body ?? {}),
    });
    return { data: r.data, error: r.ok ? null : r.error };
  },
};

// ---------------------------------------------------------------------------
// RPC
// ---------------------------------------------------------------------------

async function rpc(fn: string, args: any = {}) {
  const r = await api(`/api/rpc/${fn}`, {
    method: "POST",
    body: JSON.stringify(args ?? {}),
  });
  return { data: r.ok ? (r.data as any)?.data : null, error: r.ok ? null : r.error };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const supabase: any = {
  auth,
  from,
  channel,
  removeChannel,
  storage,
  functions,
  rpc,
};

// Best-effort: hydrate session on first import so consumers see the user
// without an additional round-trip flag.
if (typeof window !== "undefined") {
  void refreshMe();
}
