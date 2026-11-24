/** Shared content constants (spec §7). Used by the content config and the pages. */

export const WORK_TYPES = [
  'preprint',
  'paper',
  'poster',
  'talk',
  'project',
  'software',
  'dataset',
] as const;
export type WorkType = (typeof WORK_TYPES)[number];

/** Types whose `date` is required once the item is no longer a draft. */
export const DATED_TYPES: readonly WorkType[] = ['paper', 'preprint', 'poster', 'talk'];

/** Stable research-area slugs; each has a file in src/content/research/<slug>.yaml. */
export const RESEARCH_SLUGS = [
  'water-quality',
  'tda-rivernets',
  'number-theory',
  'spectral-fractals',
] as const;
export type ResearchSlug = (typeof RESEARCH_SLUGS)[number];

/** Labels for type chips and row tags. */
export const TYPE_LABELS: Record<WorkType, string> = {
  preprint: 'Preprint',
  paper: 'Paper',
  poster: 'Poster',
  talk: 'Talk',
  project: 'Project',
  software: 'Software',
  dataset: 'Dataset',
};

/** Plural labels for CV headings and chips. */
export const TYPE_PLURALS: Record<WorkType, string> = {
  preprint: 'Preprints',
  paper: 'Papers',
  poster: 'Posters',
  talk: 'Talks',
  project: 'Projects',
  software: 'Software',
  dataset: 'Datasets',
};

/** Citation buttons, in display order (spec §4.3). `site` links the title instead. */
export const LINK_BUTTONS = [
  ['pdf', 'PDF'],
  ['doi', 'DOI'],
  ['preprint', 'Preprint'],
  ['code', 'Code'],
  ['data', 'Data'],
  ['slides', 'Slides'],
  ['poster', 'Poster'],
] as const;
