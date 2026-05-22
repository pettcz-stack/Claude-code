# WorkView backend – produkční image (PostgreSQL).
FROM node:20-alpine AS build
# Prisma na Alpine potřebuje OpenSSL (jinak selže schema engine).
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
# Klient i build proti PRODUKČNÍMU (postgres) schématu.
RUN npx prisma generate --schema=prisma/schema.postgres.prisma && npm run build

FROM node:20-alpine
# Prisma na Alpine potřebuje OpenSSL (jinak selže schema engine za běhu).
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY prisma ./prisma
RUN npx prisma generate --schema=prisma/schema.postgres.prisma
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
