import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export function SessionPhotos({ photos }: { photos: { id: number; url: string }[] }) {
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  if (!photos.length) return null;

  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {photos.map(photo => (
          <button key={photo.id} type="button" onClick={() => setOpenUrl(photo.url)} className="shrink-0" aria-label="查看大圖">
            <img src={photo.url} alt="" loading="lazy" className="w-24 h-24 object-cover rounded-lg bg-muted" />
          </button>
        ))}
      </div>
      <Dialog open={openUrl !== null} onOpenChange={open => !open && setOpenUrl(null)}>
        <DialogContent className="max-w-3xl p-2 bg-black border-none">
          <DialogTitle className="sr-only">照片</DialogTitle>
          {openUrl && <img src={openUrl} alt="" className="w-full max-h-[80vh] object-contain" />}
        </DialogContent>
      </Dialog>
    </>
  );
}
