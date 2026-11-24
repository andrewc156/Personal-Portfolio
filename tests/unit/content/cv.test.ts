import { describe, expect, it } from 'vitest';
import { cv, parseCv } from '../../../src/components/content/cv';

describe('src/data/cv.yaml', () => {
  it('parses and has every CV-only section', () => {
    expect(cv.education.location).toBe('Marietta, GA');
    expect(cv.education.coursework.map((g) => g.group)).toEqual([
      'Mathematics',
      'Statistics & Data Science',
      'Computing',
    ]);
    expect(cv.research_interests).toMatch(/^Analytic number theory;/);
    expect(cv.skills.length).toBeGreaterThan(0);
    expect(cv.work_experience).toHaveLength(1);
    expect(cv.work_experience[0]).toMatchObject({ start: '2026-08', ongoing: true });
  });

  it('holds no phone number and no references (DECISIONS #68)', async () => {
    const { readFileSync } = await import('node:fs');
    const raw = readFileSync('src/data/cv.yaml', 'utf8');
    expect(raw).not.toMatch(/\d{3}[-. ]\d{3}[-. ]\d{4}/);
    expect(raw).not.toMatch(/^references:/m);
  });
});

describe('parseCv', () => {
  const minimal = 'education:\n  location: Somewhere\n';

  it('fills defaults for missing sections', () => {
    expect(parseCv(minimal)).toEqual({
      education: { location: 'Somewhere', coursework: [] },
      research_interests: '',
      skills: [],
      work_experience: [],
    });
  });

  it('rejects unknown keys, bad months and end + ongoing together', () => {
    expect(() => parseCv(`${minimal}references: []\n`)).toThrow();
    const job = (extra: string) =>
      `${minimal}work_experience:\n  - role: R\n    organization: O\n    start: '2026-08'\n${extra}`;
    expect(() => parseCv(job(''))).not.toThrow();
    expect(() => parseCv(job("    end: 'August'\n"))).toThrow();
    expect(() => parseCv(job("    end: '2026-09'\n    ongoing: true\n"))).toThrow();
  });
});
