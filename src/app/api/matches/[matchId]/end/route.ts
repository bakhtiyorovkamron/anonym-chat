import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { assertCsrf } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";

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

  await prisma.match.update({
    where: { id: matchId },
    data: { status: "ENDED", endedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
