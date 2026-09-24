import type { NextRequest } from "next/server";

type RateEntry = { count: number; resetAt: number };

const store = new Map<string, RateEntry>();
const MAX_KEYS = 50_000;
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000 && store.size < MAX_KEYS) return;
  lastSweep = now;
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

/**
 * In-memory fixed-window limiter. Per-process only: use Redis when running
 * more than one instance.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  sweep(now);
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (current.count >= limit) {
    return false;
  }

  current.count += 1;
  return true;
}

export function resetRateLimit(key: string) {
  store.delete(key);
}

export function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
