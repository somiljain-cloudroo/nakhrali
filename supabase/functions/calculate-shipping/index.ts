import { corsHeaders } from "../_shared/cors.ts";

const AUSPOST_API_KEY = Deno.env.get("AUSPOST_API_KEY");

// Nakhrali ships from Melbourne CBD
const FROM_POSTCODE = "3000";

// Standard jewellery parcel dimensions (cm) and weight (kg)
const PARCEL = { length: 15, width: 12, height: 4, weight: 0.2 };

type AusPostService = {
  code: string;
  name: string;
  price: string;
  max_extra_cover: number;
  options?: unknown;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to_postcode } = await req.json();

    if (!to_postcode || !/^\d{4}$/.test(String(to_postcode))) {
      return new Response(JSON.stringify({ error: "Valid 4-digit Australian postcode required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!AUSPOST_API_KEY) {
      throw new Error("AUSPOST_API_KEY is not configured");
    }

    const params = new URLSearchParams({
      from_postcode: FROM_POSTCODE,
      to_postcode: String(to_postcode),
      length: String(PARCEL.length),
      width: String(PARCEL.width),
      height: String(PARCEL.height),
      weight: String(PARCEL.weight),
    });

    const res = await fetch(
      `https://digitalapi.auspost.com.au/postage/parcel/domestic/service.json?${params}`,
      { headers: { "AUTH-KEY": AUSPOST_API_KEY } }
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`AusPost API error ${res.status}: ${body}`);
    }

    const data = await res.json();

    // Normalise: AusPost returns service as object (single) or array (multiple)
    const raw = data?.services?.service;
    const services: AusPostService[] = Array.isArray(raw) ? raw : raw ? [raw] : [];

    // Only expose Regular and Express to keep UI clean
    const allowed = ["AUS_PARCEL_REGULAR", "AUS_PARCEL_EXPRESS"];
    const filtered = services
      .filter((s) => allowed.includes(s.code))
      .map((s) => ({
        code: s.code,
        name: s.name,
        price: parseFloat(s.price),
      }))
      .sort((a, b) => a.price - b.price);

    return new Response(JSON.stringify({ services: filtered }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("calculate-shipping error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
