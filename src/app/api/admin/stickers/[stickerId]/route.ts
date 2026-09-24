import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminRequest } from "@/lib/auth";
import { assertCsrf } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { deleteStickerFile } from "@/lib/sticker-storage";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
});

async function guard(request: NextRequest) {
  if (!(await assertCsrf(request))) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ stickerId: string }> }) {
  const denied = await guard(request);
  if (denied) return denied;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const { stickerId } = await context.params;
  const updated = await prisma.sticker.updateMany({ where: { id: stickerId }, data: parsed.data });
  if (updated.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}

// Deleting keeps past messages valid: they fall back to "стикер удалён" (stickerId -> null).
export async function DELETE(request: NextRequest, context: { params: Promise<{ stickerId: string }> }) {
  const denied = await guard(request);
  if (denied) return denied;

  const { stickerId } = await context.params;
  const sticker = await prisma.sticker.findUnique({ where: { id: stickerId } });
  if (!sticker) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.sticker.delete({ where: { id: stickerId } });
  await deleteStickerFile(sticker.fileName);

  return NextResponse.json({ ok: true });
}
