// Supervisor-only: create a new user with email/password, assign role, link company.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Role = "cliente" | "tecnico" | "supervisor";
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "No autenticado" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: isSup } = await admin.rpc("has_role", { _user_id: user.id, _role: "supervisor" });
    if (!isSup) return json({ error: "Solo supervisores" }, 403);

    const body = await req.json();
    const email: string = (body.email ?? "").trim().toLowerCase();
    const password: string = body.password ?? "";
    const role: Role = body.role ?? "cliente";
    const full_name: string | undefined = body.full_name?.trim() || undefined;
    const username: string | undefined = body.username?.trim() || undefined;
    const company_id: string | null = body.company_id || null;
    const active: boolean = body.active !== false;

    if (!email || !password) return json({ error: "Email y contraseña son obligatorios" }, 400);
    if (password.length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres" }, 400);
    if (!["cliente", "tecnico", "supervisor"].includes(role)) return json({ error: "Rol inválido" }, 400);

    if (username) {
      const { data: dup } = await admin.from("profiles").select("id").ilike("username", username).maybeSingle();
      if (dup) {
        // Check if the auth user still exists; if it's an orphan profile, clean it up.
        const { data: existsUser } = await admin.auth.admin.getUserById(dup.id);
        if (existsUser?.user) {
          return json({ error: "El usuario ya está en uso" }, 400);
        }
        await admin.from("user_roles").delete().eq("user_id", dup.id);
        await admin.from("profiles").delete().eq("id", dup.id);
      }
    }

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name, username, company_id },
    });
    if (cErr || !created.user) return json({ error: cErr?.message ?? "No se pudo crear" }, 400);

    const newId = created.user.id;
    await admin.from("user_roles").delete().eq("user_id", newId);
    await admin.from("user_roles").insert({ user_id: newId, role });
    await admin.from("profiles").update({ full_name, username, company_id, active }).eq("id", newId);

    if (role === "tecnico") {
      const { data: existing } = await admin.from("technicians").select("id").eq("email", email).maybeSingle();
      if (!existing) {
        await admin.from("technicians").insert({
          email, name: full_name ?? email.split("@")[0], active: true, created_by: user.id,
        });
      }
    }

    return json({ ok: true, user_id: newId });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
