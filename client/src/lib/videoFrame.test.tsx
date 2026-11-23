import { afterEach, describe, expect, it, vi } from "vitest";
import { captureVideoFrame } from "./videoFrame";

function mockVideoCapture(duration: number, width: number, height: number) {
  const video = {
    duration,
    videoWidth: width,
    videoHeight: height,
    HAVE_CURRENT_DATA: 2,
    readyState: 2,
    currentTime: 0,
    onloadedmetadata: () => {},
    onloadeddata: () => {},
    onseeked: () => {},
    onerror: () => {},
    removeAttribute: vi.fn(),
    load: vi.fn(),
  };
  const drawImage = vi.fn();
  const jpeg = new Blob(["frame"], { type: "image/jpeg" });
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage }),
    toBlob: vi.fn((done: (image: Blob) => void) => done(jpeg)),
  };
  vi.stubGlobal("document", { createElement: (tag: string) => tag === "video" ? video : canvas });
  const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:video");
  const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const source = new File(["video"], "clip.mp4", { type: "video/mp4" });
  return { canvas, createObjectURL, drawImage, revokeObjectURL, source, video };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("captureVideoFrame", () => {
  it.each([
    [8, 3840, 2160, 1, 1920, 1080],
    [0.5, 2160, 3840, 0.05, 1080, 1920],
  ])("seeks within a %ss clip and exports a JPEG with the original aspect ratio",
    async (duration, width, height, time, outputWidth, outputHeight) => {
      const { canvas, createObjectURL, drawImage, revokeObjectURL, source, video } = mockVideoCapture(duration, width, height);
      const result = captureVideoFrame(source);
      expect(createObjectURL).toHaveBeenCalledWith(source);
      video.onloadedmetadata();
      expect(video.currentTime).toBe(time);
      video.onloadeddata();
      expect(drawImage).not.toHaveBeenCalled();
      video.onseeked();
      await expect(result).resolves.toMatchObject({ name: "video-frame.jpg", type: "image/jpeg", size: 5 });
      expect(canvas).toMatchObject({ width: outputWidth, height: outputHeight });
      expect(drawImage).toHaveBeenCalledWith(video, 0, 0, outputWidth, outputHeight);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:video");
    });

  it.each([Infinity, 0])("captures the first decoded frame without seeking when duration is %s", async duration => {
    const { drawImage, source, video } = mockVideoCapture(duration, 1920, 1080);
    video.readyState = 1;
    const result = captureVideoFrame(source);
    video.onloadedmetadata();
    expect(video.currentTime).toBe(0);
    expect(drawImage).not.toHaveBeenCalled();
    video.readyState = video.HAVE_CURRENT_DATA;
    video.onloadeddata();
    await expect(result).resolves.toMatchObject({ name: "video-frame.jpg", type: "image/jpeg" });
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 1920, 1080);
  });

  it("rejects a decoder error and releases the local video URL", async () => {
    const { revokeObjectURL, source, video } = mockVideoCapture(8, 1920, 1080);
    const result = captureVideoFrame(source);
    video.onerror();
    await expect(result).rejects.toThrow("Could not decode video");
    expect(video.removeAttribute).toHaveBeenCalledWith("src");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:video");
  });

  it("times out if the browser never supplies a frame", async () => {
    vi.useFakeTimers();
    const { revokeObjectURL, source } = mockVideoCapture(8, 1920, 1080);
    const result = expect(captureVideoFrame(source)).rejects.toThrow("Video frame capture timed out");
    await vi.advanceTimersByTimeAsync(5_000);
    await result;
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:video");
  });
});
