import { corsHeaders } from "../_shared/cors.ts";

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
const ADMIN_EMAIL = "admin@nakhrali.com.au";

// Notifies admin when a new user signs up. No approval required — users are active immediately.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, name } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!SENDGRID_API_KEY) throw new Error("SENDGRID_API_KEY is not set");

    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: ADMIN_EMAIL }] }],
        from: { email: "somiljain@aol.com", name: "Nakhrali" },
        subject: `New sign-up: ${name || email}`,
        content: [{
          type: "text/html",
          value: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:40px auto;background:#fff;border-radius:4px;padding:32px;border:1px solid #e8e0d0;">
              <h2 style="font-size:16px;color:#1a1510;margin:0 0 16px;">New user registered on Nakhrali</h2>
              <p style="font-size:14px;color:#5c5040;margin:0 0 8px;"><strong>Name:</strong> ${name || "(not provided)"}</p>
              <p style="font-size:14px;color:#5c5040;margin:0 0 24px;"><strong>Email:</strong> ${email}</p>
              <p style="font-size:12px;color:#9c8a6a;">Their account is active immediately — no approval needed.</p>
              <a href="https://nakhrali.com.au/admin" style="display:inline-block;margin-top:20px;padding:10px 24px;background:#c9a84c;color:#fff;text-decoration:none;border-radius:2px;font-size:12px;letter-spacing:0.1em;">View Admin Dashboard</a>
            </div>
          `,
        }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`SendGrid error ${res.status}: ${body}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-pending-approval-email error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
