import { z } from 'zod';

import {
  ComponentSelectionUpdateError,
  updateTaskRelevantComponentSelection,
} from '../../component-intelligence/component-reselection';
import { recordComponentSelectionUpdateSafely } from '../run-recorder';
import type { ServerTool } from '../types';
import { requireWorkspace } from './shared';

const UpdateComponentSelectionInput = z
  .object({
    action: z.enum(['add', 'replace']),
    role: z.string().min(1).describe('Exact planned role from the component selection plan.'),
    componentId: z
      .string()
      .min(1)
      .describe('Exact indexed component id, shortName, or title found through project search.'),
    replaceComponentId: z
      .string()
      .min(1)
      .optional()
      .describe('Optional exact currently selected component id when action is replace.'),
    reason: z
      .string()
      .min(1)
      .max(500)
      .describe('Concrete plan need or source evidence that justifies this late selection.'),
  })
  .strict();

export const updateComponentSelectionTool: ServerTool<
  z.infer<typeof UpdateComponentSelectionInput>,
  unknown
> = {
  name: 'update_component_selection',
  description:
    'Add a component for an uncovered planned role, or replace the component already selected for that role, then continue the same run. Use search_project_index and get_usage_card first. This changes only run-local selection evidence, never project source, and is bounded by the current plan and run selection budget.',
  inputSchema: UpdateComponentSelectionInput,
  safety: 'read',
  handler: async (input, ctx) => {
    const workspacePath = requireWorkspace(ctx);
    if (!ctx.componentPack) {
      throw new ComponentSelectionUpdateError(
        'component_pack_missing',
        'No run-owned component pack is active for late selection.',
      );
    }
    const result = await updateTaskRelevantComponentSelection({
      workspaceRoot: workspacePath,
      componentPack: ctx.componentPack,
      action: input.action,
      role: input.role,
      componentId: input.componentId,
      ...(input.replaceComponentId ? { replaceComponentId: input.replaceComponentId } : {}),
      reason: input.reason,
      ...(ctx.screenStructurePlan ? { screenStructurePlan: ctx.screenStructurePlan } : {}),
    });
    ctx.componentPack = result.componentPack;
    await recordComponentSelectionUpdateSafely({
      workspacePath,
      runId: ctx.runId,
      componentPack: result.componentPack,
      change: result.change,
    });
    return {
      ok: true,
      interruption: false,
      userTurnCreated: false,
      change: result.change,
      selection: {
        status: result.componentPack.status,
        candidateIds: result.componentPack.candidates.map((candidate) => candidate.componentId),
        remainingGaps: result.componentPack.selectionPlan?.gaps ?? [],
        hydratedComponentIds: result.componentPack.hydrationManifest?.hydratedComponentIds ?? [],
        changesUsed: result.componentPack.lateSelection?.changes.length ?? 0,
        changeBudget: result.componentPack.lateSelection?.maxChanges ?? 0,
      },
      next: 'Continue implementation in this run using the updated hydrated contract.',
    };
  },
};
