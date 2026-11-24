import { describe, expect, it } from 'vitest';
import {
  barReadout,
  cellReadout,
  levelReadout,
  metres,
  stripLabel,
  summaryText,
} from '../../../src/lib/viz/hero/text.ts';

describe('hero text', () => {
  it('formats readouts', () => {
    expect(metres(411.6)).toBe('412\u00a0m');
    expect(metres(411.6)).toBe(metres(412.2)); // cached string
    expect(metres(17)).toBe('17\u00a0m');
    expect(metres(-3)).toBe('-3\u00a0m'); // outside the cache
    // No plain space before any unit, so a number and its unit never wrap apart.
    for (const t of [levelReadout(17, 2), cellReadout(17, 1), metres(9999)]) {
      expect(t).not.toMatch(/\d m\b/);
    }
    expect(levelReadout(100, 1)).toBe('Level 100\u00a0m · 1 lake');
    expect(cellReadout(50, 0)).toBe('Height 50\u00a0m · dry land');
    expect(cellReadout(50, 3)).toBe('Height 50\u00a0m · Lake 3');
    expect(
      barReadout({ birth: 10, death: 60, birthCell: 1, deathCell: 2, mergedInto: 0 }, 4, 1),
    ).toBe('Lake 4 · born 10\u00a0m · spills into Lake 1 at 60\u00a0m · persistence 50\u00a0m');
    expect(
      barReadout({ birth: 0, death: Infinity, birthCell: 0, deathCell: -1, mergedInto: -1 }, 1, 0),
    ).toContain('never dies');
  });

  it('summary mentions state, level, lakes and the longest finished bar', () => {
    const s = summaryText({
      playing: false,
      progress: 0.45,
      level: 300,
      alive: 7,
      shown: 12,
      rows: 30,
      longest: {
        bar: { birth: 10, death: 200, birthCell: 1, deathCell: 2, mergedInto: 0 },
        label: 2,
      },
      seed: 42,
    });
    expect(s).toBe(
      'Paused. Terrain 42. Water level 300\u00a0m, 45% of the way up. 7 lakes are present. The barcode shows 12 of 30 bars so far. The longest finite bar is Lake 2, persistence 190\u00a0m.',
    );
  });

  it('strip label follows the view and says the lowest lake never dies', () => {
    expect(stripLabel('barcode')).toMatch(/^Barcode:/);
    expect(stripLabel('barcode')).toContain("lowest lake's bar never ends");
    expect(stripLabel('diagram')).toMatch(/^Persistence diagram:/);
    expect(stripLabel('diagram')).toContain('lowest lake never dies');
  });
});
