import bcryptjs from "bcryptjs";
import type { RequestHandler } from "express";
import { beforeAll, describe, expect, it, vi } from "vitest";

type MockResponseState = {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
};

const createMockResponse = () => {
  const state: MockResponseState = {
    statusCode: 200,
    body: undefined,
    headers: {},
  };

  const response = {
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      state.body = payload;
      return this;
    },
    setHeader(name: string, value: string) {
      state.headers[name] = value;
    },
  };

  return { response, state };
};

const createMockRequest = ({
  body,
  headers = {},
  ip = "127.0.0.1",
  userAgent = "vitest",
}: {
  body?: unknown;
  headers?: Record<string, string>;
  ip?: string;
  userAgent?: string;
} = {}) =>
  ({
    body,
    ip,
    adminAuth: undefined,
    header(name: string) {
      const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
      return key ? headers[key] : undefined;
    },
    get(name: string) {
      if (name.toLowerCase() === "user-agent") return userAgent;
      const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
      return key ? headers[key] : undefined;
    },
  }) as any;

describe("auth routes", () => {
  let handleAdminAuthCheck: RequestHandler;
  let handleLogin: RequestHandler;
  let handleRequestOtp: RequestHandler;
  let handleVerifyOtp: RequestHandler;
  let createServer: typeof import("../index").createServer;
  let getPatientsCollection: typeof import("../db").getPatientsCollection;
  let getEmailOtpsCollection: typeof import("../db").getEmailOtpsCollection;

  beforeAll(async () => {
    process.env.USE_IN_MEMORY_DB = "true";
    process.env.SMTP_LOG_ONLY = "true";
    process.env.OTP_DEV_MODE = "true";
    process.env.AUTH_JWT_SECRET = "test-auth-secret-with-at-least-32-chars";
    process.env.ADMIN_USERNAME = "admin@example.com";
    process.env.ADMIN_PASSWORD = "super-secret-password";

    const [{ createServer: createServerImpl }, authModule, dbModule, adminModule] = await Promise.all([
      import("../index"),
      import("./auth"),
      import("../db"),
      import("./admin"),
    ]);

    createServer = createServerImpl;
    handleAdminAuthCheck = adminModule.handleAdminAuthCheck;
    handleLogin = authModule.handleLogin;
    handleRequestOtp = authModule.handleRequestOtp;
    handleVerifyOtp = authModule.handleVerifyOtp;
    getPatientsCollection = dbModule.getPatientsCollection;
    getEmailOtpsCollection = dbModule.getEmailOtpsCollection;
  });

  it("registers admin auth-check for both GET and POST", async () => {
    const app = await createServer();
    const stack = ((app as any).router?.stack ?? []) as Array<any>;
    const authCheckLayers = stack.filter((layer) => layer.route?.path === "/api/admin/auth-check");

    expect(authCheckLayers.some((layer) => layer.route?.methods?.get)).toBe(true);
    expect(authCheckLayers.some((layer) => layer.route?.methods?.post)).toBe(true);
  });

  it("accepts valid admin basic auth without sending a browser challenge", async () => {
    const authHeader = `Basic ${Buffer.from("admin@example.com:super-secret-password").toString("base64")}`;
    const req = createMockRequest({ headers: { Authorization: authHeader } });
    const { response, state } = createMockResponse();

    await handleAdminAuthCheck(req, response as any, vi.fn());

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({ ok: true });
    expect(state.headers["WWW-Authenticate"]).toBeUndefined();
    expect(req.adminAuth).toEqual({ username: "admin@example.com" });
  });

  it("supports login OTP requests and verification for existing patients", async () => {
    const email = `patient-${Date.now()}@example.com`;
    const password = "strong-password";
    const patients = await getPatientsCollection();

    await patients.insertOne({
      name: "Patient Test",
      email,
      passwordHash: await bcryptjs.hash(password, 12),
      appointments: [],
      createdAt: new Date(),
    });

    const loginReq = createMockRequest({ body: { email, password } });
    const loginRes = createMockResponse();
    await handleLogin(loginReq, loginRes.response as any, vi.fn());

    expect(loginRes.state.statusCode).toBe(200);
    expect((loginRes.state.body as any)?.token).toEqual(expect.any(String));

    const requestOtpReq = createMockRequest({ body: { email, purpose: "login" } });
    const requestOtpRes = createMockResponse();
    await handleRequestOtp(requestOtpReq, requestOtpRes.response as any, vi.fn());

    expect(requestOtpRes.state.statusCode).toBe(200);
    expect((requestOtpRes.state.body as any)?.success).toBe(true);
    expect((requestOtpRes.state.body as any)?.debugOtp).toMatch(/^\d{6}$/);

    const verifyOtpReq = createMockRequest({
      body: {
        email,
        otp: (requestOtpRes.state.body as any).debugOtp,
        purpose: "login",
      },
    });
    const verifyOtpRes = createMockResponse();
    await handleVerifyOtp(verifyOtpReq, verifyOtpRes.response as any, vi.fn());

    expect(verifyOtpRes.state.statusCode).toBe(200);
    expect((verifyOtpRes.state.body as any)?.success).toBe(true);

    const otpRecord = await (await getEmailOtpsCollection()).findOne({ email, purpose: "login" });
    expect(otpRecord?.verifiedAt).toBeInstanceOf(Date);
    expect(otpRecord?.usedAt).toBeInstanceOf(Date);
  });
});
