import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import somisteamLogo from "@/assets/somisteam-logo.jpg";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { firebaseAuth, firestore } from "@/integrations/firebase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const Signup = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password, fullName);
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    try {
      let credential;
      try {
        credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
        await updateProfile(credential.user, { displayName: fullName.trim() });
        await sendEmailVerification(credential.user);
      } catch (createError) {
        if ((createError as { code?: string }).code !== "auth/email-already-in-use") throw createError;
        credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      }
      await setDoc(doc(firestore, "users", credential.user.uid), {
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        role: "customer",
        createdAt: serverTimestamp(),
      });
    } catch (firebaseError) {
      console.error("Firebase account setup failed:", firebaseError);
      setLoading(false);
      toast.error("Your legacy account was created, but Firebase setup failed. Please contact the store before signing in.");
      return;
    }
    setLoading(false);
    {
      // Fire welcome email — non-blocking, won't affect signup flow
      supabase.functions.invoke("send-confirmation-email", {
        body: {
          type: "welcome",
          email,
          name: fullName,
          data: {},
        },
      }).catch(() => {});

      toast.success("Account created! Please check your email to verify.");
      navigate("/login");
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
          <h1 className="text-2xl font-display font-bold text-foreground">Create Account</h1>
          <p className="text-muted-foreground mt-1">Join SomiSteam today</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-8 shadow-card border border-border/50 space-y-5">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Full Name</label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
              className="rounded-xl"
            />
          </div>
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
            <label className="text-sm font-medium text-foreground mb-1.5 block">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              className="rounded-xl"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-gold text-accent-foreground font-semibold py-5 rounded-xl hover:opacity-90 shadow-gold"
          >
            {loading ? "Creating account..." : "Create Account"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-accent font-medium hover:underline">
              Sign In
            </Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
};

export default Signup;
