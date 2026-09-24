import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { assertCsrf } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import {
  STICKER_MAX_BYTES,
  deleteStickerFile,
  detectStickerMime,
  isGifMime,
  saveStickerFile,
  stickerUrl,
} from "@/lib/sticker-storage";

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stickers = await prisma.sticker.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { messages: true } } },
  });

  return NextResponse.json({
    stickers: stickers.map((s) => ({
      id: s.id,
      name: s.name,
      url: stickerUrl(s.fileName),
      mimeType: s.mimeType,
      size: s.size,
      active: s.active,
      sortOrder: s.sortOrder,
      uses: s._count.messages,
    })),
  });
}

// Upload one or more stickers (multipart field "files").
export async function POST(request: NextRequest) {
  try {
    return await handleUpload(request);
  } catch (error) {
    console.error("[admin/stickers] upload failed", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Ошибка сервера: ${message}` }, { status: 500 });
  }
}

async function handleUpload(request: NextRequest) {
  if (!(await assertCsrf(request))) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const files = form?.getAll("files").filter((item): item is File => item instanceof File) ?? [];
  if (files.length === 0) return NextResponse.json({ error: "Нет файлов" }, { status: 400 });
  if (files.length > 50) return NextResponse.json({ error: "Не больше 50 файлов за раз" }, { status: 400 });

  const maxOrder = await prisma.sticker.aggregate({ _max: { sortOrder: true } });
  let order = (maxOrder._max.sortOrder ?? 0) + 1;

  const created: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    if (file.size > STICKER_MAX_BYTES) {
      errors.push(`${file.name}: больше 5 МБ`);
      continue;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = detectStickerMime(buffer);
    if (!mime || !isGifMime(mime)) {
      errors.push(`${file.name}: поддерживаются только GIF и MP4`);
      continue;
    }

    const fileName = await saveStickerFile(buffer, mime);
    const name = file.name.replace(/\.[^.]+$/, "").slice(0, 60) || "sticker";

    try {
      const sticker = await prisma.sticker.create({
        data: { name, fileName, mimeType: mime, size: buffer.length, sortOrder: order++ },
      });
      created.push(sticker.id);
    } catch (error) {
      console.error("[admin/stickers] db insert failed", error);
      await deleteStickerFile(fileName);
      errors.push(`${file.name}: ошибка сохранения в базе`);
    }
  }

  return NextResponse.json({ created: created.length, errors }, { status: created.length ? 201 : 400 });
}
