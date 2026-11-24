import { test, expect, type Page } from '@playwright/test';
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
const AREAS = readYamlDir<{ title: string; order: number }>(RESEARCH_DIR).sort(
  (a, b) => a.data.order - b.data.order,
);
const PROFILE = parse(readFileSync(join(ROOT, 'src/data/profile.yaml'), 'utf8')) as {
  cv_pdf?: string;
};

const MON_YYYY = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}$/;
const FORBIDDEN = /TODO|TBD|lorem|placeholder/i;
const PAGES = [
  '/',
  '/garden/',
  '/research/',
  ...AREAS.map((a) => `/research/${a.id}/`),
  '/cv/',
  '/about/',
];

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

function visibleRows(page: Page) {
  return page.locator('[data-work-row]:visible');
}

test.describe('content files', () => {
  test('the six §3 work items exist exactly once and drafts have empty [A] fields', () => {
    expect(ALL_WORK).toHaveLength(6);
    const byType = ALL_WORK.reduce<Record<string, number>>((acc, w) => {
      acc[w.data.type] = (acc[w.data.type] ?? 0) + 1;
      return acc;
    }, {});
    expect(byType).toEqual({ poster: 2, talk: 1, preprint: 1, project: 2 });
    for (const w of ALL_WORK) {
      if (!w.data.draft) {
        expect(w.data.title, w.id).toBeTruthy();
        if (['paper', 'preprint', 'poster', 'talk'].includes(w.data.type))
          expect(w.data.date, w.id).toBeTruthy();
      }
    }
    // Items whose title Andrew still has to supply are drafts with an empty title.
    for (const w of ALL_WORK.filter((x) => !x.data.title)) expect(w.data.draft, w.id).toBe(true);
  });

  test('four research areas', () => {
    expect(AREAS.map((a) => a.id)).toEqual([
      'water-quality',
      'tda-rivernets',
      'number-theory',
      'spectral-fractals',
    ]);
  });
});

test.describe('garden', () => {
  test('lists every published item once, with rows per §4.1', async ({ page }) => {
    await page.goto('/garden/');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Garden', exact: true }),
    ).toBeVisible();
    const rows = page.locator('[data-work-row]');
    await expect(rows).toHaveCount(PUBLIC_WORK.length);
    const ids = await rows.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.id));
    expect([...ids].sort()).toEqual(PUBLIC_WORK.map((w) => w.id).sort());

    for (const w of PUBLIC_WORK) {
      const row = page.locator(`[data-work-row][data-id="${w.id}"]`);
      await expect(row.locator('.work-row__type')).toBeVisible();
      await expect(row.locator('.work-row__title')).toHaveText(w.data.title ?? '');
      const typeFont = await row
        .locator('.work-row__type')
        .evaluate((e) => getComputedStyle(e).fontFamily);
      expect(typeFont).toMatch(/Plex Mono|monospace/);
      const date = row.locator('time');
      if (w.data.date) await expect(date).toHaveText(MON_YYYY);
      else await expect(date).toHaveCount(0);
      // Order inside the row: type tag → title → description → date.
      const order = await row.evaluate((el) =>
        ['.work-row__type', '.work-row__title', '.work-row__desc', 'time']
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
      await expect(card.getByRole('link', { name: /^Related work/ })).toHaveAttribute(
        'href',
        `/garden/?tag=${a.id}`,
      );
      await expect(card.locator(`svg[data-thumb="${a.id}"]`)).toHaveCount(1);
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

  test('the TDA page links to /rising-water/', async ({ page }) => {
    await page.goto('/research/tda-rivernets/');
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
        if (w.data.date) await expect(c.locator('time')).toHaveText(MON_YYYY);
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
  test('CV is generated from content', async ({ page }) => {
    await page.goto('/cv/');
    await expect(page.getByRole('heading', { level: 1, name: 'CV', exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Education', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Research', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Kennesaw State University', { exact: true })).toBeVisible();
    for (const a of AREAS) {
      await expect(
        page.locator('main').getByRole('link', { name: a.data.title, exact: true }),
      ).toBeVisible();
    }
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

  test('About shows the bio and no empty contact section', async ({ page }) => {
    await page.goto('/about/');
    await expect(page.getByRole('heading', { level: 1, name: 'About', exact: true })).toBeVisible();
    await expect(page.locator('.about__bio')).toContainText('Kennesaw State University');
    const contact = page.getByRole('heading', { name: 'Contact', exact: true });
    if ((await contact.count()) > 0)
      await expect(page.locator('.contact-links a').first()).toBeVisible();
  });

  test('home hides Teaching and Contact when they have no content', async ({ page }) => {
    await page.goto('/');
    for (const id of ['teaching', 'contact']) {
      const section = page.locator(`#${id}`);
      if ((await section.count()) > 0) await expect(section.locator('li, a').first()).toBeVisible();
    }
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
