/**
 * Hero modes (spec stretch S1): ids, menu labels, captions, accessible names and key help.
 * Small and dependency-free so the settings form and hero-client can import it statically;
 * the simulations themselves are loaded on demand (see ./index.ts).
 *
 * None of the extra modes is about persistence, so their copy makes no TDA claims (§6.6).
 */

export type HeroModeId = 'rising' | 'dye' | 'pond' | 'rivers' | 'collatz';

export const DEFAULT_MODE: HeroModeId = 'rising';

export interface HeroModeMeta {
  id: HeroModeId;
  /** Menu label in the settings panel. */
  label: string;
  /** The animation group's accessible name (the focusable hero box). */
  groupLabel: string;
  /** Caption under the hero (Rising water: RISING_CAPTION). */
  caption: string;
  /** Visually hidden key help, referenced by aria-describedby. */
  keys: string;
  /** aria-keyshortcuts for the hero box. */
  shortcuts: string;
  /** Click, tap and Enter act on the canvas. */
  interactive: boolean;
}

/**
 * Rising water's caption (spec §6.3 wording, edited for voice per DECISIONS #85). Every claim
 * maps to §6.6: lakes start in valleys (item 2), the older lake carries on when two meet (the
 * elder rule, item 2), and each lake gets one bar from birth level to death level (item 3).
 */
export const RISING_CAPTION =
  'Water rises over a random landscape. Lakes form in the valleys, and when two meet, the older one carries on. The barcode gives each lake a bar from the level where it forms to the level where it merges.';

export const HERO_MODES: readonly HeroModeMeta[] = [
  {
    id: 'rising',
    label: 'Rising water',
    groupLabel: 'Rising water animation',
    caption: RISING_CAPTION,
    keys: 'When the animation has focus, Space plays or pauses. The Left and Right arrows lower and raise the water, and Home and End jump to the bottom and the top. Up and Down pick a bar, Escape clears it, and N makes new terrain.',
    shortcuts: 'Space ArrowLeft ArrowRight ArrowUp ArrowDown Home End Escape N',
    interactive: false,
  },
  {
    id: 'dye',
    label: 'Dye spill',
    groupLabel: 'Dye spill animation',
    caption:
      'Dye leaks into a swirling current, drifts along it and slowly spreads out. Click or tap the water to spill more.',
    keys: 'When the animation has focus, Space plays or pauses, Enter spills dye at the centre, and N makes a new current.',
    shortcuts: 'Space Enter N',
    interactive: true,
  },
  {
    id: 'pond',
    label: 'Fractal pond',
    groupLabel: 'Fractal pond animation',
    caption:
      'Ripples spread across a pond shaped like a Koch snowflake and bounce off its walls. Click or tap the pond to drop a pebble.',
    keys: 'When the animation has focus, Space plays or pauses, Enter drops a pebble at the centre, and N makes a new pond.',
    shortcuts: 'Space Enter N',
    interactive: true,
  },
  {
    id: 'rivers',
    label: 'Random rivers',
    groupLabel: 'Random rivers animation',
    caption:
      'Every cell drains to one of its two neighbours downstream, chosen at random, so paths merge into rivers. Colour and width show Strahler stream order.',
    keys: 'When the animation has focus, Space plays or pauses and N grows a new network.',
    shortcuts: 'Space N',
    interactive: false,
  },
  {
    id: 'collatz',
    label: 'Collatz delta',
    groupLabel: 'Collatz delta animation',
    caption:
      'Numbers grow backwards from 1 along Collatz steps. Each path bends one way after an even step and the other way after an odd one, and all of them join one trunk.',
    keys: 'When the animation has focus, Space plays or pauses and N draws a new delta.',
    shortcuts: 'Space N',
    interactive: false,
  },
];

export function isHeroMode(v: unknown): v is HeroModeId {
  return typeof v === 'string' && HERO_MODES.some((m) => m.id === v);
}

export function modeMeta(id: HeroModeId): HeroModeMeta {
  return HERO_MODES.find((m) => m.id === id) ?? HERO_MODES[0];
}

/** "12,345": grouped digits without Intl (no allocation of a formatter per call). */
export function grouped(n: number): string {
  const s = String(Math.round(Math.abs(n)));
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ',';
    out += s[i];
  }
  return n < 0 ? `-${out}` : out;
}
