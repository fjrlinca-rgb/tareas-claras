/**
 * Cliente HTTP del frontend hacia la API Node.js (Express).
 * Todas las peticiones incluyen credentials: "include" para que el navegador
 * envíe/reciba la cookie HttpOnly `hd_session` emitida por el backend.
 */
export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: { message?: string; error?: string } | null;
}

export async function apiFetch<T = any>(
  path: string,
  init: RequestInit = {}
): Promise<ApiResult<T>> {
  try {
    const isForm = init.body instanceof FormData;
    const res = await fetch(`${API_URL}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        ...(init.body && !isForm ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
    const isJson = res.headers.get("content-type")?.includes("application/json");
    const body = isJson ? await res.json() : null;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data: null,
        error: body ?? { message: res.statusText },
      };
    }
    return { ok: true, status: res.status, data: body as T, error: null };
  } catch (e: any) {
    return { ok: false, status: 0, data: null, error: { message: e?.message ?? "network error" } };
  }
}

// -------------------- Auth helpers --------------------

export interface ApiUser {
  id: string;
  usuario: string;
  nombre: string;
  correo: string;
  rol: string;
}

export async function login(usuario: string, password: string) {
  return apiFetch<{ user: ApiUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ usuario, password }),
  });
}

export async function logout() {
  return apiFetch("/api/auth/logout", { method: "POST" });
}

export async function me() {
  return apiFetch<{ user: ApiUser }>("/api/auth/me", { method: "GET" });
}
