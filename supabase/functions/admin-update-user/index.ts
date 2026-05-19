// Supervisor-only: edit user fields/role/active; or delete user.
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
    const action: "update" | "delete" = body.action ?? "update";
    const target_id: string = body.user_id;
    if (!target_id) return json({ error: "user_id requerido" }, 400);

    if (action === "delete") {
      if (target_id === user.id) return json({ error: "No puedes eliminarte" }, 400);
      const { error } = await admin.auth.admin.deleteUser(target_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    const updates: Record<string, unknown> = {};
    if (body.full_name !== undefined) updates.full_name = body.full_name || null;
    if (body.username !== undefined) {
      const u = (body.username || "").trim() || null;
      if (u) {
        const { data: dup } = await admin.from("profiles").select("id").ilike("username", u).neq("id", target_id).maybeSingle();
        if (dup) return json({ error: "El usuario ya está en uso" }, 400);
      }
      updates.username = u;
    }
    if (body.company_id !== undefined) updates.company_id = body.company_id || null;
    if (body.active !== undefined) updates.active = !!body.active;

    if (Object.keys(updates).length) {
      const { error } = await admin.from("profiles").update(updates).eq("id", target_id);
      if (error) return json({ error: error.message }, 400);
    }

    if (body.email) {
      const { error } = await admin.auth.admin.updateUserById(target_id, { email: body.email });
      if (error) return json({ error: error.message }, 400);
      await admin.from("profiles").update({ email: body.email }).eq("id", target_id);
    }
    if (body.password) {
      if (String(body.password).length < 8) return json({ error: "Mínimo 8 caracteres" }, 400);
      const { error } = await admin.auth.admin.updateUserById(target_id, { password: body.password });
      if (error) return json({ error: error.message }, 400);
    }

    if (body.role) {
      const role: Role = body.role;
      if (!["cliente", "tecnico", "supervisor"].includes(role)) return json({ error: "Rol inválido" }, 400);
      await admin.from("user_roles").delete().eq("user_id", target_id);
      await admin.from("user_roles").insert({ user_id: target_id, role });
    }

    if (body.active === false) {
      await admin.auth.admin.updateUserById(target_id, { ban_duration: "876000h" });
    } else if (body.active === true) {
      await admin.auth.admin.updateUserById(target_id, { ban_duration: "none" });
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
