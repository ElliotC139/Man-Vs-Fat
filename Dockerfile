FROM node:22-slim

WORKDIR /app

# node:22-slim (Debian bookworm) ships OpenSSL 3.0 but doesn't expose it in a
# way Prisma's schema engine can detect, so it silently falls back to a
# libssl-1.1 engine binary that isn't present — the build succeeds, but the
# engine fails to load at runtime with an opaque "Schema engine error" and no
# further detail. Installing openssl explicitly fixes detection.
RUN apt-get update -y && apt-get install -y openssl

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate

ENV NODE_ENV=production
EXPOSE 3000

# `prisma migrate deploy` is idempotent, so it's safe to run on every boot —
# this is what actually applies the schema to the volume on first deploy.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
