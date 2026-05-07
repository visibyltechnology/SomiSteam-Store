import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };

  async function sendEmail(supabaseUrl: string, payload: object): Promise<void> {
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-confirmation-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.error("Email send failed (non-fatal):", e);
    }
  }

  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);

      const { reference, gateway } = await req.json();

      if (!reference || !gateway) {
        return new Response(JSON.stringify({ error: "Missing fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Read Flutterwave secret key from app_settings (set by admin)
      const { data: settings } = await supabase
        .from("app_settings")
        .select("key, value")
        .eq("key", "flutterwave_secret_key");

      const settingsMap: Record<string, string> = {};
      (settings || []).forEach((s: { key: string; value: string }) => {
        settingsMap[s.key] = s.value;
      });

      const flutterwaveSecretKey =
        settingsMap["flutterwave_secret_key"] ||
        Deno.env.get("FLUTTERWAVE_SECRET_KEY") ||
        "";

      if (!flutterwaveSecretKey) {
        console.error("No Flutterwave secret key configured");
        return new Response(JSON.stringify({ error: "Payment gateway not configured" }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let verified = false;
      let amount = 0;

      if (gateway === "flutterwave") {
        const res = await fetch(
          `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${reference}`,
          { headers: { Authorization: `Bearer ${flutterwaveSecretKey}` } }
        );
        const data = await res.json();
        console.log("Flutterwave status:", data.data?.status, "| ref:", reference);
        verified = data.data?.status === "successful";
        amount = data.data?.amount || 0;
      }

      if (verified) {
        // Look up the order via payment reference — reliable, no URL param dependency
        const { data: paymentRecord } = await supabase
          .from("payments")
          .select("order_id, user_id")
          .eq("payment_reference", reference)
          .maybeSingle();

        const orderId = paymentRecord?.order_id;
        const userId = paymentRecord?.user_id;

        // Mark payment as success
        await supabase
          .from("payments")
          .update({ status: "success" })
          .eq("payment_reference", reference);

        if (orderId) {
          const { data: order } = await supabase
            .from("orders")
            .select("*")
            .eq("id", orderId)
            .single();

          if (order) {
            const newTotalPaid = Number(order.total_paid) + amount;
            const newBalance = Number(order.total_payable) - newTotalPaid;
            const isFullyPaid = newBalance <= 0;

            await supabase
              .from("orders")
              .update({
                total_paid: newTotalPaid,
                remaining_balance: Math.max(0, newBalance),
                status: isFullyPaid ? "fully_paid" : "deposit_paid",
              })
              .eq("id", order.id);

            // Send confirmation email
            const targetUserId = userId || order.user_id;
            const { data: authUser } = await supabase.auth.admin.getUserById(targetUserId);
            const customerEmail = authUser?.user?.email;

            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("user_id", targetUserId)
              .single();

            const customerName = profile?.full_name || (customerEmail?.split("@")[0] ?? "there");

            if (customerEmail) {
              sendEmail(supabaseUrl, {
                type: "payment_received",
                email: customerEmail,
                name: customerName,
                data: {
                  amount,
                  reference,
                  product_name: order.product_name,
                  remaining_balance: Math.max(0, newBalance),
                },
              });
            }
          }
        }

        return new Response(
          JSON.stringify({ verified: true, amount, order_id: orderId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ verified: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Verify error:", error);
      return new Response(JSON.stringify({ error: "Verification failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  });
  