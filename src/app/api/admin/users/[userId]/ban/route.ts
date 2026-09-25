import { NextRequest, NextResponse } from "next/server";
import { assertCsrf } from "@/lib/csrf";
import { isAdminRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emitMatchEnded } from "@/lib/realtime";

export async function POST(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  if (!(await assertCsrf(request))) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await context.params;
  await prisma.user.update({ where: { id: userId }, data: { banned: true, online: false } });
  await prisma.searchQueue.deleteMany({ where: { userId } });

  const active = await prisma.match.findMany({
    where: { status: "ACTIVE", OR: [{ userAId: userId }, { userBId: userId }] },
    select: { id: true },
  });
  if (active.length) {
    await prisma.match.updateMany({
      where: { id: { in: active.map((m) => m.id) }, status: "ACTIVE" },
      data: { status: "ENDED", endedAt: new Date() },
    });
    for (const m of active) emitMatchEnded(m.id, userId, "blocked");
  }

  return NextResponse.json({ ok: true });
}
