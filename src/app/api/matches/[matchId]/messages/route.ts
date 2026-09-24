import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stickerUrl } from "@/lib/sticker-storage";

export async function GET(request: NextRequest, context: { params: Promise<{ matchId: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { matchId } = await context.params;
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      userA: { include: { personas: { where: { active: true }, take: 1 } } },
      userB: { include: { personas: { where: { active: true }, take: 1 } } },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 200,
        include: { sticker: { select: { fileName: true, name: true, mimeType: true } } },
      },
    },
  });

  if (!match || (match.userAId !== user.id && match.userBId !== user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const partner = match.userAId === user.id ? match.userB : match.userA;
  const self = match.userAId === user.id ? match.userA : match.userB;
  const activePersona = partner.personas[0];

  return NextResponse.json({
    match: {
      id: match.id,
      status: match.status,
      me: {
        id: user.id,
        nickname: self.personas[0]?.nickname ?? "Ты",
      },
      partner: {
        id: partner.id,
        nickname: activePersona?.nickname ?? "Anonymous",
        age: activePersona?.age ?? 18,
        mode: activePersona?.mode ?? "TALK",
        online: partner.online,
      },
    },
    messages: match.messages.map(({ sticker, ...message }) => ({
      ...message,
      sticker: sticker ? { url: stickerUrl(sticker.fileName), name: sticker.name, mimeType: sticker.mimeType } : null,
    })),
  });
}
