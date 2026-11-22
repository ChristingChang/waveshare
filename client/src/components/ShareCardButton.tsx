import { useEffect, useState } from "react";
import { Download, Image, Share2 } from "lucide-react";
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

function ShareCardPreview({ card }: { card: ShareCard }) {
  const [preview, setPreview] = useState<Preview>();
  const [failed, setFailed] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    let active = true;
    let url: string | undefined;

    createShareCardFile(card).then(file => {
      if (!active) return;
      const canShare =
        typeof navigator.share === "function" &&
        navigator.canShare?.({ files: [file] }) === true;
      url = URL.createObjectURL(file);
      setPreview({ file, url, canShare });
    }).catch(() => {
      if (active) setFailed(true);
    });

    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [card]);

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

  if (failed) return <p role="alert">無法產生圖卡，請關閉後再試。</p>;
  if (!preview) return <p role="status">正在產生圖卡…</p>;

  return (
    <>
      <img
        src={preview.url}
        alt={card.kind === "record" ? "衝浪紀錄圖卡預覽" : "我的浪點圖卡預覽"}
        width={1080}
        height={1920}
        className="mx-auto max-h-[52dvh] w-auto max-w-full rounded-md object-contain"
      />
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
          <DialogDescription>下載 PNG 圖片，可用於 IG 限時動態或 LINE。</DialogDescription>
        </DialogHeader>
        {snapshot && <ShareCardPreview card={snapshot} />}
      </DialogContent>
    </Dialog>
  );
}
