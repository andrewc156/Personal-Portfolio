import { parse } from 'yaml';
import raw from '../../data/profile.yaml?raw';

export interface DraftText {
  text: string;
  confirmed: boolean;
}

export interface Profile {
  full_name: string;
  display_name: DraftText;
  affiliation: string;
  degrees: string[];
  standing: string;
  expected_graduation: string;
  contact: { email: string; github: string; linkedin: string; orcid: string };
  photo: string;
  cv_pdf: string;
  domain: string;
  tagline: DraftText;
  hero_question: DraftText;
  keywords: string[];
  site: { source_url: string; show_claude_code_credit: boolean };
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function draft(v: unknown): DraftText {
  const o = (v ?? {}) as Record<string, unknown>;
  return { text: str(o.text), confirmed: o.confirmed === true };
}

function list(v: unknown): string[] {
  return Array.isArray(v) ? v.map(str).filter(Boolean) : [];
}

/** Parse and normalise profile YAML. Missing fields become empty, never invented. */
export function parseProfile(source: string): Profile {
  const d = (parse(source) ?? {}) as Record<string, unknown>;
  const contact = (d.contact ?? {}) as Record<string, unknown>;
  const site = (d.site ?? {}) as Record<string, unknown>;
  return {
    full_name: str(d.full_name),
    display_name: draft(d.display_name),
    affiliation: str(d.affiliation),
    degrees: list(d.degrees),
    standing: str(d.standing),
    expected_graduation: str(d.expected_graduation),
    contact: {
      email: str(contact.email),
      github: str(contact.github),
      linkedin: str(contact.linkedin),
      orcid: str(contact.orcid),
    },
    photo: str(d.photo),
    cv_pdf: str(d.cv_pdf),
    domain: str(d.domain),
    tagline: draft(d.tagline),
    hero_question: draft(d.hero_question),
    keywords: list(d.keywords),
    site: {
      source_url: str(site.source_url),
      show_claude_code_credit: site.show_claude_code_credit !== false,
    },
  };
}

export const profile: Profile = parseProfile(raw);

/** Name shown in the wordmark, footer and titles. */
export const displayName: string = profile.display_name.text || profile.full_name;
