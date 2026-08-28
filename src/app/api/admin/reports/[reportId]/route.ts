import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertCsrf } from "@/lib/csrf";
import { isAdminRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  status: z.enum(["PENDING", "REVIEWING", "RESOLVED", "DISMISSED"]),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ reportId: string }> }) {
  if (!(await assertCsrf(request))) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const { reportId } = await context.params;

  await prisma.report.update({
    where: { id: reportId },
    data: {
      status: parsed.data.status,
      resolvedAt: parsed.data.status === "RESOLVED" || parsed.data.status === "DISMISSED" ? new Date() : null,
    },
  });

  return NextResponse.json({ ok: true });
}
