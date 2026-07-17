// Sends a new-order notification through the dedicated "Orders" Telegram bot.
// Uses ORDERS_BOT_TOKEN and ORDERS_BOT_CHAT_ID secrets (separate from the main
// catalog/admin bot).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BOT_TOKEN = Deno.env.get("ORDERS_BOT_TOKEN") || "";
const CHAT_ID = Deno.env.get("ORDERS_BOT_CHAT_ID") || "";

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!BOT_TOKEN || !CHAT_ID) {
      console.warn("orders-bot-notify: ORDERS_BOT_TOKEN or ORDERS_BOT_CHAT_ID not set");
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const o = await req.json();
    const {
      orderId,
      orderNumber,
      firstName,
      lastName,
      phone,
      deliveryMethod,
      deliveryLabel,
      deliveryAddress,
      paymentMethod,
      paymentLabel,
      total,
      items = [],
      notes,
    } = o;

    const lines: string[] = [];
    lines.push(`🛒 <b>Нове замовлення №${esc(orderNumber)}</b>`);
    lines.push("");
    lines.push(`👤 ${esc(firstName)} ${esc(lastName)}`);
    lines.push(`📞 <code>${esc(phone)}</code>`);
    lines.push("");
    lines.push(`🚚 <b>${esc(deliveryLabel || deliveryMethod)}</b>`);
    if (deliveryAddress) lines.push(`📍 ${esc(deliveryAddress)}`);
    lines.push("");
    lines.push(`💳 <b>${esc(paymentLabel || paymentMethod)}</b>`);
    lines.push("");
    lines.push(`<b>Склад:</b>`);
    for (const it of items) {
      lines.push(`• ${esc(it.name)} × ${esc(it.quantity)} — ₴${esc(it.price * it.quantity)}`);
    }
    lines.push("");
    lines.push(`<b>Разом: ₴${esc(total)}</b>`);
    if (notes) {
      lines.push("");
      lines.push(`💬 <i>${esc(notes)}</i>`);
    }

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: lines.join("\n"),
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Прийняти", callback_data: `ord_accept_${orderId}` },
              { text: "📦 Відправлено", callback_data: `ord_shipped_${orderId}` },
            ],
            [{ text: "❌ Скасувати", callback_data: `ord_cancel_${orderId}` }],
          ],
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("Telegram error:", data);
      return new Response(JSON.stringify({ error: data }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("orders-bot-notify error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
