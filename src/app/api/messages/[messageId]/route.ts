import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { assertCsrf } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: NextRequest, context: { params: Promise<{ messageId: string }> }) {
  if (!(await assertCsrf(request))) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messageId } = await context.params;
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.senderId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.message.update({ where: { id: messageId }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
