// Supervisor-only: create a new user with email/password and assign role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Role = "cliente" | "tecnico" | "supervisor";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) {
      return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: isSup } = await admin.rpc("has_role", { _user_id: user.id, _role: "supervisor" });
    if (!isSup) {
      return new Response(JSON.stringify({ error: "Solo supervisores pueden crear usuarios" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const email: string = (body.email ?? "").trim().toLowerCase();
    const password: string = body.password ?? "";
    const role: Role = body.role ?? "cliente";
    const company: string | undefined = body.company?.trim() || undefined;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email y contraseña son obligatorios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!["cliente", "tecnico", "supervisor"].includes(role)) {
      return new Response(JSON.stringify({ error: "Rol inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: company ? { company } : {},
    });
    if (cErr || !created.user) {
      return new Response(JSON.stringify({ error: cErr?.message ?? "No se pudo crear el usuario" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const newId = created.user.id;
    // Replace default 'cliente' role with selected role
    await admin.from("user_roles").delete().eq("user_id", newId);
    await admin.from("user_roles").insert({ user_id: newId, role });

    // If tecnico, also register into technicians directory
    if (role === "tecnico") {
      await admin.from("technicians").upsert(
        { email, name: company ?? email.split("@")[0], active: true, created_by: user.id },
        { onConflict: "email" },
      );
    }

    return new Response(JSON.stringify({ ok: true, user_id: newId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
