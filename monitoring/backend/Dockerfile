# FOCUS backend – produkční image (PostgreSQL).
# Pro lokální / demo nasazení použij ../Dockerfile.demo (all-in-one se SQLite).

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY prisma ./prisma
COPY scripts ./scripts
COPY src ./src
# 1) Sync postgres schema z mastera (zaručí 100% shodu modelů).
# 2) Vygeneruj Prisma client proti POSTGRES schema.
# 3) Zkompiluj TypeScript.
RUN npm run prisma:sync \
 && npx prisma generate --schema=prisma/schema.postgres.prisma \
 && tsc -p tsconfig.json

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:20-alpine
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY prisma ./prisma
COPY scripts ./scripts
# Synchronizuj postgres schema znovu a regeneruj client (omit=dev nemá @types).
RUN npm run prisma:sync \
 && npx prisma generate --schema=prisma/schema.postgres.prisma
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/v1/health | grep -q '"status":"ok"' || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
