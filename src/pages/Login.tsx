import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import somisteamLogo from "@/assets/somisteam-logo.jpg";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const sendLoginAlert = async (userEmail: string, userName: string) => {
    const now = new Date();
    const loginTime = now.toLocaleString("en-NG", {
      timeZone: "Africa/Lagos",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " (WAT)";

    const ua = navigator.userAgent;
    let device = "Desktop / Laptop";
    if (/iPhone/i.test(ua)) device = "iPhone";
    else if (/iPad/i.test(ua)) device = "iPad";
    else if (/Android/i.test(ua) && /Mobile/i.test(ua)) device = "Android Phone";
    else if (/Android/i.test(ua)) device = "Android Tablet";
    else if (/Windows/i.test(ua)) device = "Windows PC";
    else if (/Mac/i.test(ua)) device = "Mac";

    supabase.functions.invoke("send-confirmation-email", {
      body: {
        type: "login_alert",
        email: userEmail,
        name: userName,
        data: { login_time: loginTime, device },
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const userName = user?.user_metadata?.full_name || email.split("@")[0];
      sendLoginAlert(email, userName);
      toast.success("Welcome back!");
      navigate("/dashboard");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your email");
      return;
    }
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password reset link sent! Check your email.");
      setForgotMode(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <img src={somisteamLogo} alt="SomiSteam Ventures Ltd." className="h-12 w-auto rounded-lg object-contain" />
          </Link>
          <h1 className="text-2xl font-display font-bold text-foreground">
            {forgotMode ? "Reset Password" : "Welcome Back"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {forgotMode ? "Enter your email to receive a reset link" : "Sign in to your account"}
          </p>
        </div>

        {forgotMode ? (
          <form onSubmit={handleForgotPassword} className="bg-card rounded-2xl p-8 shadow-card border border-border/50 space-y-5">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="rounded-xl"
              />
            </div>
            <Button
              type="submit"
              disabled={resetLoading}
              className="w-full bg-gradient-gold text-accent-foreground font-semibold py-5 rounded-xl hover:opacity-90 shadow-gold"
            >
              {resetLoading ? "Sending..." : "Send Reset Link"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <button type="button" onClick={() => setForgotMode(false)} className="text-accent font-medium hover:underline">
                Back to Sign In
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-8 shadow-card border border-border/50 space-y-5">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="rounded-xl"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-foreground">Password</label>
                <button type="button" onClick={() => setForgotMode(true)} className="text-xs text-accent font-medium hover:underline">
                  Forgot Password?
                </button>
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="rounded-xl"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-gold text-accent-foreground font-semibold py-5 rounded-xl hover:opacity-90 shadow-gold"
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/signup" className="text-accent font-medium hover:underline">
                Sign Up
              </Link>
            </p>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default Login;
