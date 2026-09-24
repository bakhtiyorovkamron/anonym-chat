import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GIF_MIME_TYPES, stickerUrl } from "@/lib/sticker-storage";

// Active GIFs (GIF or MP4) for the chat picker.
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stickers = await prisma.sticker.findMany({
    where: { active: true, mimeType: { in: GIF_MIME_TYPES } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, fileName: true, mimeType: true },
  });

  return NextResponse.json({
    stickers: stickers.map((s) => ({ id: s.id, name: s.name, mimeType: s.mimeType, url: stickerUrl(s.fileName) })),
  });
}
