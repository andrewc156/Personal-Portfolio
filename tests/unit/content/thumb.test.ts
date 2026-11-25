import { describe, expect, it } from 'vitest';
import { thumbnailMarkup } from '../../../src/components/content/thumb';

const motifs = [
  ['water-quality', 'river-network'],
  ['number-theory', 'nested-squares'],
  ['spectral-fractals', 'recursive-triangles'],
] as const;

describe('research thumbnail illustrations', () => {
  it.each(motifs)('gives %s its own deterministic motif', (slug, motif) => {
    const svg = thumbnailMarkup(slug);
    expect(svg).toContain(`class="thumb-${motif}"`);
    expect(thumbnailMarkup(slug)).toBe(svg);
    expect(svg).not.toMatch(/<(?:image|script|foreignObject)\b|\bhref\s*=/i);
  });

  it('illustrates unrecognized slugs locally without interpolating the slug into markup', () => {
    const slug = '"/><script>alert(1)</script>';
    const svg = thumbnailMarkup(slug);
    expect(svg).toContain('class="thumb-abstract"');
    expect(svg).not.toContain(slug);
    expect(thumbnailMarkup(slug)).toBe(svg);
    expect(thumbnailMarkup('future-topic')).not.toBe(svg);
  });
});
