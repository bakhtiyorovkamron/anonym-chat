import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { compareAdminSecret, signAdminSession } from "@/lib/auth";
import { COOKIE_NAMES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, resetRateLimit } from "@/lib/rate-limit";

const schema = z.object({ secret: z.string().min(1).max(256) });

const LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60_000;
const ADMIN_ANON_ID = "admin_root";

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  // Login CSRF protection: the login page has no CSRF cookie yet, so require same-origin.
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateKey = `admin-login:${getClientIp(request)}`;
  if (!checkRateLimit(rateKey, LOGIN_ATTEMPTS, LOGIN_WINDOW_MS)) {
    return NextResponse.json({ error: "Too many attempts. Try later." }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !compareAdminSecret(parsed.data.secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  resetRateLimit(rateKey);

  // Reuse a single admin identity instead of creating a new user per login.
  const adminUser = await prisma.user.upsert({
    where: { anonymousId: ADMIN_ANON_ID },
    create: { anonymousId: ADMIN_ANON_ID, online: false },
    update: {},
  });
  await prisma.admin.upsert({
    where: { userId: adminUser.id },
    create: { userId: adminUser.id, role: "ADMIN" },
    update: {},
  });

  const token = await signAdminSession(adminUser.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAMES.admin, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return response;
}
