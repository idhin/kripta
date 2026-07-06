# syntax=docker/dockerfile:1

# ---------- Base ----------
FROM node:20-alpine AS base
# openssl wajib agar Prisma mendeteksi OpenSSL 3.x dan memuat query engine
# yang benar (libssl.so.3). Tanpa ini, engine default mencari libssl.so.1.1
# yang tidak ada di Alpine terbaru sehingga app gagal start.
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# ---------- Dependencies (semua, untuk build) ----------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---------- Builder ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# prisma generate + next build
RUN npm run build

# ---------- Production dependencies (tanpa devDeps) ----------
FROM base AS proddeps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
# Prisma Client hasil generate perlu ikut disalin.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# ---------- Runner ----------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=proddeps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
