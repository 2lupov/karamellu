import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DELIVERY_LABELS: Record<string, string> = {
  nova_poshta: 'Нова Пошта',
  ukrposhta: 'Укрпошта',
  courier: "Кур'єр (Київ)",
  pickup: 'Самовивіз',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
    if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN not configured')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { orderId, orderNumber, firstName, lastName, email, phone, city, address, deliveryMethod, total, items } = await req.json()

    // Get admin chat IDs from site_settings
    const { data: setting } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'telegram_admin_chat_ids')
      .single()

    if (!setting?.value) {
      console.log('No admin chat IDs configured, skipping notification')
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const chatIds = setting.value.split(',').map((id: string) => id.trim()).filter(Boolean)

    if (chatIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Format items list
    const itemsList = (items || [])
      .map((item: any) => `  • ${item.name} × ${item.quantity} — ₴${(item.price * item.quantity).toFixed(0)}`)
      .join('\n')

    const message =
      `🛒 <b>Нове замовлення #${orderNumber}</b>\n\n` +
      `👤 ${firstName} ${lastName}\n` +
      `📱 ${phone}\n` +
      `📧 ${email}\n\n` +
      `📦 <b>Доставка:</b> ${DELIVERY_LABELS[deliveryMethod] || deliveryMethod}\n` +
      `📍 ${city}, ${address}\n\n` +
      `<b>Товари:</b>\n${itemsList}\n\n` +
      `💰 <b>Сума: ₴${Number(total).toFixed(0)}</b>`

    // Inline buttons for quick admin actions
    const replyMarkup = {
      inline_keyboard: [
        [{ text: '✅ Підтвердити', callback_data: `admin_setstatus_${orderId}_confirmed` }],
        [{ text: '❌ Скасувати', callback_data: `admin_setstatus_${orderId}_cancelled` }],
        [{ text: '📋 Деталі', callback_data: `admin_order_${orderId}` }],
        [{ text: '📞 Зателефонувати', url: `tel:${phone}` }],
      ]
    }

    // Send to all admin chats and save message IDs for clean chat
    for (const chatId of chatIds) {
      try {
        // Delete previous bot messages in this chat for clean experience
        const { data: prevMsgs } = await supabase
          .from('telegram_bot_last_messages')
          .select('message_ids')
          .eq('chat_id', Number(chatId))
          .single()

        if (prevMsgs?.message_ids?.length) {
          for (const msgId of prevMsgs.message_ids) {
            try {
              await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, message_id: msgId }),
              })
            } catch (_) {}
          }
        }

        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
            reply_markup: replyMarkup,
          }),
        })
        if (!res.ok) {
          console.error(`Failed to notify chat ${chatId}:`, await res.text())
        } else {
          const sentMsg = await res.json()
          const sentMsgId = sentMsg.result?.message_id
          if (sentMsgId) {
            // Save sent message ID so botReply can clean it up later
            await supabase
              .from('telegram_bot_last_messages')
              .upsert({ chat_id: Number(chatId), message_ids: [sentMsgId], updated_at: new Date().toISOString() }, { onConflict: 'chat_id' })
          }
        }
      } catch (e) {
        console.error(`Error notifying chat ${chatId}:`, e)
      }
    }

    return new Response(JSON.stringify({ ok: true, notified: chatIds.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Notify error:', error)
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})