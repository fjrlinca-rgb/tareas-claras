import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("¡Bienvenido de vuelta!");
    navigate("/");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Cuenta creada, ya puedes empezar.");
    navigate("/");
  };

  return (
    <main className="min-h-screen bg-gradient-hero flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow-soft">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Tareas Diarias</h1>
          <p className="text-muted-foreground text-sm">Organiza tu día con calma y claridad.</p>
        </div>

        <Card className="p-6 shadow-soft border-border/60">
          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 mb-6 w-full">
              <TabsTrigger value="signin">Iniciar sesión</TabsTrigger>
              <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email2">Correo</Label>
                  <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password2">Contraseña</Label>
                  <Input id="password2" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creando..." : "Crear cuenta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </main>
  );
};

export default Auth;
