import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORDERS_BOT_TOKEN = Deno.env.get("ORDERS_BOT_TOKEN");
const ORDERS_BOT_CHAT_ID = Deno.env.get("ORDERS_BOT_CHAT_ID");

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("uk-UA", {
    timeZone: "Europe/Kyiv",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

async function notifyAdmin(text: string) {
  if (!ORDERS_BOT_TOKEN || !ORDERS_BOT_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${ORDERS_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: ORDERS_BOT_CHAT_ID, text, parse_mode: "HTML" }),
    });
  } catch (e) {
    console.error("TG notify failed", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { service_id, master_id, scheduled_at, client_name, client_phone, price_variant_label } = body;

    if (!service_id || !master_id || !scheduled_at || !client_name || !client_phone) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const name = String(client_name).trim().slice(0, 100);
    const phone = String(client_phone).trim().slice(0, 30);
    if (name.length < 2) {
      return new Response(JSON.stringify({ error: "Невірне ім'я" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^\+?\d[\d\s\-()]{8,}$/.test(phone)) {
      return new Response(JSON.stringify({ error: "Невірний телефон" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // load service + master
    const { data: service, error: sErr } = await supabase.from("services")
      .select("id,name,duration_minutes,price_variants,category_id").eq("id", service_id).maybeSingle();
    if (sErr || !service) {
      return new Response(JSON.stringify({ error: "Послугу не знайдено" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: master, error: mErr } = await supabase.from("masters")
      .select("id,name,specialties").eq("id", master_id).maybeSingle();
    if (mErr || !master) {
      return new Response(JSON.stringify({ error: "Майстра не знайдено" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // find price
    let price: number | null = null;
    const variants = (service.price_variants as Array<{ label: string | null; price: number }>) || [];
    if (variants.length) {
      const match = variants.find((v) => (v.label || null) === (price_variant_label || null));
      price = (match ?? variants[0]).price;
    }

    const start = new Date(scheduled_at);
    const end = new Date(start.getTime() + service.duration_minutes * 60000);

    // Conflict check
    const { data: conflicts } = await supabase.from("bookings")
      .select("id,scheduled_at,duration_minutes")
      .eq("master_id", master_id)
      .in("status", ["pending", "confirmed"])
      .gte("scheduled_at", new Date(start.getTime() - 8 * 3600000).toISOString())
      .lte("scheduled_at", new Date(start.getTime() + 8 * 3600000).toISOString());

    const overlap = (conflicts || []).some((b: any) => {
      const bs = new Date(b.scheduled_at).getTime();
      const be = bs + b.duration_minutes * 60000;
      return bs < end.getTime() && be > start.getTime();
    });
    if (overlap) {
      return new Response(JSON.stringify({ error: "Цей час уже зайнятий, оберіть інший" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: booking, error: bErr } = await supabase.from("bookings").insert({
      service_id, master_id,
      client_name: name, client_phone: phone,
      scheduled_at: start.toISOString(),
      duration_minutes: service.duration_minutes,
      price_variant_label: price_variant_label || null,
      price,
      status: "pending",
    }).select().single();

    if (bErr) {
      return new Response(JSON.stringify({ error: bErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const variantStr = price_variant_label ? ` (${price_variant_label})` : "";
    const priceStr = price ? `\n💰 <b>Ціна:</b> ${price} грн` : "";
    await notifyAdmin(
      `🆕 <b>Новий запис на процедуру</b>\n\n` +
      `👤 <b>Клієнт:</b> ${name}\n` +
      `📞 <b>Телефон:</b> ${phone}\n` +
      `💅 <b>Послуга:</b> ${service.name}${variantStr}${priceStr}\n` +
      `👩‍🎨 <b>Майстер:</b> ${master.name}\n` +
      `📅 <b>Дата:</b> ${fmtDate(start.toISOString())}\n` +
      `⏱ <b>Тривалість:</b> ${service.duration_minutes} хв`
    );

    return new Response(JSON.stringify({ ok: true, booking }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
