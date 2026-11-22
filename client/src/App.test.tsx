// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "./_core/hooks/useAuth";
import App from "./App";

vi.mock("./_core/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("./pages/Home", () => ({ default: () => <div>首頁內容</div> }));
vi.mock("./pages/Friends", () => ({ default: () => null }));
vi.mock("./pages/Calendar", () => ({ default: () => null }));
vi.mock("./pages/MapPage", () => ({ default: () => null }));
vi.mock("./pages/Stats", () => ({ default: () => null }));
vi.mock("./pages/Upload", () => ({ default: () => null }));
vi.mock("./pages/Detail", () => ({ default: () => null }));
vi.mock("./pages/Edit", () => ({ default: () => null }));
vi.mock("./components/ui/sonner", () => ({ Toaster: () => null }));

const logout = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/");
  vi.mocked(useAuth).mockReturnValue({ isAuthenticated: true, loading: false, logout } as never);
});
afterEach(cleanup);

describe("regular page authentication", () => {
  it.each(["/", "/friends", "/calendar", "/map", "/stats", "/upload", "/detail/1", "/edit/1", "/404", "/unknown"])("shows logout on %s", path => {
    window.history.replaceState({}, "", path);
    render(<App />);
    expect(screen.getByRole("button", { name: "登出" })).toBeTruthy();
  });

  it("lands on a signed-out screen without automatically starting OAuth again", async () => {
    logout.mockImplementationOnce(async () => {
      vi.mocked(useAuth).mockReturnValue({ isAuthenticated: false, loading: false, logout } as never);
    });
    const { rerender } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "登出" }));
    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
    rerender(<App />);
    expect(screen.getByText("您尚未登入，請登入以查看衝浪紀錄。")).toBeTruthy();
    expect(screen.getByRole("link", { name: "使用 Google 登入" }).getAttribute("href")).toBe("/api/auth/google");
    expect(screen.queryByRole("button", { name: "登出" })).toBeNull();
    expect(screen.queryByText("首頁內容")).toBeNull();
    expect(window.location.pathname).toBe("/");
  });
});
