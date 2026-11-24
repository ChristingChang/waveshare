import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { parse } from "cookie";
import type { Express, Request, Response } from "express";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import { FRIEND_INVITE_CODE, friendInvitePath } from "../../shared/friendInvite.js";
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

function matches(expected: string, received: string) {
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}

function inviteStateSignature(state: string, code: string) {
  return createHmac("sha256", ENV.cookieSecret).update(`google-invite:${state}:${code}`).digest("hex");
}

export function registerOAuthRoutes(app: Express) {
  function startGoogleLogin(req: Request, res: Response, inviteCode?: string) {
    if (!ENV.googleClientId || !ENV.googleClientSecret || !ENV.cookieSecret) {
      res.status(503).json({ error: "Google login is not configured" });
      return;
    }
    const state = randomBytes(32).toString("hex");
    const cookieState = inviteCode ? `${state}.${inviteCode}.${inviteStateSignature(state, inviteCode)}` : state;
    res.cookie(GOOGLE_STATE_COOKIE, cookieState, {
      ...getSessionCookieOptions(req), path: "/api/auth/google", maxAge: 10 * 60 * 1000,
    });
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({ client_id: ENV.googleClientId, redirect_uri: callbackUrl(req), scope: "openid email profile", response_type: "code", state }).toString();
    res.redirect(inviteCode ? 303 : 302, url.toString());
  }

  app.get("/api/auth/google", (req, res) => startGoogleLogin(req, res));
  app.post("/api/auth/google/invite", (req, res) => {
    if (req.get("origin") !== new URL(callbackUrl(req)).origin) {
      res.status(403).json({ error: "Invalid invite origin" });
      return;
    }
    const code = req.body?.code;
    if (typeof code !== "string" || !FRIEND_INVITE_CODE.test(code)) {
      res.status(400).json({ error: "Invalid friend invite" });
      return;
    }
    startGoogleLogin(req, res, code);
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const [cookieState = "", inviteCode, signature, extra] =
      (parse(req.headers.cookie ?? "")[GOOGLE_STATE_COOKIE] ?? "").split(".");
    res.clearCookie(GOOGLE_STATE_COOKIE, { ...getSessionCookieOptions(req), path: "/api/auth/google" });
    const state = typeof req.query.state === "string" ? req.query.state : "";
    if (!matches(cookieState, state) || (inviteCode !== undefined && (
      !FRIEND_INVITE_CODE.test(inviteCode) || !signature || extra !== undefined ||
      !matches(inviteStateSignature(state, inviteCode), signature)
    ))) {
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
    let openId: string;
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
      openId = `google:${profile.sub}`;
      const name = typeof profile.name === "string" ? profile.name : "";
      await db.upsertUser({ openId, name, email, loginMethod: "google", lastSignedIn: new Date() });
      const session = await sdk.createSessionToken(openId, { name });
      res.cookie(COOKIE_NAME, session, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
    } catch {
      console.error("[OAuth] Google callback failed");
      res.status(502).json({ error: "Google login failed. Please try again." });
      return;
    }

    if (!inviteCode) {
      res.redirect(302, "/");
      return;
    }

    try {
      const user = await db.getUserByOpenId(openId);
      if (!user) throw new Error("User not found after sign-in");
      await db.acceptFriendInvite(user.id, inviteCode);
      res.redirect(302, "/friends?joined=1");
    } catch (error) {
      const reason = error instanceof TRPCError && error.code === "NOT_FOUND" ? "invalid"
        : error instanceof TRPCError && error.code === "BAD_REQUEST" ? "self" : "retry";
      res.redirect(302, `${friendInvitePath(inviteCode)}?joinError=${reason}`);
    }
  });
}
