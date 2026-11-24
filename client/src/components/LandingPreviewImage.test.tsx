// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import LandingPreviewImage from "./LandingPreviewImage";

afterEach(cleanup);

describe("landing preview image recovery", () => {
  it("recovers a failed WebP request using an independent PNG image", () => {
    render(<LandingPreviewImage image="home" alt="衝浪紀錄預覽" />);
    fireEvent.error(screen.getByAltText("衝浪紀錄預覽"));
    const fallback = screen.getByAltText("衝浪紀錄預覽");
    expect(fallback.getAttribute("src")).toBe("/landing/app-home.png");
    fireEvent.load(fallback);
    expect(screen.queryByText("預覽圖片暫時無法載入")).toBeNull();
  });

  it("replaces a double failure with a bounded, user-triggered retry", () => {
    render(<LandingPreviewImage image="home" alt="衝浪紀錄預覽" />);
    fireEvent.error(screen.getByAltText("衝浪紀錄預覽"));
    fireEvent.error(screen.getByAltText("衝浪紀錄預覽"));
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("預覽圖片暫時無法載入")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "重新載入圖片" }));
    expect(screen.getByAltText("衝浪紀錄預覽").getAttribute("src")).toBe("/landing/app-home.webp?retry=1");
    fireEvent.error(screen.getByAltText("衝浪紀錄預覽"));
    expect(screen.getByAltText("衝浪紀錄預覽").getAttribute("src")).toBe("/landing/app-home.png?retry=1");
    fireEvent.error(screen.getByAltText("衝浪紀錄預覽"));
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByRole("button", { name: "重新載入圖片" })).toBeTruthy();
  });
});
