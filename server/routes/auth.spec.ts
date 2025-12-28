import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";

let app: Express;

beforeAll(async () => {
  process.env.USE_IN_MEMORY_DB = "true";
  process.env.ADMIN_EMAIL = "admin@test.local";
  process.env.ADMIN_PASSWORD = "ChangeMeNow123!";

  const { createServer } = await import("../index");
  app = await createServer();
});

describe("auth routes", () => {
  it("signs up and logs in a patient", async () => {
    const email = "patient@test.local";
    const password = "PatientPass123!";

    const signupResponse = await request(app).post("/api/auth/patient/signup").send({
      name: "Test Patient",
      email,
      password,
    });

    expect(signupResponse.status).toBe(201);
    expect(signupResponse.body).toEqual(
      expect.objectContaining({
        token: expect.any(String),
        user: expect.objectContaining({ email, role: "patient" }),
      })
    );

    const loginResponse = await request(app).post("/api/auth/patient/login").send({ email, password });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toEqual(
      expect.objectContaining({
        token: expect.any(String),
        user: expect.objectContaining({ email, role: "patient" }),
      })
    );
  });

  it("logs in an admin user", async () => {
    const loginResponse = await request(app).post("/api/auth/admin/login").send({
      email: "admin@test.local",
      password: "ChangeMeNow123!",
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toEqual(
      expect.objectContaining({
        token: expect.any(String),
        user: expect.objectContaining({ email: "admin@test.local", role: "admin" }),
      })
    );
  });
});
