import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const match = await prisma.match.findFirst({
    where: {
      status: "ACTIVE",
      OR: [{ userAId: user.id }, { userBId: user.id }],
    },
  });

  return NextResponse.json({ matchId: match?.id ?? null });
}
