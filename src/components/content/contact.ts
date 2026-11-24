/** Contact links built from profile.yaml. Only fields Andrew has filled in appear. */
import { profile } from '../site/profile';

export interface ContactLink {
  label: string;
  href: string;
  text: string;
}

export function contactLinks(): ContactLink[] {
  const c = profile.contact;
  const out: ContactLink[] = [];
  if (c.email) out.push({ label: 'Email', href: `mailto:${c.email}`, text: c.email });
  if (c.github)
    out.push({ label: 'GitHub', href: c.github, text: c.github.replace(/^https?:\/\//, '') });
  if (c.linkedin)
    out.push({ label: 'LinkedIn', href: c.linkedin, text: c.linkedin.replace(/^https?:\/\//, '') });
  if (c.orcid)
    out.push({ label: 'ORCID', href: c.orcid, text: c.orcid.replace(/^https?:\/\//, '') });
  return out;
}
