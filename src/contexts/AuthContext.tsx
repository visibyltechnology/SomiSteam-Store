import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { firebaseAuth, firestore } from "@/integrations/firebase/client";

const ADMIN_EMAIL = "somisteamventures@gmail.com";

export interface AppUser {
  id: string;
  email: string | null;
  user_metadata: { full_name?: string; name?: string };
}

interface AuthContextType {
  user: AppUser | null;
  session: null;
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
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      setUser(firebaseUser ? fromFirebaseUser(firebaseUser) : null);
      setIsAdmin((firebaseUser?.email || "").toLowerCase() === ADMIN_EMAIL);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      await updateProfile(credential.user, { displayName: fullName.trim() });
      await setDoc(doc(firestore, "users", credential.user.uid), {
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        role: "customer",
        createdAt: serverTimestamp(),
      });
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error("Unable to create account") };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      setUser(fromFirebaseUser(credential.user));
      setIsAdmin((credential.user.email || "").toLowerCase() === ADMIN_EMAIL);
      return { error: null };
    } catch (error) {
      const firebaseError = error as { code?: string; message?: string };
      const messages: Record<string, string> = {
        "auth/invalid-credential": "The email or password is incorrect.",
        "auth/user-not-found": "No Firebase account exists for this email.",
        "auth/wrong-password": "The password is incorrect.",
        "auth/too-many-requests": "Too many attempts. Please wait and try again.",
        "auth/network-request-failed": "Connection problem. Check your internet and try again.",
        "auth/invalid-api-key": "Firebase configuration is invalid. Please contact support.",
        "auth/unauthorized-domain": "This website domain is not authorised in Firebase Authentication.",
      };
      return { error: new Error(messages[firebaseError.code || ""] || firebaseError.message || "Unable to sign in.") };
    }
  };

  const signOut = async () => {
    await firebaseSignOut(firebaseAuth);
    setUser(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, session: null, loading, isAdmin, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
