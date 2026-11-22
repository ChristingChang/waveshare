import { randomBytes, timingSafeEqual } from "node:crypto";
import { parse } from "cookie";
import type { Express, Request } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import * as db from "../db.js";
import { getSessionCookieOptions } from "./cookies.js";
import { ENV } from "./env.js";
import { sdk } from "./sdk.js";

export const GOOGLE_STATE_COOKIE = "google_oauth_state";

function callbackUrl(req: Request) {
  if (ENV.googleCallbackUrl) return ENV.googleCallbackUrl;
  const secure = req.secure || req.get("x-forwarded-proto")?.split(",")[0].trim() === "https";
  return `${secure ? "https" : "http"}://${req.get("host")}/api/auth/google/callback`;
}

async function googleJson(url: string, options: RequestInit) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error("Google request failed");
  return response.json();
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/auth/google", (req, res) => {
    if (!ENV.googleClientId || !ENV.googleClientSecret || !ENV.cookieSecret) {
      res.status(503).json({ error: "Google login is not configured" });
      return;
    }
    const state = randomBytes(32).toString("hex");
    res.cookie(GOOGLE_STATE_COOKIE, state, {
      ...getSessionCookieOptions(req), path: "/api/auth/google", maxAge: 10 * 60 * 1000,
    });
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({ client_id: ENV.googleClientId, redirect_uri: callbackUrl(req), scope: "openid email profile", response_type: "code", state }).toString();
    res.redirect(302, url.toString());
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const cookieState = parse(req.headers.cookie ?? "")[GOOGLE_STATE_COOKIE];
    res.clearCookie(GOOGLE_STATE_COOKIE, { ...getSessionCookieOptions(req), path: "/api/auth/google" });
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const expected = Buffer.from(cookieState ?? "");
    const received = Buffer.from(state);
    if (!expected.length || expected.length !== received.length || !timingSafeEqual(expected, received)) {
      res.status(400).json({ error: "Invalid OAuth state" });
      return;
    }
    const code = typeof req.query.code === "string" ? req.query.code : "";
    if (!code) {
      res.status(400).json({ error: "Google authorization code is required" });
      return;
    }
    if (!ENV.googleClientId || !ENV.googleClientSecret || !ENV.cookieSecret) {
      res.status(503).json({ error: "Google login is not configured" });
      return;
    }
    try {
      const token = await googleJson("https://oauth2.googleapis.com/token", {
        method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: ENV.googleClientId, client_secret: ENV.googleClientSecret, code, redirect_uri: callbackUrl(req), grant_type: "authorization_code" }),
      });
      if (typeof token.access_token !== "string" || !token.access_token) throw new Error("Google token missing");
      const headers = { Accept: "application/json", Authorization: `Bearer ${token.access_token}` };
      const profile = await googleJson("https://openidconnect.googleapis.com/v1/userinfo", { headers });
      if (typeof profile.sub !== "string" || !profile.sub.trim() || profile.sub.length > 57) throw new Error("Invalid Google subject");
      const email = profile.email_verified === true && typeof profile.email === "string" ? profile.email : null;
      const openId = `google:${profile.sub}`;
      const name = typeof profile.name === "string" ? profile.name : "";
      await db.upsertUser({ openId, name, email, loginMethod: "google", lastSignedIn: new Date() });
      const session = await sdk.createSessionToken(openId, { name });
      res.cookie(COOKIE_NAME, session, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch {
      console.error("[OAuth] Google callback failed");
      res.status(502).json({ error: "Google login failed. Please try again." });
    }
  });
}
