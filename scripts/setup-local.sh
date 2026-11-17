#!/usr/bin/env bash
# Prepare a local development environment that uses natively installed PostgreSQL and Redis.
# (Alternatively run everything in Docker: `pnpm docker:up`.)
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f apps/api/.env ]; then
  sed -e "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=$(openssl rand -base64 48 | tr -d '\n')|" \
      -e "s|^MFA_ENCRYPTION_KEY=.*|MFA_ENCRYPTION_KEY=$(openssl rand -base64 32)|" \
      apps/api/.env.example > apps/api/.env
  echo "Created apps/api/.env with freshly generated development secrets."
fi
for app in web admin mobile; do
  [ -f "apps/$app/.env" ] || cp "apps/$app/.env.example" "apps/$app/.env"
done

pnpm install
pnpm build:packages
pnpm db:deploy
pnpm db:seed
echo "Done. Start the API and web app with: pnpm dev"
