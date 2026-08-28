import { randomUUID, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { COOKIE_NAMES } from "@/lib/constants";
import { env } from "@/lib/env";

const secret = new TextEncoder().encode(env.AUTH_SECRET);
const adminSecret = new TextEncoder().encode(env.ADMIN_SECRET);

async function signToken(payload: Record<string, string>, expiresIn = "7d") {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

export async function createAnonymousSession() {
  const user = await prisma.user.create({
    data: {
      anonymousId: `anon_${randomUUID().slice(0, 8)}`,
    },
  });

  const token = await signToken({ uid: user.id });
  return { user, token };
}

export async function getUserFromRequest(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAMES.user)?.value;
  if (!token) return null;

  try {
    const verified = await jwtVerify(token, secret);
    const userId = verified.payload.uid;
    if (!userId || typeof userId !== "string") return null;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.banned) return null;

    return user;
  } catch {
    return null;
  }
}

export async function getUserFromServerCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAMES.user)?.value;
  if (!token) return null;

  try {
    const verified = await jwtVerify(token, secret);
    const userId = verified.payload.uid;
    if (!userId || typeof userId !== "string") return null;

    return prisma.user.findUnique({ where: { id: userId } });
  } catch {
    return null;
  }
}

export async function signAdminSession(userId: string) {
  return new SignJWT({ uid: userId, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(adminSecret);
}

export async function isAdminRequest(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAMES.admin)?.value;
  if (!token) return false;

  try {
    const verified = await jwtVerify(token, adminSecret);
    return verified.payload.role === "admin";
  } catch {
    return false;
  }
}

export async function isAdminCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAMES.admin)?.value;
  if (!token) return false;

  try {
    const verified = await jwtVerify(token, adminSecret);
    return verified.payload.role === "admin";
  } catch {
    return false;
  }
}

export function compareAdminSecret(input: string) {
  const inputBuffer = Buffer.from(input);
  const secretBuffer = Buffer.from(env.ADMIN_SECRET);
  if (inputBuffer.length !== secretBuffer.length) return false;
  return timingSafeEqual(inputBuffer, secretBuffer);
}
