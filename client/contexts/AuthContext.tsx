import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { mongoService } from "@/lib/mongoService";
import { AuthSession, AuthUser, UserRole } from "@/types/auth";

export type { UserRole } from "@/types/auth";

interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    role: UserRole,
    fullName: string,
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const { user, session } = await mongoService.getSession();
        setUser(user);
        setSession(session);
      } catch (error) {
        console.error("Error loading session", error);
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { user, session } = await mongoService.signIn(email, password);
      setUser(user);
      setSession(session);
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || "Unable to sign in right now." };
    }
  };

  const signUp = async (email: string, password: string, role: UserRole, fullName: string) => {
    try {
      const { user, session } = await mongoService.signUp(email, password, role, fullName);
      setUser(user);
      setSession(session);
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || "Unable to sign up right now." };
    }
  };

  const signOut = async () => {
    await mongoService.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
