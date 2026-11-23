#!/usr/bin/env bash
# Installs a launchd agent that runs PocketBase on 127.0.0.1:8090 at login and restarts it if it dies.
# Re-run after moving the project or editing server/.env. Remove with: scripts/install-service.sh --uninstall
set -euo pipefail

LABEL="app.whereizit.pocketbase"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
SERVER="$(cd "$(dirname "$0")/../server" && pwd)"
DOMAIN="gui/$(id -u)"

launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
if [ "${1:-}" = "--uninstall" ]; then
  rm -f "$PLIST"
  echo "removed $LABEL"
  exit 0
fi

[ -x "$SERVER/pocketbase" ] || "$SERVER/../scripts/fetch-pocketbase.sh"

mkdir -p "$HOME/Library/LaunchAgents" "$SERVER/logs"

# Optional secrets for the server (e.g. ANTHROPIC_API_KEY=...), one KEY=value per line.
ENV_XML=""
if [ -f "$SERVER/.env" ]; then
  chmod 600 "$SERVER/.env"
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" == \#* ]] && continue
    value="${value%\"}"; value="${value#\"}"
    ENV_XML+="    <key>$key</key><string>$value</string>"$'\n'
  done < "$SERVER/.env"
fi
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$SERVER/pocketbase</string>
    <string>serve</string>
    <string>--http</string>
    <string>127.0.0.1:8090</string>
  </array>
  <key>WorkingDirectory</key><string>$SERVER</string>
  <key>EnvironmentVariables</key>
  <dict>
$ENV_XML  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$SERVER/logs/pocketbase.log</string>
  <key>StandardErrorPath</key><string>$SERVER/logs/pocketbase.log</string>
</dict>
</plist>
PLIST

launchctl bootstrap "$DOMAIN" "$PLIST"
echo "installed $LABEL (logs: $SERVER/logs/pocketbase.log)"
echo "restart after changing hooks or migrations: launchctl kickstart -k $DOMAIN/$LABEL"
