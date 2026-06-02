// Public: resolve a username to its associated email for login.
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
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE);

    const body = await req.json().catch(() => ({}));
    const identifier: string = (body.username ?? "").trim();
    if (!identifier) return json({ error: "Usuario requerido" }, 400);

    // Allow passing email directly as a fallback (still works).
    if (identifier.includes("@")) {
      return json({ email: identifier.toLowerCase() });
    }

    const { data, error } = await admin
      .from("profiles")
      .select("email, active")
      .ilike("username", identifier)
      .maybeSingle();

    if (error) return json({ error: error.message }, 400);
    if (!data?.email) return json({ error: "Usuario no encontrado" }, 404);
    if (data.active === false) return json({ error: "Usuario inactivo" }, 403);

    return json({ email: data.email });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
