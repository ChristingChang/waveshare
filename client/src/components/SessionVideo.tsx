import { useRef, useState, type VideoHTMLAttributes } from "react";

type SessionVideoProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, "src" | "onError"> & { src: string };

// The server redirects to a short-lived storage link; reload once on error so a paused video can resume after it expires.
export function SessionVideo({ src, ...props }: SessionVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [attempt, setAttempt] = useState(0);
  const resumeAt = useRef(0);

  return (
    <video
      {...props}
      ref={videoRef}
      key={attempt}
      src={attempt ? `${src}?retry=${attempt}` : src}
      onLoadedMetadata={() => {
        if (resumeAt.current && videoRef.current) videoRef.current.currentTime = resumeAt.current;
      }}
      onError={() => {
        if (attempt >= 1) return;
        resumeAt.current = videoRef.current?.currentTime ?? 0;
        setAttempt(attempt + 1);
      }}
    />
  );
}
