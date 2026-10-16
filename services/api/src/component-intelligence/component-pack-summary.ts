import type { ComponentPackRunSummary } from '@sber-designer/shared-types';

import type { ComponentUseCandidate, TaskRelevantComponentPack } from './component-pack';

/**
 * Build the bounded UI projection of a run-owned component pack. Project-index
 * freshness stays independent from run-local selection/hydration health.
 */
export function componentPackRunSummary(
  componentPack: TaskRelevantComponentPack,
): ComponentPackRunSummary {
  const hydration = componentPack.hydrationManifest;
  const requiredRoles = new Set(componentPack.selectionPlan?.requiredRoles ?? []);
  return {
    status: componentPack.status,
    workspaceFreshness:
      (componentPack.selectionMap?.stale ?? componentPack.stale) ? 'stale' : 'current',
    candidateCount: componentPack.candidates.length,
    selectedCount: componentPack.candidates.length,
    diagnosticCount: componentPack.diagnostics.length,
    ...(componentPack.selectionMap
      ? {
          indexedCount: componentPack.selectionMap.counts.indexed,
          describedCount: componentPack.selectionMap.counts.described,
          divergedCount: componentPack.selectionMap.counts.diverged,
        }
      : {}),
    ...(componentPack.selectionPlan
      ? {
          selectionSource: componentPack.selectionPlan.source,
          plannedRoleCount: componentPack.selectionPlan.plannedRoles.length,
          gapCount: componentPack.selectionPlan.gaps.length,
          gaps: componentPack.selectionPlan.gaps.map((gap) => ({
            role: gap.role,
            reason: gap.reason,
            regionIds: gap.regionIds,
          })),
        }
      : {}),
    ...(hydration
      ? {
          hydratedCount: hydration.hydratedComponentIds.length,
          hydrationBatchCount: hydration.batches.length,
          hydrationBytes: hydration.totalBytes,
        }
      : {}),
    ...(componentPack.selectionPlan?.resolutions
      ? {
          resolvedComponentCount: componentPack.selectionPlan.resolutions.filter(
            (item) => item.status === 'resolved',
          ).length,
          partialResolutionCount: componentPack.selectionPlan.resolutions.filter(
            (item) => item.status === 'partial',
          ).length,
          unverifiedResolutionCount: componentPack.selectionPlan.resolutions.filter(
            (item) => item.status === 'unverified',
          ).length,
        }
      : {}),
    ...(componentPack.lateSelection
      ? {
          lateSelectionCount: componentPack.lateSelection.changes.length,
          lateSelectionBudget: componentPack.lateSelection.maxChanges,
          lateSelections: componentPack.lateSelection.changes.map((change) => ({ ...change })),
        }
      : {}),
    selections: componentPack.candidates.map((candidate) =>
      selectionSummary(candidate, componentPack, requiredRoles),
    ),
  };
}

function selectionSummary(
  candidate: ComponentUseCandidate,
  componentPack: TaskRelevantComponentPack,
  requiredRoles: Set<string>,
): NonNullable<ComponentPackRunSummary['selections']>[number] {
  const resolution =
    candidate.resolution ??
    componentPack.selectionPlan?.resolutions?.find(
      (item) => item.componentId === candidate.componentId && item.role === candidate.role,
    );
  const hydrationBatchIds =
    componentPack.hydrationManifest?.batches
      .filter((batch) => batch.componentIds.includes(candidate.componentId))
      .map((batch) => batch.id) ?? [];
  return {
    role: candidate.role,
    componentId: candidate.componentId,
    componentName: candidate.shortName,
    reason: candidate.reason,
    regionIds: candidate.regionIds ?? [],
    required: candidate.userRequired === true || requiredRoles.has(candidate.role),
    hydrated:
      componentPack.hydrationManifest?.hydratedComponentIds.includes(candidate.componentId) ??
      false,
    hydrationBatchIds,
    ...(resolution ? { resolutionStatus: resolution.status } : {}),
    variants: resolution?.chosenVariants.map((variant) => `${variant.prop}=${variant.value}`) ?? [],
  };
}
