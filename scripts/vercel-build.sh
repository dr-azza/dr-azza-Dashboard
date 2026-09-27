#!/usr/bin/env bash
# Vercel build for the QC test deployment. Deployments are made with the Vercel CLI from a machine
# that has the licensed Catalyst kit (./catalyst-ui-kit), so the kit travels only privately to the
# Vercel account and is never in this public repository.
set -euo pipefail

if [ ! -d catalyst-ui-kit/typescript ]; then
  echo "catalyst-ui-kit/typescript is missing: deploy with the Vercel CLI from a checkout that has the kit" >&2
  exit 1
fi
pnpm setup:catalyst
pnpm turbo run build --filter=@azza/web --filter='@azza/api...'

# Database changes once per production deploy, here. (If they fail, the deploy fails and the old
# one stays live.) Preview builds never touch the shared QC database.
if [ "${VERCEL_ENV:-}" != "production" ]; then
  echo "Not a production deploy (VERCEL_ENV=${VERCEL_ENV:-unset}): skipping migrations and seed."
  exit 0
fi
cd apps/api
pnpm exec prisma migrate deploy
if [ "${ALLOW_DEMO_SEED:-}" = "true" ]; then
  SEED_ONLY_IF_EMPTY=true pnpm exec prisma db seed
fi
