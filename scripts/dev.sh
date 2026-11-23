#!/usr/bin/env bash
# Runs PocketBase (:8090) and the Vite dev server (:5173) together; Ctrl-C stops both.
# Phone access: `tailscale serve --bg 5173` once, then open https://<mac>.<tailnet>.ts.net
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

[ -x "$ROOT/server/pocketbase" ] || "$ROOT/scripts/fetch-pocketbase.sh"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
source "$NVM_DIR/nvm.sh"
nvm use >/dev/null

trap 'kill 0' EXIT
"$ROOT/server/pocketbase" serve --http 127.0.0.1:8090 &
cd "$ROOT/web"
[ -d node_modules ] || npm install
npm run dev
