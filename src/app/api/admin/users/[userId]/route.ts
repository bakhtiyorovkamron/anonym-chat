import { NextRequest, NextResponse } from "next/server";
import { assertCsrf } from "@/lib/csrf";
import { isAdminRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emitMatchEnded } from "@/lib/realtime";
import { deletePhotoFile } from "@/lib/photo-storage";

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

  // Photos in all of this user's chats are removed along with the chats.
  const photos = await prisma.message.findMany({
    where: { imageFile: { not: null }, match: { OR: [{ userAId: userId }, { userBId: userId }] } },
    select: { imageFile: true },
  });

  // Cascades: personas, messages, matches, blocks, reports, queue entry.
  await prisma.user.delete({ where: { id: userId } });
  await Promise.all(photos.map((p) => (p.imageFile ? deletePhotoFile(p.imageFile) : null)));

  return NextResponse.json({ ok: true });
}
