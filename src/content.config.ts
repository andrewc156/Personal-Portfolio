/**
 * Content collections (spec §7). Work items and research areas are YAML files under
 * src/content/; site copy and repositories live in src/data/.
 */
import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import {
  DATED_TYPES,
  RESEARCH_SLUGS,
  WORK_STATUSES,
  WORK_TYPES,
} from './components/content/constants';

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$/;

/** YAML may turn an unquoted 2026-12-04 into a Date; normalise it back to YYYY-MM-DD. */
const dateField = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
  z
    .union([z.literal(''), z.string().regex(DATE_RE, 'date must be YYYY-MM or YYYY-MM-DD')])
    .default(''),
);

const optionalUrl = z.string().trim().min(1).optional();

export const workSchema = z
  .object({
    type: z.enum(WORK_TYPES),
    /** Empty only while the item is a draft. */
    title: z.string().trim().default(''),
    date: dateField,
    /** End of a dated span, e.g. a project that ran Jan–May 2026. */
    end: dateField,
    /** Still running ("– Present"). Exclusive with `end`. */
    ongoing: z.boolean().optional(),
    /** Publication status, e.g. a submitted manuscript; shown in place of date and venue. */
    status: z.enum(WORK_STATUSES).optional(),
    description: z.string().trim().max(160),
    venue: z.string().trim().optional(),
    authors: z.array(z.string().trim().min(1)).min(1),
    links: z
      .object({
        pdf: optionalUrl,
        doi: optionalUrl,
        preprint: optionalUrl,
        code: optionalUrl,
        data: optionalUrl,
        slides: optionalUrl,
        poster: optionalUrl,
        site: optionalUrl,
      })
      .strict()
      .default({}),
    tags: z.array(z.enum(RESEARCH_SLUGS)).default([]),
    featured: z.boolean().optional(),
    draft: z.boolean(),
    confirmed: z.boolean(),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (d.end && d.ongoing)
      ctx.addIssue({ code: 'custom', path: ['end'], message: 'use either end or ongoing' });
    if ((d.end || d.ongoing) && !d.date)
      ctx.addIssue({ code: 'custom', path: ['date'], message: 'a date range needs a start date' });
    if (d.end && d.date && d.end.slice(0, 7) < d.date.slice(0, 7))
      ctx.addIssue({ code: 'custom', path: ['end'], message: 'end is before the start date' });
    if (d.draft) return;
    if (!d.title)
      ctx.addIssue({ code: 'custom', path: ['title'], message: 'title is required unless draft' });
    // A submitted paper has no date until it is published.
    const undatedOk = d.type === 'paper' && d.status === 'submitted';
    if (DATED_TYPES.includes(d.type) && !d.date && !undatedOk)
      ctx.addIssue({
        code: 'custom',
        path: ['date'],
        message: `date is required for a ${d.type} unless draft`,
      });
  });

const work = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/work' }),
  schema: workSchema,
});

/** Month-precision date for research positions (YYYY-MM). */
const monthField = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().slice(0, 7) : v),
  z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'must be YYYY-MM'),
);

export const researchSchema = z
  .object({
    title: z.string().trim().min(1),
    order: z.number().int(),
    /** One-line description for cards (`$…$` marks inline math). */
    summary: z.string().trim().min(1).max(160),
    /** Longer description for the topic page; omitted until Andrew supplies one. */
    description: z.string().trim().optional(),
    /** Only methods Andrew has confirmed. Empty → the section is not rendered. */
    methods: z.array(z.string().trim().min(1)).default([]),
    /** Reported results, with the exact numbers from the CV. Empty → not rendered. */
    results: z.array(z.string().trim().min(1)).default([]),
    /** Named only on the topic page and the CV research-experience entry. */
    advisor: z.string().trim().default(''),
    /** The research position behind this area (CV "Research experience"). */
    position: z
      .object({
        role: z.string().trim().min(1),
        organization: z.string().trim().min(1),
        start: monthField,
        end: monthField.optional(),
        ongoing: z.boolean().optional(),
        /** Concise CV bullets. */
        highlights: z.array(z.string().trim().min(1)).default([]),
      })
      .strict()
      .refine((p) => !(p.end && p.ongoing), 'use either end or ongoing')
      .optional(),
  })
  .strict();

const research = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/research' }),
  schema: researchSchema,
});

const draftText = z.object({ text: z.string().trim(), confirmed: z.boolean() }).strict();

const copy = defineCollection({
  loader: file('src/data/copy.yaml'),
  schema: draftText,
});

const repos = defineCollection({
  loader: file('src/data/open-science.yaml'),
  schema: z
    .object({ id: z.string(), label: z.string().trim().min(1), url: z.string().trim().default('') })
    .strict(),
});

export const collections = { work, research, copy, repos };
