#!/usr/bin/env bash
set -euo pipefail

out=docs/checks/F13b/attempt-2
base=http://localhost:4321
node_modules/.bin/astro preview --port 4321 --ignore-lock > "$out/preview.log" 2>&1 &
server=$!
trap 'kill "$server" 2>/dev/null || true; wait "$server" 2>/dev/null || true' EXIT
for i in {1..80}; do
  kill -0 "$server"
  curl --silent --fail "$base/" >/dev/null && break
  sleep 0.25
done
curl --silent --fail "$base/" >/dev/null
node_modules/.bin/linkinator "$base/" --config linkinator.config.json > "$out/links.log" 2>&1
node docs/checks/tools/f13b-r2-browser.mjs "$base" "$out" > "$out/browser.log" 2>&1
