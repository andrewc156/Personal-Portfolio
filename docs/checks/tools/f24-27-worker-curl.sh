#!/usr/bin/env bash
# F24 checker: probe a running `wrangler dev --port 8788` (local only).
B=${1:-http://127.0.0.1:8788}
hdr() { echo; echo "=== $*"; }
hdr "GET /definitely-not-here (status, headers, body marker)"
curl -s -D - -o $TMPDIR/f24-404.html "$B/definitely-not-here" | tr -d '\r'
echo "body bytes: $(wc -c < $TMPDIR/f24-404.html)"; grep -o '<title>[^<]*</title>' $TMPDIR/f24-404.html; grep -c 'Page not found\|not found' $TMPDIR/f24-404.html
hdr "GET /nested/missing/page.html status"; curl -s -o /dev/null -w '%{http_code}\n' "$B/nested/missing/page.html"
hdr "HEAD /definitely-not-here"; curl -s -I "$B/definitely-not-here" | tr -d '\r' | grep -iE '^HTTP|content-security|cache-control|content-length'
ASSET=$(grep -o '/_astro/[^"]*\.js' dist/index.html | head -1)
hdr "GET $ASSET (cache-control count)"; curl -s -D - -o /dev/null "$B$ASSET" | tr -d '\r' | grep -iE '^HTTP|cache-control|content-security|x-content-type'
echo "cache-control header lines: $(curl -s -D - -o /dev/null "$B$ASSET" | grep -ic '^cache-control')"
hdr "GET /rising-water (no slash)"; curl -s -D - -o /dev/null "$B/rising-water?x=1" | tr -d '\r' | grep -iE '^HTTP|^location|content-security' | cut -c1-90
hdr "GET /data/colorado/meta.json headers"; curl -s -D - -o /dev/null "$B/data/colorado/meta.json" | tr -d '\r' | grep -iE '^HTTP|cache-control'
hdr "GET /og/social-card.png headers"; curl -s -D - -o /dev/null "$B/og/social-card.png" | tr -d '\r' | grep -iE '^HTTP|cache-control'
hdr "HEAD /"; curl -s -I "$B/" | tr -d '\r' | grep -iE '^HTTP|etag|content-length|content-security' | cut -c1-90
ET=$(curl -s -I "$B/" | tr -d '\r' | awk -F': ' 'tolower($1)=="etag"{print $2}')
hdr "If-None-Match $ET"; curl -s -D - -o $TMPDIR/f24-304.body -H "If-None-Match: $ET" "$B/" | tr -d '\r' | grep -iE '^HTTP|content-security|cache-control|x-frame' | cut -c1-90; echo "304 body bytes: $(wc -c < $TMPDIR/f24-304.body)"
ETA=$(curl -s -I "$B$ASSET" | tr -d '\r' | awk -F': ' 'tolower($1)=="etag"{print $2}')
hdr "If-None-Match on asset"; curl -s -D - -o /dev/null -H "If-None-Match: $ETA" "$B$ASSET" | tr -d '\r' | grep -iE '^HTTP|cache-control'
hdr "POST /"; curl -s -o /dev/null -w '%{http_code}\n' -X POST "$B/"
hdr "Host: www.andrewchincea.com /cv/?a=1"; curl -s -D - -o /dev/null -H 'Host: www.andrewchincea.com' "$B/cv/?a=1" | tr -d '\r' | grep -iE '^HTTP|^location|cache-control|content-security' | cut -c1-90
hdr "Host: andrewchincea.com (http) /garden/?type=paper"; curl -s -D - -o /dev/null -H 'Host: andrewchincea.com' "$B/garden/?type=paper" | tr -d '\r' | grep -iE '^HTTP|^location' 
hdr "Host: evil-andrewchincea.com"; curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: evil-andrewchincea.com' "$B/"
hdr "Host: sub.andrewchincea.com"; curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: sub.andrewchincea.com' "$B/"
hdr "CSP third-party origins on /"
curl -s -I "$B/" | tr -d '\r' | awk -F': ' 'tolower($1)=="content-security-policy"{print $2}' | tr ';' '\n' | grep -oE 'https?://[^ ]+|\*[^ ]*' | sort | uniq -c
