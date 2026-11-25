/** Decorative, deterministic SVG art (spec §4.3). No coordinates from research, data, or results. */
export const THUMB_VIEWBOX = '0 0 240 120';

const paper = 'var(--color-surface-sunken)';
const ink = 'var(--color-accent)';
const wash = 'var(--color-accent-soft)';
const rule = 'var(--color-control)';

function riverNetwork(): string {
  // An invented branching river, not a map of a study area or a plot of station locations.
  return `<g class="thumb-river-network" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M-8 47C29 54 34 80 66 78S113 52 141 61 186 94 248 57" stroke="${wash}" stroke-width="24"/>
    <path d="M-8 32C30 39 39 66 65 65S109 43 131 46M-7 64C24 69 33 95 66 92S115 67 138 76 189 111 247 74M151 47C175 54 192 75 248 43" stroke="${rule}" opacity=".48"/>
    <path d="M-8 47C29 54 34 80 66 78S113 52 141 61 186 94 248 57" stroke="${ink}" stroke-width="2.8"/>
    <path d="M43 -5C40 33 81 32 80 48S70 66 66 78M109 110C117 89 83 82 99 65M169 -5C146 17 169 32 160 47L149 64M224 17C209 33 184 30 187 45S208 63 205 75M45 39C56 39 62 35 66 34" stroke="${ink}" stroke-width="1.6"/>
    <path d="M175 79C163 87 166 101 146 106M55 77C50 86 47 98 30 104" stroke="${ink}" opacity=".66"/>
  </g>`;
}

function nestedSquares(): string {
  // Repeating square within square: a motif for powers, without plotting values or frequencies.
  const square = (x: number, y: number, size: number) => `M${x} ${y}h${size}v${size}h-${size}z`;
  const frames = [0, 1, 2, 3, 4].map((n) => square(86 + 8 * n, 22 + 8 * n, 72 - 16 * n)).join('');
  return `<g class="thumb-nested-squares">
    <path d="M70 22H22v48h48zM222 46h-48v48h48z" fill="none" stroke="${rule}" opacity=".64"/>
    <path d="M30 30h32v32H30zM182 54h32v32h-32z" fill="none" stroke="${rule}" opacity=".64"/>
    <path d="M38 38h16v16H38zM190 62h16v16h-16z" fill="${rule}" opacity=".36"/>
    <rect x="86" y="22" width="72" height="72" fill="${wash}"/>
    <path d="${frames}" fill="none" stroke="${ink}" stroke-width="1.5"/>
  </g>`;
}

function recursiveTriangles(): string {
  // A self-similar silhouette, not an eigenfunction visualization.
  function triangles(x: number, y: number, width: number, depth: number): string {
    const height = width * 0.8;
    const half = width / 2;
    if (!depth) return `M${x} ${y}l${half} -${height} ${half} ${height}z`;
    return (
      triangles(x, y, half, depth - 1) +
      triangles(x + half, y, half, depth - 1) +
      triangles(x + half / 2, y - height / 2, half, depth - 1)
    );
  }
  return `<g class="thumb-recursive-triangles" stroke-linejoin="round">
    <path d="${triangles(19, 83, 40, 2)}${triangles(180, 83, 40, 2)}" fill="none" stroke="${rule}"/>
    <path d="${triangles(70, 94, 100, 0)}" fill="${wash}" stroke="${ink}"/>
    <path d="${triangles(70, 94, 100, 3)}" fill="${ink}"/>
  </g>`;
}

function abstract(slug: string): string {
  // Hash only feeds a rotation; never interpolate the slug itself into SVG markup.
  let hash = 0x811c9dc5;
  for (let i = 0; i < slug.length; i++) hash = Math.imul(hash ^ slug.charCodeAt(i), 0x01000193);
  const angle = (hash >>> 0) % 180;
  return `<g class="thumb-abstract" transform="rotate(${angle} 120 56)">
    <ellipse cx="120" cy="56" rx="57" ry="23" fill="${wash}" stroke="${ink}"/>
    <ellipse cx="120" cy="56" rx="23" ry="45" fill="none" stroke="${ink}"/>
  </g>`;
}

/** SVG inner markup generated at build time; same slug gives the same illustration. */
export function thumbnailMarkup(slug: string): string {
  const motif =
    slug === 'water-quality'
      ? riverNetwork()
      : slug === 'number-theory'
        ? nestedSquares()
        : slug === 'spectral-fractals'
          ? recursiveTriangles()
          : abstract(slug);
  return `<rect width="240" height="120" fill="${paper}"/>${motif}`;
}
