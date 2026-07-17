import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { images, categories } = await req.json();
    if (!images || !Array.isArray(images) || images.length === 0) {
      return new Response(JSON.stringify({ error: "No images provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build category list for the prompt
    const categoryNames = (categories || []).map((c: any) => c.name);
    const categoryInstruction = categoryNames.length > 0
      ? `- category: одна з цих категорій (обери найбільш підходящу): ${categoryNames.map((n: string) => `"${n}"`).join(", ")}`
      : `- category: категорія товару (наприклад: "Креми", "Сироватки", "Очищення")`;

    const content: any[] = [
      {
        type: "text",
        text: `Ти — експерт з косметики та догляду за шкірою. Проаналізуй фото товару (передня та/або задня сторона упаковки) і витягни максимум інформації.

Поверни JSON з такими полями:
- name: назва товару (українською, якщо можливо визначити)
- brand: бренд товару
${categoryInstruction}
- description: детальний рекламний опис товару українською мовою (3-5 речень, привабливий маркетинговий текст)
- ingredients: список інгредієнтів (якщо видно на фото)
- usage_instructions: спосіб застосування українською мовою
- skin_type: один з варіантів: "Для всіх типів шкіри", "Суха", "Жирна", "Чутлива", "Зріла"

Якщо якусь інформацію не вдається розпізнати, залиш порожній рядок для текстових полів.`,
      },
    ];

    for (const img of images) {
      content.push({
        type: "image_url",
        image_url: { url: img },
      });
    }

    const categoryEnum = categoryNames.length > 0 ? { type: "string", enum: categoryNames } : { type: "string" };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content }],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_product_info",
              description: "Extract product information from cosmetic product photos",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  brand: { type: "string" },
                  category: categoryEnum,
                  description: { type: "string" },
                  ingredients: { type: "string" },
                  usage_instructions: { type: "string" },
                  skin_type: {
                    type: "string",
                    enum: ["Для всіх типів шкіри", "Суха", "Жирна", "Чутлива", "Зріла"],
                  },
                },
                required: ["name", "brand", "category", "description", "ingredients", "usage_instructions", "skin_type"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_product_info" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Занадто багато запитів, спробуйте пізніше" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Недостатньо кредитів AI" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    let productInfo;
    if (toolCall?.function?.arguments) {
      productInfo = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } else {
      const text = data.choices?.[0]?.message?.content || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        productInfo = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not parse AI response");
      }
    }

    // Match category name to ID if categories were provided
    if (categories && productInfo.category) {
      const match = (categories as any[]).find(
        (c) => c.name.toLowerCase() === productInfo.category.toLowerCase()
      );
      if (match) {
        productInfo.category_id = match.id;
        productInfo.category_name = match.name;
      }
    }

    return new Response(JSON.stringify({ product: productInfo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-product error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
