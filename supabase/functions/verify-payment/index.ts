const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const SUPA_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const headers = { "Content-Type": "application/json", "apikey": SERVICE_KEY, "Authorization": "Bearer " + SERVICE_KEY };

    // Helper: Supabase REST GET
    const dbGet = async (table, filter) => {
      const url = SUPA_URL + "/rest/v1/" + table + "?" + filter + "&limit=1";
      const r = await fetch(url, { headers });
      const rows = await r.json();
      return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    };

    // Helper: Supabase REST PATCH
    const dbPatch = async (table, filter, body) => {
      const url = SUPA_URL + "/rest/v1/" + table + "?" + filter;
      await fetch(url, { method: "PATCH", headers: { ...headers, "Prefer": "return=minimal" }, body: JSON.stringify(body) });
    };

    try {
      const { reference, gateway } = await req.json();
      if (!reference || !gateway) {
        return new Response(JSON.stringify({ error: "Missing reference or gateway" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
      }

      // Get Flutterwave key from app_settings
      const setting = await dbGet("app_settings", "key=eq.flutterwave_secret_key");
      const flwKey = (setting && setting.value) ? setting.value : (Deno.env.get("FLUTTERWAVE_SECRET_KEY") ?? "");

      if (!flwKey) {
        return new Response(JSON.stringify({ error: "Payment gateway not configured" }), { status: 503, headers: { ...CORS, "Content-Type": "application/json" } });
      }

      // Verify with Flutterwave
      const fwRes = await fetch("https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=" + encodeURIComponent(reference), {
        headers: { "Authorization": "Bearer " + flwKey }
      });
      const fw = await fwRes.json();
      const verified = fw.data && fw.data.status === "successful";
      const amount = verified ? Number(fw.data.amount || 0) : 0;

      console.log("ref:", reference, "flw_status:", fw.data?.status);

      if (!verified) {
        return new Response(JSON.stringify({ verified: false }), { headers: { ...CORS, "Content-Type": "application/json" } });
      }

      // Find payment record
      const payment = await dbGet("payments", "payment_reference=eq." + encodeURIComponent(reference));
      const orderId = payment ? payment.order_id : null;
      const userId = payment ? payment.user_id : null;

      // Mark payment success
      await dbPatch("payments", "payment_reference=eq." + encodeURIComponent(reference), { status: "success" });

      if (orderId) {
        const order = await dbGet("orders", "id=eq." + orderId);
        if (order) {
          const newTotalPaid = Number(order.total_paid) + amount;
          const newBalance = Math.max(0, Number(order.total_payable) - newTotalPaid);
          const newStatus = newBalance <= 0 ? "fully_paid" : "deposit_paid";

          await dbPatch("orders", "id=eq." + orderId, {
            total_paid: newTotalPaid,
            remaining_balance: newBalance,
            status: newStatus,
          });

          // Send email via sister function (fire and forget)
          const targetUserId = userId || order.user_id;
          const authRes = await fetch(SUPA_URL + "/auth/v1/admin/users/" + targetUserId, {
            headers: { "apikey": SERVICE_KEY, "Authorization": "Bearer " + SERVICE_KEY }
          });
          const authUser = await authRes.json();
          const customerEmail = authUser && authUser.email ? authUser.email : null;

          if (customerEmail) {
            fetch(SUPA_URL + "/functions/v1/send-confirmation-email", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SERVICE_KEY },
              body: JSON.stringify({
                type: "payment_received",
                email: customerEmail,
                name: customerEmail.split("@")[0],
                data: { amount, reference, product_name: order.product_name, remaining_balance: newBalance },
              }),
            }).catch(() => {});
          }
        }
      }

      return new Response(JSON.stringify({ verified: true, amount, order_id: orderId }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });

    } catch (err) {
      console.error("verify error:", err.message);
      return new Response(JSON.stringify({ error: "Verification failed", detail: String(err.message) }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
  });