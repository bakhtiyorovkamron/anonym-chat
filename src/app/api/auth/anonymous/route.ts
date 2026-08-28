import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { NextResponse } from "next/server";
import { createAnonymousSession } from "@/lib/auth";
import { COOKIE_NAMES } from "@/lib/constants";
import { newCsrfToken } from "@/lib/csrf";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const secret = new TextEncoder().encode(env.AUTH_SECRET);

export async function POST() {
  const cookieStore = await cookies();
  const currentToken = cookieStore.get(COOKIE_NAMES.user)?.value;

  if (currentToken) {
    try {
      const verified = await jwtVerify(currentToken, secret);
      const userId = verified.payload.uid;
      if (typeof userId === "string") {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: { personas: { where: { active: true }, take: 1 } },
        });

        if (user && !user.banned) {
          await prisma.user.update({ where: { id: user.id }, data: { online: true, lastSeenAt: new Date() } });
          const response = NextResponse.json({ ok: true, hasPersona: user.personas.length > 0 });
          response.cookies.set(COOKIE_NAMES.csrf, newCsrfToken(), {
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production",
            path: "/",
          });
          return response;
        }
      }
    } catch {
      // continue to new anonymous user
    }
  }

  const { user, token } = await createAnonymousSession();
  const hasPersona = false;

  const response = NextResponse.json({ ok: true, hasPersona, userId: user.id });
  response.cookies.set(COOKIE_NAMES.user, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  response.cookies.set(COOKIE_NAMES.csrf, newCsrfToken(), {
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return response;
}
