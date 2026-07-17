import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Monobank webhook received:", JSON.stringify(body));

    const { invoiceId, status, reference } = body;

    if (!invoiceId || !status) {
      return new Response(
        JSON.stringify({ error: "Missing invoiceId or status" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Map Monobank statuses to our payment statuses
    let paymentStatus: string;
    let orderStatus: string | null = null;

    switch (status) {
      case "success":
        paymentStatus = "paid";
        orderStatus = "confirmed";
        break;
      case "failure":
        paymentStatus = "failed";
        orderStatus = "cancelled";
        break;
      case "reversed":
        paymentStatus = "refunded";
        orderStatus = "returned";
        break;
      default:
        paymentStatus = "pending";
        break;
    }

    // Find order by invoice ID or reference (order ID)
    const updateData: Record<string, string> = { payment_status: paymentStatus };
    if (orderStatus) updateData.status = orderStatus;

    const { error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("monobank_invoice_id", invoiceId);

    if (error) {
      console.error("Error updating order:", error);
      throw error;
    }

    console.log(`Order updated: invoice=${invoiceId}, payment=${paymentStatus}, order=${orderStatus}`);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
