import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PaymentRequest {
  gateway: "flutterwave";
  amount: number;
  email: string;
  product_id: string;
  product_name: string;
  product_price: number;
  payment_type: "full_payment" | "deposit" | "installment";
  deposit_amount?: number;
  interest_rate: number;
  total_payable: number;
  remaining_balance: number;
  installment_months?: number;
  callback_url: string;
}

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

    // Service-role client for DB operations
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify the user JWT using the service role client
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // Read Flutterwave secret key from app_settings table (set by admin)
    const { data: settings, error: settingsError } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["flutterwave_secret_key", "flutterwave_public_key"]);

    if (settingsError) {
      console.error("Settings fetch error:", settingsError);
      return new Response(JSON.stringify({ error: "Could not load payment settings" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s: { key: string; value: string }) => {
      settingsMap[s.key] = s.value;
    });

    const flutterwaveSecretKey = settingsMap["flutterwave_secret_key"] ||
      Deno.env.get("FLUTTERWAVE_SECRET_KEY") || "";

    if (!flutterwaveSecretKey) {
      return new Response(JSON.stringify({ error: "Payment gateway not configured. Please contact support." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: PaymentRequest = await req.json();
    const {
      gateway,
      amount,
      email,
      product_id,
      product_name,
      product_price,
      payment_type,
      deposit_amount,
      interest_rate,
      total_payable,
      remaining_balance,
      installment_months,
      callback_url,
    } = body;

    if (!gateway || !amount || !email || !product_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create order in DB
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        product_id,
        product_name,
        product_price,
        payment_type,
        deposit_amount: deposit_amount || amount,
        interest_rate,
        total_payable,
        remaining_balance,
        total_paid: 0,
        installment_months: installment_months || 0,
        status: "pending",
      })
      .select()
      .single();

    if (orderError) {
      console.error("Order creation error:", orderError);
      return new Response(JSON.stringify({ error: "Failed to create order: " + orderError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reference = `SOMI-${order.id.slice(0, 8)}-${Date.now()}`;

    // Create payment record
    await supabase.from("payments").insert({
      order_id: order.id,
      user_id: userId,
      amount,
      status: "pending",
      payment_reference: reference,
      payment_gateway: gateway,
    });

    // Get customer name from profile (non-blocking)
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", userId)
      .single();

    const customerName = profile?.full_name || email.split("@")[0];

    // Fire order_confirmed email (non-blocking)
    sendEmail(supabaseUrl, {
      type: "order_confirmed",
      email,
      name: customerName,
      data: {
        product_name,
        payment_type,
        amount_paid: amount,
        remaining_balance,
        installment_months: installment_months || 0,
      },
    });

    // Initialize Flutterwave payment
    const fwRes = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${flutterwaveSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: reference,
        amount,
        currency: "NGN",
        redirect_url: callback_url,
        customer: { email },
        meta: { order_id: order.id, product_name, payment_type },
        customizations: {
          title: "SomiSteam Ventures Ltd.",
          description: `Payment for ${product_name}`,
          logo: "https://afdgjlkivfhwqhjoaylg.supabase.co/storage/v1/object/public/product-images/somisteam-logo.jpg",
        },
      }),
    });

    const fwData = await fwRes.json();
    if (fwData.status !== "success") {
      console.error("Flutterwave error:", JSON.stringify(fwData));
      throw new Error(fwData.message || "Payment gateway error. Please try again.");
    }

    const paymentUrl = fwData.data.link;
    return new Response(
      JSON.stringify({ payment_url: paymentUrl, reference, order_id: order.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Payment initialization error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Payment initialization failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
