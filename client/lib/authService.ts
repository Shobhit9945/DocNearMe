import type { AuthResponse, AuthUser } from "@shared/api";

const LOCAL_SESSION_KEY = "docnearme.auth.session";

type StoredSession = {
  token: string;
  user: AuthUser;
};

const parseJson = <T,>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const persistSession = (session: StoredSession | null) => {
  if (!session) {
    localStorage.removeItem(LOCAL_SESSION_KEY);
    return;
  }
  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));
};

const loadSession = (): StoredSession | null =>
  parseJson<StoredSession | null>(localStorage.getItem(LOCAL_SESSION_KEY), null);

const handleApiResponse = async (response: Response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error || data?.message || "Unable to reach authentication server.";
    throw new Error(message);
  }
  return data;
};

export const authService = {
  getSession(): StoredSession | null {
    return loadSession();
  },

  async signUp(payload: {
    email: string;
    password: string;
    role: "patient" | "clinic";
    fullName: string;
  }): Promise<AuthResponse> {
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await handleApiResponse(response)) as AuthResponse;
    persistSession({ token: data.token, user: data.user });
    return data;
  },

  async signIn(payload: { email: string; password: string }): Promise<AuthResponse> {
    const response = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await handleApiResponse(response)) as AuthResponse;
    persistSession({ token: data.token, user: data.user });
    return data;
  },

  signOut() {
    persistSession(null);
  },
};
