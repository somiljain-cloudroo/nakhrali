import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Environment variables — set these as Supabase secrets:
//   WESTPAC_API_KEY, WESTPAC_USER_ID, WESTPAC_CONTRACT_ID, WESTPAC_ORG_ID
//   WESTPAC_BASE_URL (optional, defaults to production)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (already set by Supabase)
// ---------------------------------------------------------------------------

const WESTPAC_API_KEY       = Deno.env.get("WESTPAC_API_KEY") ?? "";
const WESTPAC_USER_ID       = Deno.env.get("WESTPAC_USER_ID") ?? "";
const WESTPAC_CONTRACT_ID   = Deno.env.get("WESTPAC_CONTRACT_ID") ?? "";
const WESTPAC_ORG_ID        = Deno.env.get("WESTPAC_ORG_ID") ?? "";       // TODO: verify if orgId is needed in request body
const WESTPAC_BASE_URL      = Deno.env.get("WESTPAC_BASE_URL") ?? "https://api.onlinepay.westpac.com.au";

const SUPABASE_URL           = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function basicAuthHeader(userId: string, apiKey: string): string {
  return "Basic " + btoa(`${userId}:${apiKey}`);
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { orderId, amount, orderNumber, customerEmail, customerName } = await req.json();

    // Basic validation
    if (!orderId || !amount || !orderNumber) {
      return new Response(
        JSON.stringify({ error: "orderId, amount, and orderNumber are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!WESTPAC_API_KEY || !WESTPAC_USER_ID || !WESTPAC_CONTRACT_ID) {
      console.error("Westpac credentials not configured");
      return new Response(
        JSON.stringify({ error: "Payment provider not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Westpac expects amount in cents (integer)
    const amountCents = Math.round(Number(amount) * 100);

    // Build the checkout request body
    // TODO: verify exact field names against Westpac OnlinePay API docs once credentials are confirmed
    const checkoutBody = {
      amount: amountCents,                          // TODO: verify field name (may be 'totalAmount')
      currency: "AUD",
      merchantReference: orderNumber,               // TODO: verify field name (may be 'reference' or 'orderReference')
      returnUrl: "https://nakhrali.com.au/payment-complete",
      notificationUrl: `${SUPABASE_URL}/functions/v1/westpac-webhook`,
      customer: {
        email: customerEmail ?? "",
        name: customerName ?? "",                   // TODO: verify nested structure (may need firstName/lastName)
      },
      paymentProviderContractId: WESTPAC_CONTRACT_ID, // TODO: verify field name
      // orgId: WESTPAC_ORG_ID,                     // TODO: uncomment if required by the API
    };

    // Call Westpac OnlinePay — POST /checkouts
    // TODO: verify the exact endpoint path once credentials confirmed
    const westpacRes = await fetch(`${WESTPAC_BASE_URL}/checkouts`, {
      method: "POST",
      headers: {
        "Authorization": basicAuthHeader(WESTPAC_USER_ID, WESTPAC_API_KEY),
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(checkoutBody),
    });

    if (!westpacRes.ok) {
      const errBody = await westpacRes.text();
      console.error(`Westpac API error ${westpacRes.status}:`, errBody);
      return new Response(
        JSON.stringify({ error: `Payment provider error: ${westpacRes.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const westpacData = await westpacRes.json();

    // TODO: verify exact response field names — likely 'checkoutId' and 'checkoutUrl' or 'url'
    const checkoutId  = westpacData.checkoutId  ?? westpacData.id;
    const checkoutUrl = westpacData.checkoutUrl ?? westpacData.url ?? westpacData.redirectUrl;

    if (!checkoutId || !checkoutUrl) {
      console.error("Unexpected Westpac response shape:", JSON.stringify(westpacData));
      return new Response(
        JSON.stringify({ error: "Unexpected response from payment provider" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the order in Supabase: mark as pending_payment and store the checkout reference
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        payment_status: "pending_payment",
        payment_reference: checkoutId,
        status: "pending_payment",  // holds the order in a pre-approval gate until payment confirmed
      })
      .eq("id", orderId);

    if (updateError) {
      console.error("Failed to update order after Westpac checkout creation:", updateError);
      // Non-fatal — return the checkout URL so the customer can still pay.
      // The webhook will update the order when payment is confirmed.
    }

    return new Response(
      JSON.stringify({ checkoutId, checkoutUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("create-westpac-checkout error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
