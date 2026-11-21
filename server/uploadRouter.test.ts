import express from "express";
import type { Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sdk } from "./_core/sdk";
import { storagePut } from "./storage";
import uploadRouter from "./uploadRouter";

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: vi.fn() } }));
vi.mock("./storage", () => ({ storagePut: vi.fn() }));

const mp4 = Buffer.from("000000186674797069736f6d0000000069736f6d6d703432", "hex");
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use("/api", uploadRouter);
  await new Promise<void>(resolve => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test port");
  baseUrl = `http://127.0.0.1:${address.port}/api/upload-video`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(sdk.authenticateRequest).mockResolvedValue({ id: 42 } as Awaited<ReturnType<typeof sdk.authenticateRequest>>);
  vi.mocked(storagePut).mockResolvedValue({ key: "unused", url: "https://storage.example/video" });
});

async function upload(data: Buffer, type: string, name = "clip.mp4") {
  const body = new FormData();
  body.append("file", new Blob([new Uint8Array(data)], { type }), name);
  return fetch(baseUrl, { method: "POST", body });
}

describe("POST /api/upload-video", () => {
  it("rejects anonymous requests before parsing even malformed multipart", async () => {
    vi.mocked(sdk.authenticateRequest).mockRejectedValue(new Error("Invalid session"));
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "multipart/form-data" },
      body: "invalid multipart body",
    });
    expect(response.status).toBe(401);
    expect(storagePut).not.toHaveBeenCalled();
  });

  it("rejects a missing file", async () => {
    const response = await fetch(baseUrl, { method: "POST", body: new FormData() });
    expect(response.status).toBe(400);
    expect(storagePut).not.toHaveBeenCalled();
  });

  it.each([
    ["text/plain", mp4],
    ["video/mp4", Buffer.from("not a video")],
  ])("rejects invalid MIME or content (%s)", async (type, data) => {
    const response = await upload(data, type);
    expect(response.status).toBe(400);
    expect(storagePut).not.toHaveBeenCalled();
  });

  it.each([
    ["video/mp4", mp4, "mp4"],
    ["video/quicktime", Buffer.from("0000001466747970717420200000000071742020", "hex"), "mov"],
    ["video/webm", Buffer.from("1a45dfa3874282847765626d", "hex"), "webm"],
  ])("stores authenticated %s uploads in the user's namespace", async (type, data, extension) => {
    const response = await upload(data, type, "untrusted.html");
    expect(response.status).toBe(200);
    expect(sdk.authenticateRequest).toHaveBeenCalledOnce();
    expect(storagePut).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^surf-videos/42/video-\\d+-[a-f0-9]{16}\\.${extension}$`)),
      data,
      type,
    );
    expect(await response.json()).toEqual({
      url: "https://storage.example/video",
      path: vi.mocked(storagePut).mock.calls[0][0],
    });
  });

  it("returns an error when storage fails", async () => {
    vi.mocked(storagePut).mockRejectedValue(new Error("Storage unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await upload(mp4, "video/mp4");
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "Upload failed" });
    } finally {
      log.mockRestore();
    }
  });
});
