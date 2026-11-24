import { useState } from "react";

type LandingPreviewImageProps = {
  image: "home" | "calendar" | "stats";
  alt: string;
  fetchPriority?: "high";
};

/** Keep the public app previews usable if an image request or decode fails. */
export default function LandingPreviewImage({ image, alt, fetchPriority }: LandingPreviewImageProps) {
  const [source, setSource] = useState<"webp" | "png" | "failed">("webp");
  const [retry, setRetry] = useState(0);

  if (source === "failed") {
    return (
      <div className="landing-image-error" role="group" aria-label={alt}>
        <p>預覽圖片暫時無法載入</p>
        <button type="button" onClick={() => {
          setRetry(value => value + 1);
          setSource("webp");
        }}>重新載入圖片</button>
      </div>
    );
  }

  const src = `/landing/app-${image}.${source}${retry ? `?retry=${retry}` : ""}`;
  return (
    <img
      key={src}
      src={src}
      alt={alt}
      width="390"
      height="844"
      loading="eager"
      decoding="async"
      fetchPriority={fetchPriority}
      onError={() => setSource(source === "webp" ? "png" : "failed")}
    />
  );
}
