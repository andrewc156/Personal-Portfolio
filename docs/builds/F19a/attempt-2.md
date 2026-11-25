# Build report — F19a First-person copy voice — attempt 2

Summary: Kept the first-person rewrite from attempt 1 and removed wording that went beyond the sources. About and Contact now say, “I'm interested in PhD programs and in mathematics and data science REUs.” The bio no longer adds a graduation date or orders the research areas by time, and the site copy no longer claims who built the explorer or made the code public.

Files changed:
- Recovery edits: `src/data/copy.yaml`, `src/content/work/project-personal-portfolio.yaml`, `src/pages/research/[slug].astro`, and `e2e/site.spec.ts`.
- Retained attempt-1 changes: the other eight `src/content/work/*.yaml` entries, three `src/content/research/*.yaml` entries, `src/components/content/{ResearchCard.astro,work.ts}`, `src/components/home/Contact.astro`, and `src/pages/{about,garden}/index.astro`.
- New: `docs/builds/F19a/attempt-2.md`.

How to verify:

```sh
npm run check -- --ignore-lock
npm test -- tests/unit/content tests/unit/url.test.ts
files=( e2e/site.spec.ts src/components/content/{ResearchCard.astro,work.ts} src/components/home/Contact.astro src/pages/{about,garden}/index.astro 'src/pages/research/[slug].astro' )
npm exec --offline -- eslint -- "${files[@]}"
npm exec --offline -- prettier --check -- "${files[@]}"
git diff --check -- "${files[@]}" src/data/copy.yaml src/content/{research,work}
# Checker only: npm run e2e -- e2e/site.spec.ts
```

Acceptance criteria (self-check):
- ✅ #85 voice: first-person where Andrew is speaking; short, factual project copy where the Garden and CV share text. The Personal portfolio description now works in the printed CV without referring to “the site you're reading.”
- ✅ #86 scope: About and Contact name only the two interests, with no order, dates, application claim, PhD field, or school. All four `copy.yaml` entries remain `confirmed: false`. A direct YAML assertion failed before the wording change and passed afterward; both matching browser assertions are in `e2e/site.spec.ts`.
- ✅ F2 content invariants: parsed YAML comparison against `HEAD` confirmed all 12 edited entries retain every non-prose field, including citation fields and publication flags; all capped descriptions and summaries are at most 160 characters. Profile, hero question, tagline, and CV bullets were not edited.
- ✅ F2 navigation and accessibility by source review: Garden filters and sort logic are unchanged. Research cards keep the same tag-filter URLs; the accessible names start with the visible label “Related work.” Contact still renders only when links exist.
- ✅ Builder checks: Astro reported zero errors, warnings, or hints; all 19 scoped unit tests passed; scoped ESLint, Prettier, and `git diff --check` passed.

Needs Andrew: Approve the draft copy, including whether to keep the second Contact sentence: “If you'd like to talk about either, here's how to reach me.”

Requests to Control: In `docs/QUESTIONS.md` under “Copy choices,” replace the Contact lead-in draft with “I'm interested in PhD programs and in mathematics and data science REUs. If you'd like to talk about either, here's how to reach me.” Keep the existing invitation question. Leave untracked `docs/builds/F19a/.Rhistory` out of staging.

Known limitations: Production draft visibility, rendered accessibility, browser tests, and performance budgets are pending the fresh checker run. No build, preview, e2e, or Lighthouse was run; port 4321 was not used.
