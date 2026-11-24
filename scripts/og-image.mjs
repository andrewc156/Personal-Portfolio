// Social-card image (spec §5, §10/F7.4): a static 1200×630 PNG of a hero frame.
//
// Captures the home-page hero (map + barcode strip) at a fixed seed and water level,
// then composites it with the name and tagline from src/data/profile.yaml into
// public/og/social-card.png. Uses Playwright's Chromium only; no other dependencies.
//
// Needs a running site (dev or preview), e.g.:
//   npx astro dev --port 4407
//   node scripts/og-image.mjs --base http://localhost:4407
// Options: --base <url> (default http://localhost:4407), --seed <n> (default 7),
//          --level <0..1> (default 0.28), --out <path> (default public/og/social-card.png)
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { parse } from 'yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const base = arg('base', 'http://localhost:4407');
const seed = Number(arg('seed', '7'));
const level = Number(arg('level', '0.28'));
const out = resolve(root, arg('out', 'public/og/social-card.png'));
const WIDTH = 1200;
const HEIGHT = 630;
const MAX_BYTES = 300 * 1024;

const profile = parse(await readFile(resolve(root, 'src/data/profile.yaml'), 'utf8')) ?? {};
const name = profile.display_name?.text || profile.full_name || '';
const tagline = profile.tagline?.text || '';
if (!name) throw new Error('profile.yaml has no display or full name');

const font = async (file) =>
  (await readFile(resolve(root, 'node_modules/@fontsource', file))).toString('base64');
const sans400 = await font('ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2');
const sans600 = await font('ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2');
const mono400 = await font('ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2');

const escapeHtml = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

const browser = await chromium.launch();
try {
  // 1. A hero frame: light theme, reduced motion (no autoplay), fixed seed and level.
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  await page.goto(new URL(`/?seed=${seed}`, base).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('theme', 'light'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(document.querySelector('[data-hero]')?.__hero));
  await page.evaluate((p) => document.querySelector('[data-hero]').__hero.scrubTo(p), level);
  // Let the renderer draw the scrubbed frame (two animation frames, then a short pause).
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await page.waitForTimeout(400);
  const map = await page.locator('[data-hero-map]').screenshot({ type: 'png' });
  const strip = await page.locator('[data-hero-strip]').screenshot({ type: 'png' });
  await ctx.close();

  // 2. Composite with the name and tagline.
  const card = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  const cp = await card.newPage();
  await cp.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: Plex; font-weight: 400; src: url(data:font/woff2;base64,${sans400}) format('woff2'); }
    @font-face { font-family: Plex; font-weight: 600; src: url(data:font/woff2;base64,${sans600}) format('woff2'); }
    @font-face { font-family: PlexMono; font-weight: 400; src: url(data:font/woff2;base64,${mono400}) format('woff2'); }
    * { box-sizing: border-box; margin: 0; }
    body { width: ${WIDTH}px; height: ${HEIGHT}px; background: #f7f4ee; color: #1c1b19;
      font-family: Plex, sans-serif; display: grid; grid-template-columns: 400px 1fr;
      align-items: center; gap: 40px; padding: 48px 56px; overflow: hidden; }
    h1 { font-weight: 600; font-size: 60px; line-height: 1.05; letter-spacing: -0.01em; }
    p { margin-top: 24px; font-size: 28px; line-height: 1.35; color: #4a4741; }
    .tag { margin-top: 40px; font-family: PlexMono, monospace; font-size: 18px;
      letter-spacing: 0.08em; text-transform: uppercase; color: #0b4f7a; }
    .rule { width: 64px; height: 4px; background: #0b4f7a; margin-top: 28px; }
    figure { display: grid; gap: 12px; }
    img { display: block; width: 100%; border-radius: 6px; }
  </style></head><body>
    <div>
      <h1>${escapeHtml(name)}</h1>
      <div class="rule"></div>
      ${tagline ? `<p>${escapeHtml(tagline)}</p>` : ''}
      <div class="tag">Rising water</div>
    </div>
    <figure>
      <img alt="" src="data:image/png;base64,${map.toString('base64')}">
      <img alt="" src="data:image/png;base64,${strip.toString('base64')}">
    </figure>
  </body></html>`);
  await cp.evaluate(() => document.fonts.ready);
  const png = await cp.screenshot({
    type: 'png',
    clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
  });
  await card.close();

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, png);
  const { size } = await stat(out);
  console.log(
    `wrote ${out} (${WIDTH}×${HEIGHT}, ${(size / 1024).toFixed(1)} KB, seed ${seed}, level ${level})`,
  );
  if (size > MAX_BYTES) {
    console.error(`social card is ${(size / 1024).toFixed(1)} KB, over the 300 KB budget`);
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
