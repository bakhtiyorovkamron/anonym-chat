import type { Match } from "@prisma/client";
import { sanitizeText } from "@/lib/sanitize";

export const MESSAGE_LIMIT = 500;

export function validateMessagePayload(text: string) {
  const sanitized = sanitizeText(text);
  if (!sanitized) {
    return { ok: false, error: "Message cannot be empty." } as const;
  }

  if (sanitized.length > MESSAGE_LIMIT) {
    return { ok: false, error: `Message exceeds ${MESSAGE_LIMIT} chars.` } as const;
  }

  return { ok: true, text: sanitized } as const;
}

export function userCanSendInMatch(userId: string, match: Pick<Match, "userAId" | "userBId" | "status"> | null) {
  if (!match || match.status !== "ACTIVE") return false;
  return match.userAId === userId || match.userBId === userId;
}
