import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { assertCsrf } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { emitMatchEnded } from "@/lib/realtime";

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

  const updated = await prisma.match.updateMany({
    where: { id: matchId, status: "ACTIVE" },
    data: { status: "ENDED", endedAt: new Date() },
  });

  if (updated.count > 0) {
    emitMatchEnded(matchId, user.id, "ended");
  }

  return NextResponse.json({ ok: true });
}
