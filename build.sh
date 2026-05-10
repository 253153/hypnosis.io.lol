#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="$ROOT/src"
OUT="$ROOT/dist"
mkdir -p "$OUT/icons"
cp "$SRC/index.html" "$SRC/script.js" "$SRC/manifest.json" "$SRC/sw.js" "$SRC/robots.txt" "$OUT/"
rsync -a --delete "$SRC/icons/" "$OUT/icons/"
printf "Static build synced to %s (publish this folder as your site root).\n" "$OUT"
