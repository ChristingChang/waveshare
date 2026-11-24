// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Invite from "./Invite";

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
});
