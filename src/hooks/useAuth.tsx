import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

// Minimal session/user types compatible with previous Supabase shape.
type User = { id: string; email: string; user_metadata?: Record<string, any> };
type Session = { user: User; access_token: string };

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ user: null, session: null, loading: true, signOut: async () => {} });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession((s as Session) ?? null);
      setUser((s as Session)?.user ?? null);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession((session as Session) ?? null);
      setUser((session as Session)?.user ?? null);
      setLoading(false);
    });
    return () => { subscription.unsubscribe(); };
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); };

  return <Ctx.Provider value={{ user, session, loading, signOut }}>{children}</Ctx.Provider>;
};

export const useAuth = () => useContext(Ctx);
