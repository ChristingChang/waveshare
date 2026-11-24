// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createTRPCClient } from "@trpc/client";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiLink } from "@/lib/trpc";
import { captureVideoFrame } from "@/lib/videoFrame";
import type { AppRouter } from "../../../server/routers";
import Upload from "./Upload";

const { createSession, presignUpload, presignPhotoUpload } = vi.hoisted(() => ({
  createSession: vi.fn(),
  presignUpload: vi.fn(),
  presignPhotoUpload: vi.fn(),
}));

vi.mock("@/lib/trpc", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/trpc")>(),
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
  vi.useRealTimers();
  vi.resetAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function submitPhoto(photo: File) {
  render(<Upload />);
  fireEvent.change(screen.getByLabelText("浪點"), { target: { value: "外澳" } });
  fireEvent.change(screen.getByLabelText("照片"), { target: { files: [photo] } });
  fireEvent.click(screen.getByRole("button", { name: "儲存" }));
}

describe("photo authorization", () => {
  const client = createTRPCClient<AppRouter>({ links: [apiLink] });
  const photo = new File(["photo"], "photo.jpg", { type: "image/jpeg" });

  beforeEach(() => {
    presignPhotoUpload.mockImplementation(input => client.surfSessions.presignPhotoUpload.mutate(input));
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(toast, "error").mockImplementation(() => "");
  });

  it("aborts a stalled authorization and lets the user save again after the deadline", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementationOnce((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    }));
    submitPhoto(photo);

    await act(async () => { await vi.advanceTimersByTimeAsync(9_999); });
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "上傳中..." }).disabled).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith("/api/trpc/surfSessions.presignPhotoUpload", expect.objectContaining({
      credentials: "include", method: "POST", signal: expect.any(AbortSignal),
    }));
    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
    expect(signal?.aborted).toBe(false);

    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(signal?.aborted).toBe(true);
    expect(toast.error).toHaveBeenCalledWith("照片上傳授權逾時，請稍後重試");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "儲存" }).disabled).toBe(false);
    expect(fetch).toHaveBeenCalledOnce();
    expect(createSession).not.toHaveBeenCalled();
  });

  it("shows a retry message for a non-JSON 504 and saves the same photo on retry", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("504: FUNCTION_INVOCATION_TIMEOUT", { status: 504 }))
      .mockResolvedValueOnce(Response.json({
        result: { data: { json: { uploadUrl: "https://r2.test/photo", photoPath: "photo-path" } } },
      }));
    submitPhoto(photo);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("照片上傳授權逾時，請稍後重試"));
    expect(fetch).toHaveBeenCalledOnce();
    expect(createSession).not.toHaveBeenCalled();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "儲存" }).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "儲存" }));

    await waitFor(() => expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      spotName: "外澳", photoPaths: ["photo-path"],
    })));
    expect(fetch).toHaveBeenLastCalledWith("https://r2.test/photo", expect.objectContaining({ method: "PUT", body: photo }));
  });
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
