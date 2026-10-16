import {
  DESIGN_INDEX_PATHS,
  type ComponentSelectionMap,
  type ComponentUsageCard,
  type IndexedComponentRecord,
  type ProjectAgentNote,
  type ScreenIndexRecord,
} from '@sber-designer/design-indexer';
import {
  designBriefForbidsExistingScreenReferences,
  type DesignBrief,
  type ScreenStructurePlan,
} from '@sber-designer/shared-types';

import { readWorkspaceFile } from '../safe-fs';
import {
  collectImportConventions,
  renderImportConventionsBlock,
  type ImportConvention,
} from './import-conventions';
import {
  extractComponentReplacementIntent,
  extractForbiddenComponentNames,
  extractRequiredComponentNames,
  positiveComponentIntentText,
} from './component-intent';
import {
  buildComponentHydrationBatches,
  renderComponentHydrationBatches,
  type ComponentHydrationManifest,
} from './component-hydration';
import {
  descriptionDivergenceFieldsByComponent,
  resolveSelectedComponentContracts,
  type ComponentContractResolutionTrace,
  type ResolvedComponentPublicImport,
} from './component-resolution';
import {
  bestComponentForRole,
  isIndexModule,
  normalizeComponentFilePath,
  publicBarrelsByDirectory,
  searchConfidence,
  type ComponentRoleQuery as RoleQuery,
  type ScoredComponent,
} from './component-selection-ranker';
import {
  componentFamilyNamesByComponent,
  groupComponentNotes,
  loadIndexState,
  normalizeSearch,
  readComponentGroups,
  readJsonl,
  resolveComponentSelectionMap,
} from './component-pack-index';
import { componentPackRequestWithDesignBrief, sameComponentName } from './component-pack-request';

export { renderComponentSelectionMap } from './component-selection-map';
export { componentPackRequestWithDesignBrief } from './component-pack-request';

export interface ComponentUseCandidate {
  role: string;
  componentId: string;
  title: string;
  shortName: string;
  importHint?: string;
  recommendedStoryId?: string | undefined;
  confidence: 'high' | 'medium' | 'low';
  recordConfidence: IndexedComponentRecord['confidence'];
  score: number;
  reason: string;
  guidance: string[];
  /** Variant semantics from the usage card, e.g. "variant: outlined | contained". */
  variantHints?: string[];
  /** Required props the agent must set to instantiate (usage card, 0082). */
  requiredProps?: string[];
  /** Things this component must not be used for (usage card). */
  whenNotToUse?: string[];
  /** One real mined JSX usage from the project (usage card). */
  snippet?: { code: string; sourcePath: string };
  /** Short names from the same design-index component group as this candidate. */
  componentFamily?: string[];
  /** Required CSS classes for css-catalog components. */
  requiredClasses?: string[];
  /** Explicitly required by the user's request or structured Design brief. */
  userRequired?: boolean;
  /** ScreenStructurePlan regions whose role selected this component. */
  regionIds?: string[];
  /** Optional modifier classes for css-catalog components. */
  modifiers?: string[];
  /** Canonical HTML snippet mined from the css-catalog source. */
  canonicalHtml?: string;
  /** Exact public symbol/module resolved from project usage and current barrels. */
  publicImport?: ResolvedComponentPublicImport;
  /** Authored description fields rejected because project surfaces diverged. */
  divergedFields?: string[];
  /** Source-backed instantiation decision recorded before prompt hydration. */
  resolution?: ComponentContractResolutionTrace;
}

export interface TaskRelevantComponentPack {
  status: 'ready' | 'weak' | 'missing';
  source: 'design-index';
  stale: boolean;
  taskKind: 'image-to-screen' | 'screen-generation' | 'screen-redesign' | 'screen-edit' | 'unknown';
  candidates: ComponentUseCandidate[];
  diagnostics: string[];
  /** Complete compact project component map used for planning before hydration. */
  selectionMap?: TaskRelevantComponentSelectionMap;
  /** Role-by-role explanation of why this run hydrated candidates or recorded DS gaps. */
  selectionPlan?: TaskRelevantComponentSelectionPlan;
  /** Byte-measured prompt hydration grouped by concrete screen regions. */
  hydrationManifest?: ComponentHydrationManifest;
  /** Brief-level policy that forbids layout/content references to existing screens. */
  screenReferencePolicy?: 'forbidden';
  /** G1 (0083): how the project's own screens import each symbol, with collisions. */
  importConventions?: ImportConvention[];
  /** B6.2.7: bounded component additions/replacements made later in the same run. */
  lateSelection?: TaskRelevantComponentLateSelection;
}

export interface TaskRelevantComponentSelectionChange {
  sequence: number;
  action: 'add' | 'replace';
  role: string;
  regionIds: string[];
  componentId: string;
  replacedComponentId?: string;
  reason: string;
  resolutionStatus: ComponentContractResolutionTrace['status'];
}

export interface TaskRelevantComponentLateSelection {
  version: 1;
  maxChanges: number;
  changes: TaskRelevantComponentSelectionChange[];
}

export interface TaskRelevantComponentSelectionMap extends ComponentSelectionMap {
  source: 'artifact' | 'derived';
  stale: boolean;
}

export interface TaskRelevantComponentSelectionGap {
  role: string;
  regionIds: string[];
  reason: string;
  bestScore?: number;
}

export interface TaskRelevantComponentSelectionPlan {
  version: 1;
  source: 'screen-structure-plan' | 'legacy-role-profile';
  plannedRoles: string[];
  /** Roles belonging to required structure-plan regions; absent on legacy packs. */
  requiredRoles?: string[];
  gaps: TaskRelevantComponentSelectionGap[];
  resolutions?: ComponentContractResolutionTrace[];
}

export interface BuildTaskRelevantComponentPackInput {
  workspaceRoot: string;
  taskKind?: TaskRelevantComponentPack['taskKind'];
  userRequest?: string;
  designBrief?: DesignBrief | null | undefined;
  screenStructurePlan?: ScreenStructurePlan | null;
  hydrationBatchByteBudget?: number;
}

const MIN_STRUCTURE_PLAN_RELEVANCE_SCORE = 4;

const SCREEN_ROLE_QUERIES: RoleQuery[] = [
  {
    role: 'breadcrumb',
    queries: ['breadcrumb trail', 'breadcrumbs navigation hierarchy'],
  },
  {
    role: 'page-header',
    queries: ['page header title actions pagebar', 'screen header page title'],
  },
  {
    role: 'section-header',
    queries: ['section header group header dashboard group', 'content section label divider'],
  },
  {
    role: 'content-panel',
    queries: ['tile content panel card surface', 'white panel content surface card tile'],
  },
  {
    role: 'navigation',
    queries: ['navigation sidebar menu'],
  },
  {
    role: 'tabs',
    queries: ['tabs page tabs segmented navigation'],
  },
  {
    role: 'actions',
    queries: ['button action icon button link primary secondary actions'],
  },
  {
    role: 'status-badge',
    queries: ['status badge tag chip state indicator', 'badge status label'],
  },
  {
    role: 'data-table',
    queries: ['table data grid list rows', 'grid table registry rows columns'],
  },
  {
    role: 'filters',
    queries: ['filter search input control'],
  },
  {
    role: 'typography',
    queries: ['text typography body caption title heading label'],
  },
  {
    role: 'link',
    queries: ['link anchor text link navigation link'],
  },
];

const DENSE_WORKFLOW_ROLE_QUERIES: RoleQuery[] = [
  {
    role: 'data-table',
    queries: [
      'data table grid rows registry list funds assets',
      'dense table column scanning row-heavy operational table',
    ],
  },
  {
    role: 'filters',
    queries: ['filter bar search controls dense registry', 'filters search inputs toolbar'],
  },
  {
    role: 'mass-actions',
    queries: [
      'mass actions bulk action bar selected rows batch operations',
      'multi select row actions toolbar',
    ],
  },
  {
    role: 'side-preview',
    queries: [
      'side preview rail selected row details master detail',
      'preview panel details side rail',
    ],
  },
];

export async function buildTaskRelevantComponentPack(
  input: BuildTaskRelevantComponentPackInput,
): Promise<TaskRelevantComponentPack> {
  const componentRequest = componentPackRequestWithDesignBrief(
    input.userRequest,
    input.designBrief,
  );
  const forbiddenComponentNames = extractForbiddenComponentNames(componentRequest);
  const screenReferencesForbidden = designBriefForbidsExistingScreenReferences(input.designBrief);
  const [components, notes, usageCards, componentGroups, indexState, screens] = await Promise.all([
    readJsonl<IndexedComponentRecord>(input.workspaceRoot, DESIGN_INDEX_PATHS.components),
    readJsonl<ProjectAgentNote>(input.workspaceRoot, DESIGN_INDEX_PATHS.agentNotes),
    readJsonl<ComponentUsageCard>(input.workspaceRoot, DESIGN_INDEX_PATHS.usageCards),
    readComponentGroups(input.workspaceRoot),
    loadIndexState(input.workspaceRoot),
    readJsonl<ScreenIndexRecord>(input.workspaceRoot, DESIGN_INDEX_PATHS.screens),
  ]);
  const selectionMap = resolveComponentSelectionMap({
    components,
    usageCards,
    indexState,
  });
  const divergenceFieldsByComponent = descriptionDivergenceFieldsByComponent(
    indexState.diagnostics,
  );
  const notesByComponent = groupComponentNotes(notes);
  const cardsByComponent = new Map(usageCards.map((card) => [card.componentId, card]));
  const familyNamesByComponent = componentFamilyNamesByComponent(components, componentGroups);
  const diagnostics: string[] = [];
  const publicBarrels = publicBarrelsByDirectory(components);
  const roleQueries = input.screenStructurePlan
    ? roleQueriesForScreenStructurePlan(input.screenStructurePlan)
    : roleQueriesForTask(
        input.taskKind ?? 'unknown',
        positiveComponentIntentText(componentRequest),
      );
  const selectionPlan: TaskRelevantComponentSelectionPlan = {
    version: 1,
    source: input.screenStructurePlan ? 'screen-structure-plan' : 'legacy-role-profile',
    plannedRoles: roleQueries.map((query) => query.role),
    ...(input.screenStructurePlan
      ? { requiredRoles: requiredRolesForScreenStructurePlan(input.screenStructurePlan) }
      : {}),
    gaps: [],
  };

  if (components.length === 0) {
    if (selectionPlan.source === 'screen-structure-plan') {
      selectionPlan.gaps = roleQueries.map((query) => ({
        role: query.role,
        regionIds: query.regionIds ?? [],
        reason: 'No indexed project component is available for this planned UI role.',
      }));
    }
    return {
      status: 'missing',
      source: 'design-index',
      stale: indexState.stale,
      taskKind: input.taskKind ?? 'unknown',
      candidates: [],
      diagnostics: ['No indexed components found in .sber-designer/design-index/components.jsonl.'],
      selectionMap,
      selectionPlan,
      hydrationManifest: buildComponentHydrationBatches([], input.hydrationBatchByteBudget)
        .manifest,
      ...(screenReferencesForbidden ? { screenReferencePolicy: 'forbidden' as const } : {}),
    };
  }

  const candidates: ComponentUseCandidate[] = [];
  const usedComponentIds = new Set<string>();
  for (const roleQuery of roleQueries) {
    const scored = bestComponentForRole({
      roleQuery,
      components,
      notesByComponent,
      cardsByComponent,
      usedComponentIds,
      publicBarrels,
      forbiddenComponentNames,
    });
    const belowPlanThreshold =
      selectionPlan.source === 'screen-structure-plan' &&
      (!scored || scored.semanticScore < MIN_STRUCTURE_PLAN_RELEVANCE_SCORE);
    if (!scored || belowPlanThreshold) {
      const gapReason = scored
        ? `Best indexed candidate semantic relevance scored ${scored.semanticScore}, below the threshold ${MIN_STRUCTURE_PLAN_RELEVANCE_SCORE}.`
        : 'No indexed component matched this planned UI role.';
      diagnostics.push(`Design-system gap for role ${roleQuery.role}: ${gapReason}`);
      if (selectionPlan.source === 'screen-structure-plan') {
        selectionPlan.gaps.push({
          role: roleQuery.role,
          regionIds: roleQuery.regionIds ?? [],
          reason: gapReason,
          ...(scored ? { bestScore: scored.semanticScore } : {}),
        });
      }
      continue;
    }
    usedComponentIds.add(scored.component.id);
    candidates.push(
      componentUseCandidateFromScore(
        roleQuery.role,
        scored,
        notesByComponent,
        cardsByComponent.get(scored.component.id),
        familyNamesByComponent.get(scored.component.id) ?? [],
        roleQuery.regionIds ?? [],
        divergenceFieldsByComponent.get(scored.component.id) ?? [],
      ),
    );
  }

  ensureUserRequiredCandidates({
    requestedNames: extractRequiredComponentNames(componentRequest),
    components,
    candidates,
    notesByComponent,
    cardsByComponent,
    familyNamesByComponent,
    divergenceFieldsByComponent,
  });
  if (forbiddenComponentNames.length > 0) {
    diagnostics.push(
      `Explicit user constraint excludes component${forbiddenComponentNames.length === 1 ? '' : 's'}: ${forbiddenComponentNames.join(', ')}.`,
    );
  }
  const importConventions = screenReferencesForbidden
    ? []
    : await mineImportConventions(input.workspaceRoot, screens);
  selectionPlan.resolutions = await resolveSelectedComponentContracts({
    workspaceRoot: input.workspaceRoot,
    candidates,
    components,
    cardsByComponent,
    divergenceFieldsByComponent,
    importConventions,
    userRequest: componentRequest,
    designBrief: input.designBrief,
    ...(input.screenStructurePlan !== undefined
      ? { screenStructurePlan: input.screenStructurePlan }
      : {}),
    allowScreenUsageEvidence: !screenReferencesForbidden,
  });
  if (screenReferencesForbidden) {
    for (const candidate of candidates) delete candidate.snippet;
    diagnostics.push(
      'Explicit user constraint forbids existing screen/page implementations as layout or content references.',
    );
  }
  const hydrationManifest = buildComponentHydrationBatches(
    candidates,
    input.hydrationBatchByteBudget,
  ).manifest;

  return {
    status:
      candidates.length === 0
        ? 'missing'
        : selectionPlan.gaps.length > 0 ||
            candidates.every((candidate) => candidate.confidence === 'low')
          ? 'weak'
          : 'ready',
    source: 'design-index',
    stale: indexState.stale,
    taskKind: input.taskKind ?? 'unknown',
    candidates,
    diagnostics,
    selectionMap,
    selectionPlan,
    hydrationManifest,
    ...(screenReferencesForbidden ? { screenReferencePolicy: 'forbidden' as const } : {}),
    ...(importConventions.length > 0 ? { importConventions } : {}),
  };
}

function ensureUserRequiredCandidates(input: {
  requestedNames: string[];
  components: IndexedComponentRecord[];
  candidates: ComponentUseCandidate[];
  notesByComponent: Map<string, ProjectAgentNote[]>;
  cardsByComponent: Map<string, ComponentUsageCard>;
  familyNamesByComponent: Map<string, string[]>;
  divergenceFieldsByComponent: Map<string, string[]>;
}): void {
  for (const requestedName of input.requestedNames) {
    const existing = input.candidates.find((candidate) =>
      sameComponentName(candidate.shortName, requestedName),
    );
    if (existing) {
      existing.userRequired = true;
      existing.guidance = [
        `User requirement: use ${existing.shortName}; substitutes do not satisfy this requirement.`,
        ...existing.guidance,
      ];
      continue;
    }
    const component = input.components.find((candidate) =>
      [candidate.shortName, candidate.id, candidate.title].some((value) =>
        sameComponentName(value, requestedName),
      ),
    );
    if (!component) continue;
    const notes = input.notesByComponent.get(component.id) ?? [];
    const scored = {
      component,
      score: 100,
      semanticScore: 100,
      incidentalScore: 0,
      sourceAuthority: 0,
      matchedFields: ['explicit user requirement'],
      noteGuidance: notes.map((note) => note.note),
    };
    const candidate = componentUseCandidateFromScore(
      `requested-component-${requestedName.toLowerCase()}`,
      scored,
      input.notesByComponent,
      input.cardsByComponent.get(component.id),
      input.familyNamesByComponent.get(component.id) ?? [],
      [],
      input.divergenceFieldsByComponent.get(component.id) ?? [],
    );
    candidate.userRequired = true;
    candidate.guidance = [
      `User requirement: use ${candidate.shortName}; substitutes do not satisfy this requirement.`,
      ...candidate.guidance,
    ];
    input.candidates.unshift(candidate);
  }
}

const MAX_CONVENTION_FILES = 40;
const MAX_CONVENTION_FILE_BYTES = 200_000;

/**
 * G1 (0083): mine how the project's own screens import each symbol, so the pack
 * can tell the model the canonical module and flag name collisions (the kit and
 * MUI both export `Grid`/`Table`). Best-effort and bounded — never fails the pack.
 */
async function mineImportConventions(
  workspaceRoot: string,
  screens: ScreenIndexRecord[],
): Promise<ImportConvention[]> {
  const paths: string[] = [];
  for (const screen of screens) {
    // Mine ONLY screen implementation files. Story files (`*.stories.*`) are full
    // of Storybook scaffolding (Meta/StoryObj/@storybook, *Props) that pollutes
    // the cheat-sheet with non-runtime, non-component imports.
    const filePath = screen.implementationPath;
    if (filePath && !/\.stories\./.test(filePath)) paths.push(filePath);
    if (paths.length >= MAX_CONVENTION_FILES) break;
  }
  const files: { contents: string }[] = [];
  for (const filePath of paths) {
    try {
      const contents = await readWorkspaceFile(workspaceRoot, filePath);
      if (contents.length <= MAX_CONVENTION_FILE_BYTES) files.push({ contents });
    } catch {
      // Missing/unreadable screen file: skip, keep mining the rest.
    }
  }
  return collectImportConventions(files);
}

export function renderTaskRelevantComponentPack(pack: TaskRelevantComponentPack): string {
  const lines = ['## Task-Relevant Component Pack', ''];
  if (pack.status === 'missing') {
    lines.push(
      '_No task-relevant project component pack is available. Use the project index and catalog if available._',
    );
    appendSelectionPlan(lines, pack.selectionPlan);
    return lines.join('\n');
  }
  lines.push(
    'Use these project components before creating raw markup for matching regions. If you skip one, explain why in the final response.',
    '',
    `- status: ${pack.status}`,
    `- stale: ${pack.stale ? 'yes' : 'no'}`,
    `- taskKind: ${pack.taskKind}`,
  );
  appendSelectionPlan(lines, pack.selectionPlan);
  if (pack.diagnostics.length > 0) {
    lines.push('- diagnostics:');
    for (const diagnostic of pack.diagnostics.slice(0, 6)) {
      lines.push(`  - ${diagnostic}`);
    }
  }
  if (pack.lateSelection) {
    lines.push(
      `- lateSelectionBudget: ${pack.lateSelection.changes.length}/${pack.lateSelection.maxChanges}`,
    );
    for (const change of pack.lateSelection.changes) {
      lines.push(
        `  - #${change.sequence} ${change.action} ${change.role}: ${change.replacedComponentId ? `${change.replacedComponentId} -> ` : ''}${change.componentId} (${change.resolutionStatus})`,
      );
    }
  }
  if (pack.screenReferencePolicy === 'forbidden') {
    lines.push(
      '- screenReferenceConstraint: do not inspect or derive layout, content, or visual direction from existing screen/page implementations. Inspect component source or Storybook examples only for API and import verification.',
    );
  } else if (pack.stale) {
    lines.push(
      '- staleHandling: project index may lag behind source. Inspect the active implementation file, active story file, and one nearby example before broad catalog exploration; prefer current source over stale records.',
    );
  }
  if (pack.status === 'weak') {
    lines.push(
      '- confidenceWarning: component evidence is weak or stale. Verify the public barrel/index export before importing any symbol you only saw in an implementation file.',
    );
  }
  const conventionLines = renderImportConventionsBlock(pack.importConventions ?? []);
  if (conventionLines.length > 0) {
    lines.push('', ...conventionLines);
  }
  const hydration = renderComponentHydrationBatches(pack.candidates, pack.hydrationManifest);
  if (hydration) lines.push('', hydration);
  return lines.join('\n');
}

function appendSelectionPlan(
  lines: string[],
  selectionPlan: TaskRelevantComponentSelectionPlan | null | undefined,
): void {
  if (!selectionPlan) return;
  lines.push(
    `- selectionSource: ${selectionPlan.source}`,
    `- plannedRoleCount: ${selectionPlan.plannedRoles.length}`,
    `- designSystemGapCount: ${selectionPlan.gaps.length}`,
    '- lateSelection: if implementation evidence reveals a wrong or missing planned-role component, use component search + get_usage_card, then update_component_selection and continue this same run. Do not ask for a new user turn.',
  );
  if (selectionPlan.resolutions) {
    lines.push(
      `- componentResolutionCount: ${selectionPlan.resolutions.length}`,
      `- resolvedComponentCount: ${selectionPlan.resolutions.filter((item) => item.status === 'resolved').length}`,
      `- divergedResolutionCount: ${selectionPlan.resolutions.filter((item) => item.divergedFields.length > 0).length}`,
    );
  }
  if (selectionPlan.gaps.length === 0) return;
  lines.push('- designSystemGaps:');
  for (const gap of selectionPlan.gaps) {
    const regionSuffix = gap.regionIds.length > 0 ? `; regions: ${gap.regionIds.join(', ')}` : '';
    lines.push(`  - ${gap.role}${regionSuffix} — ${gap.reason}`);
  }
}

function roleQueriesForScreenStructurePlan(plan: ScreenStructurePlan): RoleQuery[] {
  const dataByRegion = new Map<string, string[]>();
  const actionsByRegion = new Map<string, string[]>();
  const statesByRegion = new Map<string, string[]>();
  for (const item of plan.data) {
    appendMapValue(dataByRegion, item.regionId, `${item.kind} ${item.description}`);
  }
  for (const action of plan.actions) {
    appendMapValue(actionsByRegion, action.regionId, `${action.priority} ${action.label}`);
  }
  for (const state of plan.states) {
    if (state.regionId) appendMapValue(statesByRegion, state.regionId, state.state);
  }
  const queries = plan.regions.flatMap((region) =>
    region.uiRoles.map((role) => {
      const roleWords = role.replace(/[-_]+/gu, ' ').trim();
      const context = [region.label, region.purpose].filter(Boolean).join(' ');
      return {
        role,
        regionIds: [region.id],
        queries: Array.from(
          new Set(
            [
              roleWords,
              `${roleWords} ${context}`,
              ...(dataByRegion.get(region.id) ?? []).map((item) => `${roleWords} ${item}`),
              ...(actionsByRegion.get(region.id) ?? []).map((item) => `${roleWords} ${item}`),
              ...(statesByRegion.get(region.id) ?? []).map((item) => `${roleWords} ${item}`),
            ]
              .map((query) => query.trim())
              .filter(Boolean),
          ),
        ),
      };
    }),
  );
  return mergeRoleQueries(queries);
}

function requiredRolesForScreenStructurePlan(plan: ScreenStructurePlan): string[] {
  return Array.from(
    new Set(
      plan.regions
        .filter((region) => region.required)
        .flatMap((region) => region.uiRoles)
        .map((role) => role.trim())
        .filter(Boolean),
    ),
  );
}

function appendMapValue(target: Map<string, string[]>, key: string, value: string): void {
  target.set(key, [...(target.get(key) ?? []), value]);
}

function roleQueriesForTask(
  taskKind: TaskRelevantComponentPack['taskKind'],
  userRequest: string | undefined,
): RoleQuery[] {
  const request = normalizeSearch(userRequest ?? '');
  const replacementIntent = extractComponentReplacementIntent(userRequest);
  const replacementTargetQueries = replacementIntent
    ? [
        {
          role: `requested-component-${replacementIntent.required.toLowerCase()}`,
          queries: [
            replacementIntent.required,
            `${replacementIntent.required} component`,
            `${replacementIntent.required} replacement component`,
          ],
        },
      ]
    : [];
  const denseQueries = isDenseWorkflowRequest(request) ? DENSE_WORKFLOW_ROLE_QUERIES : [];
  const requestHints = request.includes('admin')
    ? [{ role: 'administration-content', queries: ['administration directory catalog task'] }]
    : [];
  if (taskKind === 'screen-edit') {
    return mergeRoleQueries([
      ...replacementTargetQueries,
      ...denseQueries,
      ...SCREEN_ROLE_QUERIES,
      ...requestHints,
    ]);
  }
  if (!request) return SCREEN_ROLE_QUERIES;
  return mergeRoleQueries([
    ...replacementTargetQueries,
    ...denseQueries,
    ...SCREEN_ROLE_QUERIES,
    ...requestHints,
  ]);
}

function isDenseWorkflowRequest(request: string): boolean {
  return /\b(funds?|assets?|registry|registries|list|table|grid|rows?|filters?|mass actions?|bulk actions?|side preview|preview rail|master detail|dense)\b/iu.test(
    request,
  );
}

function mergeRoleQueries(queries: RoleQuery[]): RoleQuery[] {
  const byRole = new Map<string, RoleQuery>();
  for (const query of queries) {
    const existing = byRole.get(query.role);
    if (!existing) {
      byRole.set(query.role, {
        role: query.role,
        queries: [...query.queries],
        ...(query.regionIds ? { regionIds: [...query.regionIds] } : {}),
      });
      continue;
    }
    existing.queries = Array.from(new Set([...existing.queries, ...query.queries]));
    if (query.regionIds) {
      existing.regionIds = Array.from(new Set([...(existing.regionIds ?? []), ...query.regionIds]));
    }
  }
  return Array.from(byRole.values());
}

export function componentUseCandidateFromScore(
  role: string,
  scored: ScoredComponent,
  notesByComponent: Map<string, ProjectAgentNote[]>,
  card: ComponentUsageCard | undefined,
  componentFamily: string[],
  regionIds: string[] = [],
  divergedFields: string[] = [],
): ComponentUseCandidate {
  const component = scored.component;
  const noteGuidance = notesByComponent
    .get(component.id)
    ?.filter((note) => note.intent === 'prefer' || note.intent === 'usage')
    .map((note) => note.note.trim())
    .filter(Boolean);
  const confirmedCardFacts = (card?.facts ?? [])
    .filter((fact) => fact.status === 'confirmed' && fact.source !== 'agent-note')
    .map((fact) => fact.text.trim());
  const guidance = Array.from(
    new Set(
      [
        publicImportContractGuidance(component),
        ...confirmedCardFacts,
        ...(component.descriptionLayer?.agentGuidance ?? []),
        ...(component.descriptionLayer?.usage.map((usage) => usage.when) ?? []),
        ...(noteGuidance ?? []),
      ].filter(Boolean),
    ),
  );
  const variantHints = (card?.variantGuidance ?? []).slice(0, 3).map(renderVariantHint);
  const requiredProps = (card?.propsThatMatter ?? [])
    .filter((prop) => prop.note === 'required prop')
    .map((prop) => prop.name)
    .slice(0, 8);
  const whenNotToUse = (card?.whenNotToUse ?? []).slice(0, 2);
  const snippet = card?.snippets[0];
  return {
    role,
    componentId: component.id,
    title: component.title,
    shortName: component.shortName,
    importHint: component.filePath,
    ...(component.stories[0]?.id ? { recommendedStoryId: component.stories[0].id } : {}),
    confidence: searchConfidence(scored.score, component.confidence),
    recordConfidence: component.confidence,
    score: scored.score,
    reason: `Matched ${role} via ${scored.matchedFields.join(', ')}.`,
    guidance: guidance.length > 0 ? guidance : [`Prefer ${component.shortName} for ${role}.`],
    ...(regionIds.length > 0 ? { regionIds } : {}),
    ...(divergedFields.length > 0 ? { divergedFields } : {}),
    ...(componentFamily.length > 1 ? { componentFamily } : {}),
    ...(variantHints.length > 0 ? { variantHints } : {}),
    ...(requiredProps.length > 0 ? { requiredProps } : {}),
    ...(whenNotToUse.length > 0 ? { whenNotToUse } : {}),
    ...(snippet ? { snippet: { code: snippet.code, sourcePath: snippet.sourcePath } } : {}),
    ...(component.requiredClasses?.length ? { requiredClasses: component.requiredClasses } : {}),
    ...(component.modifiers?.length ? { modifiers: component.modifiers } : {}),
    ...(component.canonicalHtml ? { canonicalHtml: component.canonicalHtml } : {}),
  };
}

function renderVariantHint(guidance: ComponentUsageCard['variantGuidance'][number]): string {
  const values = guidance.values
    .map((value) => (value.meaning ? `${value.value} (${value.meaning})` : value.value))
    .join(' | ');
  return `${guidance.prop}: ${values}`;
}

function publicImportContractGuidance(component: IndexedComponentRecord): string {
  const moduleLabel = isIndexModule(component.filePath)
    ? component.filePath
    : implementationPublicModuleHint(component.filePath);
  return [
    `Public import contract: use the indexed component name \`${component.shortName}\``,
    `from \`${moduleLabel}\`; do not import implementation-local names from nested source files unless that public module exports them.`,
  ].join(' ');
}

function implementationPublicModuleHint(filePath: string): string {
  const normalized = normalizeComponentFilePath(filePath);
  const extensionless = normalized.replace(/\.[cm]?[tj]sx?$/iu, '');
  return extensionless;
}
