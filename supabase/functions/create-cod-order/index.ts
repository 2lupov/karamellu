// Creates an order with cash-on-delivery payment (no Monobank invoice).
// Sends Telegram notification to the dedicated orders bot.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DELIVERY_LABELS: Record<string, string> = {
  pickup: "Самовивіз (Хмельницький)",
  khmelnytskyi: "Доставка по Хмельницькому (безкоштовно)",
  nova_poshta: "Нова Пошта",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Optional auth (guests allowed)
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const anon = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await anon.auth.getUser();
      if (user) userId = user.id;
    }

    const body = await req.json();
    const {
      items,
      firstName,
      lastName,
      phone,
      deliveryMethod,
      city,
      address,
      novaPoshtaWarehouse,
      npCityRef,
      npWarehouseType,
      notes,
      discount: clientDiscount = 0,
      promoCode,
    } = body;

    if (!items?.length || !firstName || !lastName || !phone || !deliveryMethod) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resolvedCity = deliveryMethod === "nova_poshta" ? city : "Хмельницький";
    const resolvedAddress =
      deliveryMethod === "nova_poshta" ? novaPoshtaWarehouse :
      deliveryMethod === "pickup" ? "Самовивіз" :
      address;

    if (!resolvedCity || !resolvedAddress) {
      return new Response(JSON.stringify({ error: "Missing delivery address" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subtotal = items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
    const discount = Number(clientDiscount) || 0;
    const total = Math.max(0, subtotal - discount);

    const service = createClient(supabaseUrl, supabaseServiceKey);

    const { data: order, error: orderError } = await service
      .from("orders")
      .insert({
        user_id: userId,
        first_name: firstName,
        last_name: lastName,
        email: null,
        phone,
        city: resolvedCity,
        address: resolvedAddress,
        nova_poshta_warehouse: deliveryMethod === "nova_poshta" ? novaPoshtaWarehouse : null,
        np_city_ref: npCityRef || null,
        np_warehouse_type: npWarehouseType || null,
        delivery_method: deliveryMethod,
        subtotal,
        shipping_cost: 0,
        discount,
        total,
        notes: notes || null,
        status: "new",
        payment_status: "pending",
        payment_method: "cod",
      })
      .select("id, order_number")
      .single();

    if (orderError) throw orderError;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const orderItems = items.map((i: any) => ({
      order_id: order.id,
      product_id: i.productId && uuidRegex.test(i.productId) ? i.productId : null,
      product_name: i.name,
      product_brand: i.brand,
      product_image: i.image || null,
      quantity: i.quantity,
      price: i.price,
      total: i.price * i.quantity,
    }));
    const { error: itemsError } = await service.from("order_items").insert(orderItems);
    if (itemsError) throw itemsError;

    // Fire-and-forget notify
    try {
      fetch(`${supabaseUrl}/functions/v1/orders-bot-notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          orderId: order.id,
          orderNumber: order.order_number,
          firstName, lastName, phone,
          deliveryMethod,
          deliveryLabel: DELIVERY_LABELS[deliveryMethod] || deliveryMethod,
          deliveryAddress: `${resolvedCity}, ${resolvedAddress}`,
          paymentMethod: "cod",
          paymentLabel: "Готівкою (наложений платіж)",
          total, items, notes,
        }),
      }).catch((e) => console.error("notify failed:", e));
    } catch (e) {
      console.error("notify error:", e);
    }

    return new Response(
      JSON.stringify({ orderId: order.id, orderNumber: order.order_number }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("create-cod-order error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
