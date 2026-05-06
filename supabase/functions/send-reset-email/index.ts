const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = "https://afdgjlkivfhwqhjoaylg.supabase.co";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM_EMAIL = "SomiSteam Ventures <noreply@somisteamelectronics.com>";
const logoUrl = "https://afdgjlkivfhwqhjoaylg.supabase.co/storage/v1/object/public/product-images/somisteam-logo.jpg";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate the password reset link via Supabase admin API
    const linkRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "recovery",
        email,
        options: {
          redirectTo: "https://somisteamelectronics.com/reset-password",
        },
      }),
    });

    const linkData = await linkRes.json();

    if (!linkRes.ok || !linkData.action_link) {
      console.error("Generate link error:", linkData);
      return new Response(JSON.stringify({ error: linkData.message || "Could not generate reset link" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resetLink = linkData.action_link;
    const subject = "Reset Your SomiSteam Password";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
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
          <tr><td style="background:#c0160c;height:4px;"></td></tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1a1a1a;">Reset Your Password</h2>
              <p style="margin:0 0 24px;font-size:15px;color:#444444;">We received a request to reset the password for your SomiSteam account associated with <strong>${email}</strong>.</p>

              <p style="margin:0 0 24px;font-size:14px;color:#555555;">Click the button below to choose a new password. This link will expire in <strong>1 hour</strong>.</p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" style="display:inline-block;background:linear-gradient(135deg,#c0160c,#e01f14);color:#ffffff;text-decoration:none;padding:15px 40px;border-radius:10px;font-size:16px;font-weight:700;letter-spacing:0.3px;">Reset My Password</a>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f8;border-radius:10px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:12px;color:#888888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Or copy this link into your browser</p>
                    <p style="margin:0;font-size:12px;color:#555555;word-break:break-all;font-family:monospace;">${resetLink}</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf2f2;border-left:4px solid #c0160c;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0;font-size:13px;color:#555555;">&#128274; If you did <strong>not</strong> request a password reset, please ignore this email — your account remains secure. No changes have been made.</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#888888;">Need help? WhatsApp us at <a href="https://wa.me/2348033318896" style="color:#c0160c;text-decoration:none;">+234 803 331 8896</a>.</p>
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

    // Send via Resend
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: [email], subject, html }),
    });

    const emailResult = await emailRes.json();

    if (!emailRes.ok) {
      console.error("Resend error:", emailResult);
      return new Response(JSON.stringify({ error: emailResult.message || "Failed to send email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ sent: true, id: emailResult.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Reset email error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
