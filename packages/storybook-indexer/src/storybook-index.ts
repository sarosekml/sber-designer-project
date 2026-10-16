/**
 * zod schema for Storybook 8's /index.json output.
 *
 * Reference: https://storybook.js.org/docs/api/main-config/main-config-indexers
 *
 * The shape is documented but not formally typed in @storybook/types in a
 * usefully-public way, so we mirror it ourselves and validate at runtime.
 */
import { z } from 'zod';

const StoryIndexEntry = z
  .object({
    id: z.string().min(1),
    type: z.enum(['story', 'docs']),
    name: z.string().min(1),
    title: z.string().min(1),
    importPath: z.string().min(1),
    tags: z.array(z.string()).optional(),
  })
  .passthrough();

export const StorybookIndexSchema = z
  .object({
    v: z.number().optional(),
    entries: z.record(z.string(), StoryIndexEntry),
  })
  .strict();

export type StorybookIndex = z.infer<typeof StorybookIndexSchema>;
export type StorybookIndexEntry = z.infer<typeof StoryIndexEntry>;
