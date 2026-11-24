import { describe, expect, it } from 'vitest';
import { withBase, stripBase, normalizeBase, BASE } from '../../../../src/lib/url';
const B = '/Personal-Portfolio/';
const expectedBase = process.env.EXPECT_BASE ?? '/';
describe('checker D1 url edge cases', () => {
  it('BASE from Vite env', () => {
    expect(BASE).toBe(expectedBase);
    // default-arg path uses BASE
    expect(withBase('/cv/')).toBe(expectedBase === '/' ? '/cv/' : '/Personal-Portfolio/cv/');
  });
  it('root base is identity for everything', () => {
    for (const p of ['/', '/cv/', '/#m', '/garden/?tag=a#x', 'https://a.b/', '//a.b/c', 'mailto:x@y', '#t', '?q=1', '', 'rel/path', '../x', 'tel:1', 'data:text/plain,a', 'javascript:void 0'])
      expect(withBase(p, '/')).toBe(p);
    for (const b of ['', '/', '//', '///']) expect(withBase('/x/', b)).toBe('/x/');
  });
  it('sub base prefixing', () => {
    expect(withBase('/', B)).toBe(B);
    expect(withBase('/cv/', B)).toBe('/Personal-Portfolio/cv/');
    expect(withBase('/garden/?tag=a&type=b', B)).toBe('/Personal-Portfolio/garden/?tag=a&type=b');
    expect(withBase('/garden/?tag=a#frag', B)).toBe('/Personal-Portfolio/garden/?tag=a#frag');
    expect(withBase('/#research', B)).toBe('/Personal-Portfolio/#research');
    expect(withBase('/?seed=7', B)).toBe('/Personal-Portfolio/?seed=7');
    expect(withBase('/data/colorado/grid.f32', B)).toBe('/Personal-Portfolio/data/colorado/grid.f32');
  });
  it('already based / idempotent', () => {
    for (const p of ['/Personal-Portfolio/', '/Personal-Portfolio/cv/', '/Personal-Portfolio', '/Personal-Portfolio?x=1', '/Personal-Portfolio#a', '/Personal-Portfolio/?x#y'])
      expect(withBase(p, B)).toBe(p);
    for (const p of ['/', '/cv/', '/a?b#c', '/#x']) expect(withBase(withBase(p, B), B)).toBe(withBase(p, B));
  });
  it('near-miss prefixes get prefixed', () => {
    expect(withBase('/Personal-Portfolio-x/', B)).toBe('/Personal-Portfolio/Personal-Portfolio-x/');
    expect(withBase('/Personal-Portfoliox', B)).toBe('/Personal-Portfolio/Personal-Portfoliox');
    expect(withBase('/personal-portfolio/', B)).toBe('/Personal-Portfolio/personal-portfolio/');
    expect(withBase('/Personal', B)).toBe('/Personal-Portfolio/Personal');
  });
  it('non-root-relative untouched', () => {
    for (const p of ['https://andrewc156.github.io/x', 'http://x/', '//cdn.example/x', 'mailto:a@b.c', 'tel:+1', '#top', '?q=1', '', 'rel/x', './x', '../x'])
      expect(withBase(p, B)).toBe(p);
  });
  it('base normalisation variants', () => {
    for (const b of ['Personal-Portfolio', '/Personal-Portfolio', 'Personal-Portfolio/', '//Personal-Portfolio//', B])
      expect(withBase('/cv/', b)).toBe('/Personal-Portfolio/cv/');
    expect(normalizeBase(undefined)).toBe('/');
    expect(normalizeBase('a/b')).toBe('/a/b/');
    expect(withBase('/cv/', '/a/b/')).toBe('/a/b/cv/');
  });
  it('stripBase', () => {
    expect(stripBase('/Personal-Portfolio/404.html', B)).toBe('/404.html');
    expect(stripBase('/Personal-Portfolio/', B)).toBe('/');
    expect(stripBase('/Personal-Portfolio', B)).toBe('/');
    expect(stripBase('/Personal-Portfolio-x/', B)).toBe('/Personal-Portfolio-x/');
    expect(stripBase('/cv/', '/')).toBe('/cv/');
    for (const p of ['/', '/cv/', '/garden/']) expect(stripBase(withBase(p, B), B)).toBe(p);
  });
});
