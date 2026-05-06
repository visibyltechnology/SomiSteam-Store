const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = "SomiSteam Ventures <noreply@somisteamelectronics.com>";

const logoUrl = "https://afdgjlkivfhwqhjoaylg.supabase.co/storage/v1/object/public/product-images/somisteam-logo.jpg";

function emailTemplate(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#c0160c 0%,#e01f14 100%);padding:32px 40px;text-align:center;">
              <img src="${logoUrl}" alt="SomiSteam Ventures Ltd." width="180" style="max-width:180px;height:auto;display:block;margin:0 auto;" />
            </td>
          </tr>

          <!-- Red accent bar -->
          <tr>
            <td style="background:#c0160c;height:4px;"></td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9f9f9;border-top:1px solid #eeeeee;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;color:#888888;">SomiSteam Ventures Ltd. — Electronics Showroom</p>
              <p style="margin:0 0 8px;font-size:13px;color:#888888;">Lagos, Nigeria &nbsp;|&nbsp; +234 803 331 8896</p>
              <p style="margin:0;font-size:12px;color:#aaaaaa;">&copy; ${new Date().getFullYear()} SomiSteam Ventures Ltd. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(amount);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, email, name, data } = await req.json();

    let subject = "";
    let htmlBody = "";

    if (type === "order_confirmed") {
      subject = `Order Confirmed — ${data.product_name}`;
      htmlBody = emailTemplate(subject, `
        <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#c0160c;">Order Confirmed!</h2>
        <p style="margin:0 0 24px;font-size:15px;color:#444444;">Hi ${name || "there"}, your order has been placed successfully.</p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf2f2;border-radius:12px;padding:0;margin-bottom:24px;">
          <tr><td style="padding:20px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#888888;width:50%;">Product</td>
                <td style="padding:6px 0;font-size:13px;font-weight:600;color:#1a1a1a;text-align:right;">${data.product_name}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#888888;">Payment Type</td>
                <td style="padding:6px 0;font-size:13px;font-weight:600;color:#1a1a1a;text-align:right;">${(data.payment_type || "").replace(/_/g, " ")}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#888888;">Amount Paid</td>
                <td style="padding:6px 0;font-size:13px;font-weight:600;color:#c0160c;text-align:right;">${formatPrice(data.amount_paid)}</td>
              </tr>
              ${data.remaining_balance > 0 ? `
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#888888;">Remaining Balance</td>
                <td style="padding:6px 0;font-size:13px;font-weight:600;color:#1a1a1a;text-align:right;">${formatPrice(data.remaining_balance)}</td>
              </tr>` : ""}
              ${data.installment_months > 0 ? `
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#888888;">Installment Plan</td>
                <td style="padding:6px 0;font-size:13px;font-weight:600;color:#1a1a1a;text-align:right;">${data.installment_months} months</td>
              </tr>` : ""}
            </table>
          </td></tr>
        </table>

        <p style="margin:0 0 24px;font-size:14px;color:#555555;">You can track your order anytime from your <a href="https://somisteamelectronics.com/dashboard" style="color:#c0160c;font-weight:600;text-decoration:none;">customer dashboard</a>.</p>
        <p style="margin:0;font-size:14px;color:#555555;">Thank you for shopping with SomiSteam Ventures!</p>
      `);

    } else if (type === "payment_received") {
      subject = `Payment Received — ${formatPrice(data.amount)}`;
      htmlBody = emailTemplate(subject, `
        <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#c0160c;">Payment Received</h2>
        <p style="margin:0 0 24px;font-size:15px;color:#444444;">Hi ${name || "there"}, we've confirmed your payment.</p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf2f2;border-radius:12px;margin-bottom:24px;">
          <tr><td style="padding:20px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#888888;width:50%;">Amount</td>
                <td style="padding:6px 0;font-size:13px;font-weight:700;color:#c0160c;text-align:right;">${formatPrice(data.amount)}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#888888;">Reference</td>
                <td style="padding:6px 0;font-size:12px;font-weight:600;color:#1a1a1a;text-align:right;font-family:monospace;">${data.reference}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#888888;">Gateway</td>
                <td style="padding:6px 0;font-size:13px;font-weight:600;color:#1a1a1a;text-align:right;">Flutterwave</td>
              </tr>
              ${data.remaining_balance > 0 ? `
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#888888;border-top:1px solid #f0d0d0;padding-top:12px;">Remaining Balance</td>
                <td style="padding:6px 0;font-size:13px;font-weight:600;color:#1a1a1a;text-align:right;border-top:1px solid #f0d0d0;padding-top:12px;">${formatPrice(data.remaining_balance)}</td>
              </tr>` : `
              <tr>
                <td colspan="2" style="padding:12px 0 0;font-size:13px;font-weight:700;color:#16a34a;text-align:center;border-top:1px solid #f0d0d0;">Fully Paid — Thank You!</td>
              </tr>`}
            </table>
          </td></tr>
        </table>

        <p style="margin:0;font-size:14px;color:#555555;">View your full payment history on your <a href="https://somisteamelectronics.com/dashboard" style="color:#c0160c;font-weight:600;text-decoration:none;">dashboard</a>.</p>
      `);

    } else if (type === "welcome") {
      subject = "Welcome to SomiSteam Ventures!";
      htmlBody = emailTemplate(subject, `
        <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#c0160c;">Welcome, ${name || "there"}!</h2>
        <p style="margin:0 0 16px;font-size:15px;color:#444444;">Your SomiSteam account has been created successfully.</p>
        <p style="margin:0 0 24px;font-size:14px;color:#555555;">You can now browse our premium electronics, use EasyBuy installment plans, and track all your orders from your personal dashboard.</p>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr>
            <td align="center">
              <a href="https://somisteamelectronics.com/shop" style="display:inline-block;background:linear-gradient(135deg,#c0160c,#e01f14);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;">Start Shopping</a>
            </td>
          </tr>
        </table>

        <p style="margin:0;font-size:13px;color:#888888;">If you have any questions, WhatsApp us at <a href="https://wa.me/2348033318896" style="color:#c0160c;text-decoration:none;">+234 803 331 8896</a>.</p>
      `);

    } else if (type === "installment_due") {
      subject = `Installment Due — ${formatPrice(data.amount)} for ${data.product_name}`;
      htmlBody = emailTemplate(subject, `
        <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#c0160c;">Payment Reminder</h2>
        <p style="margin:0 0 24px;font-size:15px;color:#444444;">Hi ${name || "there"}, your next installment payment is due.</p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf2f2;border-radius:12px;margin-bottom:24px;">
          <tr><td style="padding:20px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#888888;width:50%;">Product</td>
                <td style="padding:6px 0;font-size:13px;font-weight:600;color:#1a1a1a;text-align:right;">${data.product_name}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#888888;">Amount Due</td>
                <td style="padding:6px 0;font-size:15px;font-weight:700;color:#c0160c;text-align:right;">${formatPrice(data.amount)}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#888888;">Due Date</td>
                <td style="padding:6px 0;font-size:13px;font-weight:600;color:#1a1a1a;text-align:right;">${data.due_date}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#888888;">Remaining Balance</td>
                <td style="padding:6px 0;font-size:13px;font-weight:600;color:#1a1a1a;text-align:right;">${formatPrice(data.remaining_balance)}</td>
              </tr>
            </table>
          </td></tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr>
            <td align="center">
              <a href="https://somisteamelectronics.com/dashboard" style="display:inline-block;background:linear-gradient(135deg,#c0160c,#e01f14);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;">Pay Now</a>
            </td>
          </tr>
        </table>

        <p style="margin:0;font-size:13px;color:#888888;">Need help? WhatsApp us at <a href="https://wa.me/2348033318896" style="color:#c0160c;text-decoration:none;">+234 803 331 8896</a>.</p>
      `);
    }

    if (!subject) {
      return new Response(JSON.stringify({ error: "Unknown email type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject,
        html: htmlBody,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("Resend error:", result);
      return new Response(JSON.stringify({ error: result.message || "Failed to send email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ sent: true, id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Email function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
