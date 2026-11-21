import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import { ForbiddenError } from "../../shared/_core/errors.js";
import { parse } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import * as db from "../db.js";
import { ENV } from "./env.js";

function sessionKey() {
  if (!ENV.cookieSecret) throw new Error("SESSION_SECRET is required");
  return new TextEncoder().encode(ENV.cookieSecret);
}

export const sdk = {
  async createSessionToken(openId: string, options: { expiresInMs?: number; name?: string } = {}) {
    return new SignJWT({ openId, name: options.name ?? "" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer("waveshare")
      .setAudience("waveshare")
      .setIssuedAt()
      .setExpirationTime(Math.floor((Date.now() + (options.expiresInMs ?? ONE_YEAR_MS)) / 1000))
      .sign(sessionKey());
  },

  async verifySession(token: string | undefined | null) {
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, sessionKey(), {
        algorithms: ["HS256"], issuer: "waveshare", audience: "waveshare",
      });
      if (typeof payload.openId !== "string" || !/^github:\d+$/.test(payload.openId)) return null;
      return { openId: payload.openId };
    } catch {
      return null;
    }
  },

  async authenticateRequest(req: Request) {
    const session = await sdk.verifySession(parse(req.headers.cookie ?? "")[COOKIE_NAME]);
    if (!session) throw ForbiddenError("Invalid session cookie");
    const user = await db.getUserByOpenId(session.openId);
    if (!user) throw ForbiddenError("User not found");
    return user;
  },
};
