import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { COOKIE_NAMES } from "@/lib/constants";

export function newCsrfToken() {
  return randomBytes(24).toString("hex");
}

export async function assertCsrf(request: NextRequest) {
  const cookieStore = await cookies();
  const csrfCookie = cookieStore.get(COOKIE_NAMES.csrf)?.value;
  const csrfHeader = request.headers.get("x-csrf-token");
  return Boolean(csrfCookie && csrfHeader && csrfCookie === csrfHeader);
}
