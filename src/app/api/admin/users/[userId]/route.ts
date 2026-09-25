import { NextRequest, NextResponse } from "next/server";
import { assertCsrf } from "@/lib/csrf";
import { isAdminRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emitMatchEnded } from "@/lib/realtime";

export async function DELETE(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  if (!(await assertCsrf(request))) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await context.params;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Notify partners in active chats before the cascade removes the matches.
  const active = await prisma.match.findMany({
    where: { status: "ACTIVE", OR: [{ userAId: userId }, { userBId: userId }] },
    select: { id: true },
  });
  for (const m of active) emitMatchEnded(m.id, userId, "blocked");

  // Cascades: personas, messages, matches, blocks, reports, queue entry.
  await prisma.user.delete({ where: { id: userId } });

  return NextResponse.json({ ok: true });
}
