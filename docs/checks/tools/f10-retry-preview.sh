#!/bin/sh
set -u
out=docs/checks/F10/attempt-2
base=http://localhost:4321
node_modules/.bin/astro preview --port 4321 --ignore-lock > "$out/preview.log" 2>&1 &
server=$!
trap 'kill "$server" 2>/dev/null || true; wait "$server" 2>/dev/null || true' EXIT INT TERM
for step in $(seq 1 40); do
  if curl --silent --fail "$base/" > /dev/null; then
    break
  fi
  sleep 0.25
done
probe() {
  log=$1
  shift
  "$@" > "$out/$log.log" 2>&1
  printf '%s %d\n' "$log" "$?"
}
probe links node_modules/.bin/linkinator "$base/" --config linkinator.config.json
probe shots node docs/checks/tools/f10-shots.mjs "$base" "$out"
probe a11y node docs/checks/tools/f10-a11y-probe.mjs "$base" "$out"
probe cls node docs/checks/tools/f10-retry-cls.mjs "$base"
probe offscreen node docs/checks/tools/f10-offscreen.mjs "$base" 3
probe perf-size node docs/checks/tools/f10-perf-size.mjs "$base"
probe leaks node docs/checks/tools/f10-leaks.mjs "$base"
