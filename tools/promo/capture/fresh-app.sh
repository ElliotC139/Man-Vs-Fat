#!/usr/bin/env bash
# Starts the app on a brand-new local database with the demo account in it.
# Run from the repo root. Leaves the server running on :3000.
set -euo pipefail
# Whatever holds the port goes, not just the pid we noted: npx's child
# outlives npx, and a surviving server would still be on the old database.
lsof -ti tcp:3000 | xargs -r kill 2>/dev/null || true
for _ in $(seq 1 20); do lsof -ti tcp:3000 >/dev/null || break; sleep 0.25; done
mkdir -p data
rm -f data/dev.db data/dev.db-*
npx prisma migrate deploy >/dev/null
nohup npx tsx src/server.ts > data/promo-server.log 2>&1 &
for _ in $(seq 1 40); do curl -s -o /dev/null http://localhost:3000/ && break; sleep 0.5; done
node tools/promo/capture/seed.mjs
# A paid plan (no ads, every feature) and no Admin tab. Stripe and the
# first-user rule set these in real life; this is a throwaway database.
printf "UPDATE User SET plan='pro', subscriptionStatus='active', isAdmin=0 WHERE username='elliot';" \
  | npx prisma db execute --stdin --schema prisma/schema.prisma >/dev/null
