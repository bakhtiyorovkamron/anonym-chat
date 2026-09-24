import type { Server } from "socket.io";

// server.mjs runs Next.js and Socket.IO in the same process and stores the
// io instance on globalThis, so API routes can push events to clients.
function getIo(): Server | null {
  return ((globalThis as Record<string, unknown>).__anonChatIo as Server | undefined) ?? null;
}

export type MatchEndReason = "ended" | "blocked";

export function emitMatchEnded(matchId: string, endedBy: string, reason: MatchEndReason = "ended") {
  getIo()?.to(`match:${matchId}`).emit("match_ended", { matchId, endedBy, reason });
}
