import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { assertCsrf } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { pickBestCandidate, type CandidateState } from "@/server/matchmaking";

function keyForPair(userAId: string, userBId: string) {
  return [userAId, userBId].sort().join(":");
}

class MatchRaceError extends Error {}

export async function POST(request: NextRequest) {
  if (!(await assertCsrf(request))) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Clients poll this endpoint; ~1 req/sec is plenty.
  if (!checkRateLimit(`matchmaking:${user.id}`, 20, 20_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

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
      user: { include: { personas: { where: { active: true }, take: 1 } } },
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
    const persona = queued.user.personas[0];
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

  const { best, bestScore } = pickBestCandidate(current, candidates);
  if (!best || bestScore <= 0) {
    return NextResponse.json({ searching: true });
  }

  try {
    const match = await prisma.$transaction(async (tx) => {
      // Claim both queue entries atomically. If a concurrent request already took
      // either user, the count will be < 2 and we abort instead of double-matching.
      const claimed = await tx.searchQueue.deleteMany({ where: { userId: { in: [user.id, best.user.id] } } });
      if (claimed.count !== 2) throw new MatchRaceError();

      const existing = await tx.match.findFirst({
        where: {
          status: "ACTIVE",
          OR: [
            { userAId: { in: [user.id, best.user.id] } },
            { userBId: { in: [user.id, best.user.id] } },
          ],
        },
        select: { id: true },
      });
      if (existing) throw new MatchRaceError();

      return tx.match.create({
        data: {
          userAId: user.id,
          userBId: best.user.id,
          status: "ACTIVE",
        },
      });
    });

    return NextResponse.json({ matchId: match.id });
  } catch (error) {
    if (!(error instanceof MatchRaceError)) throw error;

    // Lost the race: the transaction rolled back, so our queue entry is intact.
    // If someone matched *us* meanwhile, return that match.
    const ourMatch = await prisma.match.findFirst({
      where: { status: "ACTIVE", OR: [{ userAId: user.id }, { userBId: user.id }] },
      select: { id: true },
    });
    if (ourMatch) return NextResponse.json({ matchId: ourMatch.id });
    return NextResponse.json({ searching: true });
  }
}
