#!/usr/bin/env bash
# F28b attempt-2 check: do the new/changed inert assertions discriminate? Copies the working
# tree to scratch (no node_modules/dist/docs; node_modules symlinked), reverts ONLY
# src/components/site/settings.ts to HEAD (pre-fix), builds, and runs the inert + F25 tests
# there on 4321. Expect the new inert tests and the 3 modified F25 assertions to FAIL.
# Also runs f28-check-a2-exit.mjs against the mutant (expect WebKit Tab-into-panel failures).
# Usage: bash docs/checks/tools/f28-check-a2-mutant.sh
set -u
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
M="${TMPDIR:-/tmp}/f28b-a2-mutant"
rm -rf "$M"; mkdir -p "$M"
rsync -a --exclude node_modules --exclude dist --exclude docs --exclude pipeline --exclude playwright-report --exclude test-results --exclude .git "$REPO/" "$M/"
ln -s "$REPO/node_modules" "$M/node_modules"
git -C "$REPO" show HEAD:src/components/site/settings.ts > "$M/src/components/site/settings.ts"
diff <(git -C "$REPO" show HEAD:src/components/site/settings.ts) "$REPO/src/components/site/settings.ts" | head -20
cd "$M" && npm run build >"$M/build.log" 2>&1; echo "mutant build exit $?"
if lsof -nP -iTCP:4321 -sTCP:LISTEN >/dev/null 2>&1; then echo "port 4321 busy"; exit 2; fi
cd "$M" && npx playwright test e2e/shell.spec.ts -g "inert|narrow sheet|remembered open drawer" --reporter=line 2>&1 | grep -E "✘|passed|failed|Error:|Expected|Received" | head -60
