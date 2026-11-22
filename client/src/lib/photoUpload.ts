export const MAX_PHOTOS = 10;
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;

export type PhotoContentType = "image/jpeg" | "image/png" | "image/heic" | "image/heif";

const EXTENSION_TYPES: Record<string, PhotoContentType> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", heif: "image/heif",
};

// Some browsers report HEIC files with an empty type, so fall back to the extension.
export function photoContentType(file: File): PhotoContentType | null {
  if (Object.values(EXTENSION_TYPES).includes(file.type as PhotoContentType)) {
    return file.type as PhotoContentType;
  }
  return EXTENSION_TYPES[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? null;
}

export function photoFileError(file: File) {
  if (!photoContentType(file)) return `「${file.name}」不是 JPG、PNG 或 HEIC 照片`;
  if (file.size === 0 || file.size > MAX_PHOTO_BYTES) return `「${file.name}」不可為空，且大小不可超過 20MB`;
  return null;
}

export async function uploadPhotos(
  files: File[],
  presign: (input: { contentType: PhotoContentType; size: number }) => Promise<{ uploadUrl: string; photoPath: string }>,
) {
  const paths: string[] = [];
  for (const file of files) {
    const contentType = photoContentType(file);
    if (!contentType) throw new Error(`照片「${file.name}」格式不支援`);
    const { uploadUrl, photoPath } = await presign({ contentType, size: file.size });
    const response = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
    if (!response.ok) throw new Error("照片上傳失敗，請稍後重試");
    paths.push(photoPath);
  }
  return paths;
}
