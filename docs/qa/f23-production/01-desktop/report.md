# F23 production QA — 01 Desktop homepage and navigation

**Target:** `https://andrewchincea.com/` · **Date:** November 25, 2026 · **Release:** F23 (`20d59f9`, as verified in Step 30; not re-verified here)  
**Browser:** Headless Chrome 156.0.8078.80 · **Viewports:** 1024×900, 1280×900, 1440×900 CSS px · **Session:** `f23qa01`

## Executive summary

| Critical | High | Medium | Low | Total |
| ---: | ---: | ---: | ---: | ---: |
| 0 | 0 | 1 | 0 | 1 |

The homepage links and hash destinations worked. In Chromium, going Back twice from a research detail page returns the viewport to the top of the homepage but leaves keyboard focus on a link far below it. The next Tab takes the visitor back down to Research. The desktop header is not sticky; that is documented as an improvement opportunity, not a defect without a sticky-header requirement.

## Issue D01 — Back restores the homepage viewport but leaves focus offscreen

**Severity:** Medium · **Category:** Accessibility / keyboard navigation · **Browser:** Chrome 156, reproduced at all three tested desktop widths · **URLs:** `/`, `/#research`, `/research/water-quality/`

1. Open a fresh homepage at `https://andrewchincea.com/`.
2. Tab five times to **Research** in the header and press Enter. Wait for scrolling to settle.
3. Tab once to **Water-quality prediction on river networks**, then press Enter to open the article.
4. Use browser Back once. The homepage reopens at `/#research`, with focus visibly restored to the article link.
5. Use browser Back again. Observe the top of the homepage, then press Tab once.

**Expected:** When Back returns to `/` at the top, keyboard navigation resumes at a visible control in or near the restored header rather than re-entering the Research section.

**Actual:** The URL is `/` and `scrollY` is 0, but the article link still holds focus 1,907–1,995 CSS px below the viewport top. The next Tab focuses that card’s **Related work** link and scrolls to `scrollY` 1,622–1,714. The visitor sees the page jump from the hero back to Research without choosing Research again. URL and scroll history still work; the mismatch is in focus restoration. Browser-specific behavior is possible; other engines were not tested.

**Evidence:** [Top of homepage after second Back](screenshots/focus-after-history-back-1280.png) · [After the next Tab](screenshots/tab-after-history-back-1280.png) · [Recorded focus and scroll positions](observations.jsonl), entries `keyboard history Back to home`, `keyboard first Tab after Back to home`, and the `native history` repeats. Reproduced via Chrome’s CDP session history at 1280 px and via native `history.back()` at 1024 and 1440 px. No application exception coincided with the focus jump.

MEDIA:./screenshots/tab-after-history-back-1280.png

| ID | Severity | Category | Summary |
| --- | --- | --- | --- |
| D01 | Medium | Accessibility | Second Back restores the top of `/` but keeps focus on an offscreen Research link. |

## Tested and verified

| Flow | Viewport(s) | Result |
| --- | --- | --- |
| Homepage layout and scroll | 1024, 1280, 1440 | Full header visible with no horizontal overflow; hero and footer reachable. [1024](screenshots/home-1024.png) · [1280](screenshots/home-1280.png) · [1440](screenshots/home-1440.png) · [Footer](screenshots/footer-1024.png). |
| Header Mission, Work, Research, Open science | 1024, 1280, 1440 | Clicks set the correct hash and expose the intended heading. Mission, Work, and Research section edges land 16 px from the top; Open science reaches the maximum page scroll with its heading fully visible. [Research](screenshots/research-anchor-1280.png) · [Open science](screenshots/open-science-anchor-1024.png). |
| Direct home hashes and cross-page links back to home | 1280 | All four direct hash URLs landed correctly. Garden → Work, Rising water → Research, and CV → Open science landed correctly. Back returned to the previous route; the header wordmark returned to `/` at the top from all three routes and from About. |
| Browser history and scroll restoration | 1280; keyboard repeat at 1024 and 1440 | Home → Research → article → Back ×2 → Forward ×2 restored expected URLs and visible sections. Keyboard focus after the second Back is the exception (D01). |
| Keyboard entry and focus | 1280 | First Tab revealed **Skip to content**; Enter focused `main`, and the next Tab reached the animation selector. Header controls tabbed in visual order with visible focus. Enter on Research landed correctly; next Tab reached its first article. [Skip](screenshots/skip-focus-1280.png) · [Header focus](screenshots/header-research-focus-1280.png) · [Focus after Research](screenshots/after-research-first-tab-1280.png). |
| Header utility buttons | 1280 | Theme switch set light mode, survived reload, and was restored to dark. Art settings moved focus to its heading; Escape closed the panel and returned focus to its trigger. |
| Homepage local links | 1280 | Basin CTA, Recent work → Rising water, All work → Garden, all three Research detail links, all three Related work links, and footer About loaded expected routes. The three Garden query links selected the intended research filter (showed 2, 2, and 1 entries, respectively). |

## Console and resource notes

A load-time browser hook recorded a failed `SCRIPT` resource for `static.cloudflareinsights.com/beacon.min.js` on homepage and sampled internal routes. The initial collector labels all window `error` events `uncaught`; a typed repeat at 1024 px confirms this entry is a **resource load error**, not a JavaScript exception. No other application error, warning, or unhandled rejection was captured in the exercised homepage paths. Navigation and UI controls remained usable. The failure reason and reproducibility outside this browser environment were not established; track it separately from confirmed visitor-facing defects. Evidence: `typed browser console and load events` in [observations.jsonl](observations.jsonl).

## Optional improvement — keep section navigation within reach

The header is `position: static` and scrolls offscreen at all tested widths. After clicking Research or Open science, a visitor must scroll back to the top to pick another header destination; the footer has About and Source but no section links or Back to top control. Consider a compact sticky header or Back to top link. If making the header sticky, recheck heading and keyboard focus visibility at every hash. Evidence: [Research landing](screenshots/research-anchor-1280.png) and [homepage footer](screenshots/footer-1024.png).

## Not tested / limitations

- Chrome only: no Firefox, Safari, mobile, zoom, real screen reader, or formal accessibility conformance checks.
- Local route entry and return only: no deep Rising water explorer, full hero-animation settings matrix, Garden filter interactions beyond inbound links, CV download, or About content review.
- No external destinations or mail client opened, no broad scans, and no source edits or commit. All interactions were normal visitor actions against the production site.
- An initial background-tab run stalled smooth scrolling; it was discarded and the checks were rerun in a foreground tab. The evidence file contains foreground results; multi-hash history entries that followed a manual scroll back to the header reflect browser scroll restoration, not a separate defect.
