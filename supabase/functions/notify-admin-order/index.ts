import { corsHeaders } from "../_shared/cors.ts";

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
const ADMIN_EMAIL = "admin@nakhrali.com.au";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { orderNumber, customerName, customerEmail, total, items, shippingMethod } = await req.json();

    if (!SENDGRID_API_KEY) throw new Error("SENDGRID_API_KEY is not set");

    const itemsHtml = Array.isArray(items)
      ? items.map((i: { name: string; quantity: number; price: number }) =>
          `<tr>
            <td style="padding:6px 0;border-bottom:1px solid #e8e0d0;font-size:13px;color:#3a2e1e;">${i.name}</td>
            <td style="padding:6px 0;border-bottom:1px solid #e8e0d0;font-size:13px;color:#3a2e1e;text-align:center;">${i.quantity}</td>
            <td style="padding:6px 0;border-bottom:1px solid #e8e0d0;font-size:13px;color:#3a2e1e;text-align:right;">$${(i.price * i.quantity).toFixed(2)}</td>
          </tr>`
        ).join("")
      : "<tr><td colspan='3' style='font-size:13px;color:#9c8a6a;padding:6px 0;'>No item details available</td></tr>";

    const emailHtml = `
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { margin:0; padding:0; background:#f7f4ef; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
    .wrapper { max-width:560px; margin:40px auto; background:#fff; border-radius:4px; overflow:hidden; box-shadow:0 2px 16px rgba(0,0,0,0.07); }
    .header { background:#1a1510; padding:24px 40px; }
    .header h1 { margin:0; font-size:13px; letter-spacing:0.2em; text-transform:uppercase; color:#c9a84c; font-family:Georgia,serif; }
    .body { padding:32px 40px; }
    .badge { display:inline-block; background:#fdf9f0; border:1px solid #c9a84c; color:#8b6914; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; padding:4px 12px; border-radius:2px; margin-bottom:20px; }
    h2 { font-size:20px; color:#1a1510; font-weight:normal; margin:0 0 20px; font-family:Georgia,serif; }
    .meta { background:#fdf9f0; border-left:3px solid #c9a84c; padding:14px 18px; margin-bottom:24px; }
    .meta p { margin:4px 0; font-size:13px; color:#5c5040; }
    table { width:100%; border-collapse:collapse; margin-bottom:16px; }
    th { font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:#9c8a6a; padding:0 0 8px; border-bottom:2px solid #e8e0d0; text-align:left; }
    th:nth-child(2) { text-align:center; }
    th:nth-child(3) { text-align:right; }
    .total-row { font-size:15px; font-weight:600; color:#1a1510; }
    .cta { display:block; margin:24px 0 0; text-align:center; }
    .btn { display:inline-block; padding:12px 32px; background:linear-gradient(135deg,#8b6914,#c9a84c); color:#fff; text-decoration:none; border-radius:2px; font-size:11px; letter-spacing:0.16em; text-transform:uppercase; }
    .footer { background:#f7f4ef; padding:16px 40px; text-align:center; }
    .footer p { font-size:10px; letter-spacing:0.14em; text-transform:uppercase; color:#b8a07a; margin:0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>Nakhrali · New Order</h1></div>
    <div class="body">
      <span class="badge">Action required</span>
      <h2>Order ${orderNumber} has been placed</h2>
      <div class="meta">
        <p><strong>Customer:</strong> ${customerName || "—"}</p>
        <p><strong>Email:</strong> ${customerEmail || "—"}</p>
        ${shippingMethod ? `<p><strong>Shipping:</strong> ${shippingMethod}</p>` : ""}
      </div>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
          <tr class="total-row">
            <td colspan="2" style="padding:10px 0 0;font-size:14px;">Total</td>
            <td style="padding:10px 0 0;text-align:right;font-size:14px;color:#8b6914;">$${Number(total).toFixed(2)} AUD</td>
          </tr>
        </tbody>
      </table>
      <p style="font-size:12px;color:#9c8a6a;">Customer will pay via PayID to 0469860104 using order number as reference.</p>
      <div class="cta">
        <a href="https://nakhrali.com.au/admin" class="btn">View in Admin Dashboard</a>
      </div>
    </div>
    <div class="footer"><p>nakhrali.com.au &nbsp;·&nbsp; Melbourne, Australia</p></div>
  </div>
</body>
</html>`;

    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: ADMIN_EMAIL }] }],
        from: { email: "somiljain@aol.com", name: "Nakhrali" },
        subject: `New order ${orderNumber} — $${Number(total).toFixed(2)} AUD`,
        content: [{ type: "text/html", value: emailHtml }],
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
    console.error("notify-admin-order error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
