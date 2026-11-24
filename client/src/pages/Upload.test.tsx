// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { captureVideoFrame } from "@/lib/videoFrame";
import Upload from "./Upload";

const { createSession, presignUpload, presignPhotoUpload, getInviteLink, invalidateSessions } = vi.hoisted(() => ({
  createSession: vi.fn(),
  presignUpload: vi.fn(),
  presignPhotoUpload: vi.fn(),
  getInviteLink: vi.fn(),
  invalidateSessions: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ surfSessions: { invalidate: invalidateSessions } }),
    auth: { me: { useQuery: () => ({ data: { id: 1 } }) } },
    friends: {
      getFriends: { useQuery: () => ({ data: [] }) },
      getInviteLink: { useMutation: () => useMutation({ mutationFn: () => getInviteLink() }) },
    },
    surfSessions: {
      create: { useMutation: (options: object) => useMutation({ mutationFn: (input: unknown) => createSession(input), ...options }) },
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
const invitePath = `/invite/${"a".repeat(64)}`;
const inviteTitle = "邀請一起衝浪的朋友";
const writeText = vi.fn();

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
  createSession.mockResolvedValue({ success: true });
  getInviteLink.mockResolvedValue({ path: invitePath });
  vi.stubGlobal("XMLHttpRequest", VideoRequest);
  presignUpload.mockResolvedValue({ uploadUrl: "https://r2.test/video", videoPath: "video-path" });
  presignPhotoUpload.mockResolvedValue({ uploadUrl: "https://r2.test/photo", photoPath: "photo-path" });
  vi.mocked(captureVideoFrame).mockResolvedValue(new File(["frame"], "video-frame.jpg", { type: "image/jpeg" }));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = vi.fn().mockReturnValue("blob:video");
  });
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "clipboard");
});

function renderUpload() {
  const { hook } = memoryLocation({ path: "/upload" });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Router hook={hook}>
        <Route path="/upload" component={Upload} />
        <Route path="/">首頁內容</Route>
      </Router>
    </QueryClientProvider>
  );
}

function submitLog() {
  renderUpload();
  fireEvent.change(screen.getByLabelText("浪點"), { target: { value: "外澳" } });
  fireEvent.click(screen.getByRole("button", { name: "儲存" }));
}

function submitVideo(photo?: File) {
  renderUpload();
  const video = new File(["video"], "clip.mp4", { type: "video/mp4" });
  fireEvent.change(screen.getByLabelText(/影片/), { target: { files: [video] } });
  fireEvent.change(screen.getByLabelText("浪點"), { target: { value: "外澳" } });
  if (photo) fireEvent.change(screen.getByLabelText("照片"), { target: { files: [photo] } });
  fireEvent.click(screen.getByRole("button", { name: "儲存" }));
  return video;
}

describe("post-save friend invite", () => {
  it("waits for a successful save, and offers a LINE message and a copyable invite link", async () => {
    let finishSave!: () => void;
    createSession.mockImplementationOnce(() => new Promise<void>(resolve => { finishSave = resolve; }));
    submitLog();
    await waitFor(() => expect(createSession).toHaveBeenCalledOnce());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(getInviteLink).not.toHaveBeenCalled();

    await act(async () => finishSave());
    await screen.findByRole("dialog", { name: inviteTitle });
    const link = await screen.findByRole<HTMLAnchorElement>("link", { name: "用 LINE 傳送" });
    const line = new URL(link.href);
    const invite = new URL(invitePath, window.location.origin).href;
    expect(line.origin + line.pathname).toBe("https://line.me/R/share");
    expect(line.searchParams.get("text")).toBe(`一起衝浪好開心！來 WaveShare 加我當浪友吧 🌊\n${invite}`);
    expect(getInviteLink).toHaveBeenCalledOnce();
    expect(invalidateSessions).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "複製邀請連結" }));
    await screen.findByText("已複製邀請連結");
    expect(writeText).toHaveBeenCalledWith(invite);
    fireEvent.click(screen.getByRole("button", { name: "稍後再說" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("首頁內容")).toBeTruthy();
  });

  it("does not show an invite or navigate home if the log fails to save", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    createSession.mockRejectedValueOnce(new Error("Save failed"));
    submitLog();
    await screen.findByRole("button", { name: "儲存" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("首頁內容")).toBeNull();
    expect(getInviteLink).not.toHaveBeenCalled();
  });

  it("allows retrying invite retrieval and manually copying if the clipboard is unavailable", async () => {
    getInviteLink.mockRejectedValueOnce(new Error("Invite unavailable"));
    writeText.mockRejectedValueOnce(new Error("Clipboard denied"));
    submitLog();
    expect((await screen.findByRole("alert")).textContent).toBe("無法取得邀請連結，請再試一次。");

    fireEvent.click(screen.getByRole("button", { name: "重試" }));
    await screen.findByRole("link", { name: "用 LINE 傳送" });
    expect(createSession).toHaveBeenCalledOnce();
    expect(getInviteLink).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "複製邀請連結" }));
    const input = await screen.findByRole<HTMLInputElement>("textbox", { name: "浪友邀請連結" });
    expect(input.value).toBe(new URL(invitePath, window.location.origin).href);
    expect(input.readOnly).toBe(true);
  });
});

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
