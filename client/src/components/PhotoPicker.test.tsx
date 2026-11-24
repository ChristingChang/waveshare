// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";

const jpeg = new Blob([new Uint8Array(5)], { type: "image/jpeg" });
vi.mock("heic2any", () => ({ default: vi.fn(async () => jpeg) }));

import { PhotoPicker } from "./PhotoPicker";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("photo picker previews", () => {
  it("previews HEIC photos as the converted JPEG", async () => {
    const blobs: Blob[] = [];
    vi.stubGlobal("URL", Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => { blobs.push(blob); return `blob:${blobs.length}`; }),
      revokeObjectURL: vi.fn(),
    }));
    const heic = new File([new Uint8Array(10)], "IMG_1.HEIC", { type: "image/heic" });
    const jpg = new File([new Uint8Array(10)], "a.jpg", { type: "image/jpeg" });
    const { container } = render(<PhotoPicker files={[heic, jpg]} onFilesChange={() => {}} />);
    await waitFor(() => expect(container.querySelectorAll("img")).toHaveLength(2));
    expect(blobs).toHaveLength(2);
    expect(blobs.every(blob => blob.type === "image/jpeg")).toBe(true);
    expect(blobs).not.toContain(heic);
    expect(blobs).toContain(jpg);
  });
});
