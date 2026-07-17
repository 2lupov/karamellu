import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_TOKEN = Deno.env.get("BG_REMOVE_ADMIN_TOKEN")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.headers.get("x-admin-token") !== ADMIN_TOKEN) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as {
      product_id: string;
      field: "image" | "image_hover";
      path: string;
      base64: string;
    };

    if (!body.product_id || !body.path || !body.base64 || !["image", "image_hover"].includes(body.field)) {
      return new Response(JSON.stringify({ error: "bad request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bin = Uint8Array.from(atob(body.base64), (c) => c.charCodeAt(0));
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { error: upErr } = await supabase.storage
      .from("product-images")
      .upload(body.path, bin, { contentType: "image/png", upsert: true });
    if (upErr) throw upErr;

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/product-images/${body.path}`;

    const { error: dbErr } = await supabase
      .from("products")
      .update({ [body.field]: publicUrl })
      .eq("id", body.product_id);
    if (dbErr) throw dbErr;

    return new Response(JSON.stringify({ ok: true, url: publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
