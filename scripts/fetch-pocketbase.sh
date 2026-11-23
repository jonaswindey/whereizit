#!/usr/bin/env bash
# Downloads the pinned PocketBase binary into server/ for the current OS/arch.
set -euo pipefail

VERSION="0.40.6"
DIR="$(cd "$(dirname "$0")/.." && pwd)/server"

case "$(uname -s)" in
  Darwin) OS=darwin ;;
  Linux) OS=linux ;;
  *) echo "unsupported OS: $(uname -s)" >&2; exit 1 ;;
esac
case "$(uname -m)" in
  x86_64|amd64) ARCH=amd64 ;;
  arm64|aarch64) ARCH=arm64 ;;
  *) echo "unsupported arch: $(uname -m)" >&2; exit 1 ;;
esac

ZIP="pocketbase_${VERSION}_${OS}_${ARCH}.zip"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL -o "$TMP/$ZIP" "https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}/${ZIP}"
unzip -q -o "$TMP/$ZIP" pocketbase -d "$DIR"
chmod +x "$DIR/pocketbase"
"$DIR/pocketbase" --version
