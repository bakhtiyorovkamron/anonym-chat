import { randomBytes } from "crypto";
import { NextRequest } from "next/server";

export function newCsrfToken() {
  return randomBytes(24).toString("hex");
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function sameHost(url: string, request: NextRequest) {
  try {
    const origin = new URL(url);
    if (allowedOrigins.includes(origin.origin)) return true;
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return Boolean(host) && origin.host === host;
  } catch {
    return false;
  }
}

/**
 * CSRF protection without cookies: the browser always sets Origin (or Referer) on
 * cross-site POST/PATCH/DELETE, and a foreign site cannot fake it. So we only accept
 * mutating requests coming from our own origin.
 */
export async function assertCsrf(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin) return sameHost(origin, request);

  const referer = request.headers.get("referer");
  if (referer) return sameHost(referer, request);

  return false;
}
