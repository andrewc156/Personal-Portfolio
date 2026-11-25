import type { BasinMaskFile, ColoradoMeta } from './types.ts';

/**
 * "About the data" (spec §6.4) is generated at build time from meta.json and ATTRIBUTION.md.
 * This module turns ATTRIBUTION.md's small Markdown subset (headings, paragraphs, block quotes,
 * bare URLs) into blocks the page renders, without changing any text.
 */

export type Segment = { text: string; href?: undefined } | { text: string; href: string };

export interface Block {
  kind: 'heading' | 'paragraph' | 'quote';
  segments: Segment[];
}

const URL_RE = /https?:\/\/[^\s)]+/g;

/** Split text into plain and link segments. A trailing full stop or comma is not part of a URL. */
export function linkify(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    let url = m[0];
    while (/[.,;:]$/.test(url)) url = url.slice(0, -1);
    const start = m.index ?? 0;
    if (start > last) out.push({ text: text.slice(last, start) });
    out.push({ text: url, href: url });
    last = start + url.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** Blocks of ATTRIBUTION.md. Lines inside a block are joined with a space, as Markdown does. */
export function parseAttribution(md: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of md.replace(/\r\n/g, '\n').split(/\n\s*\n/)) {
    const lines = chunk
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;
    if (lines[0].startsWith('#')) {
      blocks.push({ kind: 'heading', segments: [{ text: lines[0].replace(/^#+\s*/, '') }] });
      const rest = lines.slice(1).join(' ');
      if (rest) blocks.push({ kind: 'paragraph', segments: linkify(rest) });
    } else if (lines.every((l) => l.startsWith('>'))) {
      const text = lines.map((l) => l.replace(/^>\s?/, '')).join(' ');
      blocks.push({ kind: 'quote', segments: linkify(text) });
    } else {
      blocks.push({ kind: 'paragraph', segments: linkify(lines.join(' ')) });
    }
  }
  return blocks;
}

export function blockText(b: Block): string {
  return b.segments.map((s) => s.text).join('');
}

/**
 * The attribution blocks to render (ATTRIBUTION.md without its top-level heading), after checking
 * that the licence's required notice from meta.json appears verbatim as a quote. Throws otherwise,
 * so a build can never ship a page with a missing or altered notice.
 */
export function attributionBlocks(md: string, meta: ColoradoMeta): Block[] {
  const blocks = parseAttribution(md);
  const notice = meta.licence.requiredNotice;
  if (!blocks.some((b) => b.kind === 'quote' && blockText(b) === notice)) {
    throw new Error('ATTRIBUTION.md does not quote meta.licence.requiredNotice verbatim');
  }
  return blocks[0]?.kind === 'heading' ? blocks.slice(1) : blocks;
}

export interface Fact {
  label: string;
  value: string;
  href?: string;
}

/** Key facts from meta.json for the "About the data" list. */
export function dataFacts(meta: ColoradoMeta): Fact[] {
  const [w, s, e, n] = meta.bbox;
  return [
    { label: 'Study area', value: meta.label },
    { label: 'Bounding box (W, S, E, N)', value: `${w}, ${s}, ${e}, ${n}` },
    { label: 'Source', value: meta.source.name, href: meta.source.registry },
    { label: 'Licence', value: meta.licence.name, href: meta.licence.url },
    { label: 'Citation DOI', value: meta.licence.citationDoi, href: meta.licence.citationDoi },
    {
      label: 'Grid',
      value: `${meta.width} × ${meta.height} = ${meta.cells.toLocaleString('en-US')} cells of ${meta.cellDeg}°, float32 ${meta.units}`,
    },
    { label: 'Coordinates', value: meta.crs },
    { label: 'Vertical datum', value: meta.verticalDatum },
    { label: 'Connectivity', value: `${meta.connectivity}-neighbour` },
    { label: 'Tie-break', value: meta.tieBreak },
    { label: 'Generated', value: meta.generatedAt },
  ];
}

/**
 * Key facts about the basin mask (stretch S3) from basin-mask.json and meta.json: source, release,
 * public-domain statement, cell rule and cell counts. Every value is copied from the files.
 */
export function basinFacts(info: BasinMaskFile, meta: ColoradoMeta): Fact[] {
  const n = (v: number) => v.toLocaleString('en-US');
  const facts: Fact[] = [
    { label: 'Source', value: info.source.name, href: info.source.productPage },
  ];
  for (const r of info.source.regions) {
    facts.push({ label: `Region ${r.huc2}`, value: `${r.name}: ${r.title}`, href: r.url });
  }
  facts.push(
    { label: 'Use', value: info.attribution.publicDomain, href: info.attribution.creditSource },
    { label: 'Cell rule', value: info.cellRule },
    {
      label: 'Basin cells',
      value: `${n(info.stats.basinCells)} of ${n(meta.cells)} (${(100 * info.stats.basinFraction).toFixed(1)} %)`,
    },
    { label: 'Coordinates', value: info.source.crs ?? '' },
  );
  return facts.filter((f) => f.value !== '');
}

/**
 * One sentence on the Mexican units, only if basin-mask.json's coverage notes record that WBD's
 * border units were harmonized with INEGI (DECISIONS #78). Null otherwise: nothing is inferred.
 */
export function inegiNote(info: BasinMaskFile): string | null {
  for (const c of info.coverage) {
    const m = /areas along the border "([^"]+)"/.exec(c);
    if (m && /in collaboration with Mexico's INEGI/.test(c)) {
      return `Region 15 continues into Mexico. WBD metadata: areas along the border “${m[1]}”, in collaboration with Mexico’s INEGI. The mask includes those units; it is not limited to the United States.`;
    }
  }
  return null;
}
