import { useAuth } from "./useAuth";

export type AppRole = "cliente" | "supervisor" | "tecnico";

/**
 * Source of truth for the current user's role: the JWT/session payload
 * returned by `/api/auth/me` (exposed through useAuth as
 * `user.user_metadata.rol`). No backend round-trip needed.
 */
export function useUserRole() {
  const { user, loading: authLoading } = useAuth();

  const rawRole = (user?.user_metadata?.rol ?? "") as string;
  const primary: AppRole =
    rawRole === "supervisor" || rawRole === "tecnico" || rawRole === "cliente"
      ? (rawRole as AppRole)
      : "cliente";
  const roles: AppRole[] = user ? [primary] : [];

  return {
    roles,
    primary,
    isSupervisor: primary === "supervisor",
    isTecnico: primary === "tecnico",
    isCliente: primary === "cliente",
    loading: authLoading,
  };
}
