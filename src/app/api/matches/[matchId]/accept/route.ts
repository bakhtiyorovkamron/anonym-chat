import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { assertCsrf } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { emitMatchEnded } from "@/lib/realtime";

const CONFIRM_TIMEOUT_MS = 60_000;

async function loadState(matchId: string, userId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      userA: { include: { personas: { where: { active: true }, take: 1 } } },
      userB: { include: { personas: { where: { active: true }, take: 1 } } },
    },
  });
  if (!match || (match.userAId !== userId && match.userBId !== userId)) return null;

  const isA = match.userAId === userId;
  const confirmed = match.acceptedA && match.acceptedB;

  // Auto-cancel proposals nobody answered in time.
  if (
    match.status === "ACTIVE" &&
    !confirmed &&
    Date.now() - match.createdAt.getTime() > CONFIRM_TIMEOUT_MS
  ) {
    const updated = await prisma.match.updateMany({
      where: { id: match.id, status: "ACTIVE" },
      data: { status: "ENDED", endedAt: new Date() },
    });
    if (updated.count > 0) emitMatchEnded(match.id, userId, "ended");
    match.status = "ENDED";
  }

  const partner = isA ? match.userB : match.userA;
  const persona = partner.personas[0];
  return {
    id: match.id,
    status: match.status,
    confirmed,
    meAccepted: isA ? match.acceptedA : match.acceptedB,
    partnerAccepted: isA ? match.acceptedB : match.acceptedA,
    expiresAt: match.createdAt.getTime() + CONFIRM_TIMEOUT_MS,
    partner: {
      nickname: persona?.nickname ?? "Аноним",
      age: persona?.age ?? null,
      mode: persona?.mode ?? null,
      interests: persona?.interests ?? [],
    },
  };
}

export async function GET(request: NextRequest, context: { params: Promise<{ matchId: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { matchId } = await context.params;
  const state = await loadState(matchId, user.id);
  if (!state) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(state);
}

export async function POST(request: NextRequest, context: { params: Promise<{ matchId: string }> }) {
  if (!(await assertCsrf(request))) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { matchId } = await context.params;
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || (match.userAId !== user.id && match.userBId !== user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.match.updateMany({
    where: { id: matchId, status: "ACTIVE" },
    data: match.userAId === user.id ? { acceptedA: true } : { acceptedB: true },
  });

  const state = await loadState(matchId, user.id);
  return NextResponse.json(state);
}
