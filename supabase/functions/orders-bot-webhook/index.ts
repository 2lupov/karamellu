// Webhook for the dedicated "Orders" Telegram bot.
// Handles callback queries from the inline buttons sent by orders-bot-notify.
// Buttons: ord_accept_<id>, ord_shipped_<id>, ord_cancel_<id>.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("ORDERS_BOT_TOKEN") || "";

const STATUS_MAP: Record<string, { status: string; label: string }> = {
  accept:  { status: "confirmed", label: "✅ Прийнято" },
  shipped: { status: "shipped",   label: "📦 Відправлено" },
  cancel:  { status: "cancelled", label: "❌ Скасовано" },
};

async function tg(method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error(`Telegram ${method} failed:`, res.status, t);
  }
  return res;
}

Deno.serve(async (req) => {
  // One-off helper to register the webhook with Telegram.
  // GET ?setup=1 → calls setWebhook pointing back at this function.
  const url = new URL(req.url);
  if (req.method === "GET" && url.searchParams.get("setup") === "1") {
    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/orders-bot-webhook`;
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ["callback_query", "message"] }),
    });
    return new Response(await r.text(), { status: r.status });
  }
  if (req.method !== "POST") return new Response("ok");

  try {
    if (!BOT_TOKEN) {
      console.error("ORDERS_BOT_TOKEN not set");
      return new Response("ok");
    }

    const update = await req.json().catch(() => ({}));

    // Handle plain messages (e.g. /start) — useful to get chat_id for ORDERS_BOT_CHAT_ID.
    const msg = update.message;
    if (msg?.chat?.id) {
      const chatId = msg.chat.id;
      const text: string = msg.text || "";
      if (text.startsWith("/start") || text.startsWith("/id") || text.startsWith("/chatid")) {
        const lines = [
          "👋 <b>Karamellu — бот замовлень</b>",
          "",
          "Сюди приходять сповіщення про нові замовлення з сайту з кнопками керування статусом.",
          "",
          `🆔 <b>Chat ID:</b> <code>${chatId}</code>`,
          "",
          "<i>Скопіюйте цей ID і вставте у секрет ORDERS_BOT_CHAT_ID, щоб саме сюди приходили замовлення.</i>",
        ];
        await tg("sendMessage", {
          chat_id: chatId,
          text: lines.join("\n"),
          parse_mode: "HTML",
        });
      }
      return new Response("ok");
    }

    const cq = update.callback_query;
    if (!cq) return new Response("ok");

    const data: string = cq.data || "";
    const match = data.match(/^ord_(accept|shipped|cancel)_(.+)$/);
    if (!match) {
      await tg("answerCallbackQuery", { callback_query_id: cq.id, text: "Невідома дія" });
      return new Response("ok");
    }
    const action = match[1] as keyof typeof STATUS_MAP;
    const orderId = match[2];
    const target = STATUS_MAP[action];

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: order, error } = await supabase
      .from("orders")
      .update({ status: target.status })
      .eq("id", orderId)
      .select("order_number, status")
      .maybeSingle();

    if (error || !order) {
      console.error("update order failed:", error);
      await tg("answerCallbackQuery", {
        callback_query_id: cq.id,
        text: "Не вдалося оновити замовлення",
        show_alert: true,
      });
      return new Response("ok");
    }

    const who = cq.from?.username
      ? `@${cq.from.username}`
      : [cq.from?.first_name, cq.from?.last_name].filter(Boolean).join(" ") || "адмін";
    const stamp = new Date().toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" });

    // Append status line to the original message
    const orig = cq.message?.text || cq.message?.caption || `Замовлення №${order.order_number}`;
    const newText = `${orig}\n\n— — —\n${target.label} • ${who} • ${stamp}`;

    if (cq.message?.message_id && cq.message?.chat?.id) {
      await tg("editMessageText", {
        chat_id: cq.message.chat.id,
        message_id: cq.message.message_id,
        text: newText,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: [] }, // clear buttons
      });
    }

    await tg("answerCallbackQuery", {
      callback_query_id: cq.id,
      text: target.label,
    });

    return new Response("ok");
  } catch (e) {
    console.error("orders-bot-webhook error:", e);
    return new Response("ok"); // always 200
  }
});
