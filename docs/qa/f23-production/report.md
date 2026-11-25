# Production portfolio QA — F23

**Target:** `andrewchincea.com` · **Build:** `20d59f9` · **Audit date:** November 25, 2026 · **Method:** 10 parallel, read-only exploratory reviews with browser and HTTP evidence. No application or production configuration changes were made.

## Executive summary

**18 distinct findings: 0 Critical, 1 High, 11 Medium, 6 Low.** The audit verified the deployed Collatz change: playback starts at step 1, the Settings slider defaults and resets to 30, its range is 1–120, and depths over 50 are labeled sampled. The most urgent issue is public metadata that advertises `localhost`; next are the missing branded 404 and several keyboard, touch, and motion-control problems. The core navigation, CV, research content, hero modes, and explorer worked in the sampled browser flows.

## What needs to be fixed

| ID | Severity | Area | Reproduction, impact, and recommended fix | Evidence |
| --- | --- | --- | --- | --- |
| QA-01 | High | SEO / delivery | View source on `/` or a research page, then open `/robots.txt` and `/sitemap-index.xml`. Canonical, social, and sitemap URLs advertise `http://localhost:4321`; all nine sampled public pages are affected. Trace the active Cloudflare build and the deployed `dist`; verify the production origin reaches Astro at build time and add a post-deploy smoke check. This is evidence about deployed output, **not** evidence that Andrew omitted the setting. | [Delivery](10-delivery/report.md#10-01--public-metadata-and-sitemap-advertise-localhost--high), [content](08-content/report.md), [utility](09-utility-pages/report.md) |
| QA-02 | Medium | Delivery / 404 | Visit a genuinely unknown path. The server returns `404` with an empty body, not the site's branded recovery page. Serve the existing recovery document while preserving the `404` status. | [Delivery](10-delivery/report.md#10-03--unknown-url-skips-the-sites-custom-404--medium), [utility](09-utility-pages/report.md) |
| QA-03 | Medium | Settings / keyboard | Open the narrow-screen Settings sheet and Tab past its edge. Focus moves to page controls hidden behind the sheet. Keep focus in the sheet while open, make the obscured background inert, and return focus to the opener on dismissal. | [Settings](05-settings/report.md#05-01--mobile-keyboard-focus-moves-behind-the-open-drawer), [accessibility](07-accessibility/report.md) |
| QA-04 | Medium | Settings / motion | While an animation is playing, enable system reduced motion. Playback continues. React to preference changes and pause existing playback; keep explicit Play available. | [Settings](05-settings/report.md#05-02--enabling-system-reduced-motion-does-not-stop-existing-autoplay) |
| QA-05 | Medium | Settings / playback | Pause the hero, then switch animation modes. The replacement mode can autoplay. Preserve a user-initiated pause across switches; do not confuse an animation reaching its end with a manual pause. | [Settings](05-settings/report.md#05-03--a-mode-change-can-resume-a-manually-paused-animation) |
| QA-06 | Medium | Explorer / focus | In `/rising-water/`, keyboard-activate **Show** from the lakes table. The view scrolls to the map but focus stays in the table, so the next Tab jumps back. Move focus to the selected lake detail or another meaningful map target. | [Explorer](06-explorer/report.md#rw-02--show-scrolls-to-map-but-leaves-keyboard-focus-in-table), [accessibility](07-accessibility/report.md) |
| QA-07 | Medium | Explorer / touch | On a touch viewport, tap a cell on the map and release. Its elevation and coordinates disappear on release. Keep the last inspection visible until another cell is tapped or the selection is dismissed. | [Explorer](06-explorer/report.md#rw-01--cell-readout-disappears-on-tap-release) |
| QA-08 | Medium | Explorer / keyboard | Focus the explorer map and try to inspect an arbitrary cell without a pointer. The per-cell elevation and coordinates have no keyboard equivalent. Offer keyboard cell movement or an equivalent inspection control with an accessible readout. | [Accessibility](07-accessibility/report.md#07-03--no-keyboard-equivalent-for-inspecting-an-arbitrary-map-cell) |
| QA-09 | Medium | Home Rising water / accessible status | Play the home Rising water animation or select a lake/island bar with the keyboard. The accessible summary can stay at 0 m and does not announce the selection. Update status at useful milestones and on explicit selections, without announcing every frame. | [Home Rising water](03-home-water/report.md#03-01--live-summary-does-not-follow-playback-or-announce-the-selected-bar) |
| QA-10 | Medium | Explorer / no JavaScript | Disable JavaScript and open `/rising-water/`. The explorer remains in a loading state, even though reference content is available. Show a plain-language fallback and point to the static data/table. | [Accessibility](07-accessibility/report.md#07-04--explorer-shows-endless-loading-with-javascript-disabled) |
| QA-11 | Medium | Home / navigation focus | From the homepage, follow Research, open a research article, then go Back twice. At all three tested desktop widths the viewport returns to the top but focus remains on an offscreen Research link; Tab jumps down. Restore scroll and focus together or move focus to an appropriate visible target. | [Desktop](01-desktop/report.md#issue-d01--back-restores-the-homepage-viewport-but-leaves-focus-offscreen) |
| QA-12 | Medium | Delivery / redirects | Request `http://andrewchincea.com/` or `https://www.andrewchincea.com/`. Both serve `200` instead of redirecting. Normalize to HTTPS apex with a permanent redirect that preserves the path and query. | [Delivery](10-delivery/report.md#10-02--host-and-scheme-are-not-normalized--medium) |
| QA-13 | Low | Mobile / layout | At 320 CSS px, the closed home mode selector cuts off “Rising water”; it fits at 375 px. Give the selector room to fit the full label or let the toolbar wrap. | [Mobile](02-mobile/report.md#mob-01--home-animation-selector-clips-rising-water-at-320-px) |
| QA-14 | Low | Home Rising water / chart | Hover or tap visibly blank chart space; the interaction can select a distant bar. Limit hit-testing to the rendered bar plus a small tolerance or clear the selection in empty space. | [Home Rising water](03-home-water/report.md#03-02--blank-chart-space-can-select-a-distant-bar) |
| QA-15 | Low | Hero / reproducibility | Enter with `?mode=collatz&seed=123456`, then change modes or let a new seed generate. The address bar still describes the starting state. Either synchronize the URL without adding history entries or provide a **Copy current animation link** action. | [Alternate animations](04-alt-animations/report.md#04-01--the-address-bar-can-describe-a-different-animation-or-seed) |
| QA-16 | Low | No JavaScript / inactive controls | Disable JavaScript and Tab through the homepage. Visible JS-only controls can receive focus but do nothing. Render them disabled or hidden until initialized, with a clear fallback where appropriate. | [Accessibility](07-accessibility/report.md#07-05--inert-buttons-remain-in-the-no-js-tab-order) |
| QA-17 | Low | Garden / filter state | Open Garden with a Type deep link for `preprint`, `software`, or `dataset`. It shows zero results with no active Type chip. Display the active filter and a clear action, or consistently reject unsupported types. | [Content](08-content/report.md#08-02--an-unlisted-type-query-can-hide-every-result-without-showing-the-active-filter) |
| QA-18 | Low | Delivery / console | Load a sampled production page in Chromium with console capture. The supplied Cloudflare Insights script is blocked by Content Security Policy; no visitor-facing breakage was observed. If analytics are unintended, remove the injection rather than weakening CSP. If analytics are intentional, reconcile it with the site's privacy requirement before changing policy. | [Delivery](10-delivery/report.md#10-04--delivered-analytics-script-is-blocked--low) |

## Recommended fix order

1. **Production delivery:** Fix the deployed origin, redirects, and branded 404 together. Add production checks for canonical/OG URLs, robots/sitemap targets, alias redirects, and a branded body with HTTP 404. The user confirmed the Site URL was already set; investigate which settings and artifacts the active build actually used before changing configuration.
2. **Keyboard, touch, and motion:** Fix focus containment and return, preserve manual pause, respond to system motion changes, and make the explorer's cell readout usable without a mouse. Add focused browser regressions for all these flows.
3. **Fallbacks and small UI defects:** Address misleading no-JS controls/loading, the narrow selector, chart hit-testing, and Garden deep links. Resolve the analytics injection separately from the visual work.

## Optional improvements (not counted as bugs)

- Give long pages a compact **Back to top** link or persistent section navigation. Make the horizontal mobile nav and lakes table visibly scrollable, and keep lake names in view beside **Show** when possible.
- Use **Replay** at the end of a run, name regeneration actions for their mode, and consider a **Hold at end** option for Rivers and Collatz. An explicit **No islands have formed at this level** message would make the empty chart easier to understand.
- Add direct **All research areas** navigation and consider a print/download action on the CV if offline access is important. Confirm future-event wording with Andrew before changing it.
- Clarify what Settings remembers on reload and what Reset leaves alone. Consider shareable presets, and add throttled performance and explorer-readiness measurements before drawing broad conclusions about speed.

## Coverage and limits

| Review | Scope |
| --- | --- |
| [01 Desktop](01-desktop/report.md) | Homepage layout and hash navigation, history, focus, 1024/1280/1440 px |
| [02 Mobile](02-mobile/report.md) | Touch and responsive navigation; representative pages down to 320 px |
| [03 Home Rising water](03-home-water/report.md) | Play/replay, seed, sliders, lakes/islands, chart-to-map interactions |
| [04 Alternate hero modes](04-alt-animations/report.md) | Dye spill, Fractal pond, Random rivers, Collatz, direct links and bounds |
| [05 Settings](05-settings/report.md) | Both openers, focus, dismiss, reset, mode transitions, motion and persistence |
| [06 Explorer](06-explorer/report.md) | Maps, tables, overlays, barcode/diagram; live computation matched 600 reference bars |
| [07 Accessibility](07-accessibility/report.md) | Keyboard/focus, axe, reduced motion, accessibility tree and no-JS |
| [08 Content](08-content/report.md) | Garden filters, topic links, Research/About, citations |
| [09 Utility pages](09-utility-pages/report.md) | CV and print, contact links, Open Science, footer, favicon, 404 |
| [10 Delivery](10-delivery/report.md) | HTTP responses, redirects, canonical/social URLs, sitemap, assets and performance spot checks |

This was exploratory QA of the live site, not a full cross-browser certification or a real screen-reader audit. Mobile testing was emulated; physical iOS, a full browser-version matrix, and field performance were not verified. Local browser timings from one unthrottled session are not field-performance baselines. External login walls were not counted as broken links. Duplicate reports of metadata, 404, sheet focus, and table-to-map focus were combined. Control independently rechecked the production robots response, empty 404, and both noncanonical origins.
