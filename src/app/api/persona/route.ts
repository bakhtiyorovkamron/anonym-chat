import { Gender, GenderPreference, Language } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequest } from "@/lib/auth";
import { assertCsrf } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";
import { modeFromInput } from "@/server/matchmaking";

const schema = z.object({
  nickname: z.string().min(2).max(24),
  age: z.number().int().min(18).max(99),
  gender: z.nativeEnum(Gender),
  preferredGender: z.nativeEnum(GenderPreference),
  language: z.nativeEnum(Language),
  interests: z.array(z.string().min(1).max(32)).min(1).max(8),
  mode: z.string().min(1),
  isAdultConfirmed: z.boolean().refine((value) => value, "18+ confirmation required"),
});

export async function POST(request: NextRequest) {
  if (!(await assertCsrf(request))) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = checkRateLimit(`persona:${user.id}`, 20, 60_000);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid profile data" }, { status: 400 });
  }

  const nickname = sanitizeText(parsed.data.nickname);
  if (nickname.length < 2) {
    return NextResponse.json({ error: "Nickname is too short" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        age: parsed.data.age,
        gender: parsed.data.gender,
        preferredGender: parsed.data.preferredGender,
        language: parsed.data.language,
        online: true,
        lastSeenAt: new Date(),
      },
    }),
    prisma.persona.updateMany({
      where: { userId: user.id },
      data: { active: false },
    }),
    prisma.persona.create({
      data: {
        userId: user.id,
        nickname,
        age: parsed.data.age,
        interests: parsed.data.interests.map((item) => sanitizeText(item).slice(0, 32)),
        mode: modeFromInput(parsed.data.mode),
        active: true,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
