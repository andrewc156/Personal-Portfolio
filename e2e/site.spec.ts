import { test, expect, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

/**
 * F2 content and pages: Garden filters and deep links, no-JS fallback, keyboard,
 * research pages and thumbnails, citations, CV, About, drafts hidden in the
 * production build, and the forbidden-words grep over dist/.
 * Runs against `astro preview` of the production build (playwright.config.ts).
 */

interface WorkYaml {
  type: string;
  title?: string;
  date?: string;
  end?: string;
  ongoing?: boolean;
  status?: string;
  venue?: string;
  authors: string[];
  links?: Record<string, string>;
  tags?: string[];
  draft: boolean;
}

const ROOT = process.cwd();
const WORK_DIR = join(ROOT, 'src/content/work');
const RESEARCH_DIR = join(ROOT, 'src/content/research');

function readYamlDir<T>(dir: string): { id: string; data: T }[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => ({
      id: f.replace(/\.yaml$/, ''),
      data: parse(readFileSync(join(dir, f), 'utf8')) as T,
    }));
}

const ALL_WORK = readYamlDir<WorkYaml>(WORK_DIR);
const PUBLIC_WORK = ALL_WORK.filter((w) => !w.data.draft);
const DRAFT_WORK = ALL_WORK.filter((w) => w.data.draft);
const AREAS = readYamlDir<{ title: string; order: number; advisor?: string }>(RESEARCH_DIR).sort(
  (a, b) => a.data.order - b.data.order,
);
const PROFILE = parse(readFileSync(join(ROOT, 'src/data/profile.yaml'), 'utf8')) as {
  cv_pdf?: string;
  contact: { email: string; github: string; linkedin: string; orcid?: string };
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON = `(${MONTHS.join('|')}) \\d{4}`;
const MON_YYYY = new RegExp(`^${MON}$`);
/** "Mon YYYY", "Mon YYYY – Mon YYYY" or "Mon YYYY – Present". */
const DATE_TEXT = new RegExp(`^${MON}( – (${MON}|Present))?$`);
const FORBIDDEN = /TODO|TBD|lorem|placeholder/i;
/** Detect North American phone numbers without embedding private contact data. */
const PHONE =
  /(?<![\d,])(?:\+?1[ .-]?)?(?:\([2-9]\d{2}\)|[2-9]\d{2})[ .-]?[2-9]\d{2}[ .-]?\d{4}(?!\d)/;

/**
 * Titles and descriptions mark inline math as `$k$` and superscript as `^th^`; the page
 * shows the bare letters (in <i> and <sup>).
 */
const plain = (s = '') => s.replace(/\$([^$\n]+)\$|\^([^^\s]+)\^/g, (_m, a, b) => a ?? b);

/** Expected display text of an item's date (or status) in Garden rows and citations. */
function dateText(w: WorkYaml): string {
  if (w.status === 'submitted') return 'Submitted';
  if (!w.date) return '';
  const fmt = (d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
  if (w.ongoing) return `${fmt(w.date)} – Present`;
  if (w.end && w.end.slice(0, 7) !== w.date.slice(0, 7)) return `${fmt(w.date)} – ${fmt(w.end)}`;
  return fmt(w.date);
}
const PAGES = [
  '/',
  '/garden/',
  '/research/',
  ...AREAS.map((a) => `/research/${a.id}/`),
  '/cv/',
  '/about/',
];
/** Every page, for the site-wide phone and References checks. */
const ALL_PAGES = [...PAGES, '/rising-water/', '/this-page-does-not-exist/'];

async function expectNoSeriousAxe(page: Page, label: string): Promise<void> {
  // Let entry transitions finish before scanning.
  await page.evaluate(async () => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)));
  });
  const results = await new AxeBuilder({ page }).analyze();
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(
    bad.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target).join(', ')}`),
  ).toEqual([]);
}

/** Email (mailto), GitHub and LinkedIn from profile.yaml; no ORCID and no phone link. */
async function expectContactLinks(scope: Locator): Promise<void> {
  const c = PROFILE.contact;
  await expect(scope.getByRole('link', { name: c.email, exact: true })).toHaveAttribute(
    'href',
    `mailto:${c.email}`,
  );
  for (const url of [c.github, c.linkedin]) {
    await expect(scope.locator(`a[href="${url}"]`)).toHaveCount(1);
    await expect(scope.locator(`a[href="${url}"]`)).toBeVisible();
  }
  await expect(scope.locator('a[href^="tel:"]')).toHaveCount(0);
  await expect(scope.locator('a')).toHaveCount(3);
}

function visibleRows(page: Page) {
  return page.locator('[data-work-row]:visible');
}

test.describe('content files', () => {
  test('the confirmed work items exist exactly once and drafts have empty [A] fields', () => {
    expect(ALL_WORK).toHaveLength(9);
    const byType = ALL_WORK.reduce<Record<string, number>>((acc, w) => {
      acc[w.data.type] = (acc[w.data.type] ?? 0) + 1;
      return acc;
    }, {});
    expect(byType).toEqual({ paper: 1, poster: 2, talk: 1, project: 5 });
    expect(DRAFT_WORK).toHaveLength(0);
    for (const w of ALL_WORK) {
      if (!w.data.draft) {
        expect(w.data.title, w.id).toBeTruthy();
        // A submitted paper is the only dated type allowed to have no date.
        const submittedPaper = w.data.type === 'paper' && w.data.status === 'submitted';
        if (['paper', 'preprint', 'poster', 'talk'].includes(w.data.type) && !submittedPaper)
          expect(w.data.date, w.id).toBeTruthy();
      }
    }
    // The CV lists exactly one manuscript (submitted) and no second number-theory paper.
    const papers = ALL_WORK.filter((w) => ['paper', 'preprint'].includes(w.data.type));
    expect(papers.map((w) => w.data.status)).toEqual(['submitted']);
    expect(papers[0].data.authors).toEqual(['Tsz Ho Chan', 'Andrew Chincea']);
    // Items whose title Andrew still has to supply are drafts with an empty title.
    for (const w of ALL_WORK.filter((x) => !x.data.title)) expect(w.data.draft, w.id).toBe(true);
  });

  test('three research areas (water quality and RiverNets merged, DECISIONS #68)', () => {
    expect(AREAS.map((a) => a.id)).toEqual(['water-quality', 'number-theory', 'spectral-fractals']);
    const rising = ALL_WORK.find((w) => w.id === 'project-rising-water');
    expect(rising?.data.tags).toEqual(['water-quality']);
  });
});

test.describe('garden', () => {
  test('lists every published item once, with rows per §4.1', async ({ page }) => {
    await page.goto('/garden/');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Garden', exact: true }),
    ).toBeVisible();
    // First-person lede; the one submitted paper has no date and is listed first.
    await expect(page.locator('.garden__lede')).toHaveText(
      "Here's some of my work. Submitted work has no date yet, so it comes first. The rest is newest first.",
    );
    const rows = page.locator('[data-work-row]');
    await expect(rows).toHaveCount(PUBLIC_WORK.length);
    const ids = await rows.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.id));
    expect([...ids].sort()).toEqual(PUBLIC_WORK.map((w) => w.id).sort());

    for (const w of PUBLIC_WORK) {
      const row = page.locator(`[data-work-row][data-id="${w.id}"]`);
      await expect(row.locator('.work-row__type')).toBeVisible();
      await expect(row.locator('.work-row__title')).toHaveText(plain(w.data.title));
      const typeFont = await row
        .locator('.work-row__type')
        .evaluate((e) => getComputedStyle(e).fontFamily);
      expect(typeFont).toMatch(/Plex Mono|monospace/);
      const expected = dateText(w.data);
      if (expected) await expect(row.locator('.work-row__date')).toHaveText(expected);
      else await expect(row.locator('.work-row__date')).toHaveCount(0);
      if (w.data.status) await expect(row.locator('time')).toHaveCount(0);
      for (const t of await row.locator('time').all()) await expect(t).toHaveText(MON_YYYY);
      // Order inside the row: type tag → title → description → date.
      const order = await row.evaluate((el) =>
        ['.work-row__type', '.work-row__title', '.work-row__desc', '.work-row__date']
          .map((s) => el.querySelector(s))
          .filter((n): n is Element => n !== null)
          .map((n) => Array.from(el.querySelectorAll('*')).indexOf(n)),
      );
      expect(order).toEqual([...order].sort((a, b) => a - b));
    }
  });

  test('type chips filter and update ?type=', async ({ page }) => {
    await page.goto('/garden/');
    const types = [...new Set(PUBLIC_WORK.map((w) => w.data.type))];
    for (const t of types) {
      const chip = page.locator(`a[data-filter="type"][data-value="${t}"]`);
      await chip.click();
      await expect(page).toHaveURL(new RegExp(`[?&]type=${t}(&|$)`));
      await expect(chip).toHaveAttribute('aria-current', 'true');
      await expect(visibleRows(page)).toHaveCount(
        PUBLIC_WORK.filter((w) => w.data.type === t).length,
      );
    }
    await page.locator('a[data-filter="type"][data-value=""]').click();
    await expect(visibleRows(page)).toHaveCount(PUBLIC_WORK.length);
    await expect(page).toHaveURL(/\/garden\/$/);
  });

  test('area chips filter and update ?tag=, combined with type', async ({ page }) => {
    await page.goto('/garden/');
    for (const a of AREAS) {
      await page.locator(`a[data-filter="tag"][data-value="${a.id}"]`).click();
      await expect(page).toHaveURL(new RegExp(`[?&]tag=${a.id}(&|$)`));
      const expected = PUBLIC_WORK.filter((w) => (w.data.tags ?? []).includes(a.id)).length;
      await expect(visibleRows(page)).toHaveCount(expected);
      await expect(page.locator('[data-garden-empty]')).toBeVisible({ visible: expected === 0 });
    }
  });

  test('deep links ?type= and ?tag= open filtered, and back/forward restores', async ({ page }) => {
    const t = PUBLIC_WORK[0].data.type;
    await page.goto(`/garden/?type=${t}`);
    await expect(visibleRows(page)).toHaveCount(
      PUBLIC_WORK.filter((w) => w.data.type === t).length,
    );
    await expect(page.locator(`a[data-filter="type"][data-value="${t}"]`)).toHaveAttribute(
      'aria-current',
      'true',
    );

    for (const a of AREAS) {
      await page.goto(`/garden/?tag=${a.id}`);
      const expected = PUBLIC_WORK.filter((w) => (w.data.tags ?? []).includes(a.id)).length;
      await expect(visibleRows(page)).toHaveCount(expected);
      await expect(page.locator(`a[data-filter="tag"][data-value="${a.id}"]`)).toHaveAttribute(
        'aria-current',
        'true',
      );
    }

    await page.goto('/garden/');
    await page.locator(`a[data-filter="type"][data-value="${t}"]`).click();
    await expect(page).toHaveURL(/type=/);
    await page.goBack();
    await expect(page).toHaveURL(/\/garden\/$/);
    await expect(visibleRows(page)).toHaveCount(PUBLIC_WORK.length);
  });

  test('unknown filter values are ignored', async ({ page }) => {
    await page.goto('/garden/?type=nonsense&tag=nope');
    await expect(visibleRows(page)).toHaveCount(PUBLIC_WORK.length);
  });

  // QA-17: known types with nothing listed (e.g. preprint, software, dataset today).
  test('deep link to an unlisted type shows its active chip, a clear action and a plain empty state', async ({
    page,
  }) => {
    const KNOWN = ['preprint', 'paper', 'poster', 'talk', 'project', 'software', 'dataset'];
    const listed = new Set(PUBLIC_WORK.map((w) => w.data.type));
    const unlisted = KNOWN.filter((t) => !listed.has(t));
    test.skip(unlisted.length === 0, 'every known type has listed work');
    for (const t of unlisted) {
      await page.goto(`/garden/?type=${t}`);
      const chip = page.locator(`a[data-filter="type"][data-value="${t}"]`);
      await expect(chip).toBeVisible();
      await expect(chip).toHaveAttribute('aria-current', 'true');
      await expect(page.locator('a[data-filter="type"][data-value=""]')).not.toHaveAttribute(
        'aria-current',
        'true',
      );
      await expect(visibleRows(page)).toHaveCount(0);
      const empty = page.locator('[data-garden-empty]');
      await expect(empty).toBeVisible();
      await expect(empty).toContainText(/Nothing is listed under .+ yet\./);
      await expect(page.locator('[data-garden-status]')).toHaveText(
        `Showing 0 of ${PUBLIC_WORK.length} items`,
      );
    }
    // The clear action drops the type, keeps the area, and hides the unlisted chip.
    const t = unlisted[0];
    await page.goto(`/garden/?type=${t}&tag=${AREAS[0].id}`);
    const clear = page.locator('a[data-garden-clear="type"]:visible');
    await expect(clear).toHaveCount(1);
    await clear.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/garden/\\?tag=${AREAS[0].id}$`));
    await expect(page.locator(`a[data-filter="type"][data-value="${t}"]`)).toBeHidden();
    await expect(page.locator('a[data-filter="type"][data-value=""]')).toBeFocused();
    const expected = PUBLIC_WORK.filter((w) => (w.data.tags ?? []).includes(AREAS[0].id)).length;
    await expect(visibleRows(page)).toHaveCount(expected);
    // Back returns to the unlisted filter with its chip active again.
    await page.goBack();
    await expect(page.locator(`a[data-filter="type"][data-value="${t}"]`)).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  test('ignored filter values are dropped from the address bar', async ({ page }) => {
    await page.goto(`/garden/?type=nonsense&tag=${AREAS[0].id}`);
    await expect(page).toHaveURL(new RegExp(`/garden/\\?tag=${AREAS[0].id}$`));
    await page.goto('/garden/?type=nonsense&tag=nope');
    await expect(page).toHaveURL(/\/garden\/$/);
    await expect(visibleRows(page)).toHaveCount(PUBLIC_WORK.length);
  });

  test('works without JavaScript: every item is shown, even with a filter in the URL', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(`/garden/?type=${PUBLIC_WORK[0].data.type}&tag=water-quality`);
    await expect(visibleRows(page)).toHaveCount(PUBLIC_WORK.length);
    await expect(page.locator('[data-garden-empty]')).toBeHidden();
    // Chromium still parses <noscript> as raw text when JS is disabled through Playwright,
    // so check the note is in the markup rather than that it is rendered.
    expect(await page.locator('noscript').first().innerHTML()).toContain(
      'Filtering needs JavaScript',
    );
    await ctx.close();
  });

  test('keyboard operable: Tab to a chip, Enter filters, focus stays on the chip', async ({
    page,
  }) => {
    await page.goto('/garden/');
    const t = PUBLIC_WORK[0].data.type;
    const chip = page.locator(`a[data-filter="type"][data-value="${t}"]`);
    let reached = false;
    for (let i = 0; i < 40 && !reached; i++) {
      await page.keyboard.press('Tab');
      reached = await chip.evaluate((el) => el === document.activeElement);
    }
    expect(reached).toBe(true);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`type=${t}`));
    await expect(chip).toBeFocused();
    await expect(visibleRows(page)).toHaveCount(
      PUBLIC_WORK.filter((w) => w.data.type === t).length,
    );
    // Focus ring is visible on the focused chip.
    const outline = await chip.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');
  });
  test('filtering is instant: rows change in the same task, nothing animates (F28)', async ({
    page,
  }) => {
    await page.goto('/garden/');
    const r = await page.evaluate(() => {
      const rows = () =>
        Array.from(document.querySelectorAll<HTMLElement>('.garden-list > li')).filter(
          (li) => !li.hidden,
        ).length;
      const before = rows();
      // A visible type/topic chip that isn't active and isn't an "All …" chip.
      const chip = Array.from(document.querySelectorAll<HTMLAnchorElement>('a.chip')).find(
        (c) =>
          c.getAttribute('aria-current') !== 'true' &&
          c.getClientRects().length > 0 &&
          !/all/i.test(c.textContent ?? ''),
      )!;
      chip.click();
      const after = rows(); // same task: no waiting for an animation
      const list = document.querySelector('.garden-list')!;
      const anims = list.getAnimations({ subtree: true }).length;
      return { before, after, anims };
    });
    expect(r.after).not.toBe(r.before);
    expect(r.anims).toBe(0);
  });
});

test.describe('research', () => {
  test('home cards: linked heading, one-liner, Related work → /garden/?tag=<slug>, SVG thumbnail', async ({
    page,
  }) => {
    await page.goto('/');
    const cards = page.locator('#research [data-research-card]');
    await expect(cards).toHaveCount(AREAS.length);
    for (const a of AREAS) {
      const card = page.locator(`#research [data-research-card="${a.id}"]`);
      await expect(card.getByRole('link', { name: a.data.title, exact: true })).toHaveAttribute(
        'href',
        `/research/${a.id}/`,
      );
      await expect(card.locator('.research-card__summary')).not.toBeEmpty();
      const related = card.getByRole('link', { name: /^Related work/ });
      await expect(related).toHaveAttribute('href', `/garden/?tag=${a.id}`);
      // Visible text is "Related work →"; the accessible name adds the area after a colon.
      await expect(related).toHaveAccessibleName(`Related work: ${a.data.title}`);
      const illustration = card.locator(`svg[data-thumb="${a.id}"]`);
      await expect(illustration).toHaveAttribute('aria-hidden', 'true');
      await expect(illustration).toHaveAttribute('focusable', 'false');
      await expect(illustration.locator('text')).toHaveText('Illustration');
    }
    await expect(page.locator('#research img')).toHaveCount(0);
  });

  test('Related work link filters the Garden', async ({ page }) => {
    const a =
      AREAS.find((x) => PUBLIC_WORK.some((w) => (w.data.tags ?? []).includes(x.id))) ?? AREAS[0];
    await page.goto('/');
    await page
      .locator(`#research [data-research-card="${a.id}"]`)
      .getByRole('link', { name: /^Related work/ })
      .click();
    await expect(page).toHaveURL(new RegExp(`/garden/\\?tag=${a.id}$`));
    await expect(visibleRows(page)).toHaveCount(
      PUBLIC_WORK.filter((w) => (w.data.tags ?? []).includes(a.id)).length,
    );
  });

  test('thumbnails are deterministic per slug and distinct between slugs', async ({ page }) => {
    await page.goto('/');
    const home: Record<string, string> = {};
    for (const a of AREAS)
      home[a.id] = await page.locator(`#research svg[data-thumb="${a.id}"]`).innerHTML();
    expect(new Set(Object.values(home)).size).toBe(AREAS.length);
    for (const a of AREAS) {
      await page.goto(`/research/${a.id}/`);
      expect(await page.locator(`svg[data-thumb="${a.id}"]`).innerHTML()).toBe(home[a.id]);
    }
  });

  test('topic pages name the advisor only when the CV gives one', async ({ page }) => {
    for (const a of AREAS) {
      await page.goto(`/research/${a.id}/`);
      const advisor = page.locator('[data-advisor]');
      if (a.data.advisor) await expect(advisor).toHaveText(a.data.advisor);
      else await expect(advisor).toHaveCount(0);
    }
    expect(AREAS.filter((a) => a.data.advisor).map((a) => a.id)).toEqual([
      'water-quality',
      'number-theory',
    ]);
  });

  test('topic pages have description, related work, and no empty Methods section', async ({
    page,
  }) => {
    for (const a of AREAS) {
      await page.goto(`/research/${a.id}/`);
      await expect(
        page.getByRole('heading', { level: 1, name: a.data.title, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { level: 2, name: 'About', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { level: 2, name: 'Related work', exact: true }),
      ).toBeVisible();
      const methods = page.getByRole('heading', { level: 2, name: 'Methods', exact: true });
      if ((await methods.count()) > 0)
        await expect(page.locator('section:has(#topic-methods) li').first()).toBeVisible();
      const tagged = PUBLIC_WORK.filter((w) => (w.data.tags ?? []).includes(a.id));
      await expect(page.locator('[data-citation]')).toHaveCount(tagged.length);
      await expect(
        page.getByRole('link', { name: 'See this area in the Garden', exact: false }),
      ).toHaveAttribute('href', `/garden/?tag=${a.id}`);
    }
  });

  test('the water-quality (RiverNets) page links to /rising-water/', async ({ page }) => {
    await page.goto('/research/water-quality/');
    await expect(page.locator('[data-rising-water-link] a[href="/rising-water/"]')).toBeVisible();
  });
});

test.describe('citations', () => {
  test('Andrew in bold, Mon YYYY dates, venue italic, buttons only for existing links', async ({
    page,
  }) => {
    for (const path of ['/', '/cv/', ...AREAS.map((a) => `/research/${a.id}/`)]) {
      await page.goto(path);
      const cites = page.locator('[data-citation]');
      const n = await cites.count();
      for (let i = 0; i < n; i++) {
        const c = cites.nth(i);
        const id = await c.getAttribute('data-id');
        const w = ALL_WORK.find((x) => x.id === id);
        expect(w, `${path}: citation ${id} is a known item`).toBeDefined();
        if (!w) continue;
        await expect(
          c.locator('strong').filter({ hasText: /^Andrew( Dumitru)? Chincea$/ }),
        ).toHaveCount(1);
        const weight = await c
          .locator('strong')
          .first()
          .evaluate((e) => Number(getComputedStyle(e).fontWeight));
        expect(weight).toBeGreaterThanOrEqual(600);
        for (const t of await c.locator('time').all()) await expect(t).toHaveText(MON_YYYY);
        if (w.data.status === 'submitted') {
          // "Submitted" replaces the date and the venue.
          await expect(c.locator('.citation__status')).toHaveText('Submitted');
          await expect(c.locator('time')).toHaveCount(0);
          await expect(c.locator('.citation__venue')).toHaveCount(0);
        } else if (w.data.date) {
          await expect(c.locator('[data-date-range]')).toHaveText(dateText(w.data));
        }
        await expect(c.locator('.citation__title')).toHaveText(plain(w.data.title));
        const venue = c.locator('.citation__venue');
        if ((await venue.count()) > 0) {
          expect(await venue.evaluate((e) => e.tagName)).toBe('EM');
        }
        const existing = Object.entries(w.data.links ?? {}).filter(([k, v]) => k !== 'site' && v);
        await expect(c.locator('.link-btn')).toHaveCount(existing.length);
        for (const href of await c
          .locator('a')
          .evaluateAll((els) => els.map((e) => e.getAttribute('href')))) {
          expect(href, `${path}: ${id}`).toBeTruthy();
        }
      }
    }
  });

  test('home recent work shows the latest items and links to the Garden', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#work [data-citation]')).toHaveCount(
      Math.min(5, PUBLIC_WORK.length),
    );
    await expect(page.locator('#work').getByRole('link', { name: /^All work/ })).toHaveAttribute(
      'href',
      '/garden/',
    );
  });
});

test.describe('cv and about', () => {
  test('CV is generated from content, in CV section order', async ({ page }) => {
    await page.goto('/cv/');
    await expect(page.getByRole('heading', { level: 1, name: 'CV', exact: true })).toBeVisible();
    const h2s = await page
      .locator('main h2')
      .evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim()));
    expect(h2s).toEqual([
      'Contact', // visually hidden, labels the contact links
      'Education',
      'Research interests',
      'Publications and preprints',
      'Research experience',
      'Presentations',
      'Projects',
      'Technical skills',
      'Work experience',
    ]);
    const edu = page.locator('[data-cv-education]');
    await expect(edu.getByText('Kennesaw State University', { exact: true })).toBeVisible();
    await expect(edu).toContainText('Marietta, GA');
    await expect(edu).toContainText('Expected May 2028');
    await expect(edu).toContainText('Real Analysis');

    // Research experience: one entry per area, with dates, and the advisor where known.
    const research = page.locator('[data-cv-research]');
    await expect(research.locator('[data-cv-position]')).toHaveCount(AREAS.length);
    for (const a of AREAS) {
      const entry = research.locator(`[data-cv-position="${a.id}"]`);
      await expect(entry.locator('h3 [data-date-range]')).toHaveText(DATE_TEXT);
      await expect(entry.locator('li').first()).toBeVisible();
      if (a.data.advisor) await expect(entry).toContainText(`Advisor: ${a.data.advisor}`);
      else await expect(entry).not.toContainText('Advisor');
      await expect(entry.getByRole('link', { name: a.data.title, exact: true })).toHaveAttribute(
        'href',
        `/research/${a.id}/`,
      );
    }
    await expect(research.locator('h3 [data-date-range]')).toHaveText([
      'Aug 2026 – Present',
      'Aug 2025 – Present',
      'Aug 2024 – May 2025',
    ]);

    // The submitted manuscript, with "Submitted" in place of a date.
    const pubs = page.locator('section:has(#cv-publications) [data-citation]');
    await expect(pubs).toHaveCount(1);
    await expect(pubs).toContainText(
      'Tsz Ho Chan and Andrew Chincea. Largest kth-Power Divisor of a Random Integer. Submitted.',
    );
    // Typeset as in the CV: italic k, superscript "th".
    await expect(pubs.locator('.citation__title i')).toHaveText('k');
    await expect(pubs.locator('.citation__title sup')).toHaveText('th');

    await expect(page.locator('section:has(#cv-presentations) [data-citation]')).toHaveCount(
      PUBLIC_WORK.filter((w) => ['talk', 'poster'].includes(w.data.type)).length,
    );
    await expect(page.locator('section:has(#cv-projects) [data-citation]')).toHaveCount(
      PUBLIC_WORK.filter((w) => w.data.type === 'project').length,
    );
    const job = page.locator('[data-cv-job]');
    await expect(job).toHaveCount(1);
    await expect(job.locator('h3')).toContainText(
      'Graduation Services Student Assistant (Federal Work-Study)',
    );
    await expect(job.locator('[data-date-range]')).toHaveText('Aug 2026 – Present');
    await expect(job).toContainText('Office of the Registrar');

    const hasPresentations = PUBLIC_WORK.some((w) => ['talk', 'poster'].includes(w.data.type));
    await expect(
      page.getByRole('heading', { level: 2, name: 'Presentations', exact: true }),
    ).toHaveCount(hasPresentations ? 1 : 0);
    const hasProjects = PUBLIC_WORK.some((w) =>
      ['project', 'software', 'dataset'].includes(w.data.type),
    );
    await expect(
      page.getByRole('heading', { level: 2, name: 'Projects', exact: true }),
    ).toHaveCount(hasProjects ? 1 : 0);
  });

  test('CV PDF link appears only if the file exists', async ({ page }) => {
    await page.goto('/cv/');
    const pdf = (PROFILE.cv_pdf ?? '').trim();
    let exists = false;
    if (pdf && !/^https?:/.test(pdf)) {
      try {
        exists = statSync(join(ROOT, 'public', pdf.replace(/^\/+/, ''))).isFile();
      } catch {
        exists = false;
      }
    }
    await expect(page.locator('[data-cv-pdf]')).toHaveCount(exists || /^https?:/.test(pdf) ? 1 : 0);
  });

  test('About shows the bio and the contact links', async ({ page }) => {
    await page.goto('/about/');
    await expect(page.getByRole('heading', { level: 1, name: 'About', exact: true })).toBeVisible();
    await expect(page.locator('.about__bio')).toContainText('Kennesaw State University');
    // First-person bio with the confirmed REU/PhD interest (DECISIONS #85, #86).
    await expect(page.locator('.about__bio')).toContainText(
      "I'm an undergraduate at Kennesaw State University",
    );
    await expect(page.locator('.about__bio')).toContainText(
      "I'm interested in PhD programs and in mathematics and data science REUs.",
    );
    await expect(page.locator('.about__bio')).not.toContainText(/apply/i);
    await expect(
      page.getByRole('heading', { level: 2, name: 'Contact', exact: true }),
    ).toBeVisible();
    await expectContactLinks(page.locator('.about__contact'));
  });

  test('home shows Contact with the profile links and hides empty Teaching', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#contact')).toBeVisible();
    await expectContactLinks(page.locator('#contact'));
    await expect(page.locator('#contact p[data-confirmed="false"]')).toHaveText(
      "I'm interested in PhD programs and in mathematics and data science REUs. If you'd like to talk about either, here's how to reach me.",
    );
    // No teaching content exists, so the section is not rendered at all.
    await expect(page.locator('#teaching')).toHaveCount(0);
  });

  test('CV shows the contact links and no PDF link', async ({ page }) => {
    await page.goto('/cv/');
    await expectContactLinks(page.locator('[data-cv-contact]'));
    expect((PROFILE.cv_pdf ?? '').trim()).toBe('');
    await expect(page.locator('[data-cv-pdf]')).toHaveCount(0);
  });
});

test.describe('production build hygiene', () => {
  test('no draft items or Draft badges in the build', async ({ page }) => {
    for (const path of PAGES) {
      await page.goto(path);
      await expect(page.locator('[data-draft-badge]')).toHaveCount(0);
      for (const w of DRAFT_WORK) await expect(page.locator(`[data-id="${w.id}"]`)).toHaveCount(0);
      const text = await page.locator('body').innerText();
      expect(text).not.toContain('Title needed');
      // Collaborators appear only as coauthors on draft items, so they are absent here.
      for (const w of DRAFT_WORK) {
        for (const a of w.data.authors.filter((x) => !/Chincea/.test(x))) {
          if (!PUBLIC_WORK.some((p) => p.data.authors.includes(a)))
            expect(text, path).not.toContain(a);
        }
      }
    }
  });

  for (const { id, name, url } of [
    { id: 'project-owlpath', name: 'OwlPath', url: 'https://andrewc156.github.io/OwlPath/' },
    {
      id: 'project-personal-portfolio',
      name: 'Personal portfolio',
      url: 'https://andrewchincea.com/',
    },
  ]) {
    test(`${name} links to its published project from the Garden and CV`, async ({ page }) => {
      for (const path of ['/garden/', '/cv/']) {
        await page.goto(path);
        const projectLink = page.locator(`[data-id="${id}"] a[href="${url}"]`);
        await expect(projectLink).toBeVisible();
      }
    });
  }

  test('no phone number, tel: link or References section on any page (DECISIONS #68)', async ({
    page,
  }) => {
    for (const path of ALL_PAGES) {
      await page.goto(path);
      // Visible text plus every link target and meta value (not script or asset hashes).
      const text = [
        await page.locator('body').innerText(),
        ...(await page
          .locator('[href], meta[content]')
          .evaluateAll((els) =>
            els.map((e) => e.getAttribute('href') ?? e.getAttribute('content') ?? ''),
          )),
      ].join('\n');
      expect(PHONE.test(text), `${path}: phone number on the page`).toBe(false);
      await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
      await expect(page.getByRole('heading', { name: /references/i })).toHaveCount(0);
    }
  });

  test('visible text in dist/ has no TODO, TBD, lorem or placeholder', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.html')) files.push(p);
      }
    };
    walk(join(ROOT, 'dist'));
    expect(files.length).toBeGreaterThan(0);
    const hits: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, 'utf8')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ');
      const m = FORBIDDEN.exec(text);
      if (m) hits.push(`${f}: ${text.slice(Math.max(0, m.index - 40), m.index + 40)}`);
    }
    expect(hits).toEqual([]);
  });

  test('pages have no empty labels or empty list items', async ({ page }) => {
    for (const path of PAGES) {
      await page.goto(path);
      const empties = await page.locator('main').evaluate((m) =>
        Array.from(
          m.querySelectorAll('li, dt, dd, time, em, strong, .work-row__title, .citation__title'),
        )
          .filter(
            (e) => (e as HTMLElement).innerText.trim() === '' && e.querySelector('svg') === null,
          )
          .map((e) => e.outerHTML.slice(0, 80)),
      );
      expect(empties, path).toEqual([]);
    }
  });
});

test.describe('F19c editorial polish', () => {
  test('Rising water introduces formation and merging without losing grid provenance', async ({
    page,
  }) => {
    await page.goto('/rising-water/');
    const { width, height } = JSON.parse(
      readFileSync(join(ROOT, 'public/data/colorado/meta.json'), 'utf8'),
    ) as { width: number; height: number };
    const lead = page.locator('.rw__lede');
    await expect(lead).toContainText('Lakes form in the valleys. When two meet, the older one');
    await expect(lead).toContainText('The lowest lake’s bar never ends.');
    await expect(lead).toContainText(`same ${width} × ${height} elevation grid`);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /barcode follows the lakes as they form in valleys and merge/,
    );
    await expect(page.locator('#how-to-read')).toContainText('sublevel-set filtration');
  });

  test('home Contact stays readable and keyboard navigable without JavaScript', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/#contact');
      const contact = page.locator('#contact');
      await expectContactLinks(contact);
      const email = contact.getByRole('link', { name: PROFILE.contact.email, exact: true });
      await email.focus();
      await page.keyboard.press('Tab');
      await expect(contact.locator(`a[href="${PROFILE.contact.github}"]`)).toBeFocused();
      for (const width of [375, 768, 1280]) {
        await page.setViewportSize({ width, height: 812 });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow, `home at ${width}px`).toBeLessThanOrEqual(0);
        expect((await email.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      }
    } finally {
      await context.close();
    }
  });
});

test.describe('accessibility', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`axe: 0 serious/critical on F2 pages (${colorScheme})`, async ({ browser }) => {
      const ctx = await browser.newContext({ colorScheme });
      const page = await ctx.newPage();
      for (const path of [...PAGES, '/garden/?tag=water-quality']) {
        await page.goto(path);
        await expectNoSeriousAxe(page, `${path} ${colorScheme}`);
      }
      await ctx.close();
    });
  }

  test('no horizontal overflow at 375px', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    for (const path of PAGES) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
    await ctx.close();
  });
});
