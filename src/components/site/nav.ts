import { withBase } from '../../lib/url';

/** Home-page section anchors, in spec §4.3 order. index.astro passes these ids to the stubs. */
export const SECTION_IDS = {
  mission: 'mission',
  work: 'work',
  research: 'research',
  openScience: 'open-science',
  teaching: 'teaching',
  contact: 'contact',
} as const;

export interface NavItem {
  label: string;
  href: string;
}

/** Header links follow the homepage section order, then link to standalone pages. */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Mission', href: withBase(`/#${SECTION_IDS.mission}`) },
  { label: 'Work', href: withBase(`/#${SECTION_IDS.work}`) },
  { label: 'Research', href: withBase(`/#${SECTION_IDS.research}`) },
  { label: 'Open science', href: withBase(`/#${SECTION_IDS.openScience}`) },
  { label: 'Garden', href: withBase('/garden/') },
  { label: 'Rising water', href: withBase('/rising-water/') },
  { label: 'CV', href: withBase('/cv/') },
];
