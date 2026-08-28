import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { jwtVerify } from "jose";
import { PrismaClient } from "@prisma/client";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env.PORT || 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const prisma = new PrismaClient();

const authSecret = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-auth-secret-please-change-in-production");

function getCookieValue(cookieHeader, key) {
  const values = cookieHeader?.split(";") ?? [];
  for (const value of values) {
    const [k, v] = value.trim().split("=");
    if (k === key) return decodeURIComponent(v ?? "");
  }
  return null;
}

function sanitizeText(input) {
  return input.replace(/[\u0000-\u001F\u007F]/g, "").replace(/[<>]/g, "").trim();
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));

  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: true,
      credentials: true,
    },
  });

  io.use(async (socket, nextMiddleware) => {
    try {
      const token = getCookieValue(socket.handshake.headers.cookie, "anon_session");
      if (!token) return nextMiddleware(new Error("Unauthorized"));
      const verified = await jwtVerify(token, authSecret);
      if (typeof verified.payload.uid !== "string") return nextMiddleware(new Error("Unauthorized"));

      const user = await prisma.user.findUnique({ where: { id: verified.payload.uid } });
      if (!user || user.banned) return nextMiddleware(new Error("Unauthorized"));

      socket.data.userId = user.id;
      await prisma.user.update({ where: { id: user.id }, data: { online: true, lastSeenAt: new Date() } });
      return nextMiddleware();
    } catch (error) {
      return nextMiddleware(error);
    }
  });

  io.on("connection", (socket) => {
    socket.on("join_match", async ({ matchId }) => {
      const match = await prisma.match.findUnique({ where: { id: matchId } });
      if (!match) return;
      if (match.userAId !== socket.data.userId && match.userBId !== socket.data.userId) return;
      socket.join(`match:${matchId}`);
    });

    socket.on("typing", ({ matchId, typing }) => {
      socket.to(`match:${matchId}`).emit("typing", { typing: Boolean(typing) });
    });

    socket.on("send_message", async ({ matchId, text, replyToId }, callback) => {
      const safeText = sanitizeText(String(text ?? ""));
      if (!safeText) {
        callback?.({ error: "Message cannot be empty." });
        return;
      }

      if (safeText.length > 500) {
        callback?.({ error: "Message too long." });
        return;
      }

      const match = await prisma.match.findUnique({ where: { id: matchId } });
      if (!match || match.status !== "ACTIVE") {
        callback?.({ error: "Match is not active." });
        return;
      }

      const senderId = socket.data.userId;
      if (match.userAId !== senderId && match.userBId !== senderId) {
        callback?.({ error: "Cannot send message to this match." });
        return;
      }

      const targetId = match.userAId === senderId ? match.userBId : match.userAId;
      const blocked = await prisma.block.findFirst({
        where: {
          OR: [
            { blockerId: senderId, blockedId: targetId },
            { blockerId: targetId, blockedId: senderId },
          ],
        },
      });

      if (blocked) {
        callback?.({ error: "Этот пользователь больше не может отправлять тебе сообщения." });
        return;
      }

      const message = await prisma.message.create({
        data: {
          matchId,
          senderId,
          text: safeText,
          replyToId: replyToId || null,
        },
      });

      io.to(`match:${matchId}`).emit("new_message", message);
      callback?.({ ok: true });
    });

    socket.on("disconnect", async () => {
      const userId = socket.data.userId;
      if (userId) {
        await prisma.user.update({ where: { id: userId }, data: { online: false, lastSeenAt: new Date() } });
      }
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
