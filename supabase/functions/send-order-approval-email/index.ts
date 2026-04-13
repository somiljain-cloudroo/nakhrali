import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");

// The function runs with the permissions of the user who invoked it.
// To query the database securely, we need to create a new client with the SERVICE_ROLE_KEY.
const getSupabaseAdmin = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
  }

  return createClient(supabaseUrl, supabaseServiceKey);
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const payload = await req.json();
    const order = payload.record || payload.order;

    if (!order) {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let customerEmail: string | null = null;
    let customerName: string | null = null;

    if (order.customer_id) {
      const { data: profile, error } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("id", order.customer_id)
        .single();
      if (error || !profile) {
        throw new Error(`Failed to fetch customer profile for id: ${order.customer_id}. Reason: ${error?.message}`);
      }
      customerEmail = profile.email;
      customerName = profile.full_name;
    } else if (order.account_id) {
      const { data: relationship, error: relError } = await supabaseAdmin
        .from("contact_account_relationships")
        .select("contact_id")
        .eq("account_id", order.account_id)
        .limit(1)
        .single();
      if (relError || !relationship) {
        throw new Error(`Failed to find contact for account id: ${order.account_id}. Reason: ${relError?.message}`);
      }

      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("id", relationship.contact_id)
        .single();
      if (profileError || !profile) {
        throw new Error(`Failed to fetch contact profile for id: ${relationship.contact_id}. Reason: ${profileError?.message}`);
      }
      customerEmail = profile.email;
      customerName = profile.full_name;
    }

    if (!customerEmail) {
      throw new Error("Could not determine customer email for the order.");
    }

    const emailHtml = `
      <div>
        <h1>Order Approved!</h1>
        <p>Hi ${customerName || 'Valued Customer'},</p>
        <p>Your order #${order.order_number} has been approved.</p>
        <p>Total: $${order.total_amount.toFixed(2)}</p>
        <p>We'll notify you again once it has shipped.</p>
        <p>Thanks for your order!</p>
      </div>
    `;

    const requestBody = {
      personalizations: [{ to: [{ email: customerEmail }] }],
      from: { email: "somiljain@aol.com", name: "Nakhrali" },
      content: [{ type: "text/html", value: emailHtml }],
      subject: `Order #${order.order_number} Approved`,
    };

    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const responseBody = await res.text();
      throw new Error(`SendGrid API error: ${res.statusText} - ${responseBody}`);
    }

    return new Response(JSON.stringify({ message: "Email sent successfully" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    console.error("Error processing request:", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
