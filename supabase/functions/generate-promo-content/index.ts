const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions'

function extractGatewayImage(data: any): string | null {
  return data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null
}

async function downloadProductImage(productImage?: string) {
  if (!productImage) return null

  try {
    const imgRes = await fetch(productImage)
    if (!imgRes.ok) return null

    const buffer = await imgRes.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    const CHUNK = 8192
    let binary = ''
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
    }

    const mimeType = imgRes.headers.get('content-type') || 'image/png'
    const base64 = btoa(binary)

    return {
      mimeType,
      base64,
      dataUrl: `data:${mimeType};base64,${base64}`,
    }
  } catch (e) {
    console.error('Failed to download product image:', e)
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { type, productName, productBrand, productDescription, productImage } = await req.json()

    if (!type || !productName) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured')
    }

    const prompt = `Create a beautiful lifestyle beauty photo showing a person using the cosmetic product "${productName}" by ${productBrand || 'premium brand'}. Show the product being applied — hands gently applying cream to face, or massaging serum into skin, or styling hair with the product. The product bottle/tube should be visible nearby. Setting: bright bathroom mirror, vanity table, or natural daylight near a window. Style: authentic Instagram beauty content, warm natural lighting, close-up of application process, editorial skin/hair care routine. Show real usage and texture of the product on skin/hair. No text overlays.`

    const productReference = await downloadProductImage(productImage)
    let generatedImage: string | null = null
    const attemptErrors: string[] = []

    const content: any[] = [{ type: 'text', text: prompt }]
    if (productReference?.dataUrl) {
      content.push({ type: 'image_url', image_url: { url: productReference.dataUrl } })
    }

    for (const model of ['google/gemini-3-pro-image-preview', 'google/gemini-3.1-flash-image-preview']) {
      try {
        const response = await fetch(GATEWAY_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content }],
            modalities: ['image', 'text'],
          }),
        })

        if (!response.ok) {
          const errText = await response.text()
          attemptErrors.push(`${model}: ${response.status} ${errText}`)
          continue
        }

        const data = await response.json()
        generatedImage = extractGatewayImage(data)
        if (generatedImage) break
        attemptErrors.push(`${model}: no image returned`)
      } catch (e) {
        attemptErrors.push(`${model}: ${e instanceof Error ? e.message : 'Unknown error'}`)
      }
    }

    if (!generatedImage) {
      const message = attemptErrors.at(-1) || 'No image was generated'
      if (message.includes('402')) {
        return new Response(JSON.stringify({ error: 'Недостатньо AI кредитів' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (message.includes('429')) {
        return new Response(JSON.stringify({ error: 'Забагато запитів, спробуйте за хвилину' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      console.error('Promo content generation attempts failed:', attemptErrors)
      return new Response(JSON.stringify({ error: 'Не вдалося згенерувати зображення' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ image: generatedImage, type }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('generate-promo-content error:', e)
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
