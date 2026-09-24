import { NextRequest, NextResponse } from "next/server";
import { mimeFromFileName, readStickerFile } from "@/lib/sticker-storage";

export async function GET(request: NextRequest, context: { params: Promise<{ fileName: string }> }) {
  const { fileName } = await context.params;
  const file = await readStickerFile(fileName);
  const mime = mimeFromFileName(fileName);
  if (!file || !mime) return new NextResponse("Not found", { status: 404 });

  const headers: Record<string, string> = {
    "Content-Type": mime,
    // File names are random UUIDs and never reused, so they can be cached forever.
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Accept-Ranges": "bytes",
  };

  // Safari only plays <video> when the server answers Range requests with 206.
  const range = request.headers.get("range");
  const match = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (match && (match[1] || match[2])) {
    const size = file.length;
    let start = match[1] ? Number(match[1]) : size - Number(match[2]);
    let end = match[1] && match[2] ? Number(match[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end || start >= size) {
      return new NextResponse(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    }
    return new NextResponse(new Uint8Array(file.subarray(start, end + 1)), {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }

  return new NextResponse(new Uint8Array(file), {
    headers: { ...headers, "Content-Length": String(file.length) },
  });
}
