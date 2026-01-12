export type UserRole = "patient" | "clinic";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
}

export interface AuthSession {
  token: string;
  userId: string;
}
