import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MODE,
  grouped,
  HERO_MODES,
  isHeroMode,
  modeMeta,
  RISING_CAPTION,
} from '../../../../src/lib/viz/hero/modes/meta.ts';

describe('hero mode copy', () => {
  it('Rising water is the default and uses the edited §6.3 caption (DECISIONS #85)', () => {
    expect(DEFAULT_MODE).toBe('rising');
    expect(HERO_MODES[0].id).toBe('rising');
    expect(modeMeta('rising').caption).toBe(RISING_CAPTION);
    expect(RISING_CAPTION).toBe(
      'Water rises over a random landscape. Lakes form in the valleys, and when two meet, the older one carries on. The barcode gives each lake a bar from the level where it forms to the level where it merges.',
    );
  });

  it('hero copy avoids the AI-isms Andrew asked to drop (humanizer pass)', () => {
    for (const m of HERO_MODES) {
      for (const text of [m.caption, m.keys]) {
        expect(text).not.toMatch(/—|pivotal|showcas|delve|vibrant|seamless|testament|tapestry/i);
        expect(text).not.toMatch(/With the animation focused/);
      }
    }
    expect(modeMeta('rising').keys).toBe(
      'When the animation has focus, Space plays or pauses. The Left and Right arrows lower and raise the water, and Home and End jump to the bottom and the top. Up and Down pick a bar, Escape clears it, and N makes new terrain.',
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
