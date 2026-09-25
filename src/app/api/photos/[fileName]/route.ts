import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isAdminRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSafePhotoFileName, photoMimeFromFileName, readPhotoFile } from "@/lib/photo-storage";

// Photos are private: only the two chat participants (or an admin) can open them.
export async function GET(request: NextRequest, context: { params: Promise<{ fileName: string }> }) {
  const { fileName } = await context.params;
  if (!isSafePhotoFileName(fileName)) return new NextResponse("Not found", { status: 404 });

  const message = await prisma.message.findFirst({
    where: { imageFile: fileName },
    select: { deletedAt: true, match: { select: { userAId: true, userBId: true } } },
  });
  if (!message) return new NextResponse("Not found", { status: 404 });

  const admin = await isAdminRequest(request);
  if (!admin) {
    if (message.deletedAt) return new NextResponse("Not found", { status: 404 });
    const user = await getUserFromRequest(request);
    if (!user || (user.id !== message.match.userAId && user.id !== message.match.userBId)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  const file = await readPhotoFile(fileName);
  const mime = photoMimeFromFileName(fileName);
  if (!file || !mime) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(file.length),
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
