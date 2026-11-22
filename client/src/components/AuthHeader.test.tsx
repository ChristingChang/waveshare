// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { AuthHeader } from "./AuthHeader";

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
const logout = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  logout.mockResolvedValue(undefined);
  vi.mocked(useAuth).mockReturnValue({ isAuthenticated: true, loading: false, logout } as never);
});
afterEach(cleanup);

describe("regular page logout header", () => {
  it("uses the existing logout action and disappears when signed out", async () => {
    const { rerender } = render(<AuthHeader />);
    fireEvent.click(screen.getByRole("button", { name: "登出" }));
    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: false, loading: false, logout } as never);
    rerender(<AuthHeader />);
    expect(screen.queryByRole("button", { name: "登出" })).toBeNull();
  });

  it("disables logout while authentication is pending", () => {
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: true, loading: true, logout } as never);
    render(<AuthHeader />);
    const button = screen.getByRole("button", { name: "登出" });
    expect(button.hasAttribute("disabled")).toBe(true);
    fireEvent.click(button);
    expect(logout).not.toHaveBeenCalled();
  });

  it("reports logout failures in Traditional Chinese", async () => {
    logout.mockRejectedValueOnce(new Error("network failed"));
    render(<AuthHeader />);
    fireEvent.click(screen.getByRole("button", { name: "登出" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("登出失敗，請稍後再試。"));
  });
});
