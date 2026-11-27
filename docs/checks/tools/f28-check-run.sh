#!/usr/bin/env bash
# F28 check: serve a dist/ with astro preview on 4321, run one probe, always kill the server.
# Usage: bash docs/checks/tools/f28-check-run.sh <project-dir> <probe.mjs> [args]
set -u
PROJ="$1"; shift
HERE="$(cd "$(dirname "$0")/../../.." && pwd)"
if lsof -nP -iTCP:4321 -sTCP:LISTEN >/dev/null 2>&1; then echo "port 4321 busy"; exit 2; fi
(cd "$PROJ" && exec npx astro preview --port 4321 --ignore-lock) >"${TMPDIR:-/tmp}/f28-check-preview.log" 2>&1 &
PID=$!
cleanup() { kill "$PID" 2>/dev/null; sleep 1; pkill -f "astro preview --port 4321" 2>/dev/null; true; }
trap cleanup EXIT INT TERM
for i in $(seq 1 80); do curl -sf http://localhost:4321/ >/dev/null && break; sleep 0.5; done
cd "$HERE" && node "$@"
