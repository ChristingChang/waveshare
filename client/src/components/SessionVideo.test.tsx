// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { SessionVideo } from "./SessionVideo";

afterEach(cleanup);

describe("session video player", () => {
  it("plays through the app's playback route and reloads once when the signed link fails", () => {
    const { container } = render(<SessionVideo src="/api/videos/7" controls />);
    const first = container.querySelector("video")!;
    expect(first.getAttribute("src")).toBe("/api/videos/7");
    fireEvent.error(first);
    const second = container.querySelector("video")!;
    expect(second.getAttribute("src")).toBe("/api/videos/7?retry=1");
    fireEvent.error(second);
    expect(container.querySelector("video")!.getAttribute("src")).toBe("/api/videos/7?retry=1");
  });
});
