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
    const dbHeaders = {
      "Content-Type": "application/json",
      "apikey": SERVICE_KEY,
      "Authorization": "Bearer " + SERVICE_KEY,
      "Prefer": "return=representation",
    };

    const dbGet = async (table, filter) => {
      const url = SUPA_URL + "/rest/v1/" + table + "?" + filter + "&limit=1";
      const r = await fetch(url, { headers: dbHeaders });
      const rows = await r.json();
      return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    };

    const dbInsert = async (table, body) => {
      const r = await fetch(SUPA_URL + "/rest/v1/" + table, {
        method: "POST", headers: dbHeaders, body: JSON.stringify(body)
      });
      const rows = await r.json();
      return Array.isArray(rows) ? rows[0] : rows;
    };

    try {
      const authHeader = req.headers.get("Authorization") ?? "";
      if (!authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
      }

      // Verify user JWT via Supabase Auth REST
      const userToken = authHeader.replace("Bearer ", "");
      const userRes = await fetch(SUPA_URL + "/auth/v1/user", {
        headers: { "apikey": SERVICE_KEY, "Authorization": "Bearer " + userToken }
      });
      const userData = await userRes.json();
      if (!userData || !userData.id) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
      }
      const userId = userData.id;
      const userEmail = userData.email;

      // Read Flutterwave key from app_settings
      const setting = await dbGet("app_settings", "key=eq.flutterwave_secret_key");
      const flwKey = (setting && setting.value) ? setting.value : (Deno.env.get("FLUTTERWAVE_SECRET_KEY") ?? "");

      if (!flwKey) {
        return new Response(JSON.stringify({ error: "Payment gateway not configured. Contact support." }), { status: 503, headers: { ...CORS, "Content-Type": "application/json" } });
      }

      const body = await req.json();
      const { gateway, amount, email, product_id, product_name, product_price, payment_type, deposit_amount, interest_rate, total_payable, remaining_balance, installment_months, callback_url } = body;

      if (!gateway || !amount || !email || !product_id) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
      }

      // Create order
      const order = await dbInsert("orders", {
        user_id: userId,
        product_id,
        product_name,
        product_price,
        payment_type,
        deposit_amount: deposit_amount || amount,
        interest_rate: interest_rate || 0,
        total_payable: total_payable || amount,
        remaining_balance: remaining_balance || 0,
        total_paid: 0,
        installment_months: installment_months || 0,
        status: "pending",
      });

      if (!order || !order.id) {
        return new Response(JSON.stringify({ error: "Failed to create order" }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
      }

      const reference = "SOMI-" + order.id.slice(0, 8) + "-" + Date.now();

      // Create payment record
      await dbInsert("payments", {
        order_id: order.id,
        user_id: userId,
        amount,
        status: "pending",
        payment_reference: reference,
        payment_gateway: gateway,
      });

      // Get customer name
      const profile = await dbGet("profiles", "user_id=eq." + userId);
      const customerName = (profile && profile.full_name) ? profile.full_name : (email.split("@")[0]);

      // Fire order confirmed email (non-blocking)
      fetch(SUPA_URL + "/functions/v1/send-confirmation-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SERVICE_KEY },
        body: JSON.stringify({
          type: "order_confirmed",
          email,
          name: customerName,
          data: { product_name, payment_type, amount_paid: amount, remaining_balance: remaining_balance || 0, installment_months: installment_months || 0 },
        }),
      }).catch(() => {});

      // Call Flutterwave
      const fwRes = await fetch("https://api.flutterwave.com/v3/payments", {
        method: "POST",
        headers: { "Authorization": "Bearer " + flwKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          tx_ref: reference,
          amount,
          currency: "NGN",
          redirect_url: callback_url,
          customer: { email },
          meta: { order_id: order.id, product_name, payment_type },
          customizations: {
            title: "SomiSteam Ventures Ltd.",
            description: "Payment for " + product_name,
            logo: "https://somisteamelectronics.com/favicon.jpg",
          },
        }),
      });

      const fwData = await fwRes.json();
      if (fwData.status !== "success") {
        console.error("Flutterwave error:", JSON.stringify(fwData));
        return new Response(JSON.stringify({ error: fwData.message || "Payment gateway error. Please try again." }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ payment_url: fwData.data.link, reference, order_id: order.id }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });

    } catch (err) {
      console.error("initialize-payment error:", err.message);
      return new Response(JSON.stringify({ error: err.message || "Payment initialization failed" }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }
  });