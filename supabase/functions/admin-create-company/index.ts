// Supervisor-only: create company + user with rol=cliente (empresa) and link.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
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
    const name: string = (body.name ?? "").trim();
    const contact: string | null = body.contact?.trim() || null;
    const email: string = (body.email ?? "").trim().toLowerCase();
    const username: string | null = body.username?.trim() || null;
    const password: string = body.password ?? "";
    const active: boolean = body.active !== false;

    if (!name) return json({ error: "Nombre de empresa requerido" }, 400);
    if (!email || !password) return json({ error: "Correo y contraseña requeridos" }, 400);
    if (password.length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres" }, 400);

    if (username) {
      const { data: dup } = await admin.from("profiles").select("id").ilike("username", username).maybeSingle();
      if (dup) return json({ error: "El usuario ya está en uso" }, 400);
    }

    const { data: company, error: coErr } = await admin.from("companies").insert({
      name, contact, email, active, created_by: user.id,
    }).select().single();
    if (coErr || !company) return json({ error: coErr?.message ?? "No se pudo crear empresa" }, 400);

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: name, username, company_id: company.id },
    });
    if (cErr || !created.user) {
      await admin.from("companies").delete().eq("id", company.id);
      return json({ error: cErr?.message ?? "No se pudo crear usuario" }, 400);
    }

    const newId = created.user.id;
    await admin.from("user_roles").delete().eq("user_id", newId);
    await admin.from("user_roles").insert({ user_id: newId, role: "cliente" });
    await admin.from("profiles").update({
      full_name: name, username, company_id: company.id, active,
    }).eq("id", newId);

    if (!active) await admin.auth.admin.updateUserById(newId, { ban_duration: "876000h" });

    return json({ ok: true, company_id: company.id, user_id: newId });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
