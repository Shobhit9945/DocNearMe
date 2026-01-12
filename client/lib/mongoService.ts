import { AuthSession, AuthUser, UserRole } from "@/types/auth";

const LOCAL_SESSION_KEY = "docnearme:auth";

const parseJson = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const getApiBaseUrl = () => {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return "/api";
};

const persistSession = (session: AuthSession | null, user: AuthUser | null) => {
  if (!session || !user) {
    localStorage.removeItem(LOCAL_SESSION_KEY);
    return;
  }
  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ session, user }));
};

const loadSession = (): { session: AuthSession | null; user: AuthUser | null } => {
  const stored = parseJson<{ session: AuthSession; user: AuthUser } | null>(
    localStorage.getItem(LOCAL_SESSION_KEY),
    null,
  );
  return stored ? stored : { session: null, user: null };
};

const handleApiResponse = async (response: Response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.message || data?.error || "Unable to reach MongoDB API";
    throw new Error(message);
  }
  return data;
};

const normalizeRole = (role: unknown): UserRole => {
  switch (role) {
    case "clinic":
    case "teacher":
      return "clinic";
    case "patient":
    case "student":
      return "patient";
    default:
      return "patient";
  }
};

const normalizeUser = (data: any, fallbackId?: string): AuthUser => ({
  id: data?.id || data?._id || data?.userId || fallbackId || crypto.randomUUID(),
  email: data?.email || "",
  role: normalizeRole(data?.role),
  fullName: data?.fullName || data?.full_name || data?.name || "",
});

export const mongoService = {
  async getSession(): Promise<{ session: AuthSession | null; user: AuthUser | null }> {
    const { session, user } = loadSession();
    return { session, user };
  },

  async signUp(
    email: string,
    password: string,
    role: UserRole,
    fullName: string,
  ): Promise<{ user: AuthUser; session: AuthSession }> {
    const baseUrl = getApiBaseUrl();

    const response = await fetch(`${baseUrl}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        role,
        fullName,
        full_name: fullName,
        name: fullName,
      }),
    });

    const data = await handleApiResponse(response);
    const user = normalizeUser(data.user || data, data.id);
    const session: AuthSession = {
      token: data.token || data.accessToken || crypto.randomUUID(),
      userId: user.id,
    };
    persistSession(session, user);
    return { user, session };
  },

  async signIn(email: string, password: string): Promise<{ user: AuthUser; session: AuthSession }> {
    const baseUrl = getApiBaseUrl();

    const response = await fetch(`${baseUrl}/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await handleApiResponse(response);
    const user = normalizeUser(data.user || data, data.id);
    const session: AuthSession = {
      token: data.token || data.accessToken || crypto.randomUUID(),
      userId: user.id,
    };
    persistSession(session, user);
    return { user, session };
  },

  async signOut(): Promise<void> {
    persistSession(null, null);
  },
};
