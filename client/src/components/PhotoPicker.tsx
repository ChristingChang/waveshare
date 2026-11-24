import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { MAX_PHOTOS, photoFileError, toDisplayablePhoto } from "@/lib/photoUpload";

type ExistingPhoto = { id: number; url: string };

type PhotoPickerProps = {
  files: File[];
  onFilesChange: (files: File[]) => void;
  existing?: ExistingPhoto[];
  removedIds?: number[];
  onRemovedIdsChange?: (ids: number[]) => void;
  disabled?: boolean;
};

export function PhotoPicker({ files, onFilesChange, existing = [], removedIds = [], onRemovedIdsChange, disabled }: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previews = usePreviews(files);

  const kept = existing.filter(photo => !removedIds.includes(photo.id));
  const remaining = MAX_PHOTOS - kept.length - files.length;

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = "";
    const error = selected.map(photoFileError).find(Boolean);
    if (error) {
      toast.error(error);
      return;
    }
    if (selected.length > remaining) {
      toast.error(`每筆紀錄最多 ${MAX_PHOTOS} 張照片`);
      return;
    }
    onFilesChange([...files, ...selected]);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="photos" className="text-card-foreground">
        照片 <span className="text-sm text-muted-foreground">(選填，最多 {MAX_PHOTOS} 張)</span>
      </Label>
      <div className="grid grid-cols-4 gap-2">
        {kept.map(photo => (
          <Thumb key={`existing-${photo.id}`} src={photo.url} disabled={disabled}
            onRemove={() => onRemovedIdsChange?.([...removedIds, photo.id])} />
        ))}
        {files.map((file, index) => (
          <Thumb key={`new-${index}-${file.name}-${file.lastModified}`} src={previews[index]} disabled={disabled}
            onRemove={() => onFilesChange(files.filter((_, i) => i !== index))} />
        ))}
        {remaining > 0 && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="aspect-square border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
          >
            <ImagePlus className="w-6 h-6 mb-1" />
            <span className="text-xs">加入照片</span>
          </button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">支援 JPG、PNG、HEIC，每張最大 20MB</p>
      <input
        ref={inputRef}
        id="photos"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
        onChange={handleSelect}
        className="hidden"
      />
    </div>
  );
}

// Browsers other than Safari cannot show HEIC, so preview the converted JPEG.
function usePreviews(files: File[]) {
  const [previews, setPreviews] = useState<(string | undefined)[]>([]);
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    setPreviews([]);
    files.forEach((file, index) => {
      toDisplayablePhoto(file).catch(() => file).then(displayable => {
        if (cancelled) return;
        const url = URL.createObjectURL(displayable);
        urls.push(url);
        setPreviews(current => {
          const next = [...current];
          next[index] = url;
          return next;
        });
      });
    });
    return () => {
      cancelled = true;
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [files]);
  return previews;
}

function Thumb({ src, onRemove, disabled }: { src?: string; onRemove: () => void; disabled?: boolean }) {
  return (
    <div className="relative aspect-square">
      {src
        ? <img src={src} alt="" className="w-full h-full object-cover rounded-lg bg-muted" />
        : <div className="w-full h-full rounded-lg bg-muted animate-pulse" aria-label="照片處理中" />}
      <button
        type="button"
        aria-label="移除照片"
        disabled={disabled}
        onClick={onRemove}
        className="absolute top-1 right-1 rounded-full bg-black/60 text-white p-1"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
