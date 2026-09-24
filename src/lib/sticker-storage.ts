import { randomUUID } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

// Stored outside /public: Next.js production only serves files that existed at build time.
export const STICKER_DIR = path.join(process.cwd(), "uploads", "stickers");
export const STICKER_MAX_BYTES = 5 * 1024 * 1024;

const TYPES = {
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
} as const;

export type StickerMime = keyof typeof TYPES;

// Types admins can upload and users can send. MP4 is shown as a looping muted video (like GIFs on Giphy/Telegram).
export const GIF_MIME_TYPES: StickerMime[] = ["image/gif", "video/mp4"];

export function isGifMime(mime: string) {
  return (GIF_MIME_TYPES as string[]).includes(mime);
}

/**
 * Detects the real type from magic bytes, never from the file name or the
 * client-supplied Content-Type. SVG is deliberately unsupported (it can carry scripts).
 */
export function detectStickerMime(buffer: Buffer): StickerMime | null {
  if (buffer.length < 12) return null;
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  const head6 = buffer.subarray(0, 6).toString("ascii");
  if (head6 === "GIF87a" || head6 === "GIF89a") return "image/gif";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  // ISO Base Media: bytes 4..8 are "ftyp", followed by a brand. Exclude QuickTime (.mov) which browsers may not play.
  if (buffer.subarray(4, 8).toString("ascii") === "ftyp" && buffer.subarray(8, 12).toString("ascii") !== "qt  ") {
    return "video/mp4";
  }
  return null;
}

const FILE_NAME_RE = /^[0-9a-f-]{36}\.(png|gif|webp|mp4)$/;

export function isSafeStickerFileName(fileName: string) {
  return FILE_NAME_RE.test(fileName);
}

export async function saveStickerFile(buffer: Buffer, mime: StickerMime) {
  await mkdir(STICKER_DIR, { recursive: true });
  const fileName = `${randomUUID()}.${TYPES[mime]}`;
  await writeFile(path.join(STICKER_DIR, fileName), buffer, { flag: "wx" });
  return fileName;
}

export async function readStickerFile(fileName: string) {
  if (!isSafeStickerFileName(fileName)) return null;
  try {
    return await readFile(path.join(STICKER_DIR, fileName));
  } catch {
    return null;
  }
}

export async function deleteStickerFile(fileName: string) {
  if (!isSafeStickerFileName(fileName)) return;
  await unlink(path.join(STICKER_DIR, fileName)).catch(() => {});
}

export function mimeFromFileName(fileName: string): StickerMime | null {
  const ext = fileName.split(".").pop();
  const entry = Object.entries(TYPES).find(([, value]) => value === ext);
  return (entry?.[0] as StickerMime | undefined) ?? null;
}

export function stickerUrl(fileName: string) {
  return `/api/stickers/file/${fileName}`;
}
