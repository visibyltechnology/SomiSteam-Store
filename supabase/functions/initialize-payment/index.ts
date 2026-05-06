import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;
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
      return new Response(JSON.stringify({ error: "Failed to create order" }), {
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

    // Get customer's name from profile (non-blocking)
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", userId)
      .single();

    const customerName = profile?.full_name || email.split("@")[0];

    // Fire "order_confirmed" email (non-blocking — won't slow checkout)
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
    const res = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("FLUTTERWAVE_SECRET_KEY")}`,
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
    const data = await res.json();
    if (data.status !== "success") throw new Error(data.message || "Flutterwave init failed");
    const paymentUrl = data.data.link;

    return new Response(
      JSON.stringify({ payment_url: paymentUrl, reference, order_id: order.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Payment initialization error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Payment initialization failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
