import { useEffect, useRef, useState } from "react";
import { Download, Image, ImagePlus, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createShareCardFile, type ShareCard } from "@/lib/shareCards";

type Preview = { file: File; url: string; canShare: boolean };
type RenderResult = { photo?: File; preview: Preview } | { photo?: File; error: string };

function ShareCardPreview({ card }: { card: ShareCard }) {
  const input = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File>();
  const [result, setResult] = useState<RenderResult>();
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    let active = true;
    let url: string | undefined;

    createShareCardFile(card, photo).then(file => {
      if (!active) return;
      const canShare =
        typeof navigator.share === "function" &&
        navigator.canShare?.({ files: [file] }) === true;
      url = URL.createObjectURL(file);
      setResult({ photo, preview: { file, url, canShare } });
    }).catch(() => {
      if (active) {
        setResult({
          photo,
          error: photo ? "無法使用這張照片，請改用另一張 JPG、PNG 或 HEIC 圖片（20 MB 以下）。" : "無法產生圖卡，請關閉後再試。",
        });
      }
    });

    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [card, photo]);

  async function shareImage(file: File) {
    setSharing(true);
    try {
      await navigator.share({ files: [file] });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        toast.error("無法分享圖片，請改用下載");
      }
    } finally {
      setSharing(false);
    }
  }

  const current = result?.photo === photo ? result : undefined;
  const preview = current && "preview" in current ? current.preview : undefined;

  return (
    <>
      {preview ? (
        <img
          src={preview.url}
          alt={card.kind === "record" ? "衝浪紀錄圖卡預覽" : "我的浪點圖卡預覽"}
          width={1080}
          height={1920}
          className="mx-auto max-h-[48dvh] w-auto max-w-full rounded-md object-contain"
        />
      ) : current && "error" in current ? (
        <p role="alert" className="text-sm text-destructive">{current.error}</p>
      ) : (
        <p role="status" className="text-sm text-muted-foreground">正在產生圖卡…</p>
      )}
      {card.kind === "record" && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
            hidden
            onChange={event => {
              const file = event.currentTarget.files?.[0];
              if (file) setPhoto(file);
              event.currentTarget.value = "";
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
            <ImagePlus /> {photo ? "更換照片" : "選擇背景照片"}
          </Button>
          {photo && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setPhoto(undefined)}>
              改用海浪插畫
            </Button>
          )}
        </div>
      )}
      {preview && (
        <DialogFooter>
          <Button asChild variant={preview.canShare ? "outline" : "default"}>
            <a href={preview.url} download={preview.file.name}>
              <Download /> 下載圖片
            </a>
          </Button>
          {preview.canShare && (
            <Button disabled={sharing} onClick={() => void shareImage(preview.file)}>
              <Share2 /> 分享圖片
            </Button>
          )}
        </DialogFooter>
      )}
    </>
  );
}

export function ShareCardButton({ card }: { card: ShareCard }) {
  const [snapshot, setSnapshot] = useState<ShareCard>();

  return (
    <Dialog open={!!snapshot} onOpenChange={open => setSnapshot(open ? card : undefined)}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Image /> 分享圖卡
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>分享圖卡</DialogTitle>
          <DialogDescription>
            下載 PNG 圖片，可用於 IG 限時動態或 LINE。
            {card.kind === "record" && "背景照片只在此裝置處理，不會上傳。"}
          </DialogDescription>
        </DialogHeader>
        {snapshot && <ShareCardPreview card={snapshot} />}
      </DialogContent>
    </Dialog>
  );
}
