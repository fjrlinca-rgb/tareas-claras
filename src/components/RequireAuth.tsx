import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Cargando...</div>;
  }
  return <>{children}</>;
};
