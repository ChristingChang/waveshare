import type { Server } from "node:http";
import express, { type Request } from "express";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { COOKIE_NAME } from "../shared/const.js";
import { registerOAuthRoutes, GITHUB_STATE_COOKIE } from "./_core/oauth.js";
import { sdk } from "./_core/sdk.js";
import { ENV } from "./_core/env.js";
import { getUserByOpenId, upsertUser } from "./db.js";

vi.mock("./db.js", () => ({ upsertUser: vi.fn(), getUserByOpenId: vi.fn() }));
vi.mock("./_core/env.js", () => ({ ENV: {
  githubClientId: "test-client", githubClientSecret: "test-secret", githubCallbackUrl: "",
  cookieSecret: "test-session-secret-not-for-production", isProduction: false,
} }));

const httpFetch = globalThis.fetch;
const githubFetch = vi.fn();
let server: Server;
let origin: string;
const profile = { id: 123, login: "surfer", name: "Surfer", email: "surfer@example.com" };

beforeAll(async () => {
  const app = express();
  registerOAuthRoutes(app);
  await new Promise<void>(resolve => { server = app.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test port");
  origin = `http://127.0.0.1:${address.port}`;
});
beforeEach(() => {
  vi.clearAllMocks();
  githubFetch.mockReset();
  vi.stubGlobal("fetch", githubFetch);
  ENV.githubCallbackUrl = "";
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
  return httpFetch(`${origin}/api/auth/github/callback?code=test-code&state=matching-state`, {
    headers: { Cookie: `${GITHUB_STATE_COOKIE}=matching-state` }, redirect: "manual",
  });
}

describe("GitHub OAuth", () => {
  it("starts login with a random ten-minute HttpOnly Lax state cookie and request-origin callback", async () => {
    const response = await httpFetch(`${origin}/api/auth/github`, { redirect: "manual" });
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location")!);
    expect(location.origin + location.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(location.searchParams.get("scope")).toBe("read:user user:email");
    expect(location.searchParams.get("client_id")).toBe("test-client");
    expect(location.searchParams.get("redirect_uri")).toBe(`${origin}/api/auth/github/callback`);
    const state = location.searchParams.get("state");
    expect(state).toMatch(/^[a-f0-9]{64}$/);
    expect(response.headers.get("set-cookie")).toContain(`${GITHUB_STATE_COOKIE}=${state}`);
    expect(response.headers.get("set-cookie")).toMatch(/Max-Age=600/);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=Lax");
    const next = await httpFetch(`${origin}/api/auth/github`, { redirect: "manual" });
    expect(new URL(next.headers.get("location")!).searchParams.get("state")).not.toBe(state);
  });

  it("uses the configured callback and Secure cookies in production", async () => {
    ENV.githubCallbackUrl = "https://waves.example.com/api/auth/github/callback";
    ENV.isProduction = true;
    const response = await httpFetch(`${origin}/api/auth/github`, { redirect: "manual" });
    expect(new URL(response.headers.get("location")!).searchParams.get("redirect_uri")).toBe(ENV.githubCallbackUrl);
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });

  it.each([
    { state: "different-stat", cookie: "matching-state" },
    { state: "short", cookie: "matching-state" },
    { state: "", cookie: "matching-state" },
    { state: "matching-state", cookie: "" },
  ])("rejects a mismatched or missing state and clears its cookie: %j", async ({ state, cookie }) => {
    const response = await httpFetch(`${origin}/api/auth/github/callback?code=test-code&state=${state}`, {
      headers: cookie ? { Cookie: `${GITHUB_STATE_COOKIE}=${cookie}` } : {},
    });
    expect(response.status).toBe(400);
    expect(response.headers.get("set-cookie")).toContain(`${GITHUB_STATE_COOKIE}=;`);
    expect(githubFetch).not.toHaveBeenCalled();
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it("upserts a GitHub account, sets a locally signed session and clears state on callback", async () => {
    githubFetch.mockResolvedValueOnce(Response.json({ access_token: "test-token" })).mockResolvedValueOnce(Response.json(profile));
    const response = await callback();
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/");
    expect(upsertUser).toHaveBeenCalledWith({ openId: "github:123", name: "Surfer", email: profile.email, loginMethod: "github", lastSignedIn: expect.any(Date) });
    const cookies = response.headers.getSetCookie();
    expect(cookies.some(cookie => cookie.startsWith(`${GITHUB_STATE_COOKIE}=;`))).toBe(true);
    const sessionCookie = cookies.find(cookie => cookie.startsWith(`${COOKIE_NAME}=`))!;
    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).toContain("SameSite=Lax");
    const token = sessionCookie.split(";")[0].slice(COOKIE_NAME.length + 1);
    expect(await sdk.verifySession(token)).toEqual({ openId: "github:123" });
    expect(githubFetch.mock.calls[0][0]).toBe("https://github.com/login/oauth/access_token");
    expect(githubFetch.mock.calls[0][1].body.get("redirect_uri")).toBe(`${origin}/api/auth/github/callback`);
    expect(githubFetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    { emails: [{ email: "unverified@example.com", primary: true, verified: false }, { email: "secondary@example.com", primary: false, verified: true }, { email: "primary@example.com", primary: true, verified: true }], expected: "primary@example.com" },
    { emails: [], expected: null },
  ])("falls back only to a primary verified email: $expected", async ({ emails, expected }) => {
    githubFetch.mockResolvedValueOnce(Response.json({ access_token: "test-token" }))
      .mockResolvedValueOnce(Response.json({ ...profile, email: null }))
      .mockResolvedValueOnce(Response.json(emails));
    expect((await callback()).status).toBe(302);
    expect(githubFetch.mock.calls[2][0]).toBe("https://api.github.com/user/emails");
    expect(upsertUser).toHaveBeenCalledWith(expect.objectContaining({ email: expected }));
  });

  it("fails safely when GitHub rejects the token exchange", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    githubFetch.mockResolvedValueOnce(Response.json({ error: "bad_verification_code" }));
    const response = await callback();
    expect(response.status).toBe(502);
    expect(upsertUser).not.toHaveBeenCalled();
    expect(response.headers.getSetCookie()).toHaveLength(1);
    expect(log).toHaveBeenCalledWith("[OAuth] GitHub callback failed");
  });

  it("returns a configuration error without contacting GitHub when credentials are absent", async () => {
    const original = ENV.githubClientId;
    ENV.githubClientId = "";
    try {
      expect((await httpFetch(`${origin}/api/auth/github`)).status).toBe(503);
      expect(githubFetch).not.toHaveBeenCalled();
    } finally { ENV.githubClientId = original; }
  });
});

describe("local session authentication", () => {
  it.each([undefined, "", "invalid.jwt.value"])("rejects an invalid or missing JWT: %s", async token => {
    const req = { headers: { cookie: token ? `${COOKIE_NAME}=${token}` : "" } } as Request;
    await expect(sdk.authenticateRequest(req)).rejects.toThrow("Invalid session cookie");
    expect(getUserByOpenId).not.toHaveBeenCalled();
    expect(githubFetch).not.toHaveBeenCalled();
  });

  it("loads the GitHub user locally and never falls back to an OAuth server", async () => {
    const token = await sdk.createSessionToken("github:123");
    const user = { id: 42, openId: "github:123" };
    vi.mocked(getUserByOpenId).mockResolvedValueOnce(user as never).mockResolvedValueOnce(undefined);
    const req = { headers: { cookie: `${COOKIE_NAME}=${token}` } } as Request;
    expect(await sdk.authenticateRequest(req)).toEqual(user);
    expect(getUserByOpenId).toHaveBeenCalledWith("github:123");
    await expect(sdk.authenticateRequest(req)).rejects.toThrow("User not found");
    expect(upsertUser).not.toHaveBeenCalled();
    expect(githubFetch).not.toHaveBeenCalled();
  });

  it("rejects expired, wrongly signed, and legacy Manus tokens", async () => {
    const expired = await sdk.createSessionToken("github:123", { expiresInMs: -1000 });
    expect(await sdk.verifySession(expired)).toBeNull();
    const legacy = await sdk.createSessionToken("legacy-manus-user");
    expect(await sdk.verifySession(legacy)).toBeNull();
    const wrong = await new SignJWT({ openId: "github:123" }).setProtectedHeader({ alg: "HS256" })
      .setIssuer("waveshare").setAudience("waveshare").setExpirationTime("1h").sign(new TextEncoder().encode("wrong-secret"));
    expect(await sdk.verifySession(wrong)).toBeNull();
  });
});
