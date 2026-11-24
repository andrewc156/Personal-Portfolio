import { describe, expect, it } from 'vitest';
import {
  compareWork,
  formatMonth,
  formatRange,
  mathSegments,
  plainText,
} from '../../../src/components/content/format';

describe('formatMonth', () => {
  it('formats YYYY-MM and YYYY-MM-DD as "Mon YYYY"', () => {
    expect(formatMonth('2025-03')).toBe('Mar 2025');
    expect(formatMonth('2026-12-04')).toBe('Dec 2026');
  });
  it('returns "" for empty or malformed dates', () => {
    expect(formatMonth('')).toBe('');
    expect(formatMonth('2026-13')).toBe('');
    expect(formatMonth('March 2026')).toBe('');
  });
});

describe('formatRange', () => {
  it('formats a single date', () => {
    expect(formatRange('2025-03')).toEqual({ start: 'Mar 2025', end: '' });
  });
  it('formats a closed range', () => {
    expect(formatRange('2026-01', '2026-05')).toEqual({ start: 'Jan 2026', end: 'May 2026' });
  });
  it('formats an ongoing range as "Present"', () => {
    expect(formatRange('2026-11', '', true)).toEqual({ start: 'Nov 2026', end: 'Present' });
  });
  it('collapses an end in the same month as the start', () => {
    expect(formatRange('2026-01', '2026-01-20')).toEqual({ start: 'Jan 2026', end: '' });
  });
  it('shows nothing without a start date', () => {
    expect(formatRange('', '2026-05')).toEqual({ start: '', end: '' });
    expect(formatRange('', '', true)).toEqual({ start: '', end: '' });
  });
});

describe('mathSegments and plainText', () => {
  const title = 'Largest $k$^th^-Power Divisor of a Random Integer';

  it('splits $…$ inline math and ^…^ superscript into segments', () => {
    expect(mathSegments(title)).toEqual([
      { text: 'Largest ', math: false },
      { text: 'k', math: true },
      { text: 'th', math: false, sup: true },
      { text: '-Power Divisor of a Random Integer', math: false },
    ]);
    expect(mathSegments('$O$(log $x$)')).toEqual([
      { text: 'O', math: true },
      { text: '(log ', math: false },
      { text: 'x', math: true },
      { text: ')', math: false },
    ]);
  });

  it('leaves text without math as one plain segment', () => {
    expect(mathSegments('Rising water')).toEqual([{ text: 'Rising water', math: false }]);
    expect(mathSegments('')).toEqual([]);
  });

  it('ignores a lone dollar sign or caret, and carets around spaces', () => {
    expect(mathSegments('costs $5')).toEqual([{ text: 'costs $5', math: false }]);
    expect(plainText('costs $5')).toBe('costs $5');
    expect(plainText('2^10')).toBe('2^10');
    expect(plainText('a ^b c^ d')).toBe('a ^b c^ d');
  });

  it('plainText drops the delimiters', () => {
    expect(plainText(title)).toBe('Largest kth-Power Divisor of a Random Integer');
    expect(plainText('every integer $k$ ≥ 2')).toBe('every integer k ≥ 2');
    expect(plainText('$k$th')).toBe('kth');
  });
});

describe('compareWork', () => {
  const item = (id: string, date: string, title = id) => ({ id, title, date });

  it('puts undated items (e.g. submitted papers) first, then newest first', () => {
    const items = [
      item('a', '2025-03'),
      item('b', '2026-12-04'),
      item('paper', ''),
      item('c', '2026-11'),
    ];
    expect(items.sort(compareWork).map((i) => i.id)).toEqual(['paper', 'b', 'c', 'a']);
  });

  it('breaks date ties by title, then id', () => {
    const items = [item('x', '2026-11', 'Rising water'), item('y', '2026-11', 'OwlPath')];
    expect(items.sort(compareWork).map((i) => i.id)).toEqual(['y', 'x']);
  });
});
