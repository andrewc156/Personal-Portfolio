#!/bin/sh
set -u
out=docs/checks/F14/attempt-1
base=http://localhost:4321
node_modules/.bin/wrangler pages dev dist --port 4321 > "$out/wrangler.log" 2>&1 &
server=$!
trap 'kill "$server" 2>/dev/null || true; wait "$server" 2>/dev/null || true' EXIT INT TERM
for step in $(seq 1 60); do
  if curl --silent --fail "$base/" > /dev/null; then break; fi
  sleep 0.5
done
if ! kill -0 "$server" 2>/dev/null; then exit 1; fi
HEADERS_BASE_URL="$base" npx playwright test e2e/headers.spec.ts --reporter=list --output="$out/wrangler-playwright" > "$out/headers.log" 2>&1
echo "headers $?"
node docs/checks/tools/f14-browser.mjs "$base" --csp > "$out/csp.log" 2>&1
echo "toolbar CSP $?"
