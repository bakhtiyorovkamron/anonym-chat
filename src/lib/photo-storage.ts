import { randomUUID } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

// Private user photos. Served only through an access-checked route, never publicly.
export const PHOTO_DIR = path.join(process.cwd(), "uploads", "photos");
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;

const TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
} as const;

export type PhotoMime = keyof typeof TYPES;

/** Real type from magic bytes. SVG/HEIC are rejected. */
export function detectPhotoMime(buffer: Buffer): PhotoMime | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  const head6 = buffer.subarray(0, 6).toString("ascii");
  if (head6 === "GIF87a" || head6 === "GIF89a") return "image/gif";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  return null;
}

const FILE_NAME_RE = /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/;

export function isSafePhotoFileName(fileName: string) {
  return FILE_NAME_RE.test(fileName);
}

export async function savePhotoFile(buffer: Buffer, mime: PhotoMime) {
  await mkdir(PHOTO_DIR, { recursive: true });
  const fileName = `${randomUUID()}.${TYPES[mime]}`;
  await writeFile(path.join(PHOTO_DIR, fileName), buffer, { flag: "wx" });
  return fileName;
}

export async function readPhotoFile(fileName: string) {
  if (!isSafePhotoFileName(fileName)) return null;
  try {
    return await readFile(path.join(PHOTO_DIR, fileName));
  } catch {
    return null;
  }
}

export async function deletePhotoFile(fileName: string) {
  if (!isSafePhotoFileName(fileName)) return;
  await unlink(path.join(PHOTO_DIR, fileName)).catch(() => {});
}

export function photoMimeFromFileName(fileName: string): PhotoMime | null {
  const ext = fileName.split(".").pop();
  const entry = Object.entries(TYPES).find(([, value]) => value === ext);
  return (entry?.[0] as PhotoMime | undefined) ?? null;
}

export function photoUrl(fileName: string) {
  return `/api/photos/${fileName}`;
}
