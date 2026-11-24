// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureVideoFrame } from "@/lib/videoFrame";
import Upload from "./Upload";

const { createSession, presignUpload, presignPhotoUpload } = vi.hoisted(() => ({
  createSession: vi.fn(),
  presignUpload: vi.fn(),
  presignPhotoUpload: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({}),
    auth: { me: { useQuery: () => ({ data: { id: 1 } }) } },
    friends: { getFriends: { useQuery: () => ({ data: [] }) } },
    surfSessions: {
      create: { useMutation: () => ({ mutateAsync: createSession }) },
      presignUpload: { useMutation: () => ({ mutateAsync: presignUpload }) },
      presignPhotoUpload: { useMutation: () => ({ mutateAsync: presignPhotoUpload }) },
    },
  },
}));

vi.mock("@/components/SpotSelector", () => ({
  SpotSelector: ({ onChange }: { onChange: (value: string) => void }) => (
    <input aria-label="浪點" onChange={event => onChange(event.target.value)} />
  ),
}));

vi.mock("@/components/PhotoPicker", () => ({
  PhotoPicker: ({ onFilesChange }: { onFilesChange: (files: File[]) => void }) => (
    <input aria-label="照片" type="file" onChange={event => onFilesChange(Array.from(event.target.files ?? []))} />
  ),
}));

vi.mock("@/lib/videoFrame", () => ({ captureVideoFrame: vi.fn() }));

let videoRequest: VideoRequest;
let autoCompleteVideo: boolean;

class VideoRequest {
  upload = { onprogress: null as ((event: { loaded: number }) => void) | null };
  status = 200;
  onload: (() => void) | null = null;
  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn(() => {
    if (autoCompleteVideo) queueMicrotask(() => this.onload?.());
  });

  constructor() {
    videoRequest = this;
  }
}

beforeEach(() => {
  autoCompleteVideo = true;
  vi.stubGlobal("XMLHttpRequest", VideoRequest);
  presignUpload.mockResolvedValue({ uploadUrl: "https://r2.test/video", videoPath: "video-path" });
  presignPhotoUpload.mockResolvedValue({ uploadUrl: "https://r2.test/photo", photoPath: "photo-path" });
  vi.mocked(captureVideoFrame).mockResolvedValue(new File(["frame"], "video-frame.jpg", { type: "image/jpeg" }));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = vi.fn().mockReturnValue("blob:video");
  });
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function submitVideo(photo?: File) {
  render(<Upload />);
  const video = new File(["video"], "clip.mp4", { type: "video/mp4" });
  fireEvent.change(screen.getByLabelText(/影片/), { target: { files: [video] } });
  fireEvent.change(screen.getByLabelText("浪點"), { target: { value: "外澳" } });
  if (photo) fireEvent.change(screen.getByLabelText("照片"), { target: { files: [photo] } });
  fireEvent.click(screen.getByRole("button", { name: "儲存" }));
  return video;
}

describe("video-only uploads", () => {
  it("reports video transfer progress and prepares the frame during the direct PUT", async () => {
    autoCompleteVideo = false;
    const video = submitVideo();
    expect(screen.getByRole("status").textContent).toContain("正在準備上傳影片");

    await waitFor(() => expect(captureVideoFrame).toHaveBeenCalledWith(video));
    expect(videoRequest.open).toHaveBeenCalledWith("PUT", "https://r2.test/video");
    expect(videoRequest.setRequestHeader).toHaveBeenCalledWith("Content-Type", "video/mp4");
    expect(videoRequest.send).toHaveBeenCalledWith(video);
    expect(presignPhotoUpload).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();

    act(() => videoRequest.upload.onprogress?.({ loaded: 2 }));
    expect(screen.getByRole<HTMLProgressElement>("progressbar", { name: "影片上傳進度" }).value).toBe(40);
    act(() => videoRequest.upload.onprogress?.({ loaded: video.size }));
    expect(screen.getByRole<HTMLProgressElement>("progressbar", { name: "影片上傳進度" }).value).toBe(99);

    act(() => videoRequest.onload?.());
    expect(screen.getByRole("status").textContent).toContain("影片已上傳，正在處理照片並儲存紀錄");
    await waitFor(() => expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      videoPath: "video-path", photoPaths: ["photo-path"],
    })));
  });

  it("does not upload the prepared photo or save a session if R2 rejects the video", async () => {
    autoCompleteVideo = false;
    vi.spyOn(console, "error").mockImplementation(() => {});
    const video = submitVideo();
    await waitFor(() => expect(captureVideoFrame).toHaveBeenCalledWith(video));

    videoRequest.status = 403;
    act(() => videoRequest.onload?.());

    await waitFor(() => expect(screen.getByRole<HTMLButtonElement>("button", { name: "儲存" }).disabled).toBe(false));
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(presignPhotoUpload).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  it("saves the generated frame as a record photo", async () => {
    const video = submitVideo();
    await waitFor(() => expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      videoPath: "video-path", photoPaths: ["photo-path"],
    })));
    expect(captureVideoFrame).toHaveBeenCalledWith(video);
    expect(presignPhotoUpload).toHaveBeenCalledWith({ contentType: "image/jpeg", size: 5 });
  });

  it("uses a selected photo without generating a frame", async () => {
    const photo = new File(["manual"], "photo.jpg", { type: "image/jpeg" });
    submitVideo(photo);
    await waitFor(() => expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      photoPaths: ["photo-path"],
    })));
    expect(captureVideoFrame).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith("https://r2.test/photo", expect.objectContaining({ body: photo }));
  });

  it.each(["capture", "photo upload"])("still saves the video when %s fails", async failure => {
    if (failure === "capture") vi.mocked(captureVideoFrame).mockRejectedValueOnce(new Error("Decode failed"));
    else presignPhotoUpload.mockRejectedValueOnce(new Error("Could not reserve photo upload"));
    submitVideo();
    await waitFor(() => expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      videoPath: "video-path", photoPaths: [],
    })));
  });
});
