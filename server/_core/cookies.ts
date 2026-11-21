import type { CookieOptions, Request } from "express";
import { ENV } from "./env.js";

export function getSessionCookieOptions(req: Request): Pick<CookieOptions, "httpOnly" | "path" | "sameSite" | "secure"> {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: ENV.isProduction || req.protocol === "https" || req.get?.("x-forwarded-proto")?.split(",")[0].trim() === "https",
  };
}
