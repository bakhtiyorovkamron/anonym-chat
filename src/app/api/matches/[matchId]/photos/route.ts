import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { assertCsrf } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { emitNewMessage } from "@/lib/realtime";
import { deletePhotoFile, detectPhotoMime, PHOTO_MAX_BYTES, photoUrl, savePhotoFile } from "@/lib/photo-storage";

export async function POST(request: NextRequest, context: { params: Promise<{ matchId: string }> }) {
  if (!(await assertCsrf(request))) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!checkRateLimit(`photo:${user.id}`, 5, 60_000)) {
    return NextResponse.json({ error: "Слишком много фото. Подожди минуту." }, { status: 429 });
  }

  const { matchId } = await context.params;
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || (match.userAId !== user.id && match.userBId !== user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (match.status !== "ACTIVE") return NextResponse.json({ error: "Match is not active." }, { status: 409 });
  if (!match.acceptedA || !match.acceptedB) {
    return NextResponse.json({ error: "Чат ещё не подтверждён." }, { status: 409 });
  }

  const partnerId = match.userAId === user.id ? match.userBId : match.userAId;
  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: user.id, blockedId: partnerId },
        { blockerId: partnerId, blockedId: user.id },
      ],
    },
  });
  if (blocked) return NextResponse.json({ error: "Нельзя отправить фото этому пользователю." }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Файл не выбран." }, { status: 400 });
  if (file.size > PHOTO_MAX_BYTES) {
    return NextResponse.json({ error: "Фото больше 8 МБ." }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = detectPhotoMime(buffer);
  if (!mime) return NextResponse.json({ error: "Поддерживаются JPG, PNG, WEBP, GIF." }, { status: 415 });

  const fileName = await savePhotoFile(buffer, mime);
  try {
    const message = await prisma.message.create({
      data: { matchId, senderId: user.id, type: "IMAGE", imageFile: fileName },
    });
    const payload = { ...message, sticker: null, image: { url: photoUrl(fileName) } };
    emitNewMessage(matchId, payload);
    return NextResponse.json({ ok: true, message: payload });
  } catch (error) {
    await deletePhotoFile(fileName);
    throw error;
  }
}
