// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ShareCardButton } from "./ShareCardButton";
import { createShareCardFile, makeSpotsCard } from "@/lib/shareCards";

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
});
