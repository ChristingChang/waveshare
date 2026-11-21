import { randomBytes, timingSafeEqual } from "node:crypto";
import { parse } from "cookie";
import type { Express, Request } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import * as db from "../db.js";
import { getSessionCookieOptions } from "./cookies.js";
import { ENV } from "./env.js";
import { sdk } from "./sdk.js";

export const GITHUB_STATE_COOKIE = "github_oauth_state";

function callbackUrl(req: Request) {
  if (ENV.githubCallbackUrl) return ENV.githubCallbackUrl;
  const secure = req.secure || req.get("x-forwarded-proto")?.split(",")[0].trim() === "https";
  return `${secure ? "https" : "http"}://${req.get("host")}/api/auth/github/callback`;
}

async function githubJson(url: string, options: RequestInit) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error("GitHub request failed");
  return response.json();
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/auth/github", (req, res) => {
    if (!ENV.githubClientId || !ENV.githubClientSecret || !ENV.cookieSecret) {
      res.status(503).json({ error: "GitHub login is not configured" });
      return;
    }
    const state = randomBytes(32).toString("hex");
    res.cookie(GITHUB_STATE_COOKIE, state, {
      ...getSessionCookieOptions(req), path: "/api/auth/github", maxAge: 10 * 60 * 1000,
    });
    const url = new URL("https://github.com/login/oauth/authorize");
    url.search = new URLSearchParams({ client_id: ENV.githubClientId, redirect_uri: callbackUrl(req), scope: "read:user user:email", state }).toString();
    res.redirect(302, url.toString());
  });

  app.get("/api/auth/github/callback", async (req, res) => {
    const cookieState = parse(req.headers.cookie ?? "")[GITHUB_STATE_COOKIE];
    res.clearCookie(GITHUB_STATE_COOKIE, { ...getSessionCookieOptions(req), path: "/api/auth/github" });
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const expected = Buffer.from(cookieState ?? "");
    const received = Buffer.from(state);
    if (!expected.length || expected.length !== received.length || !timingSafeEqual(expected, received)) {
      res.status(400).json({ error: "Invalid OAuth state" });
      return;
    }
    const code = typeof req.query.code === "string" ? req.query.code : "";
    if (!code) {
      res.status(400).json({ error: "GitHub authorization code is required" });
      return;
    }
    if (!ENV.githubClientId || !ENV.githubClientSecret || !ENV.cookieSecret) {
      res.status(503).json({ error: "GitHub login is not configured" });
      return;
    }
    try {
      const token = await githubJson("https://github.com/login/oauth/access_token", {
        method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: ENV.githubClientId, client_secret: ENV.githubClientSecret, code, redirect_uri: callbackUrl(req) }),
      });
      if (typeof token.access_token !== "string" || !token.access_token) throw new Error("GitHub token missing");
      const headers = { Accept: "application/vnd.github+json", Authorization: `Bearer ${token.access_token}`, "X-GitHub-Api-Version": "2022-11-28" };
      const profile = await githubJson("https://api.github.com/user", { headers });
      if (!Number.isSafeInteger(profile.id) || profile.id <= 0) throw new Error("GitHub user ID missing");
      let email = typeof profile.email === "string" ? profile.email : null;
      if (!email) {
        const emails: unknown = await githubJson("https://api.github.com/user/emails", { headers });
        if (!Array.isArray(emails)) throw new Error("Invalid GitHub emails response");
        email = emails.find(entry => entry?.primary === true && entry?.verified === true && typeof entry.email === "string")?.email ?? null;
      }
      const openId = `github:${profile.id}`;
      const name = typeof profile.name === "string" ? profile.name : typeof profile.login === "string" ? profile.login : "";
      await db.upsertUser({ openId, name, email, loginMethod: "github", lastSignedIn: new Date() });
      const session = await sdk.createSessionToken(openId, { name });
      res.cookie(COOKIE_NAME, session, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch {
      console.error("[OAuth] GitHub callback failed");
      res.status(502).json({ error: "GitHub login failed. Please try again." });
    }
  });
}
