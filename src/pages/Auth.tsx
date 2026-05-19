import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Headset, ShieldCheck, Lock, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
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

  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Brand panel */}
      <aside className="hidden lg:flex flex-col justify-between p-12 bg-sidebar text-sidebar-foreground relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="relative flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center shadow-lg">
            <Headset className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-base text-white tracking-tight">HelpDesk</p>
            <p className="text-xs text-sidebar-foreground/60">NetExpert</p>
          </div>
        </div>
        <div className="relative space-y-5 max-w-md">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-sidebar-foreground/70 bg-white/5 border border-white/10 rounded-full px-3 py-1">
            <ShieldCheck className="h-3.5 w-3.5" /> Plataforma corporativa
          </div>
          <h2 className="text-4xl font-semibold leading-tight text-white">
            Mesa de ayuda empresarial.<br />
            <span className="text-sidebar-foreground/70">Soporte controlado y trazable.</span>
          </h2>
          <p className="text-sidebar-foreground/70 text-sm leading-relaxed">
            Acceso restringido al personal autorizado por el supervisor. Las cuentas de empresa, técnicos y
            supervisores se administran internamente.
          </p>
        </div>
        <p className="relative text-xs text-sidebar-foreground/50">© NetExpert · Sistema interno</p>
      </aside>

      {/* Form */}
      <section className="flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground grid place-items-center">
              <Headset className="h-5 w-5" />
            </div>
            <p className="font-semibold">HelpDesk NetExpert</p>
          </div>

          <Card className="p-8 shadow-soft border-border/60">
            <div className="text-center mb-7">
              <h1 className="text-2xl font-semibold tracking-tight">Acceder al sistema</h1>
              <p className="text-sm text-muted-foreground mt-1.5">Ingresa tus credenciales para continuar.</p>
            </div>

            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Correo</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@empresa.com" className="pl-9" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" />
                </div>
              </div>
              <Button type="submit" className="w-full h-11 mt-2" disabled={loading}>
                {loading ? "Entrando..." : "Iniciar sesión"}
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-border/60">
              <p className="text-xs text-center text-muted-foreground leading-relaxed">
                El registro público está deshabilitado. Solicita una cuenta a tu <strong className="text-foreground">supervisor</strong>.
              </p>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
};

export default Auth;
