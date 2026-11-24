import { describe, expect, it } from 'vitest';
import { withBase, stripBase, normalizeBase, BASE } from '../../src/lib/url';
const B = '/Personal-Portfolio/';
describe('url', () => {
  it('default base', () => {
    expect(BASE).toBe('/');
    expect(withBase('/cv/')).toBe('/cv/');
    expect(withBase('/#mission')).toBe('/#mission');
  });
  it('sub base', () => {
    expect(withBase('/', B)).toBe(B);
    expect(withBase('/#mission', B)).toBe('/Personal-Portfolio/#mission');
    expect(withBase('/garden/?tag=x', B)).toBe('/Personal-Portfolio/garden/?tag=x');
    expect(withBase('/Personal-Portfolio/cv/', B)).toBe('/Personal-Portfolio/cv/');
    expect(withBase('/Personal-Portfolio', B)).toBe('/Personal-Portfolio');
    expect(withBase('https://x.org/a', B)).toBe('https://x.org/a');
    expect(withBase('//x.org/a', B)).toBe('//x.org/a');
    expect(withBase('mailto:a@b', B)).toBe('mailto:a@b');
    expect(withBase('#top', B)).toBe('#top');
    expect(withBase('/cv/', 'Personal-Portfolio')).toBe('/Personal-Portfolio/cv/');
    expect(withBase('/Personal-Portfolio-x/', B)).toBe('/Personal-Portfolio/Personal-Portfolio-x/');
    expect(stripBase('/Personal-Portfolio/cv/', B)).toBe('/cv/');
    expect(stripBase('/Personal-Portfolio/', B)).toBe('/');
    expect(stripBase('/Personal-Portfolio', B)).toBe('/');
    expect(stripBase('/other/', B)).toBe('/other/');
    expect(normalizeBase('')).toBe('/');
    expect(normalizeBase('//a//')).toBe('/a/');
  });
});
