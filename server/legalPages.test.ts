import type { Server } from "node:http";
import path from "node:path";
import { readFileSync } from "node:fs";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serveStatic } from "./_core/vite";

let server: Server;
let origin: string;

beforeAll(async () => {
  const app = express();
  serveStatic(app, path.resolve(import.meta.dirname, "../client/public"));
  await new Promise<void>(resolve => { server = app.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test port");
  origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
});

describe("public legal pages", () => {
  it.each([
    { route: "/privacy", title: "隱私權政策", content: ["已驗證電子郵件", "sub", "Cloudflare R2", "任何持有影片連結的人都可以觀看", "不會出售", "Cookie", "TiDB Cloud", "Vercel"] },
    { route: "/terms", title: "服務條款", content: ["所有權", "MP4", "MOV", "WebM", "100 MiB", "24 小時", "10 次", "台灣", "as-is"] },
  ])("serves complete $route HTML without authentication or JavaScript", async ({ route, title, content }) => {
    const response = await fetch(`${origin}${route}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain(`<h1>${title}</h1>`);
    expect(html).toContain("2026-11-22");
    expect(html).toContain("https://github.com/ChristingChang/waveshare/issues");
    expect(html).not.toContain("<script");
    for (const text of content) expect(html).toContain(text);
    const config = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../vercel.json"), "utf8"));
    const firstMatch = config.rewrites.find((rule: { source: string }) => new RegExp(`^${rule.source}$`).test(route));
    expect(firstMatch.destination).toBe(`${route}.html`);
  });

  it("serves the shared stylesheet", async () => {
    const response = await fetch(`${origin}/legal.css`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/css");
  });
});
