const MAX_FRAME_EDGE = 1920;
const CAPTURE_TIMEOUT_MS = 5_000;

export async function captureVideoFrame(file: File): Promise<File> {
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  const url = URL.createObjectURL(file);
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await new Promise<File>((resolve, reject) => {
      let seeked = false;
      let encoding = false;

      function capture() {
        if (!seeked || encoding || video.readyState < video.HAVE_CURRENT_DATA) return;
        encoding = true;

        try {
          const { videoWidth, videoHeight } = video;
          if (!videoWidth || !videoHeight) throw new Error("Video frame has no dimensions");
          const scale = Math.min(1, MAX_FRAME_EDGE / Math.max(videoWidth, videoHeight));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(videoWidth * scale));
          canvas.height = Math.max(1, Math.round(videoHeight * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas 2D unavailable");
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(blob => {
            if (blob?.type === "image/jpeg" && blob.size) {
              resolve(new File([blob], "video-frame.jpg", { type: "image/jpeg" }));
            } else {
              reject(new Error("Could not encode video frame"));
            }
          }, "image/jpeg", 0.85);
        } catch (error) {
          reject(error);
        }
      }

      timeout = setTimeout(() => reject(new Error("Video frame capture timed out")), CAPTURE_TIMEOUT_MS);
      video.onerror = () => reject(new Error("Could not decode video"));
      video.onloadedmetadata = () => {
        try {
          if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error("Invalid video duration");
          video.currentTime = video.duration > 1 ? 1 : video.duration * 0.1;
        } catch (error) {
          reject(error);
        }
      };
      video.onloadeddata = capture;
      video.onseeked = () => {
        seeked = true;
        capture();
      };
      video.src = url;
    });
  } finally {
    clearTimeout(timeout);
    video.onerror = video.onloadedmetadata = video.onloadeddata = video.onseeked = null;
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
