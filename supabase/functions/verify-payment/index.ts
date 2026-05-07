import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      // Use service role client + getUser — same pattern as initialize-payment
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { reference, gateway } = await req.json();

      if (!reference || !gateway) {
        return new Response(JSON.stringify({ error: "Missing fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let verified = false;
      let amount = 0;

      if (gateway === "flutterwave") {
        const res = await fetch(
          `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${reference}`,
          {
            headers: {
              Authorization: `Bearer ${Deno.env.get("FLUTTERWAVE_SECRET_KEY") || ""}`,
            },
          }
        );
        const data = await res.json();
        verified = data.data?.status === "successful";
        amount = data.data?.amount || 0;
      }

      if (verified) {
        // Look up the order via the payment reference (so we don't depend on order_id in URL)
        const { data: paymentRecord } = await supabase
          .from("payments")
          .select("order_id")
          .eq("payment_reference", reference)
          .maybeSingle();

        const orderId = paymentRecord?.order_id;

        // Update payment record status
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

            const { data: authUser } = await supabase.auth.admin.getUserById(order.user_id);
            const customerEmail = authUser?.user?.email;

            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("user_id", order.user_id)
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
  