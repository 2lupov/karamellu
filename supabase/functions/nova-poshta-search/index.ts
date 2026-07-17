// Public proxy to Nova Poshta API for city / warehouse autocomplete.
// No API key required for these reference endpoints, but if NOVA_POSHTA_API_KEY
// is set we forward it for higher rate limits.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NP_URL = "https://api.novaposhta.ua/v2.0/json/";
const API_KEY = Deno.env.get("NOVA_POSHTA_API_KEY") || "";

async function npCall(modelName: string, calledMethod: string, methodProperties: Record<string, unknown>) {
  const res = await fetch(NP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: API_KEY, modelName, calledMethod, methodProperties }),
  });
  if (!res.ok) throw new Error(`NP API ${res.status}`);
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { type, query, cityRef, warehouseType } = body as {
      type: "cities" | "warehouses";
      query?: string;
      cityRef?: string;
      warehouseType?: "branch" | "postomat";
    };

    if (type === "cities") {
      const q = (query || "").trim();
      if (q.length < 2) {
        return new Response(JSON.stringify({ data: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const json = await npCall("Address", "searchSettlements", {
        CityName: q,
        Limit: "15",
      });
      const items = (json?.data?.[0]?.Addresses || []).map((c: any) => ({
        ref: c.DeliveryCity || c.Ref,
        name: c.MainDescription,
        area: c.Area,
        region: c.Region,
        present: c.Present,
      }));
      return new Response(JSON.stringify({ data: items }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "warehouses") {
      if (!cityRef) {
        return new Response(JSON.stringify({ data: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const props: Record<string, unknown> = {
        CityRef: cityRef,
        Limit: "50",
        Page: "1",
      };
      if (query?.trim()) props.FindByString = query.trim();
      // 6 = Поштомат, blank = all (we filter client-side based on flag too)
      if (warehouseType === "postomat") props.TypeOfWarehouseRef = "f9316480-5f2d-425d-bc2c-ac7cd29decf0";

      const json = await npCall("AddressGeneral", "getWarehouses", props);
      const items = (json?.data || []).map((w: any) => ({
        ref: w.Ref,
        number: w.Number,
        description: w.Description,
        shortAddress: w.ShortAddress,
        typeRef: w.TypeOfWarehouse,
        categoryOfWarehouse: w.CategoryOfWarehouse,
      }));
      return new Response(JSON.stringify({ data: items }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "invalid type" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("nova-poshta-search error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
