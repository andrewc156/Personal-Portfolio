# Questions for Andrew

## Profile and hosting
- [x] Domain and hosting confirmed. Andrew deployed `andrewchincea.com` on Cloudflare Workers.
- [ ] Set the Cloudflare build variable `SITE_URL=https://andrewchincea.com` and rebuild. The deployed canonical URL and sitemap currently use localhost.
- [ ] ORCID iD and photo, if you want them shown.
- [x] Footer credit removed at Andrew’s request.

## Research and work
- [ ] Confirm whether to list an advisor for spectral analysis on fractals.
- [ ] Fractal Laplacian poster: add a poster PDF or additional author credits?
- [ ] Should Rising water be tagged as RiverNets work or only as a personal project?
- [ ] Any teaching and outreach entries to show?

The supplied CV resolves the profile, education, research, presentation and project fields recorded in C1. Andrew requested that the site omit the phone number, references and downloadable CV. The PDF annotation supplies the OwlPath URL.

## Copy choices (first option used by default, marked unconfirmed)
- [ ] Tagline: **"Mathematics, statistics, and water."** / "Measuring the shape of water." / "Where topology meets water."
- [ ] Hero question: **"What can the shape of a landscape tell us about the water that moves through it?"** / "How do we measure the structure hidden in water data?"
- [ ] Mission paragraph (first-person rewrite, F19a)
- [ ] About bio (first-person rewrite, F19a)
- [ ] Open science sentence in `src/data/copy.yaml`.
- [ ] Contact lead-in in src/data/copy.yaml (contact), from DECISIONS #86. Draft: "I'm interested in mathematics and data science REUs and, later, PhD programs. If you'd like to talk about either, here's how to reach me." Keep the invitation, or only the first sentence?
- [ ] Is "My main research is on RiverNets" still accurate? (F19a mission)
- [ ] Hero caption (F19b, DECISIONS #87): 38 words. Keep it, or drop the barcode sentence?
- [ ] Hero relief in the light theme is now strong. Keep it, or soften it (render-map.ts:104)?
- [ ] F19a before→after table to approve: docs/builds/F19a/attempt-1.md
- [ ] Keep the current hero keywords after merging water quality and RiverNets?
- [ ] After confirming the tagline, regenerate the social card with `scripts/og-image.mjs`.
- [x] Basin mask (F12): keep WBD regions 14 + 15 exactly as the spec says (current build), or exclude HU-4 1508 "Sonora", whose 634 sub-watersheds drain to the ocean or closed basins in Mexico rather than to the Colorado (1,609 of 97,311 masked cells)? **Andrew, 2026-11-24: keep 14 + 15 as built.**
