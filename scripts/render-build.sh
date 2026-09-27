#!/usr/bin/env bash
# Render build for the test deployment: install, fetch the licensed Catalyst kit from its private
# repository (Tailwind Plus licence: never in this public repo), then build the web app and API.
set -euo pipefail

corepack enable

if [ ! -d catalyst-ui-kit/typescript ]; then
  # A read-only deploy key for the private kit repo, added in Render as the secret file below.
  key_file=${CATALYST_DEPLOY_KEY_FILE:-/etc/secrets/catalyst_deploy_key}
  if [ ! -f "$key_file" ]; then
    echo "Missing Render secret file 'catalyst_deploy_key' (read-only deploy key for ${CATALYST_KIT_REPO:?})" >&2
    exit 1
  fi
  ssh_dir=$(mktemp -d)
  install -m 600 "$key_file" "$ssh_dir/key"
  # GitHub's published SSH host key, pinned rather than trusted on first use.
  echo 'github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl' > "$ssh_dir/known_hosts"
  GIT_SSH_COMMAND="ssh -i $ssh_dir/key -o IdentitiesOnly=yes -o UserKnownHostsFile=$ssh_dir/known_hosts" \
    git clone --depth 1 "$CATALYST_KIT_REPO" catalyst-ui-kit
  rm -rf "$ssh_dir"
fi

# Dev dependencies are needed to build (Vite, tsdown, Nest CLI, Prisma CLI) even with NODE_ENV=production.
pnpm install --frozen-lockfile --prod=false
pnpm setup:catalyst
pnpm turbo run build --filter=@azza/web --filter='@azza/api...'

# Database changes happen once per deploy, here, not at every start: the free instance sleeps
# and each wake should go straight to serving. (If this fails, the previous version keeps running.)
cd apps/api
pnpm exec prisma migrate deploy
if [ "${ALLOW_DEMO_SEED:-}" = "true" ]; then
  SEED_ONLY_IF_EMPTY=true pnpm exec prisma db seed
fi
