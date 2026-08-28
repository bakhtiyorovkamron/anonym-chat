import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
      },
    },
  });

  if (!match || (match.userAId !== user.id && match.userBId !== user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const partner = match.userAId === user.id ? match.userB : match.userA;
  const activePersona = partner.personas[0];

  return NextResponse.json({
    match: {
      id: match.id,
      partner: {
        id: partner.id,
        nickname: activePersona?.nickname ?? "Anonymous",
        age: activePersona?.age ?? 18,
        mode: activePersona?.mode ?? "TALK",
        online: partner.online,
      },
    },
    messages: match.messages,
  });
}
