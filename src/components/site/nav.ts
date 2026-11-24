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

/** Header nav (spec §4.3): Mission · Research · Work · Open science · Rising water · CV. */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Mission', href: `/#${SECTION_IDS.mission}` },
  { label: 'Research', href: `/#${SECTION_IDS.research}` },
  { label: 'Work', href: `/#${SECTION_IDS.work}` },
  { label: 'Open science', href: `/#${SECTION_IDS.openScience}` },
  { label: 'Rising water', href: '/rising-water/' },
  { label: 'CV', href: '/cv/' },
];
