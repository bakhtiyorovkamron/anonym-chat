import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequest } from "@/lib/auth";
import { assertCsrf } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { sanitizeText } from "@/lib/sanitize";
import { canCreateReport, isValidReportReason } from "@/server/reports";

const schema = z.object({
  reportedUserId: z.string().uuid(),
  matchId: z.string().uuid().optional(),
  reason: z.string(),
  description: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  if (!(await assertCsrf(request))) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid report data" }, { status: 400 });

  if (!isValidReportReason(parsed.data.reason)) {
    return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
  }

  const reportsInHour = await prisma.report.count({
    where: {
      reporterId: user.id,
      createdAt: { gte: new Date(Date.now() - 60 * 60_000) },
    },
  });

  if (!canCreateReport(reportsInHour)) {
    return NextResponse.json({ error: "Report limit exceeded" }, { status: 429 });
  }

  await prisma.report.create({
    data: {
      reporterId: user.id,
      reportedUserId: parsed.data.reportedUserId,
      matchId: parsed.data.matchId,
      reason: parsed.data.reason,
      description: parsed.data.description ? sanitizeText(parsed.data.description) : null,
    },
  });

  return NextResponse.json({ ok: true });
}
