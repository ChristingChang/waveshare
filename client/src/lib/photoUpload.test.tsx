import { afterEach, describe, expect, it, vi } from "vitest";
import { photoContentType, photoFileError, uploadPhotos } from "./photoUpload";

const file = (name: string, type: string, size = 10) => new File([new Uint8Array(size)], name, { type });

afterEach(() => vi.unstubAllGlobals());

describe("photo upload helpers", () => {
  it("accepts JPG, PNG and HEIC, including HEIC files with no reported type", () => {
    expect(photoContentType(file("a.jpg", "image/jpeg"))).toBe("image/jpeg");
    expect(photoContentType(file("a.png", "image/png"))).toBe("image/png");
    expect(photoContentType(file("IMG_1.HEIC", ""))).toBe("image/heic");
    expect(photoContentType(file("a.gif", "image/gif"))).toBeNull();
  });

  it("rejects empty or oversized photos", () => {
    expect(photoFileError(file("a.jpg", "image/jpeg"))).toBeNull();
    expect(photoFileError(file("a.jpg", "image/jpeg", 0))).toContain("20MB");
    expect(photoFileError(file("a.gif", "image/gif"))).toContain("JPG");
  });

  it("uploads each photo to its signed link and returns the storage paths", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const presign = vi.fn()
      .mockResolvedValueOnce({ uploadUrl: "https://put/1", photoPath: "p1" })
      .mockResolvedValueOnce({ uploadUrl: "https://put/2", photoPath: "p2" });
    await expect(uploadPhotos([file("a.jpg", "image/jpeg"), file("b.heic", "")], presign)).resolves.toEqual(["p1", "p2"]);
    expect(presign).toHaveBeenLastCalledWith({ contentType: "image/heic", size: 10 });
    expect(fetchMock).toHaveBeenLastCalledWith("https://put/2", expect.objectContaining({ method: "PUT", headers: { "Content-Type": "image/heic" } }));
  });

  it("stops when an upload fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const presign = vi.fn().mockResolvedValue({ uploadUrl: "https://put/1", photoPath: "p1" });
    await expect(uploadPhotos([file("a.jpg", "image/jpeg")], presign)).rejects.toThrow("照片上傳失敗");
  });
});
