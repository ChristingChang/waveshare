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

// Most browsers other than Safari cannot show HEIC, so convert it to JPEG before upload.
const conversions = new WeakMap<File, Promise<File>>();

export function toDisplayablePhoto(file: File): Promise<File> {
  let conversion = conversions.get(file);
  if (!conversion) {
    conversion = convertPhoto(file);
    conversion.catch(() => conversions.delete(file));
    conversions.set(file, conversion);
  }
  return conversion;
}

async function convertPhoto(file: File): Promise<File> {
  const type = photoContentType(file);
  if (type !== "image/heic" && type !== "image/heif") return file;
  const blob = await heicToJpeg(file);
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

let heicQueue: Promise<unknown> = Promise.resolve();

// heic2any never removes its worker "message" listeners, and each one keeps the decoded
// pixels alive. Convert one photo at a time and remove the listeners it added.
function heicToJpeg(file: File): Promise<Blob> {
  const run = heicQueue.then(async () => {
    const { default: heic2any } = await import("heic2any");
    const worker = (globalThis as { __heic2any__worker?: Worker }).__heic2any__worker;
    const added: Parameters<Worker["addEventListener"]>[] = [];
    const addEventListener = worker?.addEventListener;
    if (worker && addEventListener) {
      worker.addEventListener = ((...args: Parameters<Worker["addEventListener"]>) => {
        added.push(args);
        addEventListener.apply(worker, args);
      }) as Worker["addEventListener"];
    }
    try {
      // heic2any hangs if its own file read fails, so read the file here where errors reject.
      const bytes = new Blob([await file.arrayBuffer()]);
      const converted = await heic2any({ blob: bytes, toType: "image/jpeg", quality: 0.9 });
      return Array.isArray(converted) ? converted[0] : converted;
    } finally {
      if (worker && addEventListener) {
        delete (worker as Partial<Worker>).addEventListener;
        added.forEach(([type, listener, options]) => worker.removeEventListener(type, listener, options));
      }
    }
  });
  heicQueue = run.catch(() => undefined);
  return run;
}

export async function uploadPhotos(
  files: File[],
  presign: (input: { contentType: PhotoContentType; size: number }) => Promise<{ uploadUrl: string; photoPath: string }>,
) {
  const paths: string[] = [];
  for (const original of files) {
    let file: File;
    try {
      file = await toDisplayablePhoto(original);
    } catch {
      throw new Error(`照片「${original.name}」無法轉換，請改用 JPG 或 PNG`);
    }
    if (file.size > MAX_PHOTO_BYTES) throw new Error(`「${original.name}」轉換後超過 20MB`);
    const contentType = photoContentType(file);
    if (!contentType) throw new Error(`照片「${file.name}」格式不支援`);
    const { uploadUrl, photoPath } = await presign({ contentType, size: file.size });
    let response: Response;
    try {
      response = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
    } catch {
      throw new Error("照片上傳失敗，請檢查網路連線後重試");
    }
    if (!response.ok) throw new Error("照片上傳失敗，請稍後重試");
    paths.push(photoPath);
  }
  return paths;
}
