#!/usr/bin/env bash
# Render start for the test deployment: just the API (which also serves the web app, WEB_DIST).
# Migrations and demo data run in the build step, once per deploy, so waking from sleep is fast.
set -euo pipefail
cd apps/api
exec node dist/main.js
