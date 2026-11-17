# Single-container MusicVerse: API + web + admin on one public port (web), same origin.
# Intended for small deployments and previews (e.g. Render free tier). Production on Google Cloud
# uses the separate api / next-app images instead.
#   docker build -f infrastructure/docker/allinone.Dockerfile -t musicverse-allinone .
#   docker run -p 3000:3000 -e DATABASE_URL=... -e REDIS_URL=... -e JWT_ACCESS_SECRET=... \
#     -e MFA_ENCRYPTION_KEY=... -e MAIL_TRANSPORT=none musicverse-allinone
ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS build
RUN corepack enable
WORKDIR /repo
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 \
    BUNDLED_API_URL=http://127.0.0.1:4000 \
    BUNDLED_ADMIN_URL=http://127.0.0.1:3001 \
    ADMIN_BASE_PATH=/admin
RUN pnpm install --frozen-lockfile --filter "@musicverse/api..." --filter "@musicverse/web..." --filter "@musicverse/admin..." \
 && pnpm turbo run build --filter "@musicverse/api..." --filter "@musicverse/web..." --filter "@musicverse/admin..." \
 && pnpm --filter @musicverse/api deploy --prod --legacy /out/api \
 && cd /out/api && node_modules/.bin/prisma generate --schema prisma/schema.prisma

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /out/api/package.json /app/api/package.json
COPY --from=build --chown=node:node /out/api/node_modules /app/api/node_modules
COPY --from=build --chown=node:node /out/api/prisma /app/api/prisma
COPY --from=build --chown=node:node /repo/apps/api/dist /app/api/dist
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone /app/web
COPY --from=build --chown=node:node /repo/apps/web/.next/static /app/web/apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/admin/.next/standalone /app/admin
COPY --from=build --chown=node:node /repo/apps/admin/.next/static /app/admin/apps/admin/.next/static
COPY --chown=node:node infrastructure/docker/allinone-start.mjs /app/start.mjs
USER node
EXPOSE 3000
CMD ["node", "/app/start.mjs"]
