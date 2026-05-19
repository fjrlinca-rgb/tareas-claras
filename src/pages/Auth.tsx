import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Headset } from "lucide-react";
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
    toast.success("Bienvenido a HelpDesk NetExpert");
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
    toast.success("Cuenta creada correctamente");
    navigate("/");
  };

  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="hidden lg:flex flex-col justify-between p-10 bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center">
            <Headset className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-base text-white">HelpDesk</p>
            <p className="text-xs text-sidebar-foreground/60">NetExpert</p>
          </div>
        </div>
        <div className="space-y-4 max-w-md">
          <h2 className="text-3xl font-semibold leading-tight text-white">
            Mesa de ayuda profesional para soporte técnico.
          </h2>
          <p className="text-sidebar-foreground/70 text-sm leading-relaxed">
            Centraliza tickets, asigna técnicos, prioriza incidentes críticos y mantén control total
            sobre el flujo de soporte de tu organización.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">© NetExpert · Plataforma empresarial</p>
      </aside>

      {/* Form */}
      <section className="flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground grid place-items-center">
              <Headset className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">HelpDesk NetExpert</p>
            </div>
          </div>

          <Card className="p-6 shadow-soft">
            <h1 className="text-xl font-semibold mb-1">Acceder al sistema</h1>
            <p className="text-sm text-muted-foreground mb-6">Ingresa tus credenciales para continuar.</p>
            <Tabs defaultValue="signin">
              <TabsList className="grid grid-cols-2 mb-6 w-full">
                <TabsTrigger value="signin">Iniciar sesión</TabsTrigger>
                <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Correo</Label>
                    <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@empresa.com" />
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
                <div className="mb-4 rounded-md border border-primary/20 bg-primary-soft text-accent-foreground px-3 py-2 text-xs leading-relaxed">
                  Las cuentas de <strong>técnico</strong> y <strong>supervisor</strong> son administradas internamente.
                </div>
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email2">Correo</Label>
                    <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@empresa.com" />
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
      </section>
    </main>
  );
};

export default Auth;
