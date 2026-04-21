# Multi-stage build for Viktor čistič — ALBIXON moderace FB/IG komentářů.
# Backend (Node) + static frontend served from the same port.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm install --workspaces --include-workspace-root

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
COPY . .
RUN npm --workspace backend run prisma:generate \
 && npm --workspace backend run build \
 && npm --workspace frontend run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app

COPY --from=build --chown=app:app /app/backend/package.json ./backend/package.json
COPY --from=build --chown=app:app /app/backend/dist ./backend/dist
COPY --from=build --chown=app:app /app/backend/prisma ./backend/prisma
COPY --from=build --chown=app:app /app/backend/node_modules ./backend/node_modules
COPY --from=build --chown=app:app /app/frontend/dist ./frontend/dist
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/package.json ./package.json

USER app
EXPOSE 3000
CMD ["node", "backend/dist/index.js"]
