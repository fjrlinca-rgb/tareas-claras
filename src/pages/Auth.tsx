import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Headset, Lock, User, Eye, EyeOff, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[hsl(222_45%_5%)] text-foreground px-4">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.18] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(hsl(195 90% 55% / 0.35) 1px, transparent 1px), linear-gradient(90deg, hsl(195 90% 55% / 0.35) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
        }}
      />
      {/* Glow blobs */}
      <div className="absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full bg-[hsl(215_90%_45%)] opacity-30 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 h-[420px] w-[420px] rounded-full bg-[hsl(190_95%_45%)] opacity-25 blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-[hsl(210_90%_30%)] opacity-10 blur-[160px] pointer-events-none" />

      {/* Scanline */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, white 0 1px, transparent 1px 3px)" }} />

      {/* Top status bar */}
      <div className="absolute top-5 left-5 right-5 flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-cyan-300/60 font-mono z-10">
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          NOC · ONLINE
        </span>
        <span className="hidden sm:flex items-center gap-2">
          <Activity className="h-3 w-3" /> SECURE CHANNEL · TLS 1.3
        </span>
      </div>

      {/* Card */}
      <div className="relative w-full max-w-md animate-fade-in z-10">
        {/* Glow ring */}
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-cyan-400/40 via-blue-500/20 to-transparent blur-sm" />

        <div className="relative rounded-2xl border border-cyan-400/20 bg-[hsl(222_40%_8%/0.75)] backdrop-blur-2xl shadow-[0_30px_80px_-20px_hsl(195_90%_40%/0.35)] p-8 sm:p-10">
          {/* Logo + tagline */}
          <div className="flex flex-col items-center text-center">
            <p className="text-[10px] font-mono uppercase tracking-[0.5em] text-cyan-300/70 mb-3">Siempre contigo</p>
            <div className="relative mb-5">
              <div className="absolute inset-0 rounded-2xl bg-cyan-400/30 blur-xl" />
              <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 grid place-items-center shadow-lg shadow-cyan-500/40">
                <Headset className="h-7 w-7 text-white" />
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-[0.18em] bg-gradient-to-r from-cyan-200 via-white to-cyan-200 bg-clip-text text-transparent">
              HELPDESK NETEXPERT
            </h1>
            <div className="mt-2 h-px w-24 bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
            <p className="mt-4 text-sm text-slate-400">Ingresa con tu usuario y contraseña</p>
          </div>

          <form onSubmit={handleSignIn} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[10px] font-mono uppercase tracking-[0.25em] text-cyan-300/70">
                Usuario
              </Label>
              <div className="relative group">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-300/60 group-focus-within:text-cyan-300 transition-colors" />
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@empresa.com"
                  className="pl-10 h-12 bg-[hsl(222_40%_10%/0.7)] border-cyan-400/20 text-slate-100 placeholder:text-slate-500 focus-visible:border-cyan-400/70 focus-visible:ring-cyan-400/30"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[10px] font-mono uppercase tracking-[0.25em] text-cyan-300/70">
                Contraseña
              </Label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-300/60 group-focus-within:text-cyan-300 transition-colors" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 pr-11 h-12 bg-[hsl(222_40%_10%/0.7)] border-cyan-400/20 text-slate-100 placeholder:text-slate-500 focus-visible:border-cyan-400/70 focus-visible:ring-cyan-400/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-300/60 hover:text-cyan-200 transition-colors"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="relative w-full h-12 font-semibold tracking-[0.2em] uppercase text-sm bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500 hover:from-cyan-400 hover:via-blue-400 hover:to-cyan-400 text-white shadow-lg shadow-cyan-500/30 border border-cyan-300/30 transition-all"
            >
              {loading ? "Verificando..." : "Ingresar"}
            </Button>
          </form>

          <div className="mt-7 pt-5 border-t border-cyan-400/10">
            <p className="text-[11px] text-center text-slate-500 leading-relaxed font-mono">
              Acceso restringido · Las cuentas son administradas por el <span className="text-cyan-300/80">supervisor</span>.
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-[10px] uppercase tracking-[0.35em] text-slate-500 font-mono">
          © NetExpert · Security Operations
        </p>
      </div>
    </main>
  );
};

export default Auth;
