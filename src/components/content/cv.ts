/**
 * CV-only sections (education details, research interests, skills, work experience) from
 * src/data/cv.yaml. Validated with zod so a typo fails the build instead of rendering
 * an empty section.
 */
import { parse } from 'yaml';
import { z } from 'astro/zod';
import raw from '../../data/cv.yaml?raw';

const month = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().slice(0, 7) : v),
  z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'must be YYYY-MM'),
);
const text = z.string().trim().min(1);

const courseGroup = z.object({ group: text, courses: z.array(text).min(1) }).strict();
const skillGroup = z.object({ group: text, items: z.array(text).min(1) }).strict();

export const cvSchema = z
  .object({
    education: z
      .object({
        location: z.string().trim().default(''),
        coursework: z.array(courseGroup).default([]),
      })
      .strict(),
    research_interests: z.string().trim().default(''),
    skills: z.array(skillGroup).default([]),
    work_experience: z
      .array(
        z
          .object({
            role: text,
            organization: text,
            start: month,
            end: month.optional(),
            ongoing: z.boolean().optional(),
            highlights: z.array(text).default([]),
          })
          .strict()
          .refine((p) => !(p.end && p.ongoing), 'use either end or ongoing'),
      )
      .default([]),
  })
  .strict();

export type CvData = z.infer<typeof cvSchema>;

/** Parse and validate CV YAML. Throws with the zod issues when the file is malformed. */
export function parseCv(source: string): CvData {
  return cvSchema.parse(parse(source) ?? {});
}

export const cv: CvData = parseCv(raw);
