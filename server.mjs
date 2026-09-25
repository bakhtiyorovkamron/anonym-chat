import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { jwtVerify } from "jose";
import { PrismaClient } from "@prisma/client";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env.PORT || 4000);

if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  console.error("AUTH_SECRET is missing or shorter than 32 chars. Refusing to start.");
  process.exit(1);
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const prisma = new PrismaClient();

const authSecret = new TextEncoder().encode(process.env.AUTH_SECRET);

// Comma-separated list, e.g. "https://chat.example.com". Defaults to localhost in dev.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || (dev ? `http://localhost:${port}` : ""))
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  return !origin || allowedOrigins.includes(origin);
}

const MESSAGE_LIMIT = 500;
const MESSAGE_RATE = { limit: 10, windowMs: 10_000 };
const TYPING_RATE = { limit: 30, windowMs: 10_000 };

function createLimiter({ limit, windowMs }) {
  let count = 0;
  let resetAt = 0;
  return () => {
    const now = Date.now();
    if (now >= resetAt) {
      count = 0;
      resetAt = now + windowMs;
    }
    count += 1;
    return count <= limit;
  };
}

function isId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 64;
}

function getCookieValue(cookieHeader, key) {
  const values = cookieHeader?.split(";") ?? [];
  for (const value of values) {
    const [k, ...rest] = value.trim().split("=");
    if (k === key) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function sanitizeText(input) {
  return input.replace(/[\u0000-\u001F\u007F]/g, "").replace(/[<>]/g, "").trim();
}

// Open sockets per user: closing one tab must not mark the user offline.
const socketsPerUser = new Map();

// ---------- IP + geolocation ----------
// Set TRUST_PROXY=true only when running behind nginx/Cloudflare, otherwise
// X-Forwarded-For can be spoofed by the client.
const trustProxy = process.env.TRUST_PROXY === "true";

function getClientIp(socket) {
  const headers = socket.handshake.headers;
  if (trustProxy) {
    const cf = headers["cf-connecting-ip"];
    if (typeof cf === "string" && cf) return cf.trim();
    const xff = headers["x-forwarded-for"];
    if (typeof xff === "string" && xff) return xff.split(",")[0].trim();
    const real = headers["x-real-ip"];
    if (typeof real === "string" && real) return real.trim();
  }
  return (socket.handshake.address || "").replace(/^::ffff:/, "");
}

function isPrivateIp(ip) {
  return (
    !ip ||
    ip === "::1" ||
    ip.startsWith("127.") ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip.startsWith("fc") ||
    ip.startsWith("fd") ||
    ip.startsWith("fe80")
  );
}

const geoCache = new Map(); // ip -> { country, countryCode, city, at }
const GEO_TTL_MS = 24 * 60 * 60_000;

async function lookupGeo(ip) {
  if (isPrivateIp(ip)) return { country: "Локальная сеть", countryCode: null, city: null };
  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.at < GEO_TTL_MS) return cached;
  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,regionName,city&lang=ru`,
      { signal: AbortSignal.timeout(3000) },
    );
    const data = await res.json();
    if (data.status !== "success") return null;
    const parts = [data.city, data.regionName].filter(Boolean);
    const geo = {
      country: data.country || null,
      countryCode: data.countryCode || null,
      city: [...new Set(parts)].join(", ") || null,
      at: Date.now(),
    };
    geoCache.set(ip, geo);
    return geo;
  } catch {
    return null;
  }
}

async function recordIp(userId, ip) {
  if (!ip) return;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { lastIp: true, country: true } });
  if (!user) return;
  if (user.lastIp === ip && user.country) return; // nothing changed
  const geo = await lookupGeo(ip);
  await prisma.user.update({
    where: { id: userId },
    data: {
      lastIp: ip,
      ...(geo ? { country: geo.country, countryCode: geo.countryCode, city: geo.city } : {}),
    },
  });
}

async function setOnline(userId, online) {
  await prisma.user.update({ where: { id: userId }, data: { online, lastSeenAt: new Date() } });
}

function safeHandler(name, handler) {
  return async (...args) => {
    try {
      await handler(...args);
    } catch (error) {
      console.error(`[socket:${name}]`, error);
      const callback = args[args.length - 1];
      if (typeof callback === "function") callback({ error: "Internal error." });
    }
  };
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));

  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
      credentials: true,
    },
    // CORS does not apply to WebSocket upgrades, so check Origin explicitly (CSWSH).
    allowRequest: (req, callback) => callback(null, isAllowedOrigin(req.headers.origin)),
  });

  // Lets Next.js API routes (same process) emit events, see src/lib/realtime.ts.
  globalThis.__anonChatIo = io;

  io.use(async (socket, nextMiddleware) => {
    try {
      const token = getCookieValue(socket.handshake.headers.cookie, "anon_session");
      if (!token) return nextMiddleware(new Error("Unauthorized"));
      const verified = await jwtVerify(token, authSecret);
      if (typeof verified.payload.uid !== "string") return nextMiddleware(new Error("Unauthorized"));

      const user = await prisma.user.findUnique({ where: { id: verified.payload.uid } });
      if (!user || user.banned) return nextMiddleware(new Error("Unauthorized"));

      socket.data.userId = user.id;
      return nextMiddleware();
    } catch {
      return nextMiddleware(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId;
    const joinedMatches = new Set();
    const allowMessage = createLimiter(MESSAGE_RATE);
    const allowTyping = createLimiter(TYPING_RATE);

    socket.join(`user:${userId}`);
    socketsPerUser.set(userId, (socketsPerUser.get(userId) ?? 0) + 1);
    setOnline(userId, true).catch((error) => console.error("[socket:online]", error));
    recordIp(userId, getClientIp(socket)).catch((error) => console.error("[socket:ip]", error));

    socket.on(
      "join_match",
      safeHandler("join_match", async (payload) => {
        const matchId = payload?.matchId;
        if (!isId(matchId)) return;
        const match = await prisma.match.findUnique({ where: { id: matchId } });
        if (!match) return;
        if (match.userAId !== userId && match.userBId !== userId) return;
        joinedMatches.add(matchId);
        socket.join(`match:${matchId}`);
      }),
    );

    socket.on("typing", (payload) => {
      const matchId = payload?.matchId;
      // Only relay into rooms this socket was authorized to join.
      if (!isId(matchId) || !joinedMatches.has(matchId)) return;
      if (!allowTyping()) return;
      socket.to(`match:${matchId}`).emit("typing", { typing: Boolean(payload?.typing) });
    });

    socket.on(
      "send_message",
      safeHandler("send_message", async (payload, callback) => {
        const reply = typeof callback === "function" ? callback : () => {};
        const matchId = payload?.matchId;
        const replyToId = payload?.replyToId;
        const stickerId = payload?.stickerId;
        const isSticker = stickerId != null && stickerId !== "";

        if (!isId(matchId)) return reply({ error: "Invalid match." });
        if (!allowMessage()) return reply({ error: "Слишком много сообщений. Подожди немного." });

        let safeText = "";
        let sticker = null;
        if (isSticker) {
          if (!isId(stickerId)) return reply({ error: "Invalid sticker." });
          // Never trust a URL from the client: only active stickers from the admin catalog.
          sticker = await prisma.sticker.findUnique({
            where: { id: stickerId },
            select: { id: true, active: true, fileName: true, name: true, mimeType: true },
          });
          if (!sticker || !sticker.active || !["image/gif", "video/mp4"].includes(sticker.mimeType)) {
            return reply({ error: "GIF недоступен." });
          }
        } else {
          safeText = sanitizeText(String(payload?.text ?? ""));
          if (!safeText) return reply({ error: "Message cannot be empty." });
          if (safeText.length > MESSAGE_LIMIT) return reply({ error: "Message too long." });
        }

        const [sender, match] = await Promise.all([
          prisma.user.findUnique({ where: { id: userId }, select: { banned: true } }),
          prisma.match.findUnique({ where: { id: matchId } }),
        ]);

        if (!sender || sender.banned) {
          reply({ error: "Unauthorized" });
          socket.disconnect(true);
          return;
        }

        if (!match || match.status !== "ACTIVE") return reply({ error: "Match is not active." });
        if (!match.acceptedA || !match.acceptedB) return reply({ error: "Чат ещё не подтверждён." });
        if (match.userAId !== userId && match.userBId !== userId) {
          return reply({ error: "Cannot send message to this match." });
        }

        if (replyToId != null && replyToId !== "") {
          if (!isId(replyToId)) return reply({ error: "Invalid reply target." });
          const target = await prisma.message.findUnique({
            where: { id: replyToId },
            select: { matchId: true, deletedAt: true },
          });
          if (!target || target.matchId !== matchId || target.deletedAt) {
            return reply({ error: "Invalid reply target." });
          }
        }

        const targetId = match.userAId === userId ? match.userBId : match.userAId;
        const blocked = await prisma.block.findFirst({
          where: {
            OR: [
              { blockerId: userId, blockedId: targetId },
              { blockerId: targetId, blockedId: userId },
            ],
          },
        });
        if (blocked) {
          return reply({ error: "Этот пользователь больше не может отправлять тебе сообщения." });
        }

        const message = await prisma.message.create({
          data: {
            matchId,
            senderId: userId,
            type: sticker ? "STICKER" : "TEXT",
            text: safeText,
            stickerId: sticker ? sticker.id : null,
            replyToId: replyToId || null,
          },
        });

        io.to(`match:${matchId}`).emit("new_message", {
          ...message,
          sticker: sticker
            ? { url: `/api/stickers/file/${sticker.fileName}`, name: sticker.name, mimeType: sticker.mimeType }
            : null,
        });
        reply({ ok: true });
      }),
    );

    socket.on(
      "disconnect",
      safeHandler("disconnect", async () => {
        const remaining = (socketsPerUser.get(userId) ?? 1) - 1;
        if (remaining > 0) {
          socketsPerUser.set(userId, remaining);
          return;
        }
        socketsPerUser.delete(userId);
        await setOnline(userId, false);
      }),
    );
  });

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
