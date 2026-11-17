# syntax=docker/dockerfile:1.7
# MusicVerse API image. Build from the repository root:
#   docker build -f infrastructure/docker/api.Dockerfile -t musicverse-api .
ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS build
# No OS packages needed: Alpine's base already provides libssl3/libcrypto3 for Prisma's engines.
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter "@musicverse/api..." \
 && pnpm turbo run build --filter "@musicverse/api..." \
 # Self-contained production install of the API and its workspace dependencies.
 && pnpm --filter @musicverse/api deploy --prod --legacy /out \
 && cd /out && node_modules/.bin/prisma generate --schema prisma/schema.prisma

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production PORT=4000
WORKDIR /app
COPY --from=build --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/prisma ./prisma
COPY --from=build --chown=node:node /repo/apps/api/dist ./dist
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/v1/health/live" >/dev/null || exit 1
# Run with an init process for signal forwarding/zombie reaping (compose `init: true`; Cloud Run does this).
# Migrations run as a separate one-off job (see docker-compose `migrate` / Cloud Run Job):
#   node_modules/.bin/prisma migrate deploy && node dist/database/seed.js
CMD ["node", "dist/main.js"]
