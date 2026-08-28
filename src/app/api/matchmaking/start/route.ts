import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { assertCsrf } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { pickBestCandidate, scoreCandidate, type CandidateState } from "@/server/matchmaking";

function keyForPair(userAId: string, userBId: string) {
  return [userAId, userBId].sort().join(":");
}

export async function POST(request: NextRequest) {
  if (!(await assertCsrf(request))) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const activeMatch = await prisma.match.findFirst({
    where: {
      status: "ACTIVE",
      OR: [{ userAId: user.id }, { userBId: user.id }],
    },
  });

  if (activeMatch) {
    return NextResponse.json({ matchId: activeMatch.id });
  }

  const currentPersona = await prisma.persona.findFirst({ where: { userId: user.id, active: true } });
  if (!currentPersona) {
    return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });
  }

  await prisma.searchQueue.upsert({
    where: { userId: user.id },
    create: { userId: user.id, mode: currentPersona.mode },
    update: { mode: currentPersona.mode },
  });

  const queueUsers = await prisma.searchQueue.findMany({
    where: {
      userId: { not: user.id },
      user: {
        online: true,
        banned: false,
      },
    },
    include: {
      user: true,
    },
    orderBy: { updatedAt: "asc" },
    take: 30,
  });

  const blocks = await prisma.block.findMany({
    where: {
      OR: [
        { blockerId: user.id, blockedId: { in: queueUsers.map((entry) => entry.userId) } },
        { blockedId: user.id, blockerId: { in: queueUsers.map((entry) => entry.userId) } },
      ],
    },
  });

  const blockedSet = new Set(blocks.map((item) => `${item.blockerId}:${item.blockedId}`));

  const recentMatches = await prisma.match.findMany({
    where: {
      status: "ENDED",
      endedAt: { gte: new Date(Date.now() - 30 * 60_000) },
      OR: [{ userAId: user.id }, { userBId: user.id }],
    },
    select: { userAId: true, userBId: true },
  });

  const recentSet = new Set(recentMatches.map((item) => keyForPair(item.userAId, item.userBId)));

  const candidates: CandidateState[] = [];
  for (const queued of queueUsers) {
    const persona = await prisma.persona.findFirst({ where: { userId: queued.userId, active: true } });
    if (!persona) continue;

    candidates.push({
      user: queued.user,
      persona,
      blocked:
        blockedSet.has(`${user.id}:${queued.userId}`) || blockedSet.has(`${queued.userId}:${user.id}`),
      recentlyMatched: recentSet.has(keyForPair(user.id, queued.userId)),
    });
  }

  const current: CandidateState = {
    user,
    persona: currentPersona,
    blocked: false,
    recentlyMatched: false,
  };

  const { best } = pickBestCandidate(current, candidates);
  if (!best || scoreCandidate(current, best) <= 0) {
    return NextResponse.json({ searching: true });
  }

  const match = await prisma.$transaction(async (tx) => {
    await tx.searchQueue.deleteMany({ where: { userId: { in: [user.id, best.user.id] } } });
    return tx.match.create({
      data: {
        userAId: user.id,
        userBId: best.user.id,
        status: "ACTIVE",
      },
    });
  });

  return NextResponse.json({ matchId: match.id });
}
