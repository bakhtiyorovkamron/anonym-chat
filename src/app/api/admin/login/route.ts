import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { compareAdminSecret, signAdminSession } from "@/lib/auth";
import { COOKIE_NAMES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

const schema = z.object({ secret: z.string().min(1) });

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !compareAdminSecret(parsed.data.secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminUser = await prisma.user.create({
    data: {
      anonymousId: `admin_${Date.now()}`,
      online: false,
    },
  });

  await prisma.admin.create({ data: { userId: adminUser.id, role: "ADMIN" } });

  const token = await signAdminSession(adminUser.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAMES.admin, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return response;
}
