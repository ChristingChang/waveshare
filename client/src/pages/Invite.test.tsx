// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Invite, { getLineExternalUrl } from "./Invite";

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({}),
    friends: { acceptInvite: { useMutation: () => ({ mutate, isPending: false }) } },
  },
}));

const code = "a".repeat(64);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("Invite", () => {
  it("uses a Google sign-in form for signed-out visitors without redeeming on load", () => {
    render(<Invite code={code} isAuthenticated={false} />);
    const form = screen.getByRole("button", { name: "使用 Google 登入並加入浪友" }).closest("form");
    expect(form?.getAttribute("action")).toBe("/api/auth/google/invite");
    expect(form?.method).toBe("post");
    expect(form && new FormData(form).get("code")).toBe(code);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("only redeems for a signed-in visitor after an explicit click", () => {
    render(<Invite code={code} isAuthenticated />);
    expect(mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "加入浪友" }));
    expect(mutate.mock.calls).toEqual([[{ code }]]);
  });

  it("does not offer sign-in or redemption for a malformed code", () => {
    render(<Invite code="invalid" isAuthenticated={false} />);
    expect(screen.getByRole("alert").textContent).toBe("這個浪友邀請連結無效。");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each(["Instagram 360", "[FBAN/FBIOS;FBAV/508.0;]", "Messenger"])(
    "does not start Google login in %s and offers a copyable browser link",
    async userAgent => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("navigator", { userAgent, clipboard: { writeText } });
      render(<Invite code={code} isAuthenticated={false} />);
      expect(screen.queryByRole("button", { name: /Google/ })).toBeNull();
      expect(screen.getByText(/在 Safari 或 Chrome 開啟/)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "複製邀請連結" }));
      expect((await screen.findByRole("status")).textContent).toBe("已複製邀請連結");
      expect(writeText.mock.calls).toEqual([[`${window.location.origin}/invite/${code}`]]);
    },
  );

  it("keeps the URL and adds LINE's external-browser flag only once", () => {
    const invite = `https://wave.example/invite/${code}?from=line#top`;
    const target = `https://wave.example/invite/${code}?from=line&openExternalBrowser=1#top`;
    expect(getLineExternalUrl(invite)).toBe(target);
    expect(getLineExternalUrl(target)).toBeUndefined();
  });

  it("offers manual copying if LINE stays in the in-app browser with no clipboard access", async () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 Line/15.0" });
    window.history.replaceState(null, "", `/invite/${code}?openExternalBrowser=1`);
    render(<Invite code={code} isAuthenticated={false} />);
    expect(screen.queryByRole("button", { name: /Google/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "複製邀請連結" }));
    const link = await screen.findByRole<HTMLInputElement>("textbox", { name: "浪友邀請連結" });
    expect(link.value).toBe(`${window.location.origin}/invite/${code}`);
  });

  it("lets signed-in visitors join directly even in an in-app browser", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 Line/15.0" });
    render(<Invite code={code} isAuthenticated />);
    fireEvent.click(screen.getByRole("button", { name: "加入浪友" }));
    expect(mutate.mock.calls).toEqual([[{ code }]]);
  });
});
