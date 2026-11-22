import { useEffect, useMemo, useRef } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { MAX_PHOTOS, photoFileError } from "@/lib/photoUpload";

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
  const previews = useMemo(() => files.map(file => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach(url => URL.revokeObjectURL(url)), [previews]);

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
        {previews.map((src, index) => (
          <Thumb key={src} src={src} disabled={disabled}
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

function Thumb({ src, onRemove, disabled }: { src: string; onRemove: () => void; disabled?: boolean }) {
  return (
    <div className="relative aspect-square">
      <img src={src} alt="" className="w-full h-full object-cover rounded-lg bg-muted" />
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
