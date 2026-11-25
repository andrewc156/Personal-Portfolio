import { describe, expect, it } from 'vitest';
import { heroHref } from '../../../src/lib/viz/hero/url.ts';

/** F26 QA-15: the address bar follows the hero's mode and seed. */
describe('heroHref', () => {
  const base = 'https://andrewchincea.com/';

  it('writes the seed; the default mode drops ?mode', () => {
    expect(heroHref(base, 'rising', 42)).toBe(`${base}?seed=42`);
    expect(heroHref(`${base}?mode=collatz&seed=123456`, 'rising', 650283)).toBe(
      `${base}?seed=650283`,
    );
  });

  it('writes mode and seed for the extra modes, updating in place', () => {
    expect(heroHref(`${base}?mode=collatz&seed=123456`, 'collatz', 650283)).toBe(
      `${base}?mode=collatz&seed=650283`,
    );
    expect(heroHref(`${base}?seed=42`, 'dye', 42)).toBe(`${base}?seed=42&mode=dye`);
  });

  it('keeps other parameters and the hash', () => {
    expect(heroHref(`${base}?utm=x&seed=1#work`, 'pond', 7)).toBe(
      `${base}?utm=x&seed=7&mode=pond#work`,
    );
    expect(heroHref(`${base}#research`, 'rising', 9)).toBe(`${base}?seed=9#research`);
  });

  it('round-trips: the written URL parses back to the same mode and seed', () => {
    const href = heroHref(`${base}?a=1`, 'rivers', 305613);
    const p = new URL(href).searchParams;
    expect(p.get('mode')).toBe('rivers');
    expect(p.get('seed')).toBe('305613');
    expect(p.get('a')).toBe('1');
  });

  it('is idempotent', () => {
    const once = heroHref(`${base}?seed=1&mode=dye`, 'dye', 5);
    expect(heroHref(once, 'dye', 5)).toBe(once);
  });
});
