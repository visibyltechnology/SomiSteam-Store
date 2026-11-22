import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { onAuthStateChanged, signOut as firebaseSignOut, User as FirebaseUser } from "firebase/auth";
import { firebaseAuth } from "@/integrations/firebase/client";

const ADMIN_EMAIL = "somisteamventures@gmail.com";

export interface AppUser {
  id: string;
  email: string | null;
  user_metadata: { full_name?: string; name?: string };
}

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const fromFirebaseUser = (user: FirebaseUser): AppUser => ({
  id: user.uid,
  email: user.email,
  user_metadata: { full_name: user.displayName || undefined, name: user.displayName || undefined },
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        const supaUser = nextSession.user;
        setUser({
          id: supaUser.id,
          email: supaUser.email || null,
          user_metadata: {
            full_name: supaUser.user_metadata?.full_name,
            name: supaUser.user_metadata?.name,
          },
        });
        setIsAdmin((supaUser.email || "").toLowerCase() === ADMIN_EMAIL);
      } else if (!firebaseAuth.currentUser) {
        setUser(null);
        setIsAdmin(false);
      }
    });

    const unsubscribeFirebase = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      if (firebaseUser && !session) {
        setUser(fromFirebaseUser(firebaseUser));
        setIsAdmin((firebaseUser.email || "").toLowerCase() === ADMIN_EMAIL);
      } else if (!firebaseUser && !session) {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        const supaUser = data.session.user;
        setSession(data.session);
        setUser({
          id: supaUser.id,
          email: supaUser.email || null,
          user_metadata: { full_name: supaUser.user_metadata?.full_name },
        });
        setIsAdmin((supaUser.email || "").toLowerCase() === ADMIN_EMAIL);
      }
      setLoading(false);
    }).catch(() => setLoading(false));

    return () => {
      subscription.unsubscribe();
      unsubscribeFirebase();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      return { error: error as Error | null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error("Unable to create account") };
    }
  };

  // Firebase is the primary sign-in system. Supabase is optional legacy access for existing orders/payments.
  const signIn = async (email: string, password: string) => {
    try {
      const credential = await (await import("firebase/auth")).signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      setUser(fromFirebaseUser(credential.user));
      setIsAdmin((credential.user.email || "").toLowerCase() === ADMIN_EMAIL);
      setLoading(false);

      // Keep the legacy Supabase session when available, but never block Firebase login on it.
      try {
        await supabase.auth.signInWithPassword({ email: email.trim(), password });
      } catch (legacyError) {
        console.warn("Legacy Supabase sign-in unavailable; Firebase sign-in succeeded.", legacyError);
      }
      return { error: null };
    } catch (firebaseError) {
      // Existing legacy customers can still sign in if their account has not yet been added to Firebase.
      try {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (!error) return { error: null };
        return { error: firebaseError instanceof Error ? firebaseError : error as Error };
      } catch {
        return { error: firebaseError instanceof Error ? firebaseError : new Error("Sign-in failed. Please check your email and password.") };
      }
    }
  };

  const signOut = async () => {
    await Promise.allSettled([supabase.auth.signOut(), firebaseSignOut(firebaseAuth)]);
    setUser(null);
    setSession(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
