/**
 * Content collections (spec §7). Work items and research areas are YAML files under
 * src/content/; site copy and repositories live in src/data/.
 */
import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { DATED_TYPES, RESEARCH_SLUGS, WORK_TYPES } from './components/content/constants';

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
    if (d.draft) return;
    if (!d.title)
      ctx.addIssue({ code: 'custom', path: ['title'], message: 'title is required unless draft' });
    if (DATED_TYPES.includes(d.type) && !d.date)
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

const research = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/research' }),
  schema: z
    .object({
      title: z.string().trim().min(1),
      order: z.number().int(),
      /** One-line description for cards. */
      summary: z.string().trim().min(1).max(160),
      /** Longer description for the topic page; omitted until Andrew supplies one. */
      description: z.string().trim().optional(),
      /** Only methods Andrew has confirmed. Empty → the section is not rendered. */
      methods: z.array(z.string().trim().min(1)).default([]),
      advisor: z.string().trim().default(''),
    })
    .strict(),
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
