/** Browser → Cloudinary (unsigned upload preset). No API secret in the app. */

export type UploadedMediaForPost = {
  kind: "image" | "video" | "audio" | "pdf" | "other";
  storageKey: string;
  cdnUrl: string;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
  processingStatus: "ready";
};

type CloudinarySuccess = {
  public_id: string;
  secure_url: string;
  bytes: number;
  width?: number;
  height?: number;
  duration?: number;
};

type CloudinaryError = { error?: { message?: string } };

export function isCloudinaryConfigured(): boolean {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim();
  return Boolean(cloud && preset);
}

/** Pick Cloudinary upload API resource segment (not the same as post `kind`). */
function uploadResourceForFile(file: File): "image" | "video" | "raw" {
  const t = file.type || "";
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "video";
  const n = file.name.toLowerCase();
  if (/\.(jpe?g|png|gif|webp|bmp|svg|heic|avif)$/i.test(n)) return "image";
  if (/\.(mp4|webm|mov|mkv|m4v)$/i.test(n)) return "video";
  if (/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(n)) return "video";
  return "raw";
}

export function mapKindFromFile(file: File): UploadedMediaForPost["kind"] {
  const t = file.type || "";
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  const n = file.name.toLowerCase();
  if (/\.(jpe?g|png|gif|webp|bmp|svg|heic|avif)$/i.test(n)) return "image";
  if (/\.(mp4|webm|mov|mkv|m4v)$/i.test(n)) return "video";
  if (/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(n)) return "audio";
  if (n.endsWith(".pdf")) return "pdf";
  return "other";
}

async function postToCloudinary(
  cloud: string,
  resource: "image" | "video" | "raw",
  preset: string,
  file: File,
): Promise<{ res: Response; data: Partial<CloudinarySuccess> & CloudinaryError }> {
  const url = `https://api.cloudinary.com/v1_1/${cloud}/${resource}/upload`;
  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", preset);
  const folder = process.env.NEXT_PUBLIC_CLOUDINARY_FOLDER?.trim();
  if (folder) {
    body.append("folder", folder);
  }
  const res = await fetch(url, { method: "POST", body });
  let data: Partial<CloudinarySuccess> & CloudinaryError = {};
  try {
    data = (await res.json()) as Partial<CloudinarySuccess> & CloudinaryError;
  } catch {
    data = { error: { message: `Invalid response (${res.status})` } };
  }
  return { res, data };
}

export async function uploadFileToCloudinary(file: File): Promise<UploadedMediaForPost> {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim();
  if (!cloud || !preset) {
    throw new Error(
      "Cloudinary is not configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET in web/.env.local",
    );
  }

  const primary = uploadResourceForFile(file);
  let { res, data } = await postToCloudinary(cloud, primary, preset, file);

  if (!res.ok && primary !== "raw") {
    const second = await postToCloudinary(cloud, "raw", preset, file);
    res = second.res;
    data = second.data;
  }

  if (!res.ok) {
    const msg =
      data.error?.message ?? `Cloudinary upload failed (${res.status})`;
    throw new Error(msg);
  }

  if (!data.public_id || !data.secure_url) {
    throw new Error("Cloudinary returned an unexpected response (missing public_id or secure_url).");
  }

  const kind = mapKindFromFile(file);
  return {
    kind,
    storageKey: data.public_id,
    cdnUrl: data.secure_url,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: data.bytes ?? file.size,
    width: data.width ?? null,
    height: data.height ?? null,
    durationSec: typeof data.duration === "number" ? data.duration : null,
    processingStatus: "ready",
  };
}

export const CLOUDINARY_ACCEPT =
  "image/*,video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip";

/**
 * Show media in the feed when `cdnUrl` is missing (older posts) but `storageKey` exists.
 */
function cloudinaryResourceSegment(item: {
  kind: string;
  mimeType?: string | null;
}): "image" | "video" | "raw" {
  const mime = item.mimeType ?? "";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "video";
  if (item.kind === "image") return "image";
  if (item.kind === "video" || item.kind === "audio") return "video";
  return "raw";
}

export function resolveMediaDeliveryUrl(item: {
  kind: string;
  storageKey: string;
  cdnUrl?: string | null;
  mimeType?: string | null;
}): string | null {
  const direct = item.cdnUrl?.trim();
  if (direct) return direct;
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  if (!cloud || !item.storageKey?.trim()) return null;
  const res = cloudinaryResourceSegment(item);
  const tail = encodeURI(item.storageKey.trim());
  return `https://res.cloudinary.com/${cloud}/${res}/upload/${tail}`;
}

/** How to render in the feed (handles API quirks). */
export function isFeedImageItem(item: {
  kind: string;
  mimeType?: string | null;
}): boolean {
  return item.kind === "image" || (item.mimeType ?? "").startsWith("image/");
}

export function isFeedVideoItem(item: {
  kind: string;
  mimeType?: string | null;
}): boolean {
  return item.kind === "video" || (item.mimeType ?? "").startsWith("video/");
}

export function isFeedAudioItem(item: {
  kind: string;
  mimeType?: string | null;
}): boolean {
  return item.kind === "audio" || (item.mimeType ?? "").startsWith("audio/");
}
