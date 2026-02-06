import http from "k6/http";
import { check, group, sleep } from "k6";

const BASE_URL = (__ENV.BASE_URL || "https://docnearme.jp").replace(/\/$/, "");
const AUTH_TOKEN = __ENV.AUTH_TOKEN;
const CLINIC_ID = __ENV.CLINIC_ID;
const SIGNUP_ENABLED = __ENV.SIGNUP_ENABLED === "true";
const SIGNUP_PHONE = __ENV.SIGNUP_PHONE;
const SIGNUP_PHONE_PROOF_TOKEN = __ENV.SIGNUP_PHONE_PROOF_TOKEN || "bypass";
const LOAD_TEST_BYPASS_KEY = __ENV.LOAD_TEST_BYPASS_KEY;
const SIGNUP_PASSWORD = __ENV.SIGNUP_PASSWORD || "Password123!";

const DEFAULT_PATIENT_NAME = __ENV.PATIENT_NAME || "Load Test User";
const DEFAULT_PATIENT_PHONE = __ENV.PATIENT_PHONE || "+819000000000";
const DEFAULT_PATIENT_EMAIL = __ENV.PATIENT_EMAIL || "loadtest@docnearme.jp";

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const buildPreferredTimes = () => {
  const minutesFromNow = 24 * 60 + rand(15, 12 * 60);
  const preferredStart = new Date(Date.now() + minutesFromNow * 60 * 1000);
  const preferredEnd = new Date(preferredStart.getTime() + 30 * 60 * 1000);
  return {
    preferredStart: preferredStart.toISOString(),
    preferredEnd: preferredEnd.toISOString(),
  };
};

export const options = {
  discardResponseBodies: true,
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<1500"],
  },
  stages: [
    { duration: "2m", target: 50 },
    { duration: "3m", target: 100 },
    { duration: "3m", target: 500 },
    { duration: "3m", target: 1000 },
    { duration: "2m", target: 0 },
  ],
};

export default function () {
  group("home", () => {
    const res = http.get(`${BASE_URL}/`);
    check(res, { "home 200": (r) => r.status === 200 });
  });

  group("search", () => {
    const query = encodeURIComponent(["clinic", "dentist", "pediatrics", "oita", "beppu"][rand(0, 4)]);
    const res = http.get(`${BASE_URL}/search?q=${query}`);
    check(res, { "search 200": (r) => r.status === 200 });
  });

  group("clinics_api", () => {
    const res = http.get(`${BASE_URL}/api/clinics`);
    check(res, { "clinics api 200": (r) => r.status === 200 });
  });

  if (AUTH_TOKEN && CLINIC_ID) {
    group("appointment_booking", () => {
      const { preferredStart, preferredEnd } = buildPreferredTimes();
      const payload = {
        clinicId: CLINIC_ID,
        patientName: DEFAULT_PATIENT_NAME,
        patientPhone: DEFAULT_PATIENT_PHONE,
        patientEmail: DEFAULT_PATIENT_EMAIL,
        preferredStart,
        preferredEnd,
        specialization: "General",
        note: `Load test booking ${__VU}-${__ITER}`,
      };

      const res = http.post(`${BASE_URL}/api/appointments/request`, JSON.stringify(payload), {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AUTH_TOKEN}`,
        },
      });

      check(res, {
        "appointment 200/409": (r) => r.status === 200 || r.status === 409,
      });
    });
  }

  if (SIGNUP_ENABLED && SIGNUP_PHONE && SIGNUP_PHONE_PROOF_TOKEN) {
    group("account_creation", () => {
      const unique = `${__VU}-${__ITER}-${Date.now()}`;
      const payload = {
        name: `Load Test ${unique}`,
        email: `loadtest-${unique}@example.com`,
        password: SIGNUP_PASSWORD,
        dateOfBirth: "1990-01-01",
        nationality: "Japan",
        visaType: "Resident",
        phone: SIGNUP_PHONE,
        phoneProofToken: SIGNUP_PHONE_PROOF_TOKEN,
        consentAccepted: true,
      };

      const res = http.post(`${BASE_URL}/api/auth/signup`, JSON.stringify(payload), {
        headers: {
          "Content-Type": "application/json",
          ...(LOAD_TEST_BYPASS_KEY ? { "x-load-test-key": LOAD_TEST_BYPASS_KEY } : {}),
        },
      });

      check(res, { "signup 200": (r) => r.status === 200 });
    });
  }

  sleep(rand(1, 3));
}
