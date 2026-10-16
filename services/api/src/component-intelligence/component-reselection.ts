import {
  DESIGN_INDEX_PATHS,
  type ComponentGroupRecord,
  type ComponentUsageCard,
  type IndexedComponentRecord,
  type ProjectAgentNote,
} from '@sber-designer/design-indexer';
import type { ScreenStructurePlan } from '@sber-designer/shared-types';

import { loadProjectDesignIndex } from '../design-index';
import { readWorkspaceFile } from '../safe-fs';
import { groupComponentAgentNotes, readProjectIndexJsonl } from '../agent/tools/project-index-data';
import {
  componentUseCandidateFromScore,
  type TaskRelevantComponentPack,
  type TaskRelevantComponentSelectionChange,
} from './component-pack';
import { buildComponentHydrationBatches } from './component-hydration';
import {
  descriptionDivergenceFieldsByComponent,
  resolveSelectedComponentContracts,
} from './component-resolution';

export interface UpdateComponentSelectionInput {
  workspaceRoot: string;
  componentPack: TaskRelevantComponentPack;
  action: 'add' | 'replace';
  role: string;
  componentId: string;
  replaceComponentId?: string;
  reason: string;
  screenStructurePlan?: ScreenStructurePlan | null;
}

export interface UpdateComponentSelectionResult {
  componentPack: TaskRelevantComponentPack;
  change: TaskRelevantComponentSelectionChange;
}

export class ComponentSelectionUpdateError extends Error {
  constructor(
    readonly code:
      | 'component_pack_missing'
      | 'selection_plan_missing'
      | 'selection_budget_exhausted'
      | 'role_not_planned'
      | 'component_not_found'
      | 'component_already_selected'
      | 'role_already_selected'
      | 'role_not_selected'
      | 'required_component'
      | 'component_resolution_failed',
    message: string,
  ) {
    super(message);
  }
}

/**
 * B6.2.7: update a run-owned component selection without creating a new user
 * turn. The input pack is replaced atomically after the exact indexed contract
 * has been resolved, so later tools in the same built-in run see the change.
 */
export async function updateTaskRelevantComponentSelection(
  input: UpdateComponentSelectionInput,
): Promise<UpdateComponentSelectionResult> {
  const plan = input.componentPack.selectionPlan;
  if (!plan) {
    throw new ComponentSelectionUpdateError(
      'selection_plan_missing',
      'Late component selection requires a run-owned selection plan.',
    );
  }
  const role = input.role.trim();
  if (!plan.plannedRoles.includes(role)) {
    throw new ComponentSelectionUpdateError(
      'role_not_planned',
      `Role "${role}" is not a need in the current selection plan.`,
    );
  }
  const maxChanges = Math.max(1, Math.min(4, plan.plannedRoles.length));
  const previousChanges = input.componentPack.lateSelection?.changes ?? [];
  if (previousChanges.length >= maxChanges) {
    throw new ComponentSelectionUpdateError(
      'selection_budget_exhausted',
      `Late component selection budget exhausted (${maxChanges} change(s)).`,
    );
  }

  const selectedForRole = input.componentPack.candidates.find(
    (candidate) => candidate.role === role,
  );
  if (input.action === 'add' && selectedForRole) {
    throw new ComponentSelectionUpdateError(
      'role_already_selected',
      `Role "${role}" already has ${selectedForRole.componentId}; use replace.`,
    );
  }
  if (input.action === 'replace' && !selectedForRole && !input.replaceComponentId) {
    throw new ComponentSelectionUpdateError(
      'role_not_selected',
      `Role "${role}" has no selected component to replace; use add.`,
    );
  }

  const replacementIndex = resolveReplacementIndex(input, role);
  const replaced = replacementIndex >= 0 ? input.componentPack.candidates[replacementIndex] : null;
  if (replaced?.userRequired) {
    throw new ComponentSelectionUpdateError(
      'required_component',
      `Component ${replaced.componentId} is explicitly required and cannot be replaced.`,
    );
  }

  const [components, notes, cards, groups, indexContext] = await Promise.all([
    readProjectIndexJsonl<IndexedComponentRecord>(
      input.workspaceRoot,
      DESIGN_INDEX_PATHS.components,
    ),
    readProjectIndexJsonl<ProjectAgentNote>(input.workspaceRoot, DESIGN_INDEX_PATHS.agentNotes),
    readProjectIndexJsonl<ComponentUsageCard>(input.workspaceRoot, DESIGN_INDEX_PATHS.usageCards),
    readComponentGroups(input.workspaceRoot),
    loadProjectDesignIndex(input.workspaceRoot).catch(() => null),
  ]);
  const component = findExactComponent(components, input.componentId);
  if (!component) {
    throw new ComponentSelectionUpdateError(
      'component_not_found',
      `Indexed component not found: ${input.componentId}`,
    );
  }
  const duplicate = input.componentPack.candidates.find(
    (candidate, index) => candidate.componentId === component.id && index !== replacementIndex,
  );
  if (duplicate) {
    throw new ComponentSelectionUpdateError(
      'component_already_selected',
      `Component ${component.id} is already selected for role "${duplicate.role}".`,
    );
  }

  const next = structuredClone(input.componentPack);
  const notesByComponent = groupComponentAgentNotes(notes);
  const cardsByComponent = new Map(cards.map((card) => [card.componentId, card]));
  const divergence = descriptionDivergenceFieldsByComponent(indexContext?.diagnostics ?? []);
  const regionIds =
    selectedForRole?.regionIds ?? plan.gaps.find((gap) => gap.role === role)?.regionIds ?? [];
  const candidate = componentUseCandidateFromScore(
    role,
    {
      component,
      score: 100,
      semanticScore: 100,
      incidentalScore: 0,
      sourceAuthority: 100,
      matchedFields: ['agent late retrieval'],
      noteGuidance: notesByComponent.get(component.id)?.map((note) => note.note) ?? [],
    },
    notesByComponent,
    cardsByComponent.get(component.id),
    componentFamily(component, components, groups),
    regionIds,
    divergence.get(component.id) ?? [],
  );
  candidate.reason = `Late ${input.action} for planned role ${role}: ${input.reason.trim()}`;
  const traces = await resolveSelectedComponentContracts({
    workspaceRoot: input.workspaceRoot,
    candidates: [candidate],
    components,
    cardsByComponent,
    divergenceFieldsByComponent: divergence,
    importConventions: next.importConventions ?? [],
    userRequest: input.reason,
    ...(input.screenStructurePlan ? { screenStructurePlan: input.screenStructurePlan } : {}),
    allowScreenUsageEvidence: next.screenReferencePolicy !== 'forbidden',
  });
  const resolution = traces[0];
  if (!resolution) {
    throw new ComponentSelectionUpdateError(
      'component_resolution_failed',
      `Could not resolve an instantiation contract for ${component.id}.`,
    );
  }

  if (replacementIndex >= 0) next.candidates.splice(replacementIndex, 1, candidate);
  else next.candidates.push(candidate);
  if (next.selectionPlan) {
    next.selectionPlan.gaps = next.selectionPlan.gaps.filter((gap) => gap.role !== role);
    next.selectionPlan.resolutions = next.candidates.flatMap((item) =>
      item.resolution ? [item.resolution] : [],
    );
  }
  next.hydrationManifest = buildComponentHydrationBatches(
    next.candidates,
    next.hydrationManifest?.batchBudgetBytes,
  ).manifest;
  next.status = componentPackStatus(next);
  const change: TaskRelevantComponentSelectionChange = {
    sequence: previousChanges.length + 1,
    action: input.action,
    role,
    regionIds,
    componentId: component.id,
    ...(replaced ? { replacedComponentId: replaced.componentId } : {}),
    reason: input.reason.trim(),
    resolutionStatus: resolution.status,
  };
  next.lateSelection = {
    version: 1,
    maxChanges,
    changes: [...previousChanges, change],
  };
  next.diagnostics = [
    ...next.diagnostics,
    `Late component ${input.action}: ${role} -> ${component.id}${replaced ? ` (replaced ${replaced.componentId})` : ''}.`,
  ];

  replacePack(input.componentPack, next);
  return { componentPack: input.componentPack, change };
}

function resolveReplacementIndex(input: UpdateComponentSelectionInput, role: string): number {
  if (input.action !== 'replace') return -1;
  if (input.replaceComponentId) {
    const index = input.componentPack.candidates.findIndex(
      (candidate) => candidate.componentId === input.replaceComponentId,
    );
    if (index < 0 || input.componentPack.candidates[index]?.role !== role) {
      throw new ComponentSelectionUpdateError(
        'role_not_selected',
        `Component ${input.replaceComponentId} is not selected for role "${role}".`,
      );
    }
    return index;
  }
  return input.componentPack.candidates.findIndex((candidate) => candidate.role === role);
}

function findExactComponent(
  components: IndexedComponentRecord[],
  value: string,
): IndexedComponentRecord | undefined {
  const needle = normalize(value);
  return components.find((component) =>
    [component.id, component.shortName, component.title].some((item) => normalize(item) === needle),
  );
}

function normalize(value: string): string {
  return value.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
}

async function readComponentGroups(workspaceRoot: string): Promise<ComponentGroupRecord[]> {
  try {
    const parsed = JSON.parse(
      await readWorkspaceFile(workspaceRoot, DESIGN_INDEX_PATHS.componentGroups),
    ) as { groups?: ComponentGroupRecord[] };
    return Array.isArray(parsed.groups) ? parsed.groups : [];
  } catch {
    return [];
  }
}

function componentFamily(
  component: IndexedComponentRecord,
  components: IndexedComponentRecord[],
  groups: ComponentGroupRecord[],
): string[] {
  const ids = new Set([component.id]);
  for (const group of groups) {
    if (group.componentIds.includes(component.id)) {
      for (const id of group.componentIds) ids.add(id);
    }
  }
  return components.filter((item) => ids.has(item.id)).map((item) => item.shortName);
}

function componentPackStatus(pack: TaskRelevantComponentPack): TaskRelevantComponentPack['status'] {
  if (pack.candidates.length === 0) return 'missing';
  if (
    pack.stale ||
    (pack.selectionPlan?.gaps.length ?? 0) > 0 ||
    pack.candidates.every((candidate) => candidate.confidence === 'low')
  ) {
    return 'weak';
  }
  return 'ready';
}

function replacePack(target: TaskRelevantComponentPack, source: TaskRelevantComponentPack): void {
  for (const key of Object.keys(target) as Array<keyof TaskRelevantComponentPack>) {
    if (!(key in source)) delete target[key];
  }
  Object.assign(target, source);
}
