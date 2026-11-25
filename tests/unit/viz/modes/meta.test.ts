import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MODE,
  grouped,
  HERO_MODES,
  isHeroMode,
  modeMeta,
} from '../../../../src/lib/viz/hero/modes/meta.ts';

describe('hero mode copy', () => {
  it('Rising water is the default and keeps the §6.3 caption exactly', () => {
    expect(DEFAULT_MODE).toBe('rising');
    expect(HERO_MODES[0].id).toBe('rising');
    expect(modeMeta('rising').caption).toBe(
      "Water rises over a random landscape. Lakes are born, then merge, and the barcode records each lake's lifetime.",
    );
  });

  it('the other modes make no persistence claims and stay short', () => {
    for (const m of HERO_MODES.filter((x) => x.id !== 'rising')) {
      for (const text of [m.caption, m.groupLabel, m.keys]) {
        expect(text).not.toMatch(/persisten|barcode|homolog|\blakes?\b|filtration|elder rule/i);
      }
      expect(m.caption.length).toBeLessThanOrEqual(180);
    }
  });

  it('click modes mention Enter in their key help; others do not', () => {
    for (const m of HERO_MODES.filter((x) => x.id !== 'rising')) {
      expect(m.keys.includes('Enter')).toBe(m.interactive);
      expect(m.shortcuts.includes('Enter')).toBe(m.interactive);
    }
  });

  it('isHeroMode and grouped', () => {
    expect(isHeroMode('pond')).toBe(true);
    expect(isHeroMode('lava')).toBe(false);
    expect(isHeroMode(null)).toBe(false);
    expect(grouped(0)).toBe('0');
    expect(grouped(999)).toBe('999');
    expect(grouped(1000)).toBe('1,000');
    expect(grouped(1073741824)).toBe('1,073,741,824');
  });
});
