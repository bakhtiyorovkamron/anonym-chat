import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequest } from "@/lib/auth";
import { assertCsrf } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  blockedUserId: z.string().uuid(),
  matchId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  if (!(await assertCsrf(request))) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!checkRateLimit(`block:${user.id}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  if (parsed.data.blockedUserId === user.id) {
    return NextResponse.json({ error: "Cannot block yourself" }, { status: 400 });
  }

  await prisma.block.upsert({
    where: {
      blockerId_blockedId: {
        blockerId: user.id,
        blockedId: parsed.data.blockedUserId,
      },
    },
    create: {
      blockerId: user.id,
      blockedId: parsed.data.blockedUserId,
    },
    update: {},
  });

  await prisma.match.updateMany({
    where: {
      status: "ACTIVE",
      OR: [
        { userAId: user.id, userBId: parsed.data.blockedUserId },
        { userAId: parsed.data.blockedUserId, userBId: user.id },
      ],
    },
    data: { status: "ENDED", endedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
