#!/usr/bin/env bash
# Deploys the QC test site to Vercel from this machine (it must have ./catalyst-ui-kit).
# Needs VERCEL_TOKEN (and optionally VERCEL_SCOPE) in the environment, e.g. from a private file:
#   set -a; . ~/.config/azzah/deploy.env; set +a; bash scripts/deploy-vercel.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${VERCEL_TOKEN:?Set VERCEL_TOKEN}"
[ -d catalyst-ui-kit/typescript ] || { echo "catalyst-ui-kit/typescript missing" >&2; exit 1; }
scope=${VERCEL_SCOPE:+--scope "$VERCEL_SCOPE"}
# shellcheck disable=SC2086
# The CLI reads VERCEL_TOKEN from the environment (never passed as an argument, so it is not
# visible in the process list).
pnpm dlx vercel@latest deploy --prod --yes $scope
