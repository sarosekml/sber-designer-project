/**
 * In-memory pub-sub. Single global bus; multi-tenant sharding lands
 * later (ADR-0010).
 *
 * Subscribers are typed callbacks; the WS route adapts them to socket
 * sends. proj-mcp publishes via HTTP — no subscribe path for it yet.
 */
import { z } from 'zod';

import { SelectedNodeSchema } from './state-store';

export const EditorEventSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('editor.message'),
      text: z.string().min(1),
      source: z.enum(['proj-mcp', 'agent', 'user']).default('proj-mcp'),
      meta: z
        .object({
          provider: z.string().optional(),
          model: z.string().optional(),
        })
        .optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('editor.mode-changed'),
      mode: z.enum(['interact', 'design', 'code']),
    })
    .strict(),
  z
    .object({
      type: z.literal('editor.selection-changed'),
      selection: SelectedNodeSchema.nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal('proj-mcp.tool-call'),
      tool: z.string(),
      argsSummary: z.string(),
    })
    .strict(),
  z
    .object({
      type: z.literal('project.changed'),
      reason: z.string().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('storybook.reload-pending'),
      path: z.string().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('storybook.reload-cleared'),
    })
    .strict(),
]);

export type EditorEvent = z.infer<typeof EditorEventSchema>;

type Subscriber = (event: EditorEvent) => void;

const subscribers = new Set<Subscriber>();

export function subscribe(fn: Subscriber): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function publish(event: EditorEvent): void {
  for (const fn of subscribers) {
    try {
      fn(event);
    } catch {
      // a single bad subscriber must not break others
    }
  }
}

export function subscriberCount(): number {
  return subscribers.size;
}
