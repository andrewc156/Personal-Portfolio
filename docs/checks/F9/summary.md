# Portfolio final audit — F9 attempt 3

**Verdict: PASS_WITH_NOTES.** The full site passed static checks, all 125 production browser tests, all 8 Wrangler header tests, Lighthouse budgets, internal links, visual review, content and data checks, and hosting verification.

The checked portfolio includes the supplied CV content, the OwlPath link, a font layout-shift fix, and updated explorer behavior. The two attempt-2 test failures are resolved. Lighthouse median scores were 100 in every category on nine routes and 96/100/96/100 on /rising-water/. CLS was 0.0000 on all routes.

The only audit note is Lighthouse's image-aspect-ratio observation on /rising-water/, which does not breach the required score budgets. Evidence and 60 reviewed screenshots are in docs/checks/F9/attempt-3/.
