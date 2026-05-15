import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Dashboard from "./Dashboard";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  if (loading || !user) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Cargando...</div>;
  }
  return <Dashboard />;
};

export default Index;
