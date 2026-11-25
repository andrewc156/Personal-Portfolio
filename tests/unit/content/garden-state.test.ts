import { describe, expect, it } from 'vitest';
import {
  gardenQuery,
  normalizedGardenSearch,
  readGardenState,
  type GardenValid,
} from '../../../src/components/content/garden-state';

const valid: GardenValid = {
  type: new Set(['paper', 'preprint', 'software']),
  tag: new Set(['water-quality', 'number-theory']),
};

describe('readGardenState', () => {
  it('reads known type and tag values', () => {
    expect(readGardenState('?type=paper&tag=water-quality', valid)).toEqual({
      type: 'paper',
      tag: 'water-quality',
    });
  });

  it('keeps known types even when nothing is listed under them (QA-17)', () => {
    expect(readGardenState('?type=preprint', valid)).toEqual({ type: 'preprint', tag: '' });
  });

  it('ignores unknown values and uses the first duplicate', () => {
    expect(readGardenState('?type=nonsense&tag=nope', valid)).toEqual({ type: '', tag: '' });
    expect(readGardenState('?type=paper&type=software', valid).type).toBe('paper');
  });
});

describe('gardenQuery', () => {
  it('builds ?type= / ?tag= and omits empty facets', () => {
    expect(gardenQuery({ type: '', tag: '' })).toBe('');
    expect(gardenQuery({ type: 'paper', tag: '' })).toBe('?type=paper');
    expect(gardenQuery({ type: 'paper', tag: 'number-theory' })).toBe(
      '?type=paper&tag=number-theory',
    );
  });
});

describe('normalizedGardenSearch', () => {
  it('returns null when the URL already matches what is shown', () => {
    expect(normalizedGardenSearch('', valid)).toBeNull();
    expect(normalizedGardenSearch('?type=preprint', valid)).toBeNull();
    expect(normalizedGardenSearch('?type=paper&tag=water-quality', valid)).toBeNull();
    expect(normalizedGardenSearch('?utm=x', valid)).toBeNull();
  });

  it('drops ignored filter values and keeps other parameters', () => {
    expect(normalizedGardenSearch('?type=nonsense', valid)).toBe('');
    expect(normalizedGardenSearch('?type=nonsense&tag=number-theory', valid)).toBe(
      '?tag=number-theory',
    );
    expect(normalizedGardenSearch('?x=1&tag=nope', valid)).toBe('?x=1');
    expect(normalizedGardenSearch('?type=', valid)).toBe('');
  });

  it('collapses duplicates to the value in effect', () => {
    expect(normalizedGardenSearch('?type=paper&type=software', valid)).toBe('?type=paper');
  });
});
