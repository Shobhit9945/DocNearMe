const TOKEN_KEY = "clinicToken";
const CLINIC_ID_KEY = "clinicId";

export type ClinicSession = {
  token: string;
  clinicId: string;
};

export const getClinicSession = (): ClinicSession | null => {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem(TOKEN_KEY);
  const clinicId = window.localStorage.getItem(CLINIC_ID_KEY);
  if (!token || !clinicId) return null;
  return { token, clinicId };
};

export const setClinicSession = (session: ClinicSession) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, session.token);
  window.localStorage.setItem(CLINIC_ID_KEY, session.clinicId);
};

export const clearClinicSession = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(CLINIC_ID_KEY);
};

export const getClinicAuthHeader = () => {
  const session = getClinicSession();
  if (!session) return {};
  return { Authorization: `Bearer ${session.token}` };
};
