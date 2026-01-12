import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AuthUser } from "@shared/api";
import { authService } from "@/lib/authService";

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (payload: {
    email: string;
    password: string;
    role: "patient" | "clinic";
    fullName: string;
  }) => Promise<{ error: string | null }>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = authService.getSession();
    setUser(session?.user ?? null);
    setToken(session?.token ?? null);
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const response = await authService.signIn({ email, password });
      setUser(response.user);
      setToken(response.token);
      return { error: null };
    } catch (error: any) {
      return { error: error?.message ?? "Unable to sign in right now." };
    }
  };

  const signUp = async (payload: {
    email: string;
    password: string;
    role: "patient" | "clinic";
    fullName: string;
  }) => {
    try {
      const response = await authService.signUp(payload);
      setUser(response.user);
      setToken(response.token);
      return { error: null };
    } catch (error: any) {
      return { error: error?.message ?? "Unable to sign up right now." };
    }
  };

  const signOut = () => {
    authService.signOut();
    setUser(null);
    setToken(null);
  };

  const value = useMemo(
    () => ({ user, token, loading, signIn, signUp, signOut }),
    [user, token, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
