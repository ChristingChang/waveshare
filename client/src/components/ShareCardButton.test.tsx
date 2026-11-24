// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ShareCardButton } from "./ShareCardButton";
import { createShareCardFile, makeRecordCard, makeSpotsCard } from "@/lib/shareCards";

vi.mock("@/lib/shareCards", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/shareCards")>(),
  createShareCardFile: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ShareCardButton", () => {
  it.each([false, true])("offers a PNG download when file sharing support is %s", async canShare => {
    const file = new File(["PNG"], "waveshare-my-spots.png", { type: "image/png" });
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, canShare: vi.fn().mockReturnValue(canShare) });
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL = vi.fn().mockReturnValue("blob:spots");
      static revokeObjectURL = revokeObjectURL;
    });
    vi.mocked(createShareCardFile).mockResolvedValue(file);

    const { unmount } = render(<ShareCardButton card={makeSpotsCard([])} />);
    fireEvent.click(screen.getByRole("button", { name: "分享圖卡" }));
    const download = await screen.findByRole("link", { name: "下載圖片" });
    expect(download.getAttribute("href")).toBe("blob:spots");
    expect(download.getAttribute("download")).toBe(file.name);

    if (canShare) {
      fireEvent.click(screen.getByRole("button", { name: "分享圖片" }));
      expect(share).toHaveBeenCalledWith({ files: [file] });
    } else {
      expect(screen.queryByRole("button", { name: "分享圖片" })).toBeNull();
    }

    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:spots");
  });

  it("allows a record photo to be replaced with the illustrated background", async () => {
    const defaultPng = new File(["PNG illustration"], "card.png", { type: "image/png" });
    const photoPng = new File(["PNG photo"], "card.png", { type: "image/png" });
    const photo = new File(["JPEG"], "surf.jpg", { type: "image/jpeg" });
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL = vi.fn((file: File) => file === photoPng ? "blob:photo" : "blob:illustration");
      static revokeObjectURL = vi.fn();
    });
    vi.mocked(createShareCardFile).mockImplementation(async (_card, background) =>
      background ? photoPng : defaultPng
    );
    const card = makeRecordCard({ spotName: "外澳", date: "2026-11-20", waveQuality: 4 });
    render(<ShareCardButton card={card} />);
    fireEvent.click(screen.getByRole("button", { name: "分享圖卡" }));
    expect((await screen.findByRole("link", { name: "下載圖片" })).getAttribute("href")).toBe("blob:illustration");

    const input = screen.getByRole("dialog").querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [photo] } });
    expect(createShareCardFile).toHaveBeenLastCalledWith(card, photo);
    expect((await screen.findByRole("link", { name: "下載圖片" })).getAttribute("href")).toBe("blob:photo");

    fireEvent.click(screen.getByRole("button", { name: "改用海浪插畫" }));
    expect(createShareCardFile).toHaveBeenLastCalledWith(card, undefined);
    expect((await screen.findByRole("link", { name: "下載圖片" })).getAttribute("href")).toBe("blob:illustration");
  });

  it("defaults to the record photo and allows overriding it with the illustration or a local file", async () => {
    const png = new File(["PNG"], "card.png", { type: "image/png" });
    const local = new File(["JPEG"], "surf.jpg", { type: "image/jpeg" });
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL = vi.fn().mockReturnValue("blob:card");
      static revokeObjectURL = vi.fn();
    });
    vi.mocked(createShareCardFile).mockResolvedValue(png);
    const card = makeRecordCard({ spotName: "外澳", date: "2026-11-20", waveQuality: 4 });
    render(<ShareCardButton card={card} recordPhotoUrl="/api/photos/12" />);
    fireEvent.click(screen.getByRole("button", { name: "分享圖卡" }));
    expect(await screen.findByRole("link", { name: "下載圖片" })).toBeTruthy();
    expect(createShareCardFile).toHaveBeenLastCalledWith(card, "/api/photos/12");

    fireEvent.click(screen.getByRole("button", { name: "改用海浪插畫" }));
    expect(await screen.findByRole("link", { name: "下載圖片" })).toBeTruthy();
    expect(createShareCardFile).toHaveBeenLastCalledWith(card, undefined);

    const input = screen.getByRole("dialog").querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [local] } });
    expect(await screen.findByRole("link", { name: "下載圖片" })).toBeTruthy();
    expect(createShareCardFile).toHaveBeenLastCalledWith(card, local);
  });

  it("automatically tries the record video when opened and allows opting out", async () => {
    const png = new File(["PNG"], "card.png", { type: "image/png" });
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL = vi.fn().mockReturnValue("blob:card");
      static revokeObjectURL = vi.fn();
    });
    vi.mocked(createShareCardFile).mockResolvedValue(png);
    const card = makeRecordCard({ spotName: "外澳", date: "2026-11-20", waveQuality: 4 });
    render(<ShareCardButton card={card} recordVideoUrl="/api/videos/7" />);
    expect(createShareCardFile).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "分享圖卡" }));
    expect(await screen.findByRole("link", { name: "下載圖片" })).toBeTruthy();
    expect(createShareCardFile).toHaveBeenLastCalledWith(card, undefined, "/api/videos/7");

    fireEvent.click(screen.getByRole("button", { name: "改用海浪插畫" }));
    expect(await screen.findByRole("link", { name: "下載圖片" })).toBeTruthy();
    expect(createShareCardFile).toHaveBeenLastCalledWith(card, undefined);
  });
});
