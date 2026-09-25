import { NextRequest, NextResponse } from "next/server";
import type { Server } from "socket.io";
import { assertCsrf } from "@/lib/csrf";
import { isAdminRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rm } from "fs/promises";
import { PHOTO_DIR } from "@/lib/photo-storage";

const CONFIRM_PHRASE = "УДАЛИТЬ ВСЁ";

export async function POST(request: NextRequest) {
  if (!(await assertCsrf(request))) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (body?.confirm !== CONFIRM_PHRASE) {
    return NextResponse.json({ error: "Неверная фраза подтверждения" }, { status: 400 });
  }

  // GIFs/stickers are kept. Everything user-related is wiped.
  const [messages, reports, blocks, queue, matches, personas, users] = await prisma.$transaction([
    prisma.message.deleteMany(),
    prisma.report.deleteMany(),
    prisma.block.deleteMany(),
    prisma.searchQueue.deleteMany(),
    prisma.match.deleteMany(),
    prisma.persona.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  // Kick every connected client so they re-create a fresh anonymous session.
  const io = (globalThis as Record<string, unknown>).__anonChatIo as Server | undefined;
  io?.disconnectSockets(true);

  // Remove all user-uploaded photos from disk.
  await rm(PHOTO_DIR, { recursive: true, force: true }).catch(() => {});

  return NextResponse.json({
    ok: true,
    deleted: {
      users: users.count,
      personas: personas.count,
      matches: matches.count,
      messages: messages.count,
      reports: reports.count,
      blocks: blocks.count,
      queue: queue.count,
    },
  });
}
