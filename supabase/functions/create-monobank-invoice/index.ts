import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MONOBANK_TOKEN = Deno.env.get("MONOBANK_TOKEN");
    if (!MONOBANK_TOKEN) throw new Error("MONOBANK_TOKEN not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate user (optional for guest checkout)
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const {
        data: { user },
        error: authError,
      } = await anonClient.auth.getUser();

      if (authError) {
        console.warn("Ignoring invalid auth header during checkout:", authError.message);
      } else if (user) {
        userId = user.id;
      }
    }

    const body = await req.json();
    const {
      items,
      firstName,
      lastName,
      email,
      phone,
      city,
      address,
      postalCode,
      novaPoshtaWarehouse,
      npCityRef,
      npWarehouseType,
      deliveryMethod = "nova_poshta",
      notes,
      discount: clientDiscount = 0,
      promoCode,
    } = body;

    const resolvedCity =
      deliveryMethod === "nova_poshta" ? city : (city || "Хмельницький");
    const normalizedAddress =
      deliveryMethod === "pickup"
        ? (address?.trim() || "Самовивіз")
        : deliveryMethod === "nova_poshta"
          ? (novaPoshtaWarehouse?.trim() || address?.trim())
          : address?.trim();

    if (!items?.length || !firstName || !lastName || !phone || !resolvedCity || !normalizedAddress) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate totals
    const subtotal = items.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0
    );
    const shippingCost = 0;
    const discount = Number(clientDiscount) || 0;
    const total = Math.max(0, subtotal + shippingCost - discount);

    // Create order in DB
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: order, error: orderError } = await serviceClient
      .from("orders")
      .insert({
        user_id: userId,
        first_name: firstName,
        last_name: lastName,
        email: email || null,
        phone,
        city: resolvedCity,
        address: normalizedAddress,
        postal_code: postalCode || null,
        nova_poshta_warehouse: novaPoshtaWarehouse || null,
        np_city_ref: npCityRef || null,
        np_warehouse_type: npWarehouseType || null,
        delivery_method: deliveryMethod,
        subtotal,
        shipping_cost: shippingCost,
        discount,
        total,
        notes: notes || null,
        status: "new",
        payment_status: "pending",
        payment_method: "monobank",
      })
      .select("id, order_number")
      .single();

    if (orderError) throw orderError;

    // Insert order items
    // Validate product_id as UUID, otherwise set null
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      product_id: (item.productId && uuidRegex.test(item.productId)) ? item.productId : null,
      product_name: item.name,
      product_brand: item.brand,
      product_image: item.image || null,
      quantity: item.quantity,
      price: item.price,
      total: item.price * item.quantity,
    }));

    const { error: itemsError } = await serviceClient
      .from("order_items")
      .insert(orderItems);

    if (itemsError) throw itemsError;

    // Create Monobank invoice
    const amountInCents = Math.round(total * 100);

    const basketOrder = items.map((item: any) => ({
      name: item.name,
      qty: item.quantity,
      sum: Math.round(item.price * item.quantity * 100),
      unit: "шт.",
    }));

    const monoResponse = await fetch(
      "https://api.monobank.ua/api/merchant/invoice/create",
      {
        method: "POST",
        headers: {
          "X-Token": MONOBANK_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amountInCents,
          ccy: 980, // UAH
          merchantPaymInfo: {
            reference: order.id,
            destination: `Замовлення #${order.order_number} — Карамель LU`,
            basketOrder,
          },
          redirectUrl: `https://karamellu.online/order-success?order=${order.id}`,
          webHookUrl: `${supabaseUrl}/functions/v1/monobank-webhook`,
          validity: 3600,
          paymentType: "debit",
        }),
      }
    );

    const monoData = await monoResponse.json();

    if (!monoResponse.ok) {
      console.error("Monobank error:", monoData);
      throw new Error(
        `Monobank API error [${monoResponse.status}]: ${JSON.stringify(monoData)}`
      );
    }

    // Update order with invoice ID
    await serviceClient
      .from("orders")
      .update({ monobank_invoice_id: monoData.invoiceId })
      .eq("id", order.id);

    // Notify orders bot (dedicated bot for new orders)
    try {
      const deliveryLabels: Record<string, string> = {
        pickup: "Самовивіз (Хмельницький)",
        khmelnytskyi: "Доставка по Хмельницькому (безкоштовно)",
        nova_poshta: "Нова Пошта",
      };
      fetch(`${supabaseUrl}/functions/v1/orders-bot-notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          orderId: order.id,
          orderNumber: order.order_number,
          firstName, lastName, phone,
          deliveryMethod,
          deliveryLabel: deliveryLabels[deliveryMethod] || deliveryMethod,
          deliveryAddress: `${resolvedCity}, ${normalizedAddress}`,
          paymentMethod: "monobank",
          paymentLabel: "Карткою онлайн (Monobank)",
          total, items, notes,
        }),
      }).catch(e => console.error('Orders bot notify failed:', e));
    } catch (e) {
      console.error('Orders bot notify error:', e);
    }

    return new Response(
      JSON.stringify({
        orderId: order.id,
        orderNumber: order.order_number,
        pageUrl: monoData.pageUrl,
        invoiceId: monoData.invoiceId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error creating invoice:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
