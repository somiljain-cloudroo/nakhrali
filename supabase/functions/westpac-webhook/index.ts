// verify_jwt = false — this endpoint is called by Westpac, not by the browser.
// See supabase/config.toml: [functions.westpac-webhook] verify_jwt = false

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL          = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// TODO: Once Westpac provides a webhook signing secret, add signature verification here.
//       Westpac may send an 'X-Westpac-Signature' (or similar) header.
//       Until then, we rely on the uniqueness of payment_reference (checkoutId) for matching.
//       Example stub:
//
//   const sig = req.headers.get("X-Westpac-Signature") ?? "";
//   const expectedSig = await hmacSha256(WESTPAC_WEBHOOK_SECRET, rawBody);
//   if (!timingSafeEqual(sig, expectedSig)) {
//     return new Response("Forbidden", { status: 403 });
//   }

Deno.serve(async (req: Request) => {
  // Westpac expects a 200 OK quickly — always return 200 even on internal errors.
  try {
    if (req.method !== "POST") {
      // Westpac should only POST but handle gracefully
      return new Response("ok", { status: 200 });
    }

    const body = await req.json();
    console.log("westpac-webhook received:", JSON.stringify(body));

    // TODO: verify exact field names from Westpac webhook payload.
    //       Common patterns: 'status', 'paymentStatus', 'responseCode'.
    //       'merchantReference' is the orderNumber we sent; 'checkoutId' is the payment_reference.
    const rawStatus: string = (body.status ?? body.paymentStatus ?? body.responseCode ?? "").toString().toLowerCase();

    // TODO: confirm the exact approved status string Westpac sends (may be 'approved', 'APPROVED', '00', 'success')
    const isApproved = rawStatus === "approved" || rawStatus === "success" || rawStatus === "00";
    const isFailed   = !isApproved && (rawStatus === "declined" || rawStatus === "failed" || rawStatus === "error" || rawStatus !== "");

    // Identify the order — prefer checkoutId (our payment_reference), fall back to merchantReference (orderNumber)
    // TODO: verify the field names Westpac uses in the webhook body
    const checkoutId        = body.checkoutId ?? body.id ?? null;
    const merchantReference = body.merchantReference ?? body.reference ?? body.orderReference ?? null;

    if (!checkoutId && !merchantReference) {
      console.error("westpac-webhook: cannot identify order — no checkoutId or merchantReference in body");
      return new Response("ok", { status: 200 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    // Build the WHERE clause: match by payment_reference first, fall back to order_number
    let query = supabase.from("orders").update(
      isApproved
        ? {
            payment_status: "paid",
            payment_method: "card",
            status: "pending",  // moves order into the admin approval queue
          }
        : {
            payment_status: "failed",
          }
    );

    if (checkoutId) {
      query = query.eq("payment_reference", checkoutId);
    } else {
      query = query.eq("order_number", merchantReference);
    }

    const { error: updateError, count } = await query;

    if (updateError) {
      console.error("westpac-webhook: DB update error:", updateError);
    } else {
      console.log(`westpac-webhook: updated ${count ?? "?"} order(s) — approved=${isApproved}`);
    }
  } catch (err) {
    // Log but don't expose internals — always return 200 to Westpac
    console.error("westpac-webhook unhandled error:", err);
  }

  return new Response("ok", { status: 200 });
});
