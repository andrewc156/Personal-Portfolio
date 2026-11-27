# Check report — Issue #13 preview cleanup — attempt 1

**Verdict** PASS

**Gates** check ✅ · lint ✅ · unit n/a · pytest n/a · build ✅ · e2e n/a · axe n/a · Lighthouse n/a · links ✅ · visual n/a · content n/a · TDA n/a · data n/a

## Acceptance criteria

- ✅ `npm run check` reported 0 errors, warnings, or hints across 170 files. `npm run lint` and `npm run build` passed. The build generated 10 HTML pages.
- ✅ `npm run links` and an immediate second run with `-- --verbosity info` both scanned 30 links and exited 0. An independent Node HTTP server bound to `localhost:4321` immediately after each run.
- ✅ `npm run links -- --status-code 200:error --verbosity none` forced Linkinator to fail on successful HTTP responses. The command exited 1 and the port could be rebound immediately.
- ✅ Running the script with `PATH=/usr/bin:/bin` and an absolute Node executable reproduced an `ENOENT` from spawning `npx`. The script exited 1 and the port could be rebound immediately.
- ✅ With port 4321 occupied by another preview, `npm run links` exited 1 and reported that the port was already in use. The original listening process was still present afterward.

**Notes** These checks used Astro 7.4.13 and Node 26.13.0 on macOS.

**Artifacts** Command results recorded above.
