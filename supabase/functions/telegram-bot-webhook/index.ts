import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  new: '🆕 Нове', confirmed: '✅ Підтверджено', processing: '📦 Обробляється',
  shipped: '🚚 Відправлено', delivered: '✅ Доставлено', cancelled: '❌ Скасовано', returned: '↩️ Повернено',
}
const ORDER_STATUS_FLOW = ['new', 'confirmed', 'processing', 'shipped', 'delivered']
const DELIVERY_LABELS: Record<string, string> = {
  nova_poshta: 'Нова Пошта', ukrposhta: 'Укрпошта', courier: "Кур'єр", pickup: 'Самовивіз',
}
const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: '⏳ Очікує', paid: '✅ Оплачено', failed: '❌ Помилка', refunded: '↩️ Повернення',
}
const CHANNEL_USERNAME = '@karamellu_shop'

// ══════════════════════════════════════════════
// ── Telegram helpers
// ══════════════════════════════════════════════

async function deleteTelegramMessage(botToken: string, chatId: number, messageId: number) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    })
  } catch (e) { console.error('Delete msg err:', e) }
}

async function deletePreviousBotMessages(botToken: string, chatId: number, supabase: any) {
  const { data } = await supabase.from('telegram_bot_last_messages').select('message_ids').eq('chat_id', chatId).single()
  if (data?.message_ids?.length) {
    for (const msgId of data.message_ids) await deleteTelegramMessage(botToken, chatId, msgId)
  }
}

async function saveBotMessageIds(chatId: number, messageIds: number[], supabase: any) {
  await supabase.from('telegram_bot_last_messages')
    .upsert({ chat_id: chatId, message_ids: messageIds, updated_at: new Date().toISOString() }, { onConflict: 'chat_id' })
}

async function sendTelegramMessage(botToken: string, chatId: number | string, text: string, replyMarkup?: any): Promise<number | null> {
  const body: any = { chat_id: chatId, text, parse_mode: 'HTML' }
  if (replyMarkup) body.reply_markup = replyMarkup
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) { console.error('Send msg error:', await res.text()); return null }
  return (await res.json()).result?.message_id || null
}

async function sendTelegramPhoto(botToken: string, chatId: number | string, photo: string, caption: string, replyMarkup?: any): Promise<number | null> {
  const body: any = { chat_id: chatId, photo, caption, parse_mode: 'HTML' }
  if (replyMarkup) body.reply_markup = replyMarkup
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) { console.error('Send photo error:', await res.text()); return null }
  return (await res.json()).result?.message_id || null
}

async function sendTelegramVideo(botToken: string, chatId: number | string, video: string, caption: string, replyMarkup?: any): Promise<number | null> {
  const body: any = { chat_id: chatId, video, caption, parse_mode: 'HTML' }
  if (replyMarkup) body.reply_markup = replyMarkup
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendVideo`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) { console.error('Send video error:', await res.text()); return null }
  return (await res.json()).result?.message_id || null
}

async function botReply(
  botToken: string, chatId: number, supabase: any,
  messages: Array<{ type: 'text' | 'photo' | 'video'; text: string; photo?: string; video?: string; replyMarkup?: any }>,
  userMessageId?: number
) {
  // Always delete previous bot messages AND user message
  await deletePreviousBotMessages(botToken, chatId, supabase)
  if (userMessageId) await deleteTelegramMessage(botToken, chatId, userMessageId)

  const sentIds: number[] = []
  for (const msg of messages) {
    let msgId: number | null = null
    if (msg.type === 'video' && msg.video) {
      msgId = await sendTelegramVideo(botToken, chatId, msg.video, msg.text, msg.replyMarkup)
    } else if (msg.type === 'photo' && msg.photo) {
      msgId = await sendTelegramPhoto(botToken, chatId, msg.photo, msg.text, msg.replyMarkup)
    } else {
      msgId = await sendTelegramMessage(botToken, chatId, msg.text, msg.replyMarkup)
    }
    if (msgId) sentIds.push(msgId)
  }
  await saveBotMessageIds(chatId, sentIds, supabase)
}

// ══════════════════════════════════════════════
// ── State management
// ══════════════════════════════════════════════

async function getRegState(chatId: number, supabase: any) {
  const { data } = await supabase.from('telegram_registration_state').select('step, nickname').eq('chat_id', chatId).single()
  return data as { step: string; nickname: string | null } | null
}
async function setRegState(chatId: number, step: string, nickname: string | null, supabase: any) {
  await supabase.from('telegram_registration_state')
    .upsert({ chat_id: chatId, step, nickname, updated_at: new Date().toISOString() }, { onConflict: 'chat_id' })
}
async function clearRegState(chatId: number, supabase: any) {
  await supabase.from('telegram_registration_state').delete().eq('chat_id', chatId)
}

// ══════════════════════════════════════════════
// ── Admin check
// ══════════════════════════════════════════════

async function isAdmin(telegramUserId: number, supabase: any): Promise<boolean> {
  const { data: tgUser } = await supabase.from('telegram_users').select('user_id').eq('telegram_user_id', telegramUserId).single()
  if (!tgUser?.user_id) return false
  const { data } = await supabase.rpc('has_role', { _user_id: tgUser.user_id, _role: 'admin' })
  return !!data
}

// ══════════════════════════════════════════════
// ── Channel posting
// ══════════════════════════════════════════════

async function postProductToChannel(botToken: string, product: any, category: any) {
  const hashtag = category?.name ? `#${category.name.replace(/[^a-zA-Zа-яА-ЯіІїЇєЄґҐ0-9_]/g, '')}` : '#новинка'
  let caption = `✨ <b>Новинка!</b>\n\n<b>${product.name}</b>\n`
  if (product.brand) caption += `🏷 ${product.brand}\n`
  caption += `💰 ₴${product.price}\n`
  if (product.description) caption += `\n${product.description.substring(0, 300)}${product.description.length > 300 ? '...' : ''}\n`
  caption += `\n${hashtag}`
  const buttons = { inline_keyboard: [[{ text: '🛒 Переглянути', url: `https://karamellu.online/product/${product.id}` }]] }
  if (product.image) {
    await sendTelegramPhoto(botToken, CHANNEL_USERNAME, product.image, caption, buttons)
  } else {
    await sendTelegramMessage(botToken, CHANNEL_USERNAME, caption, buttons)
  }
}

// ══════════════════════════════════════════════
// ── AI helpers
// ══════════════════════════════════════════════

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured')
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    }),
  })
  if (!response.ok) {
    if (response.status === 429) throw new Error('Забагато запитів, спробуйте за хвилину')
    if (response.status === 402) throw new Error('Недостатньо кредитів AI')
    throw new Error(`AI помилка: ${response.status}`)
  }
  const data = await response.json()
  return data.choices?.[0]?.message?.content || 'AI не відповів'
}

function detectImageMimeType(url: string, headerMimeType: string | null, bytes: Uint8Array): string {
  const h = (headerMimeType || '').split(';')[0].trim().toLowerCase()
  if (h.startsWith('image/') && h !== 'application/octet-stream') return h === 'image/jpg' ? 'image/jpeg' : h
  const u = url.toLowerCase()
  if (u.endsWith('.jpg') || u.endsWith('.jpeg')) return 'image/jpeg'
  if (u.endsWith('.png')) return 'image/png'
  if (u.endsWith('.webp')) return 'image/webp'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png'
  return 'image/jpeg'
}

async function downloadAsBase64(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download: ${res.status}`)
  const buffer = await res.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const CHUNK = 8192
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  const contentType = detectImageMimeType(url, res.headers.get('content-type'), bytes)
  return `data:${contentType};base64,${btoa(binary)}`
}

async function uploadBase64ToStorage(base64Data: string, supabase: any): Promise<string> {
  const match = base64Data.match(/^data:(image\/\w+);base64,(.+)$/)
  if (!match) throw new Error('Invalid base64 image')
  const mimeType = match[1]
  const ext = mimeType.split('/')[1] || 'png'
  const raw = atob(match[2])
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  const path = `generated/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('product-images').upload(path, bytes.buffer, { contentType: mimeType })
  if (error) throw error
  const { data } = supabase.storage.from('product-images').getPublicUrl(path)
  return data.publicUrl
}

async function getTelegramPhotoUrl(botToken: string, fileId: string): Promise<string> {
  const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId }),
  })
  const fileData = await fileRes.json()
  const filePath = fileData.result?.file_path
  return filePath ? `https://api.telegram.org/file/bot${botToken}/${filePath}` : fileId
}

async function invokeInternalFunction(functionName: string, payload: Record<string, unknown>) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Внутрішні ключі функцій не налаштовані')
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const raw = await res.text()
  const data = raw ? (() => {
    try { return JSON.parse(raw) } catch { return { raw } }
  })() : null

  if (!res.ok) {
    throw new Error(data?.error || `Function ${functionName} failed (${res.status})`)
  }

  return data
}

async function uploadGeneratedImageToStorage(imageSource: string, supabase: any, productId: string): Promise<string> {
  if (imageSource.startsWith('data:')) {
    return uploadBase64ToStorage(imageSource, supabase)
  }

  const imageRes = await fetch(imageSource)
  if (!imageRes.ok) throw new Error('Не вдалося завантажити AI-зображення')

  const contentType = (imageRes.headers.get('content-type') || 'image/png').split(';')[0]
  const ext = contentType.includes('jpeg') ? 'jpg' : contentType.includes('webp') ? 'webp' : 'png'
  const imageBuffer = await imageRes.arrayBuffer()
  const path = `promo/${productId}/photo-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('product-images').upload(path, imageBuffer, { contentType })
  if (error) throw error
  const { data } = supabase.storage.from('product-images').getPublicUrl(path)
  return data.publicUrl
}

async function ensurePromoPhotoForProduct(product: any, supabase: any): Promise<string> {
  if (product.promo_photo) return product.promo_photo

  const photoData = await invokeInternalFunction('generate-promo-content', {
    type: 'photo',
    productName: product.name,
    productBrand: product.brand,
    productDescription: product.description,
    productImage: product.image,
  })

  if (!photoData?.image) {
    throw new Error('Не вдалося згенерувати рекламне фото')
  }

  const promoPhotoUrl = await uploadGeneratedImageToStorage(photoData.image, supabase, product.id)
  const { error } = await supabase.from('products').update({ promo_photo: promoPhotoUrl }).eq('id', product.id)
  if (error) throw error
  return promoPhotoUrl
}


// ══════════════════════════════════════════════
// ── KEYBOARDS — styled & clean
// ══════════════════════════════════════════════

function clientMenuKeyboard(isRegistered: boolean) {
  const rows: any[][] = []
  if (isRegistered) {
    rows.push([
      { text: '🛍 Каталог', callback_data: 'action_catalog' },
      { text: '⭐ Хіти', callback_data: 'action_bestsellers' },
    ])
    rows.push([
      { text: '🔎 Пошук', callback_data: 'action_search' },
      { text: '📋 Замовлення', callback_data: 'action_my_orders' },
    ])
    rows.push([{ text: '💎 AI-консультант', callback_data: 'action_ask_ai' }])
    rows.push([{ text: '🌐 Відкрити магазин', url: 'https://karamellu.online' }])
  } else {
    rows.push([
      { text: '📝 Реєстрація', callback_data: 'action_register' },
      { text: '🔑 Увійти', callback_data: 'action_login' },
    ])
    rows.push([
      { text: '🛍 Каталог', callback_data: 'action_catalog' },
      { text: '💎 Консультант', callback_data: 'action_ask_ai' },
    ])
    rows.push([{ text: '🌐 Відкрити магазин', url: 'https://karamellu.online' }])
  }
  return { inline_keyboard: rows }
}

function adminMenuKeyboard(telegramUserId?: number) {
  const rows: any[][] = [
    [
      { text: '📦 Замовлення', callback_data: 'admin_orders' },
      { text: '🛍 Товари', callback_data: 'admin_products' },
    ],
  ]
  // Only show admin management for the owner
  if (telegramUserId === 5109895086) {
    rows.push([{ text: '👥 Адміни', callback_data: 'admin_users' }])
  }
  rows.push([{ text: '📸 AI-сканер товару', callback_data: 'ai_scanner' }])
  rows.push([{ text: '📦 Пакетне сканування', callback_data: 'ai_batch_scanner' }])
  return { inline_keyboard: rows }
}

function backToMenuKeyboard() {
  return { inline_keyboard: [[{ text: '◀️ Меню', callback_data: 'action_menu' }]] }
}
function cancelKeyboard() {
  return { inline_keyboard: [[{ text: '❌ Скасувати', callback_data: 'action_cancel' }]] }
}
function adminBackKeyboard() {
  return { inline_keyboard: [[{ text: '◀️ Адмін', callback_data: 'admin_menu' }]] }
}

function formatProduct(p: any): string {
  return `<b>${p.name}</b>\n🏷 ${p.brand}\n💰 ₴${p.price}\n📂 ${p.skin_type || 'Для всіх типів шкіри'}`
}

function productButtons(productId: string) {
  return { inline_keyboard: [[{ text: '🔍  Детальніше на сайті', url: `https://karamellu.online/product/${productId}` }]] }
}

// ══════════════════════════════════════════════
// ── AI Scanner
// ══════════════════════════════════════════════

async function processScannedProduct(botToken: string, chatId: number, supabase: any, scanDataStr: string) {
  await botReply(botToken, chatId, supabase, [{ type: 'text', text: '🔍  AI аналізує фото товару...' }])

  let scanData: any = {}
  try { scanData = JSON.parse(scanDataStr) } catch {}
  const photos = scanData.photos || []

  try {
    const base64Photos = await Promise.all(photos.map((url: string) => downloadAsBase64(url)))

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured')

    // Fetch categories for AI matching
    const { data: categories } = await supabase.from('categories').select('id, name').order('sort_order')
    const catList = categories || []
    const catNames = catList.map((c: any) => c.name)
    const categoryInstruction = catNames.length > 0
      ? `- category: одна з цих категорій (обери найбільш підходящу): ${catNames.map((n: string) => `"${n}"`).join(', ')}`
      : `- category: категорія товару`

    const content: any[] = [{
      type: 'text',
      text: `Ти — експерт з косметики. Проаналізуй фото товару і витягни інформацію.
Поверни JSON: {"name":"","brand":"","category":"","description":"","ingredients":"","usage_instructions":"","skin_type":""}
${categoryInstruction}
skin_type: "Для всіх типів шкіри", "Суха", "Жирна", "Чутлива" або "Зріла".
description: рекламний опис українською (3-5 речень).
usage_instructions: спосіб застосування українською.`,
    }]
    for (const img of base64Photos) content.push({ type: 'image_url', image_url: { url: img } })

    const categoryEnum = catNames.length > 0 ? { type: 'string', enum: catNames } : { type: 'string' }

    const analyzeRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content }],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_product_info',
            description: 'Extract product info from photos',
            parameters: {
              type: 'object',
              properties: {
                name: { type: 'string' }, brand: { type: 'string' }, category: categoryEnum,
                description: { type: 'string' },
                ingredients: { type: 'string' }, usage_instructions: { type: 'string' },
                skin_type: { type: 'string', enum: ['Для всіх типів шкіри', 'Суха', 'Жирна', 'Чутлива', 'Зріла'] },
              },
              required: ['name', 'brand', 'category', 'description', 'ingredients', 'usage_instructions', 'skin_type'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'extract_product_info' } },
      }),
    })

    if (!analyzeRes.ok) {
      const errBody = await analyzeRes.text()
      console.error('AI analysis error:', errBody)
      throw new Error(`AI аналіз не вдався: ${analyzeRes.status}`)
    }
    const analyzeData = await analyzeRes.json()
    const toolCall = analyzeData.choices?.[0]?.message?.tool_calls?.[0]

    let productInfo: any
    if (toolCall?.function?.arguments) {
      productInfo = typeof toolCall.function.arguments === 'string' ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments
    } else {
      const txt = analyzeData.choices?.[0]?.message?.content || ''
      const jsonMatch = txt.match(/\{[\s\S]*\}/)
      if (jsonMatch) productInfo = JSON.parse(jsonMatch[0])
      else throw new Error('AI не зміг розпізнати товар')
    }

    // Match detected category to ID
    let detectedCategoryId: string | null = null
    let detectedCategoryName = ''
    if (productInfo.category) {
      const match = catList.find((c: any) => c.name.toLowerCase() === productInfo.category.toLowerCase())
      if (match) {
        detectedCategoryId = match.id
        detectedCategoryName = match.name
      }
    }

    // Generate clean photo
    await botReply(botToken, chatId, supabase, [{ type: 'text', text: '✨  Генерую професійне фото...' }])

    const genPhotoRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3.1-flash-image-preview',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: `Take this product photo and create a clean, professional e-commerce product image. Remove the background completely and place the product on a pure clean white (#FFFFFF) background. The product should be well-lit, centered, with soft natural shadows. The background must be solid white — no patterns, no gradients, no checkerboard. Keep the product exactly as it is. Product: ${productInfo.name}.` },
            { type: 'image_url', image_url: { url: base64Photos[0] } },
          ],
        }],
        modalities: ['image', 'text'],
      }),
    })

    let cleanImageUrl = ''
    if (genPhotoRes.ok) {
      const genData = await genPhotoRes.json()
      const genImage = genData.choices?.[0]?.message?.images?.[0]?.image_url?.url
      if (genImage) cleanImageUrl = await uploadBase64ToStorage(genImage, supabase)
    }
    if (!cleanImageUrl && photos[0]) {
      cleanImageUrl = await uploadBase64ToStorage(base64Photos[0], supabase)
    }

    scanData.productInfo = productInfo
    scanData.cleanImageUrl = cleanImageUrl
    scanData.suggestedPrice = 0

    // If category was detected, pre-set it; otherwise ask user to choose
    if (detectedCategoryId) {
      scanData.category_id = detectedCategoryId
    }

    await setRegState(chatId, 'scanner_awaiting_category', JSON.stringify(scanData), supabase)

    // If AI detected a category, show only the suggested one + "choose other" button
    // Otherwise show full list
    if (detectedCategoryId) {
      await botReply(botToken, chatId, supabase, [{
        type: 'text',
        text: `✅  <b>AI розпізнав товар:</b>\n\n` +
          `📦  <b>${productInfo.name}</b>\n` +
          `🏷  ${productInfo.brand}\n` +
          `📂  Категорія: ${detectedCategoryName}\n` +
          `🧴  ${productInfo.skin_type}\n` +
          `\n📝  ${(productInfo.description || '').substring(0, 200)}...\n\n` +
          `AI визначив категорію <b>${detectedCategoryName}</b>:`,
        replyMarkup: { inline_keyboard: [
          [{ text: `✅  ${detectedCategoryName}`, callback_data: `scanner_cat_${detectedCategoryId}` }],
          [{ text: '📂  Обрати іншу категорію', callback_data: 'scanner_show_all_cats' }],
          [{ text: '❌  Скасувати', callback_data: 'action_cancel' }],
        ]},
      }])
    } else {
      const catButtons = catList.map((c: any) => {
        return [{ text: `📂  ${c.name}`, callback_data: `scanner_cat_${c.id}` }]
      })
      await botReply(botToken, chatId, supabase, [{
        type: 'text',
        text: `✅  <b>AI розпізнав товар:</b>\n\n` +
          `📦  <b>${productInfo.name}</b>\n` +
          `🏷  ${productInfo.brand}\n` +
          `🧴  ${productInfo.skin_type}\n` +
          `\n📝  ${(productInfo.description || '').substring(0, 200)}...\n\n` +
          `Оберіть <b>категорію</b>:`,
        replyMarkup: { inline_keyboard: [...catButtons, [{ text: '❌  Скасувати', callback_data: 'action_cancel' }]] },
      }])
    }
  } catch (err: any) {
    console.error('Scanner error:', err)
    await clearRegState(chatId, supabase)
    await botReply(botToken, chatId, supabase, [{
      type: 'text', text: `❌  Помилка сканування: ${err.message}`,
      replyMarkup: adminBackKeyboard(),
    }])
  }
}

async function finalizeScannedProduct(botToken: string, chatId: number, supabase: any, scanData: any) {
  await botReply(botToken, chatId, supabase, [{ type: 'text', text: '📦  Створюю товар...' }])

  try {
    const info = scanData.productInfo
    const price = scanData.finalPrice || info.price || 0

    const { data: product, error: insertError } = await supabase.from('products').insert({
      name: info.name || 'Новий товар', brand: info.brand || '', description: info.description || '',
      ingredients: info.ingredients || '', usage_instructions: info.usage_instructions || '',
      skin_type: info.skin_type || 'Для всіх типів шкіри', price,
      image: scanData.cleanImageUrl || null, category_id: scanData.category_id || null,
      is_active: true, best_seller: false,
    }).select().single()

    if (insertError) throw insertError

    // Channel posting disabled for now
    // let category = null
    // if (scanData.category_id) {
    //   const { data: cat } = await supabase.from('categories').select('name').eq('id', scanData.category_id).single()
    //   category = cat
    // }
    // try { await postProductToChannel(botToken, product, category) } catch (e) { console.error('Channel post error:', e) }

    if (scanData.batch_mode) {
      const newCount = (scanData.batch_count || 0) + 1
      // Reset state to await next product's front photo, preserving batch_mode
      const nextStateData = JSON.stringify({ batch_mode: true, batch_count: newCount })
      await setRegState(chatId, 'scanner_awaiting_front_photo', nextStateData, supabase)
      await botReply(botToken, chatId, supabase, [{
        type: 'text',
        text: `✅  <b>Товар #${newCount} додано:</b> ${product.name}\n💰  ₴${product.price}\n\n` +
          `📦  <b>Пакет:</b> ${newCount} товар(ів)\n\n` +
          `📸  Надішліть фото <b>передньої сторони</b> наступного товару\nабо завершіть пакет:`,
        replyMarkup: { inline_keyboard: [
          [{ text: '✅  Завершити пакет', callback_data: 'batch_finish' }],
        ]},
      }])
    } else {
      await clearRegState(chatId, supabase)
      await botReply(botToken, chatId, supabase, [{
        type: 'text',
        text: `✅  <b>Товар створено!</b>\n\n` +
          `📦  ${product.name}\n🏷  ${product.brand}\n💰  ₴${product.price}\n\n` +
          `✅  Додано на сайт`,
        replyMarkup: { inline_keyboard: [
          [{ text: '✨  Створити промо', callback_data: `ai_promo_prod_${product.id}` }],
          [{ text: '🌐  Переглянути на сайті', url: `https://karamellu.online/product/${product.id}` }],
          [{ text: '📸  Сканувати ще товар', callback_data: 'ai_scanner' }],
          [{ text: '◀️  Товари', callback_data: 'admin_products' }],
        ]},
      }])
    }
  } catch (err: any) {
    console.error('Finalize error:', err)
    await clearRegState(chatId, supabase)
    await botReply(botToken, chatId, supabase, [{
      type: 'text', text: `❌  Помилка створення: ${err.message}`,
      replyMarkup: adminBackKeyboard(),
    }])
  }
}

// ══════════════════════════════════════════════
// ── Admin handlers
// ══════════════════════════════════════════════

async function handleAdminOrders(botToken: string, chatId: number, supabase: any, page = 0) {
  const pageSize = 5
  const { data: orders, count } = await supabase.from('orders')
    .select('id, order_number, first_name, last_name, total, status, payment_status, created_at', { count: 'exact' })
    .order('created_at', { ascending: false }).range(page * pageSize, (page + 1) * pageSize - 1)

  if (!orders?.length) {
    await botReply(botToken, chatId, supabase, [{ type: 'text', text: '📦  Замовлень поки немає.', replyMarkup: adminBackKeyboard() }])
    return
  }

  let text = `📦  <b>Замовлення</b> (${count || 0} всього)\n<i>(натисніть щоб переглянути деталі)</i>\n\n`
  const buttons: any[] = []
  for (const o of orders) {
    const date = new Date(o.created_at).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })
    text += `#${o.order_number} — ${o.first_name} ${o.last_name} | ₴${Number(o.total).toFixed(0)} | ${date}\n`
    buttons.push([{ text: `#${o.order_number}  ${o.first_name} — ${ORDER_STATUS_LABELS[o.status] || o.status}`, callback_data: `admin_order_${o.id}` }])
  }
  const navRow: any[] = []
  if (page > 0) navRow.push({ text: '⬅️  Назад', callback_data: `admin_orders_p${page - 1}` })
  if (count && (page + 1) * pageSize < count) navRow.push({ text: 'Далі  ➡️', callback_data: `admin_orders_p${page + 1}` })
  if (navRow.length) buttons.push(navRow)
  buttons.push([{ text: '◀️  Адмін-панель', callback_data: 'admin_menu' }])
  await botReply(botToken, chatId, supabase, [{ type: 'text', text, replyMarkup: { inline_keyboard: buttons } }])
}

async function handleAdminOrderDetail(botToken: string, chatId: number, supabase: any, orderId: string) {
  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single()
  if (!order) { await botReply(botToken, chatId, supabase, [{ type: 'text', text: '❌  Не знайдено.', replyMarkup: adminBackKeyboard() }]); return }

  const { data: items } = await supabase.from('order_items').select('product_name, quantity, price, total').eq('order_id', orderId)
  const itemsList = (items || []).map((i: any) => `  • ${i.product_name} × ${i.quantity} — ₴${Number(i.total).toFixed(0)}`).join('\n')
  const date = new Date(order.created_at).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  let text = `📦  <b>Замовлення #${order.order_number}</b>\n📅  ${date}\n\n`
  text += `👤  ${order.first_name} ${order.last_name}\n📱  ${order.phone}\n📧  ${order.email}\n\n`
  text += `📦  ${DELIVERY_LABELS[order.delivery_method] || order.delivery_method}\n📍  ${order.city}, ${order.address}\n`
  if (order.nova_poshta_warehouse) text += `🏤  ${order.nova_poshta_warehouse}\n`
  text += `\n<b>Товари:</b>\n${itemsList}\n\n`
  if (order.discount > 0) text += `🏷  Знижка: ₴${Number(order.discount).toFixed(0)}\n`
  if (order.shipping_cost > 0) text += `🚚  Доставка: ₴${Number(order.shipping_cost).toFixed(0)}\n`
  text += `💰  <b>Сума: ₴${Number(order.total).toFixed(0)}</b>\n\n`
  text += `📋  Статус: ${ORDER_STATUS_LABELS[order.status] || order.status}\n`
  text += `💳  Оплата: ${PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status}\n`
  if (order.notes) text += `\n📝  ${order.notes}`

  const statusButtons: any[] = []
  const currentIdx = ORDER_STATUS_FLOW.indexOf(order.status)
  if (currentIdx >= 0 && currentIdx < ORDER_STATUS_FLOW.length - 1) {
    const nextStatus = ORDER_STATUS_FLOW[currentIdx + 1]
    statusButtons.push([{ text: `➡️  Змінити на: ${ORDER_STATUS_LABELS[nextStatus]}`, callback_data: `admin_setstatus_${orderId}_${nextStatus}` }])
  }
  if (order.status !== 'cancelled') statusButtons.push([{ text: '❌  Скасувати замовлення', callback_data: `admin_setstatus_${orderId}_cancelled` }])
  if (order.payment_status !== 'paid') statusButtons.push([{ text: '💳  Позначити оплаченим', callback_data: `admin_setpay_${orderId}_paid` }])
  statusButtons.push([{ text: '📞  Зателефонувати', url: `tel:${order.phone}` }])
  statusButtons.push([{ text: '◀️  Замовлення', callback_data: 'admin_orders' }])
  await botReply(botToken, chatId, supabase, [{ type: 'text', text, replyMarkup: { inline_keyboard: statusButtons } }])
}

async function handleAdminProducts(botToken: string, chatId: number, supabase: any) {
  const { count } = await supabase.from('products').select('id', { count: 'exact', head: true })
  await setRegState(chatId, 'admin_product_search', null, supabase)
  await botReply(botToken, chatId, supabase, [{
    type: 'text',
    text: `🛍  <b>Товари</b> (${count || 0} всього)\n\n🔍  Введіть назву або бренд товару для пошуку:`,
    replyMarkup: { inline_keyboard: [
      [{ text: '📸  AI-сканер (додати товар)', callback_data: 'ai_scanner' }],
      [{ text: '◀️  Адмін-панель', callback_data: 'admin_menu' }],
    ]},
  }])
}

async function handleAdminProductSearch(botToken: string, chatId: number, supabase: any, query: string) {
  const q = query.toLowerCase()

  // Keyword synonyms for smart matching
  const synonyms: Record<string, string[]> = {
    'волосся': ['шампунь', 'кондиціонер', 'маска для волосся', 'бальзам', 'hair', 'shampoo', 'conditioner'],
    'волос': ['шампунь', 'кондиціонер', 'маска для волосся', 'бальзам', 'hair', 'shampoo', 'conditioner'],
    'шкіра': ['крем', 'сироватка', 'тонік', 'лосьйон', 'скраб', 'skin', 'cream', 'serum'],
    'лице': ['крем для обличчя', 'сироватка', 'маска', 'тонік', 'face', 'обличчя'],
    'обличчя': ['крем для обличчя', 'сироватка', 'маска', 'тонік', 'face'],
    'губи': ['помада', 'бальзам для губ', 'блиск', 'lip', 'lipstick'],
    'тіло': ['лосьйон для тіла', 'крем для тіла', 'скраб', 'body', 'масло'],
    'зволоження': ['зволожуючий', 'moisturizing', 'hydrating', 'гіалуронова'],
  }

  const searchTerms = [q]
  for (const [key, vals] of Object.entries(synonyms)) {
    if (q.includes(key)) searchTerms.push(...vals)
  }

  const orConditions = searchTerms
    .map(t => `name.ilike.%${t}%,brand.ilike.%${t}%,description.ilike.%${t}%,ingredients.ilike.%${t}%,skin_type.ilike.%${t}%`)
    .join(',')

  const { data: products } = await supabase.from('products')
    .select('id, name, brand, price, is_active, category_id')
    .or(orConditions)
    .order('created_at', { ascending: false })
    .limit(10)

  // Search matching categories
  const catOrConditions = searchTerms.map(t => `name.ilike.%${t}%,description.ilike.%${t}%`).join(',')
  const { data: matchingCats } = await supabase.from('categories').select('id, name').or(catOrConditions)

  // Count products per matching category
  const categoryBtns: any[] = []
  const categoryLines: string[] = []
  if (matchingCats?.length) {
    for (const cat of matchingCats) {
      const { count } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('category_id', cat.id)
      categoryLines.push(`📂  <b>${cat.name}</b> — ${count || 0} товарів`)
      categoryBtns.push([{ text: `📂  ${cat.name} (${count || 0})`, callback_data: `admin_cat_${cat.id}` }])
    }
  }

  if (!products?.length && !matchingCats?.length) {
    await botReply(botToken, chatId, supabase, [{
      type: 'text',
      text: `🔍  За запитом "<b>${query}</b>" нічого не знайдено.\n\n<i>Спробуйте іншу назву:</i>`,
      replyMarkup: { inline_keyboard: [
        [{ text: '📸  AI-сканер (додати товар)', callback_data: 'ai_scanner' }],
        [{ text: '◀️  Адмін-панель', callback_data: 'admin_menu' }],
      ]},
    }])
    await setRegState(chatId, 'admin_product_search', null, supabase)
    return
  }

  let headerText = `🔍  Результати для "<b>${query}</b>":\n`
  if (categoryLines.length) {
    headerText += `\n${categoryLines.join('\n')}\n`
  }

  const buttons: any[] = [...categoryBtns]
  if (products?.length) {
    for (const p of products) {
      const active = p.is_active ? '🟢' : '🔴'
      buttons.push([{ text: `${active}  ${p.name} — ₴${p.price}`, callback_data: `admin_prod_${p.id}` }])
    }
  }
  buttons.push([{ text: '🔍  Шукати ще', callback_data: 'admin_products' }])
  buttons.push([{ text: '◀️  Адмін-панель', callback_data: 'admin_menu' }])
  await botReply(botToken, chatId, supabase, [{
    type: 'text',
    text: headerText,
    replyMarkup: { inline_keyboard: buttons },
  }])
}

async function handleAdminProductDetail(botToken: string, chatId: number, supabase: any, productId: string) {
  const { data: p } = await supabase.from('products').select('*').eq('id', productId).single()
  if (!p) { await botReply(botToken, chatId, supabase, [{ type: 'text', text: '❌  Товар не знайдено.', replyMarkup: adminBackKeyboard() }]); return }

  const active = p.is_active ? '🟢  Активний' : '🔴  Прихований'
  const best = p.best_seller ? '  ⭐  Бестселер' : ''
  const text = `<b>${p.name}</b>\n🏷  ${p.brand}\n💰  ₴${p.price}\n${active}${best}`

  const buttons = [
    [{ text: '✨  Створити промо', callback_data: `ai_promo_prod_${productId}` }],
    [{ text: '🎨  Переробити фото (білий фон)', callback_data: `admin_prod_rephoto_${productId}` }],
    ...(p.promo_photo ? [[{ text: '🗑  Видалити промо-фото', callback_data: `admin_prod_delpromo_${productId}` }]] : []),
    [{ text: '✏️  Назва', callback_data: `admin_prod_setname_${productId}` }, { text: '🏷  Бренд', callback_data: `admin_prod_setbrand_${productId}` }],
    [{ text: '💰  Ціна', callback_data: `admin_prod_setprice_${productId}` }],
    [{ text: '📝  Опис', callback_data: `admin_prod_setdesc_${productId}` }],
    [{ text: '🧪  Інгредієнти', callback_data: `admin_prod_setingr_${productId}` }, { text: '💡  Застосування', callback_data: `admin_prod_setusage_${productId}` }],
    [{ text: p.is_active ? '🔴  Приховати' : '🟢  Активувати', callback_data: `admin_prod_toggle_${productId}` }],
    [{ text: p.best_seller ? '⭐  Прибрати бестселер' : '⭐  Бестселер', callback_data: `admin_prod_best_${productId}` }],
    [{ text: '🗑  Видалити', callback_data: `admin_prod_delete_${productId}` }],
    [{ text: '🌐  На сайті', url: `https://karamellu.online/product/${productId}` }],
    [{ text: '◀️  Товари', callback_data: 'admin_products' }],
  ]

  if (p.image) {
    await botReply(botToken, chatId, supabase, [{ type: 'photo', text, photo: p.image, replyMarkup: { inline_keyboard: buttons } }])
  } else {
    await botReply(botToken, chatId, supabase, [{ type: 'text', text, replyMarkup: { inline_keyboard: buttons } }])
  }
}

async function handleAdminPromos(botToken: string, chatId: number, supabase: any) {
  const { data: promos } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false }).limit(10)

  let text = '🎟  <b>Промокоди</b>\n<i>(натисніть для деталей)</i>\n\n'
  const buttons: any[] = []

  if (!promos?.length) {
    text += 'Поки немає промокодів.'
  } else {
    for (const p of promos) {
      const active = p.is_active ? '🟢' : '🔴'
      const type = p.discount_type === 'percent' ? `${p.value}%` : `₴${p.value}`
      const uses = p.max_uses ? `${p.current_uses || 0}/${p.max_uses}` : `${p.current_uses || 0}/∞`
      text += `${active}  <code>${p.code}</code> — ${type} (${uses})\n`
      buttons.push([{ text: `${active}  ${p.code} — ${type}`, callback_data: `admin_promo_${p.id}` }])
    }
  }
  buttons.push([{ text: '➕  Створити промокод', callback_data: 'admin_promo_new' }])
  buttons.push([{ text: '◀️  Адмін-панель', callback_data: 'admin_menu' }])
  await botReply(botToken, chatId, supabase, [{ type: 'text', text, replyMarkup: { inline_keyboard: buttons } }])
}

async function handleAdminStats(botToken: string, chatId: number, supabase: any) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7); weekAgo.setHours(0, 0, 0, 0)

  const { data: todayOrders, count: todayCount } = await supabase.from('orders')
    .select('total, status', { count: 'exact' }).gte('created_at', today.toISOString())
  const todayRevenue = (todayOrders || []).reduce((s: number, o: any) => s + Number(o.total), 0)
  const todayNew = (todayOrders || []).filter((o: any) => o.status === 'new').length

  const { count: weekCount } = await supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString())
  const { count: totalOrders } = await supabase.from('orders').select('id', { count: 'exact', head: true })
  const { count: totalProducts } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true)
  const { count: pendingOrders } = await supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', ['new', 'confirmed', 'processing'])

  let text = `📊  <b>Статистика</b>\n\n`
  text += `<b>Сьогодні:</b>\n  📦  ${todayCount || 0} замовлень\n  💰  ₴${todayRevenue.toFixed(0)} виручка\n`
  if (todayNew > 0) text += `  🆕  ${todayNew} нових\n`
  text += `\n<b>Тиждень:</b>  ${weekCount || 0} замовлень\n`
  text += `\n<b>Загалом:</b>\n  📦  ${totalOrders || 0} замовлень\n  🛍  ${totalProducts || 0} товарів\n  ⏳  ${pendingOrders || 0} в обробці`

  await botReply(botToken, chatId, supabase, [{
    type: 'text', text,
    replyMarkup: { inline_keyboard: [
      [{ text: '🔄  Оновити', callback_data: 'admin_stats' }],
      [{ text: '◀️  Адмін-панель', callback_data: 'admin_menu' }],
    ]},
  }])
}

async function handleAdminUsers(botToken: string, chatId: number, supabase: any) {
  const { data: tgUsers } = await supabase.from('telegram_users')
    .select('user_id, telegram_user_id, telegram_username, telegram_first_name').order('created_at', { ascending: false })

  if (!tgUsers?.length) {
    await botReply(botToken, chatId, supabase, [{ type: 'text', text: '👥  Немає зареєстрованих користувачів.', replyMarkup: adminBackKeyboard() }])
    return
  }

  const { data: adminRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'admin')
  const adminUserIds = new Set((adminRoles || []).map((r: any) => r.user_id))

  let text = '👥  <b>Керування адмінами</b>\n<i>(натисніть щоб дати/забрати доступ)</i>\n\n'
  const buttons: any[] = []
  for (const u of tgUsers) {
    const isAdm = adminUserIds.has(u.user_id)
    const icon = isAdm ? '👑' : '👤'
    const name = u.telegram_first_name || u.telegram_username || 'Unknown'
    text += `${icon}  ${name}${u.telegram_username ? ` @${u.telegram_username}` : ''}\n`
    buttons.push([{
      text: isAdm ? `👑  ${name} — забрати адмін` : `👤  ${name} — дати адмін`,
      callback_data: isAdm ? `admin_revoke_${u.user_id}` : `admin_grant_${u.user_id}`,
    }])
  }
  buttons.push([{ text: '◀️  Адмін-панель', callback_data: 'admin_menu' }])
  await botReply(botToken, chatId, supabase, [{ type: 'text', text, replyMarkup: { inline_keyboard: buttons } }])
}

// ══════════════════════════════════════════════
// ── MAIN HANDLER
// ══════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
  if (!botToken) return new Response('Bot token not configured', { status: 500 })

  const url = new URL(req.url)
  if (url.pathname.endsWith('/setup')) {
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-bot-webhook`
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    })
    return new Response(JSON.stringify(await res.json()), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    const update = await req.json()
    console.log('Telegram update:', JSON.stringify(update))

    // ── Callback queries ──
    if (update.callback_query) {
      const cb = update.callback_query.data
      const chatId = update.callback_query.message.chat.id
      const firstName = update.callback_query.from.first_name || ''
      const telegramUserId = update.callback_query.from.id
      const username = update.callback_query.from.username || ''

      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: update.callback_query.id }),
      })

      // ── CLIENT: Main menu ──
      if (cb === 'action_menu') {
        await clearRegState(chatId, supabase)
        const { data: tgUser } = await supabase.from('telegram_users').select('user_id').eq('telegram_user_id', telegramUserId).single()
        const isReg = !!tgUser
        const showAdmin = isReg && await isAdmin(telegramUserId, supabase)

        if (showAdmin) {
          await botReply(botToken, chatId, supabase, [{
            type: 'text',
            text: `✨  <b>Карамель LU — Адмін</b>\n\nВітаємо, ${firstName}!`,
            replyMarkup: adminMenuKeyboard(telegramUserId),
          }])
        } else {
          await botReply(botToken, chatId, supabase, [{
            type: 'text',
            text: `✨  <b>Карамель LU</b>\n\nВітаємо, ${firstName}!\nОберіть що вас цікавить:`,
            replyMarkup: clientMenuKeyboard(isReg),
          }])
        }
        return new Response('OK', { status: 200 })
      }

      if (cb === 'action_cancel') {
        await clearRegState(chatId, supabase)
        const { data: tgUser } = await supabase.from('telegram_users').select('user_id').eq('telegram_user_id', telegramUserId).single()
        const isAdm = tgUser && await isAdmin(telegramUserId, supabase)
        const keyboard = isAdm ? adminMenuKeyboard(telegramUserId) : clientMenuKeyboard(!!tgUser)
        await botReply(botToken, chatId, supabase, [{ type: 'text', text: '❌  Скасовано.\n\n✨  <b>Карамель LU</b>', replyMarkup: keyboard }])
        return new Response('OK', { status: 200 })
      }

      // ── CLIENT: Register ──
      if (cb === 'action_register') {
        const { data: existing } = await supabase.from('telegram_users').select('user_id').eq('telegram_user_id', telegramUserId).single()
        if (existing) {
          await botReply(botToken, chatId, supabase, [{
            type: 'text', text: '✅  У вас вже є акаунт!',
            replyMarkup: { inline_keyboard: [[{ text: '🔑  Увійти', callback_data: 'action_login' }], [{ text: '◀️  Меню', callback_data: 'action_menu' }]] },
          }])
          return new Response('OK', { status: 200 })
        }
        await setRegState(chatId, 'awaiting_nickname', null, supabase)
        await botReply(botToken, chatId, supabase, [{
          type: 'text',
          text: '📝  <b>Реєстрація</b>\n\nПридумайте нікнейм:\n<i>(3-20 символів, латинські букви, цифри, _)</i>\n\nНаприклад: <code>anna_beauty</code>',
          replyMarkup: cancelKeyboard(),
        }])
        return new Response('OK', { status: 200 })
      }

      // ── CLIENT: Login ──
      if (cb === 'action_login') {
        const { data: existing } = await supabase.from('telegram_users').select('user_id').eq('telegram_user_id', telegramUserId).single()
        if (!existing) {
          await botReply(botToken, chatId, supabase, [{
            type: 'text', text: '❌  У вас ще немає акаунта.',
            replyMarkup: { inline_keyboard: [[{ text: '📝  Створити акаунт', callback_data: 'action_register' }], [{ text: '◀️  Меню', callback_data: 'action_menu' }]] },
          }])
          return new Response('OK', { status: 200 })
        }
        const code = Math.floor(100000 + Math.random() * 900000).toString()
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
        await supabase.from('telegram_auth_codes').update({ used: true }).eq('telegram_user_id', telegramUserId).eq('used', false)
        await supabase.from('telegram_auth_codes').insert({ telegram_user_id: telegramUserId, telegram_username: username, telegram_first_name: firstName, code, expires_at: expiresAt.toISOString() })
        const loginUrl = `https://karamellu.online/login?tg_code=${code}`
        await botReply(botToken, chatId, supabase, [{
          type: 'text', text: '🔐  <b>Вхід на сайт</b>\n\nНатисніть кнопку нижче:',
          replyMarkup: { inline_keyboard: [[{ text: '🚀  Увійти на сайт', url: loginUrl }], [{ text: '◀️  Меню', callback_data: 'action_menu' }]] },
        }])
        return new Response('OK', { status: 200 })
      }

      // ── CLIENT: Catalog ──
      if (cb === 'action_catalog') {
        const { data: cats } = await supabase.from('categories').select('id, name').order('sort_order')
        if (!cats?.length) {
          await botReply(botToken, chatId, supabase, [{ type: 'text', text: '📦  Категорії поки відсутні.', replyMarkup: backToMenuKeyboard() }])
          return new Response('OK', { status: 200 })
        }
        const keyboard = [...cats.map((c: any) => ([{ text: `📂  ${c.name}`, callback_data: `cat_${c.id}` }])), [{ text: '◀️  Меню', callback_data: 'action_menu' }]]
        await botReply(botToken, chatId, supabase, [{ type: 'text', text: '🛍  <b>Оберіть категорію:</b>', replyMarkup: { inline_keyboard: keyboard } }])
        return new Response('OK', { status: 200 })
      }

      if (cb.startsWith('cat_')) {
        const categoryId = cb.replace('cat_', '')
        const { data: prods } = await supabase.from('products').select('*')
          .eq('category_id', categoryId).eq('is_active', true).order('best_seller', { ascending: false }).limit(5)
        if (!prods?.length) {
          await botReply(botToken, chatId, supabase, [{
            type: 'text', text: '📦  Товарів у цій категорії поки немає.',
            replyMarkup: { inline_keyboard: [[{ text: '◀️  Категорії', callback_data: 'action_catalog' }], [{ text: '◀️  Меню', callback_data: 'action_menu' }]] },
          }])
        } else {
          const msgs: any[] = []
          for (const p of prods) {
            msgs.push(p.image
              ? { type: 'photo', text: formatProduct(p), photo: p.image, replyMarkup: productButtons(p.id) }
              : { type: 'text', text: formatProduct(p), replyMarkup: productButtons(p.id) })
          }
          msgs.push({ type: 'text', text: '⬇️', replyMarkup: { inline_keyboard: [
            ...(prods.length === 5 ? [[{ text: '🌐  Більше на сайті', url: 'https://karamellu.online/shop' }]] : []),
            [{ text: '◀️  Категорії', callback_data: 'action_catalog' }], [{ text: '◀️  Меню', callback_data: 'action_menu' }],
          ]}})
          await botReply(botToken, chatId, supabase, msgs)
        }
        return new Response('OK', { status: 200 })
      }

      // ── CLIENT: Bestsellers ──
      if (cb === 'action_bestsellers') {
        const { data: prods } = await supabase.from('products').select('*')
          .eq('best_seller', true).eq('is_active', true).order('rating', { ascending: false }).limit(5)
        if (!prods?.length) {
          await botReply(botToken, chatId, supabase, [{ type: 'text', text: '⭐  Бестселери поки відсутні.', replyMarkup: backToMenuKeyboard() }])
          return new Response('OK', { status: 200 })
        }
        const msgs: any[] = [{ type: 'text', text: '⭐  <b>Наші бестселери:</b>' }]
        for (const p of prods) {
          msgs.push(p.image
            ? { type: 'photo', text: formatProduct(p), photo: p.image, replyMarkup: productButtons(p.id) }
            : { type: 'text', text: formatProduct(p), replyMarkup: productButtons(p.id) })
        }
        msgs.push({ type: 'text', text: '⬇️', replyMarkup: backToMenuKeyboard() })
        await botReply(botToken, chatId, supabase, msgs)
        return new Response('OK', { status: 200 })
      }

      // ── CLIENT: Search ──
      if (cb === 'action_search') {
        await setRegState(chatId, 'awaiting_search', null, supabase)
        await botReply(botToken, chatId, supabase, [{
          type: 'text',
          text: '🔍  <b>Пошук товару</b>\n\nНапишіть що вас цікавить — наприклад:\n<i>волосся, шкіра, лице, зволоження, шампунь, крем...</i>',
          replyMarkup: cancelKeyboard(),
        }])
        return new Response('OK', { status: 200 })
      }

      // ── CLIENT: Show single product from search suggestion ──
      if (cb.startsWith('sp_')) {
        const productId = cb.replace('sp_', '')
        const { data: product } = await supabase.from('products').select('*').eq('id', productId).single()
        if (!product) {
          await botReply(botToken, chatId, supabase, [{ type: 'text', text: '❌  Товар не знайдено.', replyMarkup: backToMenuKeyboard() }])
          return new Response('OK', { status: 200 })
        }
        const msgs: any[] = []
        msgs.push(product.image
          ? { type: 'photo', text: formatProduct(product), photo: product.image, replyMarkup: productButtons(product.id) }
          : { type: 'text', text: formatProduct(product), replyMarkup: productButtons(product.id) })
        msgs.push({ type: 'text', text: '⬇️', replyMarkup: { inline_keyboard: [[{ text: '🔍  Шукати ще', callback_data: 'action_search' }], [{ text: '◀️  Меню', callback_data: 'action_menu' }]] } })
        await botReply(botToken, chatId, supabase, msgs)
        return new Response('OK', { status: 200 })
      }

      // ── CLIENT: AI consultant (coming soon) ──
      if (cb === 'action_ask_ai') {
        await botReply(botToken, chatId, supabase, [{
          type: 'text',
          text: '✨  <b>AI-Консультант</b>\n\n🔧 Ця функція зараз в розробці та скоро буде доступна!\n\nНаш AI-консультант зможе допомогти вам з підбором косметики, відповістю на питання про доставку та догляд за шкірою.\n\n<i>Слідкуйте за оновленнями!</i> 💎',
          replyMarkup: backToMenuKeyboard(),
        }])
        return new Response('OK', { status: 200 })
      }

      // ── CLIENT: My Orders ──
      if (cb === 'action_my_orders') {
        const { data: tgUser } = await supabase.from('telegram_users').select('user_id').eq('telegram_user_id', telegramUserId).single()
        if (!tgUser?.user_id) {
          await botReply(botToken, chatId, supabase, [{ type: 'text', text: '❌  Спершу увійдіть в акаунт.', replyMarkup: backToMenuKeyboard() }])
          return new Response('OK', { status: 200 })
        }
        const { data: orders } = await supabase.from('orders').select('id, order_number, status, payment_status, total, created_at')
          .eq('user_id', tgUser.user_id).order('created_at', { ascending: false }).limit(10)
        if (!orders?.length) {
          await botReply(botToken, chatId, supabase, [{ type: 'text', text: '📋  У вас поки немає замовлень.', replyMarkup: backToMenuKeyboard() }])
          return new Response('OK', { status: 200 })
        }
        const rows = orders.map((o: any) => ([{
          text: `#${o.order_number}  ${ORDER_STATUS_LABELS[o.status] || o.status}  ₴${o.total}`,
          callback_data: `client_order_${o.id}`,
        }]))
        rows.push([{ text: '◀️  Меню', callback_data: 'action_menu' }])
        await botReply(botToken, chatId, supabase, [{
          type: 'text',
          text: '📋  <b>Ваші замовлення:</b>\n\n<i>Натисніть на замовлення для деталей</i>',
          replyMarkup: { inline_keyboard: rows },
        }])
        return new Response('OK', { status: 200 })
      }

      if (cb.startsWith('client_order_')) {
        const orderId = cb.replace('client_order_', '')
        const { data: tgUser } = await supabase.from('telegram_users').select('user_id').eq('telegram_user_id', telegramUserId).single()
        if (!tgUser?.user_id) { await botReply(botToken, chatId, supabase, [{ type: 'text', text: '❌  Доступ обмежено.', replyMarkup: backToMenuKeyboard() }]); return new Response('OK', { status: 200 }) }
        const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).eq('user_id', tgUser.user_id).single()
        if (!order) { await botReply(botToken, chatId, supabase, [{ type: 'text', text: '❌  Замовлення не знайдено.', replyMarkup: backToMenuKeyboard() }]); return new Response('OK', { status: 200 }) }
        const { data: items } = await supabase.from('order_items').select('product_name, quantity, price, total').eq('order_id', orderId)
        const itemsText = items?.map((i: any) => `  • ${i.product_name} ×${i.quantity} — ₴${i.total}`).join('\n') || 'немає'
        const date = new Date(order.created_at).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        const delivery = DELIVERY_LABELS[order.delivery_method] || order.delivery_method
        const text = `📋  <b>Замовлення #${order.order_number}</b>\n\n` +
          `📅  ${date}\n` +
          `📦  Статус: ${ORDER_STATUS_LABELS[order.status] || order.status}\n` +
          `💳  Оплата: ${PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status}\n` +
          `🚚  Доставка: ${delivery}\n` +
          `${order.city ? `🏙  ${order.city}` : ''}${order.nova_poshta_warehouse ? `, ${order.nova_poshta_warehouse}` : ''}\n\n` +
          `🛒  <b>Товари:</b>\n${itemsText}\n\n` +
          `💰  <b>Разом: ₴${order.total}</b>${order.discount > 0 ? ` (знижка ₴${order.discount})` : ''}`
        await botReply(botToken, chatId, supabase, [{
          type: 'text', text,
          replyMarkup: { inline_keyboard: [[{ text: '◀️  Мої замовлення', callback_data: 'action_my_orders' }], [{ text: '◀️  Меню', callback_data: 'action_menu' }]] },
        }])
        return new Response('OK', { status: 200 })
      }

      // ── ADMIN: Menu ──
      if (cb === 'admin_menu') {
        if (!(await isAdmin(telegramUserId, supabase))) {
          await botReply(botToken, chatId, supabase, [{ type: 'text', text: '🔒  У вас немає доступу.', replyMarkup: backToMenuKeyboard() }])
          return new Response('OK', { status: 200 })
        }
        await botReply(botToken, chatId, supabase, [{
          type: 'text',
          text: '⚙️  <b>Адмін-панель</b>\n\n<i>Оберіть розділ:</i>',
          replyMarkup: adminMenuKeyboard(telegramUserId),
        }])
        return new Response('OK', { status: 200 })
      }

      // ── ADMIN: Orders ──
      if (cb === 'admin_orders' || cb.startsWith('admin_orders_p')) {
        if (!(await isAdmin(telegramUserId, supabase))) { await botReply(botToken, chatId, supabase, [{ type: 'text', text: '🔒  Доступ обмежено.', replyMarkup: backToMenuKeyboard() }]); return new Response('OK', { status: 200 }) }
        const page = cb.startsWith('admin_orders_p') ? parseInt(cb.replace('admin_orders_p', '')) : 0
        await handleAdminOrders(botToken, chatId, supabase, page)
        return new Response('OK', { status: 200 })
      }

      if (cb.startsWith('admin_order_')) {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        await handleAdminOrderDetail(botToken, chatId, supabase, cb.replace('admin_order_', ''))
        return new Response('OK', { status: 200 })
      }

      if (cb.startsWith('admin_setstatus_')) {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        const remainder = cb.replace('admin_setstatus_', '')
        const lastUnderscore = remainder.lastIndexOf('_')
        const orderId = remainder.substring(0, lastUnderscore)
        const newStatus = remainder.substring(lastUnderscore + 1)
        await supabase.from('orders').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', orderId)
        await handleAdminOrderDetail(botToken, chatId, supabase, orderId)
        return new Response('OK', { status: 200 })
      }

      if (cb.startsWith('admin_setpay_')) {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        const remainder = cb.replace('admin_setpay_', '')
        const lastUnderscore = remainder.lastIndexOf('_')
        const orderId = remainder.substring(0, lastUnderscore)
        const newPayStatus = remainder.substring(lastUnderscore + 1)
        await supabase.from('orders').update({ payment_status: newPayStatus, updated_at: new Date().toISOString() }).eq('id', orderId)
        await handleAdminOrderDetail(botToken, chatId, supabase, orderId)
        return new Response('OK', { status: 200 })
      }

      // ── ADMIN: Products ──
      if (cb === 'admin_products') {
        if (!(await isAdmin(telegramUserId, supabase))) { await botReply(botToken, chatId, supabase, [{ type: 'text', text: '🔒  Доступ обмежено.', replyMarkup: backToMenuKeyboard() }]); return new Response('OK', { status: 200 }) }
        await handleAdminProducts(botToken, chatId, supabase)
        return new Response('OK', { status: 200 })
      }

      // ── ADMIN: Category products from search ──
      if (cb.startsWith('admin_cat_')) {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        const categoryId = cb.replace('admin_cat_', '')
        const { data: cat } = await supabase.from('categories').select('name').eq('id', categoryId).single()
        const { data: products } = await supabase.from('products')
          .select('id, name, brand, price, is_active')
          .eq('category_id', categoryId)
          .order('created_at', { ascending: false })
          .limit(15)
        const buttons: any[] = []
        if (products?.length) {
          for (const p of products) {
            const active = p.is_active ? '🟢' : '🔴'
            buttons.push([{ text: `${active}  ${p.name} — ₴${p.price}`, callback_data: `admin_prod_${p.id}` }])
          }
        }
        buttons.push([{ text: '🔍  Шукати ще', callback_data: 'admin_products' }])
        buttons.push([{ text: '◀️  Адмін-панель', callback_data: 'admin_menu' }])
        await botReply(botToken, chatId, supabase, [{
          type: 'text',
          text: `📂  <b>${cat?.name || 'Категорія'}</b> — ${products?.length || 0} товарів:`,
          replyMarkup: { inline_keyboard: buttons },
        }])
        return new Response('OK', { status: 200 })
      }

      if (cb.startsWith('admin_prod_toggle_')) {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        const productId = cb.replace('admin_prod_toggle_', '')
        const { data: prod } = await supabase.from('products').select('*, categories(name)').eq('id', productId).single()
        if (prod) {
          const wasInactive = !prod.is_active
          await supabase.from('products').update({ is_active: !prod.is_active }).eq('id', productId)
          // Channel posting disabled for now
          // if (wasInactive) {
          //   try { await postProductToChannel(botToken, { ...prod, is_active: true }, prod.categories) } catch (e) { console.error('Channel post error:', e) }
          // }
        }
        await handleAdminProductDetail(botToken, chatId, supabase, productId)
        return new Response('OK', { status: 200 })
      }

      if (cb.startsWith('admin_prod_best_')) {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        const productId = cb.replace('admin_prod_best_', '')
        const { data: prod } = await supabase.from('products').select('best_seller').eq('id', productId).single()
        if (prod) await supabase.from('products').update({ best_seller: !prod.best_seller }).eq('id', productId)
        await handleAdminProductDetail(botToken, chatId, supabase, productId)
        return new Response('OK', { status: 200 })
      }

      if (cb.startsWith('admin_prod_setprice_')) {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        const productId = cb.replace('admin_prod_setprice_', '')
        await setRegState(chatId, 'admin_awaiting_price', productId, supabase)
        await botReply(botToken, chatId, supabase, [{
          type: 'text',
          text: '💰  <b>Нова ціна</b>\n\n<i>Введіть число (наприклад: 450)</i>',
          replyMarkup: cancelKeyboard(),
        }])
        return new Response('OK', { status: 200 })
      }

      if (cb.startsWith('admin_prod_setname_')) {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        const productId = cb.replace('admin_prod_setname_', '')
        await setRegState(chatId, 'admin_awaiting_name', productId, supabase)
        await botReply(botToken, chatId, supabase, [{
          type: 'text',
          text: '✏️  <b>Нова назва товару</b>\n\n<i>Введіть нову назву:</i>',
          replyMarkup: cancelKeyboard(),
        }])
        return new Response('OK', { status: 200 })
      }

      if (cb.startsWith('admin_prod_setbrand_')) {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        const productId = cb.replace('admin_prod_setbrand_', '')
        await setRegState(chatId, 'admin_awaiting_brand', productId, supabase)
        await botReply(botToken, chatId, supabase, [{
          type: 'text',
          text: '🏷  <b>Новий бренд</b>\n\n<i>Введіть назву бренду:</i>',
          replyMarkup: cancelKeyboard(),
        }])
        return new Response('OK', { status: 200 })
      }

      if (cb.startsWith('admin_prod_setdesc_')) {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        const productId = cb.replace('admin_prod_setdesc_', '')
        await setRegState(chatId, 'admin_awaiting_desc', productId, supabase)
        await botReply(botToken, chatId, supabase, [{
          type: 'text',
          text: '📝  <b>Новий опис товару</b>\n\n<i>Надішліть текст опису:</i>',
          replyMarkup: cancelKeyboard(),
        }])
        return new Response('OK', { status: 200 })
      }

      if (cb.startsWith('admin_prod_setingr_')) {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        const productId = cb.replace('admin_prod_setingr_', '')
        await setRegState(chatId, 'admin_awaiting_ingr', productId, supabase)
        await botReply(botToken, chatId, supabase, [{
          type: 'text',
          text: '🧪  <b>Інгредієнти</b>\n\n<i>Надішліть склад/інгредієнти:</i>',
          replyMarkup: cancelKeyboard(),
        }])
        return new Response('OK', { status: 200 })
      }

      if (cb.startsWith('admin_prod_setusage_')) {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        const productId = cb.replace('admin_prod_setusage_', '')
        await setRegState(chatId, 'admin_awaiting_usage', productId, supabase)
        await botReply(botToken, chatId, supabase, [{
          type: 'text',
          text: '💡  <b>Інструкція з застосування</b>\n\n<i>Надішліть текст інструкції:</i>',
          replyMarkup: cancelKeyboard(),
        }])
        return new Response('OK', { status: 200 })
      }


      if (cb.startsWith('admin_prod_delete_')) {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        const productId = cb.replace('admin_prod_delete_', '')
        await setRegState(chatId, 'admin_confirm_delete', productId, supabase)
        await botReply(botToken, chatId, supabase, [{
          type: 'text',
          text: '⚠️  <b>Видалити товар?</b>\n\n<i>Цю дію неможливо скасувати!</i>',
          replyMarkup: { inline_keyboard: [
            [{ text: '🗑  Так, видалити', callback_data: `admin_prod_confirm_del_${productId}` }],
            [{ text: '❌  Ні, повернутись', callback_data: `admin_prod_${productId}` }],
          ]},
        }])
        return new Response('OK', { status: 200 })
      }

      if (cb.startsWith('admin_prod_confirm_del_')) {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        const productId = cb.replace('admin_prod_confirm_del_', '')
        await supabase.from('products').delete().eq('id', productId)
        await clearRegState(chatId, supabase)
        await botReply(botToken, chatId, supabase, [{ type: 'text', text: '✅  Товар видалено.', replyMarkup: { inline_keyboard: [[{ text: '◀️  Товари', callback_data: 'admin_products' }]] } }])
        return new Response('OK', { status: 200 })
      }

      // ── ADMIN: Delete promo photo ──
      if (cb.startsWith('admin_prod_delpromo_')) {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        const productId = cb.replace('admin_prod_delpromo_', '')
        const { data: p } = await supabase.from('products').select('id, name, promo_photo').eq('id', productId).single()
        if (!p) { await botReply(botToken, chatId, supabase, [{ type: 'text', text: '❌  Товар не знайдено.', replyMarkup: adminBackKeyboard() }]); return new Response('OK', { status: 200 }) }
        if (!p.promo_photo) {
          await botReply(botToken, chatId, supabase, [{
            type: 'text', text: 'ℹ️  У цього товару немає промо-фото.',
            replyMarkup: { inline_keyboard: [[{ text: '◀️  До товару', callback_data: `admin_prod_${productId}` }]] },
          }])
          return new Response('OK', { status: 200 })
        }

        // Try to remove file from storage (path inside product-images bucket)
        try {
          const url = p.promo_photo as string
          const marker = '/product-images/'
          const idx = url.indexOf(marker)
          if (idx !== -1) {
            const path = url.slice(idx + marker.length).split('?')[0]
            await supabase.storage.from('product-images').remove([path])
          }
        } catch (e) {
          console.error('Promo file delete (non-fatal):', e)
        }

        await supabase.from('products').update({ promo_photo: null }).eq('id', productId)

        await botReply(botToken, chatId, supabase, [{
          type: 'text',
          text: `✅  Промо-фото видалено для «${p.name}».`,
          replyMarkup: { inline_keyboard: [
            [{ text: '✨  Створити нове промо', callback_data: `ai_promo_prod_${productId}` }],
            [{ text: '◀️  До товару', callback_data: `admin_prod_${productId}` }],
          ]},
        }])
        return new Response('OK', { status: 200 })
      }

      // ── ADMIN: Replace product main photo (white background via AI) — uses existing image ──
      if (cb.startsWith('admin_prod_rephoto_')) {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        const productId = cb.replace('admin_prod_rephoto_', '')
        const { data: p } = await supabase.from('products').select('id, name, image').eq('id', productId).single()
        if (!p) { await botReply(botToken, chatId, supabase, [{ type: 'text', text: '❌  Товар не знайдено.', replyMarkup: adminBackKeyboard() }]); return new Response('OK', { status: 200 }) }
        if (!p.image) {
          await botReply(botToken, chatId, supabase, [{
            type: 'text',
            text: '❌  У товару немає основного фото для переробки.',
            replyMarkup: { inline_keyboard: [[{ text: '◀️  До товару', callback_data: `admin_prod_${productId}` }]] },
          }])
          return new Response('OK', { status: 200 })
        }

        await botReply(botToken, chatId, supabase, [{ type: 'text', text: '🎨  Переробляю фото на білому фоні...' }])

        try {
          // Fetch existing image and convert to base64 data URL with proper MIME detection
          const imgRes = await fetch(p.image)
          if (!imgRes.ok) throw new Error('Не вдалося завантажити поточне фото')
          const buf = await imgRes.arrayBuffer()
          const bytes = new Uint8Array(buf)

          let ct = 'image/jpeg'
          if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) ct = 'image/png'
          else if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ct = 'image/jpeg'
          else if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) ct = 'image/gif'
          else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) ct = 'image/webp'
          else {
            const headerCt = (imgRes.headers.get('content-type') || '').split(';')[0].trim()
            if (headerCt.startsWith('image/') && headerCt !== 'image/octet-stream') ct = headerCt
          }

          let bin = ''
          const CHUNK = 0x8000
          for (let i = 0; i < bytes.length; i += CHUNK) {
            bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)))
          }
          const base64 = btoa(bin)
          const dataUrl = `data:${ct};base64,${base64}`

          const cleaned = await invokeInternalFunction('generate-product-photo', {
            image: dataUrl,
            productName: p.name,
          })

          if (!cleaned?.image) throw new Error('AI не повернув зображення')

          const newImageUrl = await uploadGeneratedImageToStorage(cleaned.image, supabase, productId)
          await supabase.from('products').update({ image: newImageUrl }).eq('id', productId)

          await botReply(botToken, chatId, supabase, [{
            type: 'photo',
            text: `✅  <b>Фото оновлено!</b>\n\n«${p.name}» тепер на чистому білому фоні.`,
            photo: newImageUrl,
            replyMarkup: { inline_keyboard: [
              [{ text: '🔄  Переробити ще раз', callback_data: `admin_prod_rephoto_${productId}` }],
              [{ text: '🌐  Переглянути на сайті', url: `https://karamellu.online/product/${productId}` }],
              [{ text: '◀️  До товару', callback_data: `admin_prod_${productId}` }],
            ]},
          }])
        } catch (err: any) {
          console.error('Rephoto error:', err)
          await botReply(botToken, chatId, supabase, [{
            type: 'text',
            text: `❌  Не вдалося обробити фото: ${err.message || 'невідома помилка'}`,
            replyMarkup: { inline_keyboard: [
              [{ text: '🔄  Спробувати ще', callback_data: `admin_prod_rephoto_${productId}` }],
              [{ text: '◀️  До товару', callback_data: `admin_prod_${productId}` }],
            ]},
          }])
        }
        return new Response('OK', { status: 200 })
      }

      if (cb.startsWith('admin_prod_')) {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        await handleAdminProductDetail(botToken, chatId, supabase, cb.replace('admin_prod_', ''))
        return new Response('OK', { status: 200 })
      }

      // ── ADMIN: AI Scanner ──
      if (cb === 'ai_scanner') {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        await setRegState(chatId, 'scanner_awaiting_front_photo', null, supabase)
        await botReply(botToken, chatId, supabase, [{
          type: 'text',
          text: '📸  <b>AI-сканер товару</b>\n\nНадішліть фото <b>передньої сторони</b> товару.\n\n<i>AI розпізнає назву, бренд, склад, створить професійне фото та додасть товар на сайт!</i>',
          replyMarkup: cancelKeyboard(),
        }])
        return new Response('OK', { status: 200 })
      }

      // ── ADMIN: Batch AI Scanner (multiple products in a row) ──
      if (cb === 'ai_batch_scanner') {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        const initData = JSON.stringify({ batch_mode: true, batch_count: 0 })
        await setRegState(chatId, 'scanner_awaiting_front_photo', initData, supabase)
        await botReply(botToken, chatId, supabase, [{
          type: 'text',
          text: '📦  <b>Пакетне сканування</b>\n\nДоданих товарів: <b>0</b>\n\n📸  Надішліть фото <b>передньої сторони</b> першого товару.\n\n<i>Після ціни товар автоматично додасться, і бот попросить наступне фото. Натискайте «Завершити пакет» коли закінчите.</i>',
          replyMarkup: { inline_keyboard: [[{ text: '❌  Скасувати пакет', callback_data: 'action_cancel' }]] },
        }])
        return new Response('OK', { status: 200 })
      }

      // Finish batch scanning — just return to admin menu
      if (cb === 'batch_finish') {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        const { data: state } = await supabase.from('telegram_registration_state').select('nickname').eq('chat_id', chatId).single()
        let count = 0
        try { const d = JSON.parse(state?.nickname || '{}'); count = d.batch_count || 0 } catch {}
        await clearRegState(chatId, supabase)
        await botReply(botToken, chatId, supabase, [{
          type: 'text',
          text: `✅  <b>Пакетне сканування завершено</b>\n\nДодано товарів: <b>${count}</b>`,
          replyMarkup: adminMenuKeyboard(telegramUserId),
        }])
        return new Response('OK', { status: 200 })
      }

      if (cb === 'scanner_skip_back') {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        const { data: state } = await supabase.from('telegram_registration_state').select('nickname').eq('chat_id', chatId).single()
        if (!state?.nickname) return new Response('OK', { status: 200 })
        await processScannedProduct(botToken, chatId, supabase, state.nickname)
        return new Response('OK', { status: 200 })
      }

      // Show all categories when user clicks "choose other"
      if (cb === 'scanner_show_all_cats') {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        const { data: state } = await supabase.from('telegram_registration_state').select('nickname').eq('chat_id', chatId).single()
        if (!state?.nickname) return new Response('OK', { status: 200 })
        const { data: categories } = await supabase.from('categories').select('id, name').order('sort_order')
        const catButtons = (categories || []).map((c: any) => [{ text: `📂  ${c.name}`, callback_data: `scanner_cat_${c.id}` }])
        await botReply(botToken, chatId, supabase, [{
          type: 'text',
          text: '📂  <b>Оберіть категорію:</b>',
          replyMarkup: { inline_keyboard: [...catButtons, [{ text: '❌  Скасувати', callback_data: 'action_cancel' }]] },
        }])
        return new Response('OK', { status: 200 })
      }

      if (cb.startsWith('scanner_cat_')) {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        const categoryId = cb.replace('scanner_cat_', '')
        const { data: state } = await supabase.from('telegram_registration_state').select('nickname').eq('chat_id', chatId).single()
        if (!state?.nickname) return new Response('OK', { status: 200 })
        let scanData: any = {}
        try { scanData = JSON.parse(state.nickname) } catch {}
        scanData.category_id = categoryId
        await setRegState(chatId, 'scanner_awaiting_price', JSON.stringify(scanData), supabase)
        await botReply(botToken, chatId, supabase, [{
          type: 'text',
          text: `💰  <b>Вкажіть ціну</b> (₴)\n\n${scanData.suggestedPrice ? `AI рекомендує: ₴${scanData.suggestedPrice}` : 'Введіть ціну:'}\n\n<i>Наприклад: 450</i>`,
          replyMarkup: scanData.suggestedPrice ? { inline_keyboard: [
            [{ text: `✅  ₴${scanData.suggestedPrice} (рекомендована)`, callback_data: `scanner_price_${scanData.suggestedPrice}` }],
            [{ text: '❌  Скасувати', callback_data: 'action_cancel' }],
          ]} : cancelKeyboard(),
        }])
        return new Response('OK', { status: 200 })
      }

      if (cb.startsWith('scanner_price_')) {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        const price = parseInt(cb.replace('scanner_price_', ''))
        const { data: state } = await supabase.from('telegram_registration_state').select('nickname').eq('chat_id', chatId).single()
        if (!state?.nickname) return new Response('OK', { status: 200 })
        let scanData: any = {}
        try { scanData = JSON.parse(state.nickname) } catch {}
        scanData.finalPrice = price
        await finalizeScannedProduct(botToken, chatId, supabase, scanData)
        return new Response('OK', { status: 200 })
      }

      // ── ADMIN: Create promo (photo) for product ──
      if (cb.startsWith('ai_promo_prod_')) {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        const productId = cb.replace('ai_promo_prod_', '')
        const { data: p } = await supabase.from('products').select('*').eq('id', productId).single()
        if (!p) { await botReply(botToken, chatId, supabase, [{ type: 'text', text: '❌  Товар не знайдено.', replyMarkup: adminBackKeyboard() }]); return new Response('OK', { status: 200 }) }

        await botReply(botToken, chatId, supabase, [{ type: 'text', text: '✨  Створюю промо-фото...' }])

        try {
          // Step 1: Generate promo photo
          const photoData = await invokeInternalFunction('generate-promo-content', {
            type: 'photo',
            productName: p.name,
            productBrand: p.brand,
            productDescription: p.description,
            productImage: p.image,
          })

          if (!photoData?.image) throw new Error('AI не згенерував зображення')

          const imageUrl = await uploadGeneratedImageToStorage(photoData.image, supabase, productId)
          await supabase.from('products').update({ promo_photo: imageUrl }).eq('id', productId)

          await botReply(botToken, chatId, supabase, [{
            type: 'photo',
            text: `✅  <b>Промо-фото для "${p.name}" створено!</b>\n\n📸  Рекламне фото збережено на сторінку товару.`,
            photo: imageUrl,
            replyMarkup: { inline_keyboard: [
              [{ text: '🌐  Переглянути на сайті', url: `https://karamellu.online/product/${productId}` }],
              [{ text: '◀️  До товару', callback_data: `admin_prod_${productId}` }],
            ]},
          }])
        } catch (err: any) {
          console.error('AI promo error:', err)
          await botReply(botToken, chatId, supabase, [{
            type: 'text', text: `❌  ${err.message}`,
            replyMarkup: { inline_keyboard: [[{ text: '🔄  Спробувати ще', callback_data: `ai_promo_prod_${productId}` }], [{ text: '◀️  До товару', callback_data: `admin_prod_${productId}` }]] },
          }])
        }
        return new Response('OK', { status: 200 })
      }

      // ── ADMIN: Promos ──
      if (cb === 'admin_promos') {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        await handleAdminPromos(botToken, chatId, supabase)
        return new Response('OK', { status: 200 })
      }

      if (cb === 'admin_promo_new') {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        await setRegState(chatId, 'admin_awaiting_promo_code', null, supabase)
        await botReply(botToken, chatId, supabase, [{
          type: 'text',
          text: '🎟  <b>Новий промокод</b>\n\n<i>Введіть код (латиниця, цифри):</i>',
          replyMarkup: cancelKeyboard(),
        }])
        return new Response('OK', { status: 200 })
      }

      if (cb.startsWith('admin_promo_toggle_')) {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        const promoId = cb.replace('admin_promo_toggle_', '')
        const { data: promo } = await supabase.from('promo_codes').select('is_active').eq('id', promoId).single()
        if (promo) await supabase.from('promo_codes').update({ is_active: !promo.is_active }).eq('id', promoId)
        await handleAdminPromos(botToken, chatId, supabase)
        return new Response('OK', { status: 200 })
      }

      if (cb.startsWith('admin_promo_del_')) {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        await supabase.from('promo_codes').delete().eq('id', cb.replace('admin_promo_del_', ''))
        await handleAdminPromos(botToken, chatId, supabase)
        return new Response('OK', { status: 200 })
      }

      if (cb.startsWith('admin_promo_') && !cb.startsWith('admin_promo_new') && !cb.startsWith('admin_promo_toggle_') && !cb.startsWith('admin_promo_del_')) {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        const promoId = cb.replace('admin_promo_', '')
        const { data: promo } = await supabase.from('promo_codes').select('*').eq('id', promoId).single()
        if (!promo) { await handleAdminPromos(botToken, chatId, supabase); return new Response('OK', { status: 200 }) }

        const type = promo.discount_type === 'percent' ? `${promo.value}%` : `₴${promo.value}`
        const active = promo.is_active ? '🟢  Активний' : '🔴  Вимкнений'
        const uses = promo.max_uses ? `${promo.current_uses || 0}/${promo.max_uses}` : `${promo.current_uses || 0}/∞`
        let exp = 'Без обмежень'
        if (promo.expires_at) exp = new Date(promo.expires_at).toLocaleDateString('uk-UA')

        await botReply(botToken, chatId, supabase, [{
          type: 'text',
          text: `🎟  <b>Промокод: ${promo.code}</b>\n\n💰  Знижка: ${type}\n${active}\n📊  Використання: ${uses}\n📅  Діє до: ${exp}\n${promo.min_order ? `🛒  Мін. замовлення: ₴${promo.min_order}` : ''}`,
          replyMarkup: { inline_keyboard: [
            [{ text: promo.is_active ? '🔴  Вимкнути' : '🟢  Увімкнути', callback_data: `admin_promo_toggle_${promo.id}` }],
            [{ text: '🗑  Видалити', callback_data: `admin_promo_del_${promo.id}` }],
            [{ text: '◀️  Промокоди', callback_data: 'admin_promos' }],
          ]},
        }])
        return new Response('OK', { status: 200 })
      }

      // ── ADMIN: News ──
      if (cb === 'admin_news') {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        await setRegState(chatId, 'admin_awaiting_news', null, supabase)
        await botReply(botToken, chatId, supabase, [{
          type: 'text',
          text: `📢  <b>Новини в канал</b>\n\n<i>Напишіть текст для публікації в ${CHANNEL_USERNAME}:</i>`,
          replyMarkup: cancelKeyboard(),
        }])
        return new Response('OK', { status: 200 })
      }

      // ── ADMIN: Stats ──
      if (cb === 'admin_stats') {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        await handleAdminStats(botToken, chatId, supabase)
        return new Response('OK', { status: 200 })
      }

      // ── ADMIN: Users ──
      if (cb === 'admin_users') {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        await handleAdminUsers(botToken, chatId, supabase)
        return new Response('OK', { status: 200 })
      }

      if (cb.startsWith('admin_grant_')) {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        const userId = cb.replace('admin_grant_', '')
        await supabase.from('user_roles').upsert({ user_id: userId, role: 'admin' }, { onConflict: 'user_id,role' })
        await handleAdminUsers(botToken, chatId, supabase)
        return new Response('OK', { status: 200 })
      }

      if (cb.startsWith('admin_revoke_')) {
        if (!(await isAdmin(telegramUserId, supabase))) return new Response('OK', { status: 200 })
        const userId = cb.replace('admin_revoke_', '')
        await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'admin')
        await handleAdminUsers(botToken, chatId, supabase)
        return new Response('OK', { status: 200 })
      }

      return new Response('OK', { status: 200 })
    }

    // ── Handle messages ──
    if (!update.message) return new Response('OK', { status: 200 })

    const chatId = update.message.chat.id
    const telegramUserId = update.message.from.id
    const firstName = update.message.from.first_name || ''
    const username = update.message.from.username || ''
    const text = update.message.text || ''
    const userMsgId = update.message.message_id

    // ── Handle photo messages (scanner) ──
    if (update.message.photo?.length) {
      const regState = await getRegState(chatId, supabase)

      // ── ADMIN: Replace product main photo with AI-cleaned (white background) ──
      if (regState?.step === 'admin_awaiting_replace_photo' && regState.nickname) {
        const productId = regState.nickname
        const photo = update.message.photo[update.message.photo.length - 1]
        const photoUrl = await getTelegramPhotoUrl(botToken, photo.file_id)

        await botReply(botToken, chatId, supabase, [{ type: 'text', text: '🎨  Обробляю фото на білому фоні...' }])

        try {
          const { data: p } = await supabase.from('products').select('id, name').eq('id', productId).single()
          if (!p) throw new Error('Товар не знайдено')

          // Convert telegram photo URL to base64 data URL for AI
          const imgRes = await fetch(photoUrl)
          if (!imgRes.ok) throw new Error('Не вдалося завантажити фото')
          const buf = await imgRes.arrayBuffer()
          const bytes = new Uint8Array(buf)

          // Detect real MIME type from magic bytes (Telegram often returns application/octet-stream)
          let ct = 'image/jpeg'
          if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) ct = 'image/png'
          else if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ct = 'image/jpeg'
          else if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) ct = 'image/gif'
          else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) ct = 'image/webp'
          else {
            const headerCt = (imgRes.headers.get('content-type') || '').split(';')[0].trim()
            if (headerCt.startsWith('image/') && headerCt !== 'image/octet-stream') ct = headerCt
          }

          // Encode to base64 in chunks (avoid stack overflow on large images)
          let bin = ''
          const CHUNK = 0x8000
          for (let i = 0; i < bytes.length; i += CHUNK) {
            bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)))
          }
          const base64 = btoa(bin)
          const dataUrl = `data:${ct};base64,${base64}`

          // Call AI to clean the background
          const cleaned = await invokeInternalFunction('generate-product-photo', {
            image: dataUrl,
            productName: p.name,
          })

          if (!cleaned?.image) throw new Error('AI не повернув зображення')

          const newImageUrl = await uploadGeneratedImageToStorage(cleaned.image, supabase, productId)
          await supabase.from('products').update({ image: newImageUrl }).eq('id', productId)
          await clearRegState(chatId, supabase)

          await botReply(botToken, chatId, supabase, [{
            type: 'photo',
            text: `✅  <b>Фото оновлено!</b>\n\n«${p.name}» тепер на чистому білому фоні.`,
            photo: newImageUrl,
            replyMarkup: { inline_keyboard: [
              [{ text: '🌐  Переглянути на сайті', url: `https://karamellu.online/product/${productId}` }],
              [{ text: '◀️  До товару', callback_data: `admin_prod_${productId}` }],
            ]},
          }], userMsgId)
        } catch (err: any) {
          console.error('Replace photo error:', err)
          await botReply(botToken, chatId, supabase, [{
            type: 'text',
            text: `❌  Не вдалося обробити фото: ${err.message || 'невідома помилка'}`,
            replyMarkup: { inline_keyboard: [
              [{ text: '🔄  Спробувати ще', callback_data: `admin_prod_rephoto_${productId}` }],
              [{ text: '◀️  До товару', callback_data: `admin_prod_${productId}` }],
            ]},
          }], userMsgId)
        }
        return new Response('OK', { status: 200 })
      }

      if (regState?.step === 'scanner_awaiting_front_photo') {
        const photo = update.message.photo[update.message.photo.length - 1]
        const photoUrl = await getTelegramPhotoUrl(botToken, photo.file_id)
        // Preserve batch_mode/batch_count from previous state if present
        let prev: any = {}
        try { if (regState.nickname) prev = JSON.parse(regState.nickname) } catch {}
        const scanData = JSON.stringify({ photos: [photoUrl], batch_mode: !!prev.batch_mode, batch_count: prev.batch_count || 0 })
        await setRegState(chatId, 'scanner_awaiting_back_photo', scanData, supabase)
        const cancelBtn = prev.batch_mode
          ? [{ text: '✅  Завершити пакет', callback_data: 'batch_finish' }]
          : [{ text: '❌  Скасувати', callback_data: 'action_cancel' }]
        await botReply(botToken, chatId, supabase, [{
          type: 'text',
          text: '✅  Фото отримано!\n\n📸  Надішліть фото <b>задньої сторони</b> (склад)\nабо натисніть кнопку нижче:',
          replyMarkup: { inline_keyboard: [[{ text: '⏭  Пропустити (без складу)', callback_data: 'scanner_skip_back' }], cancelBtn] },
        }], userMsgId)
        return new Response('OK', { status: 200 })
      }

      if (regState?.step === 'scanner_awaiting_back_photo' && regState.nickname) {
        const photo = update.message.photo[update.message.photo.length - 1]
        const photoUrl = await getTelegramPhotoUrl(botToken, photo.file_id)
        let scanData: any = {}
        try { scanData = JSON.parse(regState.nickname) } catch {}
        scanData.photos.push(photoUrl)
        await processScannedProduct(botToken, chatId, supabase, JSON.stringify(scanData))
        return new Response('OK', { status: 200 })
      }

      // If admin sends a photo outside scanner — offer to start scanner
      if (await isAdmin(telegramUserId, supabase)) {
        await setRegState(chatId, 'scanner_awaiting_front_photo', null, supabase)
        // Treat this photo as the front photo
        const photo = update.message.photo[update.message.photo.length - 1]
        const photoUrl = await getTelegramPhotoUrl(botToken, photo.file_id)
        const scanData = JSON.stringify({ photos: [photoUrl] })
        await setRegState(chatId, 'scanner_awaiting_back_photo', scanData, supabase)
        await botReply(botToken, chatId, supabase, [{
          type: 'text',
          text: '📸  <b>AI-сканер</b>\n\nФото отримано! Надішліть фото <b>задньої сторони</b> (склад)\nабо натисніть кнопку нижче:',
          replyMarkup: { inline_keyboard: [[{ text: '⏭  Пропустити (без складу)', callback_data: 'scanner_skip_back' }], [{ text: '❌  Скасувати', callback_data: 'action_cancel' }]] },
        }], userMsgId)
        return new Response('OK', { status: 200 })
      }

      // Unknown photo from non-admin — show menu
      await botReply(botToken, chatId, supabase, [{
        type: 'text', text: '✨  <b>Карамель LU</b>\n\nОберіть дію:',
        replyMarkup: clientMenuKeyboard(false),
      }], userMsgId)
      return new Response('OK', { status: 200 })
    }

    // ── Text state handling ──
    const regState = await getRegState(chatId, supabase)
    if (regState) {
      // Smart search
      if (regState.step === 'awaiting_search') {
        await clearRegState(chatId, supabase)
        const query = text.trim().toLowerCase()
        if (query.length < 2) {
          await botReply(botToken, chatId, supabase, [{ type: 'text', text: '❌  Запит занадто короткий. Напишіть хоча б 2 символи.', replyMarkup: { inline_keyboard: [[{ text: '🔍  Спробувати ще', callback_data: 'action_search' }], [{ text: '◀️  Меню', callback_data: 'action_menu' }]] } }], userMsgId)
          return new Response('OK', { status: 200 })
        }

        // Keyword synonyms for smart matching
        const synonyms: Record<string, string[]> = {
          'волосся': ['шампунь', 'кондиціонер', 'маска для волосся', 'бальзам', 'hair', 'shampoo', 'conditioner'],
          'волос': ['шампунь', 'кондиціонер', 'маска для волосся', 'бальзам', 'hair', 'shampoo', 'conditioner'],
          'шкіра': ['крем', 'сироватка', 'тонік', 'лосьйон', 'скраб', 'skin', 'cream', 'serum'],
          'лице': ['крем для обличчя', 'сироватка', 'маска', 'тонік', 'face', 'обличчя'],
          'обличчя': ['крем для обличчя', 'сироватка', 'маска', 'тонік', 'face'],
          'губи': ['помада', 'бальзам для губ', 'блиск', 'lip', 'lipstick'],
          'тіло': ['лосьйон для тіла', 'крем для тіла', 'скраб', 'body', 'масло'],
          'зволоження': ['зволожуючий', 'moisturizing', 'hydrating', 'гіалуронова'],
          'сухість': ['зволожуючий', 'живильний', 'для сухої шкіри'],
          'жирна': ['матуючий', 'для жирної шкіри', 'себорегулюючий'],
          'очищення': ['гель для вмивання', 'пінка', 'міцелярна', 'cleanser'],
          'захист': ['spf', 'сонцезахисний', 'sunscreen'],
          'anti-age': ['антивіковий', 'проти зморшок', 'ретинол', 'пептид'],
          'зморшки': ['антивіковий', 'проти зморшок', 'ретинол', 'anti-age'],
        }

        // Build search terms: original query + synonyms
        const searchTerms = [query]
        for (const [key, vals] of Object.entries(synonyms)) {
          if (query.includes(key)) {
            searchTerms.push(...vals)
          }
        }

        // Search across all product fields
        const orConditions = searchTerms
          .map(t => `name.ilike.%${t}%,brand.ilike.%${t}%,description.ilike.%${t}%,ingredients.ilike.%${t}%,skin_type.ilike.%${t}%`)
          .join(',')

        const { data: prods } = await supabase.from('products').select('id, name, brand, price, image, skin_type, description, category_id')
          .eq('is_active', true).or(orConditions).limit(8)

        // Also search matching categories
        const catOrConditions = searchTerms.map(t => `name.ilike.%${t}%,description.ilike.%${t}%`).join(',')
        const { data: matchingCats } = await supabase.from('categories').select('id, name').or(catOrConditions)

        // Count products per matching category
        let categoryLines: string[] = []
        const categoryBtns: any[] = []
        if (matchingCats?.length) {
          for (const cat of matchingCats) {
            const { count } = await supabase.from('products').select('id', { count: 'exact', head: true })
              .eq('is_active', true).eq('category_id', cat.id)
            categoryLines.push(`📂  <b>${cat.name}</b> — ${count || 0} товарів`)
            categoryBtns.push([{ text: `📂  ${cat.name} (${count || 0})`, callback_data: `cat_${cat.id}` }])
          }
        }

        if (!prods?.length && !matchingCats?.length) {
          await botReply(botToken, chatId, supabase, [{
            type: 'text',
            text: `🔍  За запитом "<b>${text.trim()}</b>" нічого не знайдено.\n\nСпробуйте інший запит — наприклад: <i>волосся, крем, зволоження</i>`,
            replyMarkup: { inline_keyboard: [[{ text: '🔍  Шукати ще', callback_data: 'action_search' }], [{ text: '🛍  Каталог', callback_data: 'action_catalog' }], [{ text: '◀️  Меню', callback_data: 'action_menu' }]] },
          }], userMsgId)
        } else {
          // Build header with categories
          let headerText = `✨  <b>Ви маєте на увазі?</b>\n`
          if (categoryLines.length) {
            headerText += `\n${categoryLines.join('\n')}\n`
          }
          if (prods?.length) {
            headerText += `\nОберіть товар:`
          }

          // Build buttons: categories first, then products
          const allBtns: any[] = [...categoryBtns]
          if (prods?.length) {
            for (const p of prods) {
              allBtns.push([{
                text: `${p.name} — ${p.brand} ₴${p.price}`,
                callback_data: `sp_${p.id}`,
              }])
            }
          }
          allBtns.push([{ text: '🔍  Шукати ще', callback_data: 'action_search' }])
          allBtns.push([{ text: '◀️  Меню', callback_data: 'action_menu' }])

          await botReply(botToken, chatId, supabase, [{
            type: 'text',
            text: headerText,
            replyMarkup: { inline_keyboard: allBtns },
          }], userMsgId)
        }
        return new Response('OK', { status: 200 })
      }

      // Customer AI question
      if (regState.step === 'customer_awaiting_question') {
        await clearRegState(chatId, supabase)
        await botReply(botToken, chatId, supabase, [{ type: 'text', text: '⏳  Шукаю відповідь...' }], userMsgId)
        try {
          const { data: products } = await supabase.from('products').select('name, brand, price, skin_type, description, category_id').eq('is_active', true).limit(50)
          const { data: categories } = await supabase.from('categories').select('id, name')
          const catMap: Record<string, string> = {}
          for (const c of (categories || [])) catMap[c.id] = c.name
          const catalog = (products || []).map((p: any) => `• ${p.name} (${p.brand}) — ₴${p.price}${p.category_id && catMap[p.category_id] ? `, ${catMap[p.category_id]}` : ''}`).join('\n')

          const result = await callAI(
            `Ти — привітний консультант магазину "Карамель LU" ✨. Відповідай українською, дружньо. Рекомендуй товари з каталогу. 3-5 речень.
Каталог:\n${catalog}\nСайт: karamellu.online. Доставка: Нова Пошта, Укрпошта, самовивіз. Оплата: Monobank.`, text
          )
          await botReply(botToken, chatId, supabase, [{
            type: 'text', text: `💬  ${result}`,
            replyMarkup: { inline_keyboard: [[{ text: '💬  Ще питання', callback_data: 'action_ask_ai' }], [{ text: '🛍  Каталог', callback_data: 'action_catalog' }], [{ text: '◀️  Меню', callback_data: 'action_menu' }]] },
          }])
        } catch {
          await botReply(botToken, chatId, supabase, [{
            type: 'text', text: '❌  Не вдалось отримати відповідь. Спробуйте пізніше.',
            replyMarkup: backToMenuKeyboard(),
          }])
        }
        return new Response('OK', { status: 200 })
      }

      // Scanner price input
      if (regState.step === 'scanner_awaiting_price' && regState.nickname) {
        const price = parseFloat(text.replace(',', '.').replace(/[^\d.]/g, ''))
        if (isNaN(price) || price <= 0) {
          await botReply(botToken, chatId, supabase, [{ type: 'text', text: '❌  Введіть число більше 0:', replyMarkup: cancelKeyboard() }], userMsgId)
          return new Response('OK', { status: 200 })
        }
        let scanData: any = {}
        try { scanData = JSON.parse(regState.nickname) } catch {}
        scanData.finalPrice = price
        // Delete user's price message before finalizing
        if (userMsgId) await deleteTelegramMessage(botToken, chatId, userMsgId)
        await finalizeScannedProduct(botToken, chatId, supabase, scanData)
        return new Response('OK', { status: 200 })
      }

      // Admin product search
      if (regState.step === 'admin_product_search') {
        await clearRegState(chatId, supabase)
        const query = text.trim()
        if (query.length < 2) {
          await botReply(botToken, chatId, supabase, [{ type: 'text', text: '❌  Мінімум 2 символи для пошуку.', replyMarkup: { inline_keyboard: [[{ text: '🔍  Спробувати ще', callback_data: 'admin_products' }], [{ text: '◀️  Адмін-панель', callback_data: 'admin_menu' }]] } }], userMsgId)
          return new Response('OK', { status: 200 })
        }
        if (userMsgId) await deleteTelegramMessage(botToken, chatId, userMsgId)
        await handleAdminProductSearch(botToken, chatId, supabase, query)
        return new Response('OK', { status: 200 })
      }

      // Admin price change
      if (regState.step === 'admin_awaiting_price' && regState.nickname) {
        const price = parseFloat(text.replace(',', '.').replace(/[^\d.]/g, ''))
        if (isNaN(price) || price < 0) {
          await botReply(botToken, chatId, supabase, [{ type: 'text', text: '❌  Введіть коректну ціну:', replyMarkup: cancelKeyboard() }], userMsgId)
          return new Response('OK', { status: 200 })
        }
        const productId = regState.nickname
        await supabase.from('products').update({ price }).eq('id', productId)
        await clearRegState(chatId, supabase)
        await handleAdminProductDetail(botToken, chatId, supabase, productId)
        return new Response('OK', { status: 200 })
      }

      // Admin: edit text fields (name/brand/desc/ingr/usage)
      const textFieldMap: Record<string, string> = {
        admin_awaiting_name: 'name',
        admin_awaiting_brand: 'brand',
        admin_awaiting_desc: 'description',
        admin_awaiting_ingr: 'ingredients',
        admin_awaiting_usage: 'usage_instructions',
      }
      if (regState.step && textFieldMap[regState.step] && regState.nickname) {
        const field = textFieldMap[regState.step]
        const value = text.trim()
        const minLen = (field === 'name' || field === 'brand') ? 1 : 2
        if (value.length < minLen) {
          await botReply(botToken, chatId, supabase, [{ type: 'text', text: '❌  Текст занадто короткий. Спробуйте ще:', replyMarkup: cancelKeyboard() }], userMsgId)
          return new Response('OK', { status: 200 })
        }
        const productId = regState.nickname
        const { error } = await supabase.from('products').update({ [field]: value }).eq('id', productId)
        await clearRegState(chatId, supabase)
        if (userMsgId) await deleteTelegramMessage(botToken, chatId, userMsgId)
        if (error) {
          await botReply(botToken, chatId, supabase, [{ type: 'text', text: `❌  Помилка оновлення: ${error.message}`, replyMarkup: { inline_keyboard: [[{ text: '◀️  До товару', callback_data: `admin_prod_${productId}` }]] } }])
        } else {
          await handleAdminProductDetail(botToken, chatId, supabase, productId)
        }
        return new Response('OK', { status: 200 })
      }

      // Admin news
      if (regState.step === 'admin_awaiting_news') {
        if (text.length < 5) {
          await botReply(botToken, chatId, supabase, [{ type: 'text', text: '❌  Текст занадто короткий.', replyMarkup: cancelKeyboard() }], userMsgId)
          return new Response('OK', { status: 200 })
        }
        await clearRegState(chatId, supabase)
        try {
          const caption = `📢  <b>Новини Карамель LU</b>\n\n${text}`
          const buttons = { inline_keyboard: [[{ text: '🌐  Наш магазин', url: 'https://karamellu.online' }]] }
          await sendTelegramMessage(botToken, CHANNEL_USERNAME, caption, buttons)
          await botReply(botToken, chatId, supabase, [{ type: 'text', text: `✅  Опубліковано в ${CHANNEL_USERNAME}!`, replyMarkup: adminBackKeyboard() }], userMsgId)
        } catch (e) {
          await botReply(botToken, chatId, supabase, [{ type: 'text', text: `❌  Помилка: ${(e as Error).message}`, replyMarkup: adminBackKeyboard() }], userMsgId)
        }
        return new Response('OK', { status: 200 })
      }

      // Admin promo code
      if (regState.step === 'admin_awaiting_promo_code') {
        const code = text.toUpperCase().replace(/[^A-Z0-9]/g, '')
        if (code.length < 3) {
          await botReply(botToken, chatId, supabase, [{ type: 'text', text: '❌  Мінімум 3 символи (латиниця/цифри):', replyMarkup: cancelKeyboard() }], userMsgId)
          return new Response('OK', { status: 200 })
        }
        const { data: existing } = await supabase.from('promo_codes').select('id').eq('code', code).single()
        if (existing) {
          await botReply(botToken, chatId, supabase, [{ type: 'text', text: `❌  Код <code>${code}</code> вже існує.`, replyMarkup: cancelKeyboard() }], userMsgId)
          return new Response('OK', { status: 200 })
        }
        await setRegState(chatId, 'admin_awaiting_promo_value', code, supabase)
        await botReply(botToken, chatId, supabase, [{
          type: 'text',
          text: `✅  Код: <code>${code}</code>\n\n<i>Введіть знижку:</i>\n• <code>15%</code> — відсоткова\n• <code>100</code> — фіксована ₴`,
          replyMarkup: cancelKeyboard(),
        }], userMsgId)
        return new Response('OK', { status: 200 })
      }

      if (regState.step === 'admin_awaiting_promo_value' && regState.nickname) {
        const input = text.trim()
        let discountType = 'fixed', value = 0
        if (input.endsWith('%')) { discountType = 'percent'; value = parseFloat(input.replace('%', '')) }
        else value = parseFloat(input.replace(/[^\d.]/g, ''))
        if (isNaN(value) || value <= 0) {
          await botReply(botToken, chatId, supabase, [{ type: 'text', text: '❌  Введіть коректне значення:', replyMarkup: cancelKeyboard() }], userMsgId)
          return new Response('OK', { status: 200 })
        }
        const code = regState.nickname
        const { error } = await supabase.from('promo_codes').insert({ code, discount_type: discountType, value, is_active: true })
        await clearRegState(chatId, supabase)
        if (error) {
          await botReply(botToken, chatId, supabase, [{ type: 'text', text: `❌  ${error.message}`, replyMarkup: adminBackKeyboard() }], userMsgId)
        } else {
          const typeLabel = discountType === 'percent' ? `${value}%` : `₴${value}`
          await botReply(botToken, chatId, supabase, [{
            type: 'text', text: `✅  Промокод <code>${code}</code> створено!\n💰  Знижка: ${typeLabel}`,
            replyMarkup: { inline_keyboard: [[{ text: '◀️  Промокоди', callback_data: 'admin_promos' }]] },
          }], userMsgId)
        }
        return new Response('OK', { status: 200 })
      }

      // Registration: nickname
      if (regState.step === 'awaiting_nickname') {
        const nickname = text.toLowerCase().replace(/[^a-z0-9_]/g, '')
        if (nickname.length < 3 || nickname.length > 20) {
          await botReply(botToken, chatId, supabase, [{ type: 'text', text: '❌  Від 3 до 20 символів (латинські букви, цифри, _).', replyMarkup: cancelKeyboard() }], userMsgId)
          return new Response('OK', { status: 200 })
        }
        const email = `${nickname}@karamellu.local`
        const { data: existingUsers } = await supabase.auth.admin.listUsers()
        if (existingUsers?.users?.some((u: any) => u.email === email)) {
          await botReply(botToken, chatId, supabase, [{ type: 'text', text: `❌  Нікнейм <b>${nickname}</b> зайнятий.`, replyMarkup: cancelKeyboard() }], userMsgId)
          return new Response('OK', { status: 200 })
        }
        await setRegState(chatId, 'awaiting_password', nickname, supabase)
        await botReply(botToken, chatId, supabase, [{
          type: 'text',
          text: `✅  Нікнейм <b>${nickname}</b> вільний!\n\n🔒  Придумайте пароль (мін. 6 символів):`,
          replyMarkup: cancelKeyboard(),
        }], userMsgId)
        return new Response('OK', { status: 200 })
      }

      // Registration: password
      if (regState.step === 'awaiting_password' && regState.nickname) {
        const password = text
        if (password.length < 6) {
          await botReply(botToken, chatId, supabase, [{ type: 'text', text: '❌  Мінімум 6 символів.', replyMarkup: cancelKeyboard() }], userMsgId)
          return new Response('OK', { status: 200 })
        }
        const nickname = regState.nickname
        const email = `${nickname}@karamellu.local`
        await clearRegState(chatId, supabase)

        const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: { full_name: firstName, telegram_username: username },
        })
        if (signUpError) {
          await botReply(botToken, chatId, supabase, [{ type: 'text', text: `❌  ${signUpError.message}`, replyMarkup: backToMenuKeyboard() }], userMsgId)
          return new Response('OK', { status: 200 })
        }
        if (signUpData.user) {
          await supabase.from('telegram_users').upsert({
            telegram_user_id: telegramUserId, user_id: signUpData.user.id,
            telegram_username: username, telegram_first_name: firstName,
          }, { onConflict: 'telegram_user_id' })

          const code = Math.floor(100000 + Math.random() * 900000).toString()
          const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
          await supabase.from('telegram_auth_codes').insert({
            telegram_user_id: telegramUserId, telegram_username: username,
            telegram_first_name: firstName, code, expires_at: expiresAt.toISOString(),
          })
          const loginUrl = `https://karamellu.online/login?tg_code=${code}`

          await botReply(botToken, chatId, supabase, [{
            type: 'text',
            text: `✅  Акаунт <b>${nickname}</b> створено!\n\nНатисніть щоб увійти:`,
            replyMarkup: { inline_keyboard: [[{ text: '🚀  Увійти на сайт', url: loginUrl }], [{ text: '◀️  Меню', callback_data: 'action_menu' }]] },
          }], userMsgId)
        }
        return new Response('OK', { status: 200 })
      }
    }

    // ── Commands ──
    if (text === '/start' || text.startsWith('/start ')) {
      // Don't reset scanner/admin states — only clear non-critical states
      const regState = await getRegState(chatId, supabase)
      const isScannerState = regState?.step?.startsWith('scanner_') || regState?.step === 'admin_awaiting_price'
      if (isScannerState) {
        // Ignore /start during scanner flow — just delete the /start message
        await deleteTelegramMessage(botToken, chatId, userMsgId)
        return new Response('OK', { status: 200 })
      }
      await clearRegState(chatId, supabase)
      const { data: tgUser } = await supabase.from('telegram_users').select('user_id').eq('telegram_user_id', telegramUserId).single()
      const isReg = !!tgUser
      const showAdmin = isReg && await isAdmin(telegramUserId, supabase)

      // Deep-link payload: /start admin_prod_<uuid> → open product detail (admin only)
      const startPayload = text.startsWith('/start ') ? text.slice(7).trim() : ''
      if (startPayload.startsWith('admin_prod_') && showAdmin) {
        const productId = startPayload.replace('admin_prod_', '')
        if (userMsgId) await deleteTelegramMessage(botToken, chatId, userMsgId)
        await handleAdminProductDetail(botToken, chatId, supabase, productId)
        return new Response('OK', { status: 200 })
      }

      if (showAdmin) {
        await botReply(botToken, chatId, supabase, [{
          type: 'text',
          text: `✨  <b>Карамель LU — Адмін</b>\n\nВітаємо, ${firstName}!`,
          replyMarkup: adminMenuKeyboard(telegramUserId),
        }], userMsgId)
      } else {
        await botReply(botToken, chatId, supabase, [{
          type: 'text',
          text: `✨  <b>Карамель LU</b>\n\nВітаємо, ${firstName}!\nОберіть що вас цікавить:`,
          replyMarkup: clientMenuKeyboard(isReg),
        }], userMsgId)
      }
      return new Response('OK', { status: 200 })
    }

    // ── Default: AI consultant disabled (in development), show menu ──
    const isAdminUser = await isAdmin(telegramUserId, supabase)
    if (!isAdminUser && text.length > 2 && !text.startsWith('/')) {
      const { data: tgUser } = await supabase.from('telegram_users').select('user_id').eq('telegram_user_id', telegramUserId).single()
      const keyboard = clientMenuKeyboard(!!tgUser)
      await botReply(botToken, chatId, supabase, [{ type: 'text', text: '✨  <b>Карамель LU</b>\n\nОберіть дію:', replyMarkup: keyboard }])
    } else {
      const { data: tgUser } = await supabase.from('telegram_users').select('user_id').eq('telegram_user_id', telegramUserId).single()
      const keyboard = isAdminUser ? adminMenuKeyboard(telegramUserId) : clientMenuKeyboard(!!tgUser)
      await botReply(botToken, chatId, supabase, [{ type: 'text', text: '✨  <b>Карамель LU</b>\n\nОберіть дію:', replyMarkup: keyboard }], userMsgId)
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response('OK', { status: 200 })
  }
})
