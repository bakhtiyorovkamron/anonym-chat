import { NextRequest, NextResponse } from "next/server";
import { assertCsrf } from "@/lib/csrf";
import { isAdminRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  if (!(await assertCsrf(request))) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await context.params;
  await prisma.user.update({ where: { id: userId }, data: { banned: true, online: false } });

  return NextResponse.json({ ok: true });
}
