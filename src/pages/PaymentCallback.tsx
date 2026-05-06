import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

type PaymentStatus = "loading" | "success" | "cancelled" | "failed";

const PaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<PaymentStatus>("loading");

  useEffect(() => {
    const verify = async () => {
      // Flutterwave sends status=cancelled when user closes checkout
      const flwStatus = searchParams.get("status");
      if (flwStatus === "cancelled") {
        setStatus("cancelled");
        return;
      }

      const reference = searchParams.get("reference") || searchParams.get("tx_ref");
      const gateway = searchParams.get("gateway") || "flutterwave";
      const orderId = searchParams.get("order_id");

      if (!reference || !orderId) {
        // No reference = likely a cancelled/abandoned checkout
        if (flwStatus === "cancelled" || !reference) {
          setStatus("cancelled");
        } else {
          setStatus("failed");
        }
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("verify-payment", {
          body: { reference, gateway, order_id: orderId },
        });

        if (error || !data?.verified) {
          setStatus("failed");
        } else {
          setStatus("success");
        }
      } catch {
        setStatus("failed");
      }
    };

    verify();
  }, [searchParams]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="pt-24 pb-16 flex items-center justify-center min-h-[80vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md mx-auto px-4"
        >
          {status === "loading" && (
            <>
              <Loader2 className="w-16 h-16 text-accent animate-spin mx-auto mb-6" />
              <h2 className="text-2xl font-display font-bold text-foreground mb-2">
                Verifying Payment...
              </h2>
              <p className="text-muted-foreground">Please wait while we confirm your payment.</p>
            </>
          )}

          {status === "success" && (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
              >
                <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
              </motion.div>
              <h2 className="text-2xl font-display font-bold text-foreground mb-2">
                Payment Successful!
              </h2>
              <p className="text-muted-foreground mb-8">
                Your payment has been confirmed. A confirmation email has been sent to you. Track your order from your dashboard.
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                <Link to="/dashboard">
                  <Button className="bg-gradient-gold text-accent-foreground shadow-gold">
                    View Dashboard
                  </Button>
                </Link>
                <Link to="/shop">
                  <Button variant="outline">Continue Shopping</Button>
                </Link>
              </div>
            </>
          )}

          {status === "cancelled" && (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
              >
                <AlertCircle className="w-20 h-20 text-orange-400 mx-auto mb-6" />
              </motion.div>
              <h2 className="text-2xl font-display font-bold text-foreground mb-2">
                Payment Cancelled
              </h2>
              <p className="text-muted-foreground mb-4">
                You cancelled the payment process. Your transaction was not completed and no money was charged.
              </p>
              <p className="text-sm text-muted-foreground mb-8">
                Your order has been saved. You can retry payment from your dashboard or start a new purchase.
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                <Link to="/shop">
                  <Button className="bg-gradient-gold text-accent-foreground shadow-gold">
                    Back to Shop
                  </Button>
                </Link>
                <Link to="/dashboard">
                  <Button variant="outline">My Dashboard</Button>
                </Link>
              </div>
            </>
          )}

          {status === "failed" && (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
              >
                <XCircle className="w-20 h-20 text-destructive mx-auto mb-6" />
              </motion.div>
              <h2 className="text-2xl font-display font-bold text-foreground mb-2">
                Payment Not Successful
              </h2>
              <p className="text-muted-foreground mb-8">
                We could not verify your payment. If money was deducted, please contact us on WhatsApp and we will resolve it immediately.
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                <Link to="/shop">
                  <Button className="bg-gradient-gold text-accent-foreground shadow-gold">
                    Try Again
                  </Button>
                </Link>
                <a href="https://wa.me/2348033318896?text=Hi, I had a payment issue and need help." target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="border-green-500 text-green-600 hover:bg-green-50">
                    WhatsApp Support
                  </Button>
                </a>
              </div>
            </>
          )}
        </motion.div>
      </div>
      <Footer />
    </div>
  );
};

export default PaymentCallback;
