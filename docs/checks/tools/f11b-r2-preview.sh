#!/bin/sh
set -u
out=docs/checks/F11b/attempt-2
base=http://localhost:4321
node_modules/.bin/astro preview --port 4321 --ignore-lock > "$out/preview.log" 2>&1 &
server=$!
trap 'kill "$server" 2>/dev/null || true; wait "$server" 2>/dev/null || true' EXIT INT TERM
for step in $(seq 1 40); do
  if curl --silent --fail "$base/" > /dev/null; then break; fi
  sleep 0.25
done
probe() {
  log=$1
  shift
  "$@" > "$out/$log.log" 2>&1
  printf '%s %d\n' "$log" "$?"
}
if [ "${1:-all}" = browser ]; then
  node docs/checks/tools/f11b-r2-browser.mjs "$base" > "$out/browser.log" 2>&1
  exit "$?"
fi
probe links node_modules/.bin/linkinator "$base/" --config linkinator.config.json
probe browser node docs/checks/tools/f11b-r2-browser.mjs "$base"
probe cls node docs/checks/tools/f10-retry-cls.mjs "$base"
