#!/usr/bin/env bash
# F28a: start astro preview on 4321, run one probe script, always kill the server.
# Usage: bash docs/checks/tools/f28a-run.sh docs/checks/tools/f28a-probe.mjs [args]
set -u
cd "$(dirname "$0")/../../.."
if lsof -nP -iTCP:4321 -sTCP:LISTEN >/dev/null 2>&1; then echo "port 4321 busy"; exit 2; fi
npx astro preview --port 4321 >"${TMPDIR:-/tmp}/f28a-preview.log" 2>&1 &
PID=$!
cleanup() { kill "$PID" 2>/dev/null; sleep 1; pkill -f "astro preview --port 4321" 2>/dev/null; true; }
trap cleanup EXIT INT TERM
for i in $(seq 1 60); do curl -sf http://localhost:4321/ >/dev/null && break; sleep 0.5; done
node "$@"
RC=$?
exit $RC
