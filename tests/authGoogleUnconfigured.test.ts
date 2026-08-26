import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Deliberately omits GOOGLE_SIGNIN_CLIENT_ID, unlike authRoutes.test.ts —
// covers the deployment-without-Drive-style fallback where the button/endpoint
// are simply unavailable rather than erroring.
vi.mock("../src/config", () => ({ config: {} }));

vi.mock("../src/db", () => ({
  prisma: {
    setting: { upsert: vi.fn() },
  },
}));

import { authRouter } from "../src/routes/auth";

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRouter);

  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe("Google sign-in without GOOGLE_SIGNIN_CLIENT_ID configured", () => {
  it("GET /api/auth/google/config reports no client id", async () => {
    const res = await fetch(`${baseUrl}/api/auth/google/config`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ clientId: null });
  });

  it("POST /api/auth/google is unavailable", async () => {
    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: "some-token-string" }),
    });
    expect(res.status).toBe(503);
  });
});
