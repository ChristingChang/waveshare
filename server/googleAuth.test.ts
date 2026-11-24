import type { Server } from "node:http";
import express, { type Request } from "express";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "../shared/const.js";
import { registerOAuthRoutes, GOOGLE_STATE_COOKIE } from "./_core/oauth.js";
import { sdk } from "./_core/sdk.js";
import { ENV } from "./_core/env.js";
import { acceptFriendInvite, getUserByOpenId, upsertUser } from "./db.js";

vi.mock("./db.js", () => ({ upsertUser: vi.fn(), getUserByOpenId: vi.fn(), acceptFriendInvite: vi.fn() }));
vi.mock("./_core/env.js", () => ({ ENV: {
  googleClientId: "test-client", googleClientSecret: "test-secret", googleCallbackUrl: "",
  cookieSecret: "test-session-secret-not-for-production", isProduction: false,
} }));

const httpFetch = globalThis.fetch;
const googleFetch = vi.fn();
let server: Server;
let origin: string;
const profile = { sub: "surfer-123", name: "Surfer", email: "surfer@example.com", email_verified: true };

beforeAll(async () => {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  registerOAuthRoutes(app);
  await new Promise<void>(resolve => { server = app.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test port");
  origin = `http://127.0.0.1:${address.port}`;
});
beforeEach(() => {
  vi.clearAllMocks();
  googleFetch.mockReset();
  vi.stubGlobal("fetch", googleFetch);
  ENV.googleCallbackUrl = "";
  ENV.isProduction = false;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
});

async function callback() {
  return httpFetch(`${origin}/api/auth/google/callback?code=test-code&state=matching-state`, {
    headers: { Cookie: `${GOOGLE_STATE_COOKIE}=matching-state` }, redirect: "manual",
  });
}

const inviteCode = "a".repeat(64);

function startInvite(code = inviteCode, from = origin) {
  return httpFetch(`${origin}/api/auth/google/invite`, {
    method: "POST",
    headers: { Origin: from },
    body: new URLSearchParams({ code }),
    redirect: "manual",
  });
}

async function inviteCallback(cookieOverride?: (cookie: string) => string) {
  const start = await startInvite();
  expect(start.status).toBe(303);
  const loginUrl = new URL(start.headers.get("location")!);
  expect(loginUrl.href).not.toContain(inviteCode);
  const state = loginUrl.searchParams.get("state");
  const cookie = start.headers.get("set-cookie")!.split(";")[0];
  return httpFetch(`${origin}/api/auth/google/callback?code=test-code&state=${state}`, {
    headers: { Cookie: cookieOverride?.(cookie) ?? cookie }, redirect: "manual",
  });
}

describe("Google OAuth", () => {
  it("redeems an invite for the resolved Google account and lands on Friends", async () => {
    googleFetch.mockResolvedValueOnce(Response.json({ access_token: "token" }))
      .mockResolvedValueOnce(Response.json(profile));
    vi.mocked(getUserByOpenId).mockResolvedValueOnce({ id: 42 } as never);
    const response = await inviteCallback();
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/friends?joined=1");
    expect(response.headers.get("set-cookie")).toContain(`${COOKIE_NAME}=`);
    expect(getUserByOpenId).toHaveBeenCalledWith("google:surfer-123");
    expect(vi.mocked(acceptFriendInvite).mock.calls).toEqual([[42, inviteCode]]);
  });

  it("keeps the session and returns to the invite when redemption fails", async () => {
    googleFetch.mockResolvedValueOnce(Response.json({ access_token: "token" }))
      .mockResolvedValueOnce(Response.json(profile));
    vi.mocked(getUserByOpenId).mockResolvedValueOnce({ id: 42 } as never);
    vi.mocked(acceptFriendInvite).mockRejectedValueOnce(new TRPCError({ code: "NOT_FOUND" }));
    const response = await inviteCallback();
    expect(response.headers.get("location")).toBe(`/invite/${inviteCode}?joinError=invalid`);
    expect(response.headers.get("set-cookie")).toContain(`${COOKIE_NAME}=`);
  });

  it("rejects cross-origin starts, malformed codes, and tampered invite state", async () => {
    expect((await startInvite(inviteCode, "https://example.com")).status).toBe(403);
    expect((await startInvite("//example.com")).status).toBe(400);
    expect((await inviteCallback(cookie => cookie.replace(inviteCode, "b".repeat(64)))).status).toBe(400);
    expect(googleFetch).not.toHaveBeenCalled();
    expect(acceptFriendInvite).not.toHaveBeenCalled();
  });

  it("starts login with a random ten-minute HttpOnly Lax state cookie and request-origin callback", async () => {
    const response = await httpFetch(`${origin}/api/auth/google`, { redirect: "manual" });
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location")!);
    expect(location.origin + location.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(location.searchParams.get("scope")).toBe("openid email profile");
    expect(location.searchParams.get("response_type")).toBe("code");
    expect(location.searchParams.get("client_id")).toBe("test-client");
    expect(location.searchParams.get("redirect_uri")).toBe(`${origin}/api/auth/google/callback`);
    const state = location.searchParams.get("state");
    expect(state).toMatch(/^[a-f0-9]{64}$/);
    expect(response.headers.get("set-cookie")).toContain(`${GOOGLE_STATE_COOKIE}=${state}`);
    expect(response.headers.get("set-cookie")).toMatch(/Max-Age=600/);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=Lax");
    const next = await httpFetch(`${origin}/api/auth/google`, { redirect: "manual" });
    expect(new URL(next.headers.get("location")!).searchParams.get("state")).not.toBe(state);
  });

  it("uses the configured callback and Secure cookies in production", async () => {
    ENV.googleCallbackUrl = "https://waves.example.com/api/auth/google/callback";
    ENV.isProduction = true;
    const response = await httpFetch(`${origin}/api/auth/google`, { redirect: "manual" });
    expect(new URL(response.headers.get("location")!).searchParams.get("redirect_uri")).toBe(ENV.googleCallbackUrl);
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });

  it.each([
    { state: "different-stat", cookie: "matching-state" },
    { state: "short", cookie: "matching-state" },
    { state: "", cookie: "matching-state" },
    { state: "matching-state", cookie: "" },
  ])("rejects a mismatched or missing state and clears its cookie: %j", async ({ state, cookie }) => {
    const response = await httpFetch(`${origin}/api/auth/google/callback?code=test-code&state=${state}`, {
      headers: cookie ? { Cookie: `${GOOGLE_STATE_COOKIE}=${cookie}` } : {},
    });
    expect(response.status).toBe(400);
    expect(response.headers.get("set-cookie")).toContain(`${GOOGLE_STATE_COOKIE}=;`);
    expect(googleFetch).not.toHaveBeenCalled();
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it("upserts a Google account, sets a locally signed session and clears state on callback", async () => {
    googleFetch.mockResolvedValueOnce(Response.json({ access_token: "test-token" })).mockResolvedValueOnce(Response.json(profile));
    const response = await callback();
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/");
    expect(upsertUser).toHaveBeenCalledWith({ openId: "google:surfer-123", name: "Surfer", email: profile.email, loginMethod: "google", lastSignedIn: expect.any(Date) });
    const cookies = response.headers.getSetCookie();
    expect(cookies.some(cookie => cookie.startsWith(`${GOOGLE_STATE_COOKIE}=;`))).toBe(true);
    const sessionCookie = cookies.find(cookie => cookie.startsWith(`${COOKIE_NAME}=`))!;
    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).toContain("SameSite=Lax");
    const token = sessionCookie.split(";")[0].slice(COOKIE_NAME.length + 1);
    expect(await sdk.verifySession(token)).toEqual({ openId: "google:surfer-123" });
    expect(googleFetch.mock.calls[0][0]).toBe("https://oauth2.googleapis.com/token");
    expect(googleFetch.mock.calls[0][1].body.get("grant_type")).toBe("authorization_code");
    expect(googleFetch.mock.calls[1][0]).toBe("https://openidconnect.googleapis.com/v1/userinfo");
    expect(googleFetch.mock.calls[1][1].headers.Authorization).toBe("Bearer test-token");
    expect(googleFetch.mock.calls[0][1].body.get("redirect_uri")).toBe(`${origin}/api/auth/google/callback`);
    expect(googleFetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    { email_verified: false }, { email_verified: undefined }, { email_verified: "true" },
  ])("does not store an unverified email: $email_verified", async ({ email_verified }) => {
    googleFetch.mockResolvedValueOnce(Response.json({ access_token: "test-token" }))
      .mockResolvedValueOnce(Response.json({ ...profile, email_verified }));
    expect((await callback()).status).toBe(302);
    expect(googleFetch).toHaveBeenCalledTimes(2);
    expect(upsertUser).toHaveBeenCalledWith(expect.objectContaining({ email: null }));
  });

  it("fails safely when Google rejects the token exchange", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    googleFetch.mockResolvedValueOnce(Response.json({ error: "bad_verification_code" }));
    const response = await callback();
    expect(response.status).toBe(502);
    expect(upsertUser).not.toHaveBeenCalled();
    expect(response.headers.getSetCookie()).toHaveLength(1);
    expect(log).toHaveBeenCalledWith("[OAuth] Google callback failed");
  });

  it("allows a profile without an email", async () => {
    googleFetch.mockResolvedValueOnce(Response.json({ access_token: "test-token" }))
      .mockResolvedValueOnce(Response.json({ sub: profile.sub }));
    expect((await callback()).status).toBe(302);
    expect(upsertUser).toHaveBeenCalledWith(expect.objectContaining({ email: null, name: "" }));
  });

  it.each([undefined, "", 123, "x".repeat(58)])("rejects an invalid profile subject: %s", async sub => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    googleFetch.mockResolvedValueOnce(Response.json({ access_token: "test-token" }))
      .mockResolvedValueOnce(Response.json({ ...profile, sub }));
    expect((await callback()).status).toBe(502);
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it("returns a configuration error without contacting Google when credentials are absent", async () => {
    const original = ENV.googleClientId;
    ENV.googleClientId = "";
    try {
      expect((await httpFetch(`${origin}/api/auth/google`)).status).toBe(503);
      expect(googleFetch).not.toHaveBeenCalled();
    } finally { ENV.googleClientId = original; }
  });
});

describe("local session authentication", () => {
  it.each([undefined, "", "invalid.jwt.value"])("rejects an invalid or missing JWT: %s", async token => {
    const req = { headers: { cookie: token ? `${COOKIE_NAME}=${token}` : "" } } as Request;
    await expect(sdk.authenticateRequest(req)).rejects.toThrow("Invalid session cookie");
    expect(getUserByOpenId).not.toHaveBeenCalled();
    expect(googleFetch).not.toHaveBeenCalled();
  });

  it("loads the Google user locally and never falls back to an OAuth server", async () => {
    const token = await sdk.createSessionToken("google:123");
    const user = { id: 42, openId: "google:123" };
    vi.mocked(getUserByOpenId).mockResolvedValueOnce(user as never).mockResolvedValueOnce(undefined);
    const req = { headers: { cookie: `${COOKIE_NAME}=${token}` } } as Request;
    expect(await sdk.authenticateRequest(req)).toEqual(user);
    expect(getUserByOpenId).toHaveBeenCalledWith("google:123");
    await expect(sdk.authenticateRequest(req)).rejects.toThrow("User not found");
    expect(upsertUser).not.toHaveBeenCalled();
    expect(googleFetch).not.toHaveBeenCalled();
  });

  it("rejects expired, wrongly signed, and legacy Manus tokens", async () => {
    const expired = await sdk.createSessionToken("google:123", { expiresInMs: -1000 });
    expect(await sdk.verifySession(expired)).toBeNull();
    const legacy = await sdk.createSessionToken("legacy-manus-user");
    expect(await sdk.verifySession(legacy)).toBeNull();
    const wrong = await new SignJWT({ openId: "google:123" }).setProtectedHeader({ alg: "HS256" })
      .setIssuer("waveshare").setAudience("waveshare").setExpirationTime("1h").sign(new TextEncoder().encode("wrong-secret"));
    expect(await sdk.verifySession(wrong)).toBeNull();
  });
});
