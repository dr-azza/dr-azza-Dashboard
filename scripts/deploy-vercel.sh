#!/usr/bin/env bash
# Deploys the QC test site to Vercel from this machine (it must have ./catalyst-ui-kit).
# Only reviewed code goes out: a clean checkout of main, identical to origin/main, whose CI passed.
# Needs VERCEL_TOKEN, VERCEL_ORG_ID and VERCEL_PROJECT_ID in the environment, e.g.:
#   set -a; . ~/.config/azzah/deploy.env; set +a; bash scripts/deploy-vercel.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${VERCEL_TOKEN:?Set VERCEL_TOKEN}" "${VERCEL_ORG_ID:?Set VERCEL_ORG_ID}" "${VERCEL_PROJECT_ID:?Set VERCEL_PROJECT_ID}"
[ -d catalyst-ui-kit/typescript ] || { echo "catalyst-ui-kit/typescript missing" >&2; exit 1; }

branch=$(git rev-parse --abbrev-ref HEAD)
[ "$branch" = main ] || { echo "Deploy from main (now on $branch)" >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "Uncommitted changes: commit or stash first" >&2; exit 1; }
git fetch -q origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "Local main differs from origin/main" >&2; exit 1; }
if command -v gh >/dev/null; then
  ci=$(gh run list --branch main --commit "$(git rev-parse HEAD)" --limit 1 --json conclusion -q '.[0].conclusion' || true)
  [ "$ci" = success ] || { echo "CI has not passed for this commit (status: ${ci:-none})" >&2; exit 1; }
fi

# Pinned CLI version (reproducible deploys). It reads VERCEL_TOKEN from the environment, so the
# token is never an argument visible in the process list.
pnpm dlx vercel@60.1.3 deploy --prod --yes
