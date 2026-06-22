FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate

ENV NODE_ENV=production
EXPOSE 3000

# `prisma migrate deploy` is idempotent, so it's safe to run on every boot —
# this is what actually applies the schema to the volume on first deploy.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
