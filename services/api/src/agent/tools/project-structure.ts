import { z } from 'zod';
import { getHtmlProjectStructureReport } from '@sber-designer/design-indexer';
import type { HtmlProjectRestructureReceipt } from '@sber-designer/shared-types';

import { applyHtmlProjectRestructure } from '../../project-restructure';
import type { ServerTool } from '../types';
import { requireWorkspace } from './shared';

const GetProjectStructureReportInput = z.object({}).strict();

export const getProjectStructureReport: ServerTool<
  z.infer<typeof GetProjectStructureReportInput>,
  Awaited<ReturnType<typeof getHtmlProjectStructureReport>>
> = {
  name: 'get_project_structure_report',
  safety: 'read',
  description:
    'Inspect a static HTML workspace before a restructure run. Returns canonical/non-canonical/unsupported status, bounded file classification, proposed moves/creates, and broken local references. Read-only: always present the plan and ask for confirmation before changing files.',
  inputSchema: GetProjectStructureReportInput,
  handler: async (_input, ctx) => getHtmlProjectStructureReport(requireWorkspace(ctx)),
};

const ApplyProjectRestructureInput = z
  .object({
    planDigest: z
      .string()
      .regex(/^[a-f0-9]{64}$/u)
      .describe('Exact planDigest returned by the report shown to the user.'),
    confirmedByUser: z
      .literal(true)
      .describe('Set only after the user explicitly approves the displayed plan.'),
  })
  .strict();

export const applyProjectRestructure: ServerTool<
  z.infer<typeof ApplyProjectRestructureInput>,
  HtmlProjectRestructureReceipt
> = {
  name: 'apply_project_restructure',
  safety: 'disk-write',
  description:
    'Apply the exact static-HTML restructure plan previously returned by get_project_structure_report. Call only after showing every mapping, link rewrite, conflict, and follow-up and receiving explicit user confirmation. The tool rejects stale digests/conflicts, preserves user files, rebuilds managed indexes, registers pages, reindexes, persists a run receipt, and returns a deterministic post-check.',
  inputSchema: ApplyProjectRestructureInput,
  handler: async (input, ctx) =>
    applyHtmlProjectRestructure({
      workspacePath: requireWorkspace(ctx),
      planDigest: input.planDigest,
      confirmedByUser: input.confirmedByUser,
      ...(ctx.runId ? { runId: ctx.runId } : {}),
      ...(ctx.canvasUrl ? { canvasUrl: ctx.canvasUrl } : {}),
    }),
};
