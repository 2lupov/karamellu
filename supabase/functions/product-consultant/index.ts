const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured')

    const { message, product, history } = await req.json()

    if (!message || !product?.name) {
      return new Response(JSON.stringify({ error: 'Missing message or product' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const systemPrompt = `Ти — професійний AI-консультант косметичного магазину "Карамель LU". Ти допомагаєш клієнтам розібратися в товарах.

Зараз клієнт переглядає товар:
📦 Назва: ${product.name}
🏷 Бренд: ${product.brand || 'Не вказано'}
💰 Ціна: ₴${product.price || 'Не вказано'}
🧴 Тип шкіри: ${product.skinType || 'Для всіх типів шкіри'}

📝 Опис: ${product.description || 'Немає опису'}

🧪 Інгредієнти: ${product.ingredients || 'Не вказано'}

📋 Інструкція використання: ${product.usage || 'Не вказано'}

Правила:
- Відповідай ТІЛЬКИ українською мовою
- Будь дружнім, професійним та лаконічним (до 3-4 речень)
- Якщо питають про інгредієнти — поясни їх дію, користь та можливі протипоказання
- Якщо питають чи підходить їм — запитай тип шкіри/волосся та порадь
- Якщо не знаєш — чесно скажи і порекомендуй звернутися до дерматолога
- Ніколи не вигадуй інгредієнти або властивості, яких немає в описі
- Можеш рекомендувати товар або порадити альтернативу
- Не використовуй markdown форматування, пиши простим текстом`

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
    ]

    if (history?.length) {
      for (const h of history.slice(-6)) {
        messages.push({ role: h.role, content: h.content })
      }
    }

    messages.push({ role: 'user', content: message })

    const response = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages,
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('AI Gateway error:', response.status, errText)
      throw new Error('Помилка AI сервісу')
    }

    const data = await response.json()
    const reply = data.choices?.[0]?.message?.content || 'Вибачте, не вдалося отримати відповідь.'

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('product-consultant error:', e)
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
