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

    // Check if the auth user actually exists. If not, this is an orphan profile.
    const { data: authCheck } = await admin.auth.admin.getUserById(target_id);
    const authExists = !!authCheck?.user;

    if (action === "delete") {
      if (target_id === user.id) return json({ error: "No puedes eliminarte" }, 400);
      if (!authExists) {
        // Orphan: clean profile + roles directly.
        await admin.from("user_roles").delete().eq("user_id", target_id);
        await admin.from("profiles").delete().eq("id", target_id);
        return json({ ok: true, cleaned_orphan: true });
      }
      const { error } = await admin.auth.admin.deleteUser(target_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // === UPDATE path ===
    if (!authExists) {
      // Orphan profile: cannot update auth.users. Clean up so supervisor can recreate the user.
      await admin.from("user_roles").delete().eq("user_id", target_id);
      await admin.from("profiles").delete().eq("id", target_id);
      return json({
        error: "Este usuario ya no existe en autenticación. Se limpió el perfil huérfano; por favor vuelve a crearlo.",
        orphan_cleaned: true,
      }, 409);
    }

    const updates: Record<string, unknown> = {};
    if (body.full_name !== undefined) updates.full_name = body.full_name || null;
    if (body.username !== undefined) {
      const u = (body.username || "").trim() || null;
      if (u) {
        const { data: dup } = await admin.from("profiles").select("id").ilike("username", u).neq("id", target_id).maybeSingle();
        if (dup) {
          // Verify the conflicting profile is not itself an orphan.
          const { data: dupAuth } = await admin.auth.admin.getUserById(dup.id);
          if (dupAuth?.user) {
            return json({ error: "El nombre de usuario ya está en uso" }, 400);
          }
          await admin.from("user_roles").delete().eq("user_id", dup.id);
          await admin.from("profiles").delete().eq("id", dup.id);
        }
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
      const newEmail = String(body.email).trim().toLowerCase();
      // Duplicate email check across auth users (paginated, capped).
      try {
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const conflict = (list?.users ?? []).find(
          (u: any) => u.id !== target_id && (u.email ?? "").toLowerCase() === newEmail
        );
        if (conflict) return json({ error: "El correo ya está en uso" }, 400);
      } catch (_) { /* non-fatal */ }

      const { error } = await admin.auth.admin.updateUserById(target_id, { email: newEmail });
      if (error) return json({ error: error.message }, 400);
      await admin.from("profiles").update({ email: newEmail }).eq("id", target_id);
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
