import { corsHeaders } from "../_shared/cors.ts";

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");

const emailHtml = (name: string) => `
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background: #f7f4ef; font-family: Georgia, 'Times New Roman', serif; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 4px; overflow: hidden; box-shadow: 0 2px 16px rgba(0,0,0,0.07); }
    .header { background: #ffffff; padding: 36px 40px 24px; text-align: center; border-bottom: 1px solid #e8e0d0; }
    .logo { width: 100px; height: 100px; border-radius: 50%; object-fit: cover; }
    .brand { font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: #a08444; margin-top: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .body { padding: 36px 40px; }
    .greeting { font-size: 22px; color: #1a1510; font-weight: normal; margin: 0 0 16px; }
    .copy { font-size: 14px; line-height: 1.8; color: #5c5040; margin: 0 0 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .highlight { background: #fdf9f0; border-left: 3px solid #c9a84c; padding: 16px 20px; border-radius: 0 4px 4px 0; margin: 24px 0; }
    .highlight p { font-size: 13px; color: #7a5c1e; margin: 0; line-height: 1.7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .btn-wrap { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, #8b6914, #c9a84c); color: #ffffff !important; text-decoration: none; border-radius: 2px; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .divider { border: none; border-top: 1px solid #e8e0d0; margin: 28px 0; }
    .small { font-size: 11px; color: #9c8a6a; line-height: 1.7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .footer { background: #f7f4ef; padding: 20px 40px; text-align: center; }
    .footer-text { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: #b8a07a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; }
    .tagline { font-size: 10px; color: #c9a84c; letter-spacing: 0.2em; text-transform: uppercase; margin: 6px 0 0; font-family: Georgia, serif; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <img src="https://nakhrali.com.au/nakhrali-logo.jpg" alt="Nakhrali" class="logo" />
      <p class="brand">Nakhrali</p>
    </div>
    <div class="body">
      <h1 class="greeting">Welcome, ${name || "there"} — you're in!</h1>
      <p class="copy">
        We're delighted to let you know that your Nakhrali account has been approved.
        You now have full access to our handcrafted Indian heritage jewellery collection.
      </p>
      <div class="highlight">
        <p>
          ✦ &nbsp;Your account is now <strong>active</strong>.<br/>
          Sign in to browse our exclusive collection and place your first order.
        </p>
      </div>
      <div class="btn-wrap">
        <a href="https://nakhrali.com.au" class="btn">Shop the Collection</a>
      </div>
      <p class="copy">
        If you have any questions or need assistance, simply reply to this email — we're here to help.
      </p>
      <hr class="divider" />
      <p class="small">
        If you did not sign up for a Nakhrali account, please ignore this email.
      </p>
    </div>
    <div class="footer">
      <p class="footer-text">nakhrali.com.au &nbsp;·&nbsp; Melbourne, Australia</p>
      <p class="tagline">Bold · Elegant · You</p>
    </div>
  </div>
</body>
</html>
`;

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

    if (!SENDGRID_API_KEY) {
      throw new Error("SENDGRID_API_KEY is not set");
    }

    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: "somiljain@aol.com", name: "Nakhrali" },
        subject: "Your Nakhrali account is approved — welcome!",
        content: [{ type: "text/html", value: emailHtml(name) }],
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
    console.error("send-account-approved-email error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
