import type { Server } from "http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../api/index";

let server: Server;
let origin: string;

beforeAll(async () => {
  await new Promise<void>(resolve => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
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

describe("Vercel Express handler", () => {
  it("serves the tRPC health endpoint at the original API path", async () => {
    const input = encodeURIComponent(JSON.stringify({ json: { timestamp: 0 } }));
    const response = await fetch(`${origin}/api/trpc/system.health?input=${input}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: { data: { json: { ok: true } } } });
  });

  it("removes the legacy video proxy endpoint", async () => {
    const response = await fetch(`${origin}/api/upload-video`, { method: "POST" });
    expect(response.status).toBe(404);
  });

  it("registers the OAuth callback", async () => {
    const response = await fetch(`${origin}/api/oauth/callback`);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "code and state are required" });
  });
});
