import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { login as apiLogin, logout as apiLogout, me as apiMe, type ApiUser } from "@/lib/api";

export type User = {
  id: string;
  email: string;
  user_metadata?: Record<string, any>;
};

export type Session = { user: User; access_token: string } | null;

interface AuthCtx {
  user: User | null;
  session: Session;
  loading: boolean;
  signIn: (usuario: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  signIn: async () => ({ error: "not-ready" }),
  signOut: async () => {},
  refreshUser: async () => {},
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

  const refreshUser = useCallback(async () => {
    const r = await apiMe();
    setUser(r.ok ? toUser(r.data?.user) : null);
  }, []);

  useEffect(() => {
    (async () => {
      await refreshUser();
      setLoading(false);
    })();
  }, [refreshUser]);

  const signIn: AuthCtx["signIn"] = async (usuario, password) => {
    const r = await apiLogin(usuario, password);
    if (!r.ok) {
      return { error: r.error?.error ?? r.error?.message ?? "Credenciales inválidas" };
    }
    const next = toUser(r.data?.user);
    if (next) {
      setUser(next);
    } else {
      // Fallback: confirm session via /me if login response shape is unexpected
      const me = await apiMe();
      setUser(me.ok ? toUser(me.data?.user) : null);
    }
    return { error: null };
  };

  const signOut = async () => {
    await apiLogout();
    setUser(null);
  };

  const session: Session = user ? { user, access_token: "cookie" } : null;

  return (
    <Ctx.Provider value={{ user, session, loading, signIn, signOut, refreshUser }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);
