#!/usr/bin/env bash
# Builds the web app and puts it live together with any new migrations/hooks:
# backup database → build → copy into server/pb_public → restart the service (applies migrations).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="app.whereizit.pocketbase"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
source "$NVM_DIR/nvm.sh"
cd "$ROOT/web" && nvm use >/dev/null && npm run build

mkdir -p "$ROOT/server/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
sqlite3 "$ROOT/server/pb_data/data.db" ".backup '$ROOT/server/backups/data-$STAMP-deploy.db'"
echo "backup: server/backups/data-$STAMP-deploy.db"

rsync -a --delete "$ROOT/web/dist/" "$ROOT/server/pb_public/"
launchctl kickstart -k "gui/$(id -u)/$LABEL"
for _ in $(seq 1 30); do curl -sf http://127.0.0.1:8090/api/health >/dev/null && break; sleep 0.5; done
curl -sf http://127.0.0.1:8090/api/health >/dev/null && echo "deployed" || { echo "server did not come back; see server/logs/pocketbase.log" >&2; exit 1; }
