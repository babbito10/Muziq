# syntax=docker/dockerfile:1.7
# Image for a Next.js app in the monorepo (web or admin). Build from the repository root:
#   docker build -f infrastructure/docker/next-app.Dockerfile --build-arg APP=web -t musicverse-web .
# Runtime configuration (PUBLIC_API_URL) is read per request, so one image serves every environment.
ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS build
ARG APP=web
RUN corepack enable
WORKDIR /repo
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm install --frozen-lockfile --filter "@musicverse/${APP}..." \
 && pnpm turbo run build --filter "@musicverse/${APP}..."

FROM ${NODE_IMAGE} AS runtime
ARG APP=web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 APP_DIR=apps/${APP}
WORKDIR /app
# Standalone output mirrors the monorepo layout (outputFileTracingRoot = repo root).
COPY --from=build --chown=node:node /repo/apps/${APP}/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/${APP}/.next/static ./apps/${APP}/.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/" >/dev/null || exit 1
CMD ["sh", "-c", "node ${APP_DIR}/server.js"]
