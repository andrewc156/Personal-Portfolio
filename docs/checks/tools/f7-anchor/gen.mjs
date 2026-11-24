// Generates control + sabotaged copies of the F7 anchor test (e2e/shell.spec.ts:150-225).
import fs from 'node:fs';
const src = fs.readFileSync('../../../../e2e/shell.spec.ts', 'utf8').split('\n');
const body = src.slice(149, 225).join('\n'); // lines 150..225
const head = `import { test, expect } from '@playwright/test';\nconst SECTION_ANCHORS = ['mission', 'work', 'research', 'open-science'];\n`;
const logLine = `      console.log('LANDING', id, JSON.stringify(l));\n      if (l.atBottom) {`;
const withLog = body.replace('      if (l.atBottom) {', logLine);
const inject = (script) => withLog.replace("await page.goto('/');", `await page.addInitScript(${script});\n    await page.goto('/');`);
// A: cancel nav clicks, update hash without scrolling.
const A = `() => { document.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a[href^="/#"]'); if (!a) return; e.preventDefault(); history.replaceState(null, '', a.getAttribute('href')); }, true); }`;
// B: cancel nav clicks, scroll so target lands 120 px below its margin (wrong landing).
const B = `() => { document.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a[href^="/#"]'); if (!a) return; e.preventDefault(); const id = a.getAttribute('href').slice(2); history.replaceState(null, '', a.getAttribute('href')); const el = document.getElementById(id); const y = el.getBoundingClientRect().top + window.scrollY - 136; window.scrollTo({ top: Math.max(1, y), behavior: 'instant' }); }, true); }`;
fs.writeFileSync('control.spec.ts', head + `test.describe('control', () => {\n${withLog}\n});\n`);
fs.writeFileSync('sabotageA.spec.ts', head + `test.describe('sabotageA', () => {\n${inject(A)}\n});\n`);
fs.writeFileSync('sabotageB.spec.ts', head + `test.describe('sabotageB', () => {\n${inject(B)}\n});\n`);
