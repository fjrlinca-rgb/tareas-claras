import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { login as apiLogin, logout as apiLogout, me as apiMe, type ApiUser } from "@/lib/api";

// Mantiene la misma forma de `user` usada por el resto del frontend
// (id + email + user_metadata) para no romper componentes existentes.
type User = {
  id: string;
  email: string;
  user_metadata?: Record<string, any>;
};
type Session = { user: User; access_token: string };

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (usuario: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  signIn: async () => ({ error: "not-ready" }),
  signOut: async () => {},
  refresh: async () => {},
});

function toUser(u: ApiUser | null | undefined): User | null {
  if (!u) return null;
  return {
    id: u.id,
    email: u.correo ?? "",
    user_metadata: { full_name: u.nombre, username: u.usuario, rol: u.rol },
  };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const r = await apiMe();
    setUser(r.ok ? toUser(r.data?.user) : null);
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const signIn: AuthCtx["signIn"] = async (usuario, password) => {
    const r = await apiLogin(usuario, password);
    if (!r.ok) {
      return { error: r.error?.error ?? r.error?.message ?? "Credenciales inválidas" };
    }
    setUser(toUser(r.data?.user));
    return { error: null };
  };

  const signOut = async () => {
    await apiLogout();
    setUser(null);
  };

  const session: Session | null = user ? { user, access_token: "cookie" } : null;

  return (
    <Ctx.Provider value={{ user, session, loading, signIn, signOut, refresh }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);
