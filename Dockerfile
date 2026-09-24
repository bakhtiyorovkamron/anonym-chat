# syntax=docker/dockerfile:1

# Node 22.9+ is required for `node --env-file-if-exists` used in package.json scripts.
FROM node:22-alpine AS base
# Prisma's query engine needs OpenSSL on Alpine.
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

# ---------- dependencies (all, including dev: needed for next build) ----------
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ---------- build ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# src/lib/env.ts validates env when modules load, and `next build` loads route modules.
# These placeholder values exist only in this build stage and are NOT copied into the final image.
ENV NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    AUTH_SECRET="build-time-placeholder-secret-not-used-at-runtime" \
    ADMIN_SECRET="build-time-placeholder"
RUN npx prisma generate && npm run build

# ---------- production dependencies only ----------
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
# `prisma` (CLI) is a regular dependency, so `migrate deploy` works in the final image.
RUN npm ci --omit=dev && npx prisma generate && npm cache clean --force

# ---------- runtime ----------
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --chown=node:node package.json server.mjs next.config.ts ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node docker/entrypoint.sh /usr/local/bin/entrypoint.sh

# Uploaded GIFs live here (see src/lib/sticker-storage.ts). Mounted as a volume in docker-compose.
RUN mkdir -p /app/uploads/stickers && chown -R node:node /app/uploads && chmod +x /usr/local/bin/entrypoint.sh

USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/" >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.mjs"]
