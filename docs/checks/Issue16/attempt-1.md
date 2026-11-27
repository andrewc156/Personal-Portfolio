# Check report — Issue #16 Header icon alignment — attempt 1

**Verdict: PASS**

## Gates

| Gate | Result |
|---|---|
| Astro check and lint | PASS. 169 files checked with zero errors, warnings, or hints. |
| Unit tests | PASS. 913 tests across 37 files. |
| Static build | PASS. 10 HTML pages built at 20:32:51 EST, before the concurrent Issue #17 source and Playwright configuration edits. |
| Shell browser tests | PASS. All 61 Chromium tests passed, including both new alignment tests and the existing theme, navigation, and Settings tests. |
| axe | PASS. Zero serious or critical violations in either theme. |
| Mobile Lighthouse | PASS. Performance, accessibility, best practices, and SEO were all 100 on both `/` and `/404.html`. CLS was 0 on both. |
| Internal links | PASS. Linkinator checked 30 internal URLs against the built site. |
| Visual review | PASS. Reviewed six home header screenshots from 375×812, 768×1024, and 1280×800 viewports in both themes. Icons read clearly and align with each other at every width. The header navigation remained readable and fits its existing scrolling row on mobile. |

Python, data, TDA, explorer behavior, and canvas frame-time checks were outside the scope of this SVG change. The browser check used one Chromium and one WebKit release.

## Acceptance criteria

- The sun, moon, and gear use a 24-unit viewBox and 1.5-unit strokes. The outline geometry measures 19×19 units with its center at (12, 12) in Chromium 159 and WebKit 27.2.
- Independently measured the painted SVG pixels with 8× browser screenshots at 1280×800. In both browsers the visible theme icon and gear each measured 17.25×17.25 CSS px. Their ink bounds were centered on their buttons with zero measured x or y offset and a shared viewport y coordinate of 30 CSS px.
- Substituting the previous SVG markup from `4f2e99d` into the same DOM reproduced the mismatch. The old gear center was 0.8125 CSS px below its button center, and the old gear's painted height exceeded the sun's by 1.125 CSS px and the moon's by 4.125 CSS px.
- The new shell tests compare the visible theme icon and gear in both themes at 1280×800. They check painted width and height, both center offsets relative to the buttons, and the shared vertical center, with a tolerance of 1 CSS px.

Local evidence is under `docs/checks/Issue16/attempt-1/`, including the header PNGs, browser measurements, and the independent measurement script.
