// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SessionShares } from "./SessionShares";

afterEach(cleanup);

describe("session sharing controls", () => {
  it("starts private and saves only selected friends", () => {
    const save = vi.fn();
    render(<SessionShares friends={[{ id: 2, name: "小浪" }, { id: 3, name: "小海" }]} sharedIds={[]} pending={false} onSave={save} />);
    expect(screen.getByText(/新紀錄不會自動分享/)).toBeTruthy();
    expect(screen.getAllByRole("checkbox").every(box => box.getAttribute("aria-checked") === "false")).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "小浪" }));
    fireEvent.click(screen.getByRole("button", { name: "儲存分享設定" }));
    expect(save).toHaveBeenCalledWith([2]);
    fireEvent.click(screen.getByRole("checkbox", { name: "小浪" }));
    fireEvent.click(screen.getByRole("button", { name: "儲存分享設定" }));
    expect(save).toHaveBeenLastCalledWith([]);
  });

  it("shows an empty state and still allows clearing stale shares", () => {
    const save = vi.fn();
    render(<SessionShares friends={[]} sharedIds={[9]} pending={false} onSave={save} />);
    expect(screen.getByText(/還沒有好友/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(save).toHaveBeenCalledWith([]);
  });

  it("keeps selections while saving and allows retrying after an error", () => {
    const save = vi.fn();
    const props = { friends: [{ id: 2, name: "小浪" }], sharedIds: [2], onSave: save };
    const view = render(<SessionShares {...props} pending={true} />);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
    view.rerender(<SessionShares {...props} pending={false} />);
    fireEvent.click(screen.getByRole("button"));
    expect(save).toHaveBeenCalledWith([2]);
  });
});
