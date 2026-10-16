import type {
  DesignBrief,
  DesignDirectionSelection,
  ScreenStructureActionRequirement,
  ScreenStructureDataRequirement,
  ScreenStructurePlan,
  ScreenStructurePlanSource,
  ScreenStructureRegion,
  ScreenStructureStateRequirement,
  ScreenStructureTaskKind,
  ModalDefaults,
  ProjectScreenSurface,
} from '@sber-designer/shared-types';
import { MODAL_FALLBACK_DEFAULTS } from '@sber-designer/shared-types';
import { positiveComponentIntentText } from '../component-intelligence/component-intent';

export interface BuildScreenStructurePlanInput {
  taskKind: ScreenStructureTaskKind;
  userRequest: string;
  designBrief?: DesignBrief | null;
  directionSelection?: DesignDirectionSelection | null;
  surface?: ProjectScreenSurface;
  modal?: ModalDefaults | null;
  target?: {
    screenId?: string | undefined;
    screenName?: string | undefined;
    files?: string[] | undefined;
  } | null;
}

interface RegionSeed {
  label: string;
  purpose: string;
  roles: string[];
  required?: boolean;
}

const PLAN_TASK_KINDS = new Set<ScreenStructureTaskKind>([
  'image-to-screen',
  'screen-generation',
  'screen-redesign',
]);

export function buildScreenStructurePlan(
  input: BuildScreenStructurePlanInput,
): ScreenStructurePlan | null {
  if (!PLAN_TASK_KINDS.has(input.taskKind)) return null;
  const source = planSource(input.userRequest, input.designBrief, input.directionSelection);
  const templateRegions = extractTemplateRegions(input.userRequest);
  const intentRequest = generatedScreenUserInstruction(input.userRequest) ?? input.userRequest;
  const positiveRequest = positiveComponentIntentText(intentRequest);
  const surface = input.surface ?? inferredSurface(input.userRequest);
  const modal = surface === 'modal' ? (input.modal ?? MODAL_FALLBACK_DEFAULTS) : null;
  const seeds =
    templateRegions.length > 0
      ? templateRegions
      : surface === 'modal'
        ? modalRegionSeeds()
        : inferRegions(positiveRequest, input.designBrief);
  const regions = uniqueRegions(seeds);
  const requirementSource = templateRegions.length > 0 ? 'template' : 'inferred';
  const intent = extractIntent(intentRequest);
  const data = regions.flatMap((region) => dataForRegion(region, requirementSource));
  const actions = regions.flatMap((region) => actionsForRegion(region, requirementSource, intent));
  const states = stateRequirements(intentRequest, regions, source);
  const targetFiles = Array.from(
    new Set((input.target?.files ?? []).map(normalizeLine).filter(Boolean)),
  );
  const target = input.target
    ? {
        ...(input.target.screenId ? { screenId: input.target.screenId } : {}),
        ...(input.target.screenName ? { screenName: input.target.screenName } : {}),
        files: targetFiles,
      }
    : undefined;
  const assumptions = planAssumptions({
    request: intentRequest,
    source,
    regions,
    taskKind: input.taskKind,
  });
  return {
    version: 1,
    taskKind: input.taskKind,
    source,
    surface,
    intent,
    ...(target ? { target } : {}),
    regions,
    data,
    actions,
    states,
    constraints: uniqueStrings(input.designBrief?.axes.constraints ?? []).slice(0, 8),
    assumptions,
    ...(modal ? { modal } : {}),
    ...(input.designBrief ? { designBrief: input.designBrief } : {}),
    ...(input.directionSelection ? { directionSelection: input.directionSelection } : {}),
  };
}

function inferredSurface(request: string): ProjectScreenSurface {
  return /\b(?:modal|dialog)\b|(?:модал|диалог)/iu.test(request) ? 'modal' : 'page';
}

export function renderScreenStructurePlan(plan: ScreenStructurePlan | null | undefined): string {
  if (!plan) return '';
  const lines = [
    '## Screen Structure Plan',
    '',
    'This run-owned plan is the mandatory information-architecture checkpoint before the first screen write.',
    '- Account for every required region before editing. Refine a region from inspected evidence when needed, but do not silently replace the user intent.',
    '- Choose project components against these concrete needs; do not fill a fixed generic component quota.',
    '- Artifact: `.sber-designer/runs/<runId>/screen-structure-plan.json`.',
    `- taskKind: ${plan.taskKind}`,
    `- source: ${plan.source}`,
    `- surface: ${plan.surface ?? 'page'}`,
    ...(plan.modal
      ? [
          `- modal width: ${plan.modal.width}`,
          `- modal height: ${plan.modal.height}`,
          `- modal long content: ${plan.modal.longContent}`,
        ]
      : []),
    `- intent: ${plan.intent}`,
    '',
    '### Regions',
  ];
  for (const region of plan.regions) {
    lines.push(
      `- ${region.id}: ${region.label} (${region.required ? 'required' : 'optional'})`,
      `  - purpose: ${region.purpose}`,
      `  - uiRoles: ${region.uiRoles.join(', ') || 'unresolved'}`,
    );
  }
  lines.push('', '### Data');
  if (plan.data.length === 0) lines.push('- none explicitly required');
  for (const item of plan.data) {
    lines.push(`- ${item.regionId}: ${item.kind} — ${item.description} [${item.source}]`);
  }
  lines.push('', '### Actions');
  if (plan.actions.length === 0) lines.push('- none explicitly required');
  for (const action of plan.actions) {
    lines.push(`- ${action.regionId}: ${action.label} (${action.priority}, ${action.source})`);
  }
  lines.push('', '### States');
  if (plan.states.length === 0) lines.push('- no data lifecycle state was inferred');
  for (const state of plan.states) {
    lines.push(`- ${state.state}${state.regionId ? ` → ${state.regionId}` : ''} [${state.source}]`);
  }
  if (plan.constraints.length > 0) {
    lines.push('', '### Constraints', ...plan.constraints.map((item) => `- ${item}`));
  }
  if (plan.assumptions.length > 0) {
    lines.push('', '### Planning assumptions', ...plan.assumptions.map((item) => `- ${item}`));
  }
  return lines.join('\n');
}

function modalRegionSeeds(): RegionSeed[] {
  return [
    region(
      'Modal header',
      'Name the dialog task and expose a visible close control.',
      ['dialog-header'],
      false,
    ),
    region('Modal body', 'Present the dialog content, fields, feedback, or confirmation context.', [
      'dialog-body',
      'form-section',
    ]),
    region('Modal footer actions', 'Expose the primary commit and secondary cancel action.', [
      'action-bar',
    ]),
  ];
}

function planSource(
  request: string,
  brief: DesignBrief | null | undefined,
  direction: DesignDirectionSelection | null | undefined,
): ScreenStructurePlanSource {
  if (direction || brief?.source === 'direction-picker') return 'direction-picker';
  if (extractTemplateRegions(request).length > 0) return 'screen-template';
  if (brief) return 'design-brief';
  return 'request';
}

function extractTemplateRegions(request: string): RegionSeed[] {
  const section = request.match(/(?:^|\n)## Regions\s*\n([\s\S]*?)(?=\n##\s|$)/iu)?.[1];
  if (!section) return [];
  const items: string[] = [];
  let current = '';
  for (const line of section.split(/\r?\n/u)) {
    if (/^\s*-\s+\*\*[^*]+\*\*/u.test(line)) {
      if (current) items.push(current);
      current = line.trim();
      continue;
    }
    if (current && line.trim() && !line.trim().startsWith('<!--')) {
      current += ` ${line.trim()}`;
    }
  }
  if (current) items.push(current);
  return items.flatMap((item) => {
    const match = item.match(/^-\s+\*\*([^*]+)\*\*\s*[—-]\s*(.+)$/u);
    if (!match?.[1] || !match[2]) return [];
    const label = normalizeLine(match[1]);
    const body = normalizeLine(match[2]);
    const roles = Array.from(body.matchAll(/Role:\s*`([^`]+)`/giu)).flatMap((role) =>
      role[1] ? [normalizeRole(role[1])] : [],
    );
    return [
      {
        label,
        purpose: compactPurpose(body),
        roles: roles.length > 0 ? roles : [normalizeRole(label)],
        required: !/\boptional\b|\bif present\b|опциональ|если (?:есть|нуж)/iu.test(body),
      },
    ];
  });
}

function inferRegions(request: string, brief: DesignBrief | null | undefined): RegionSeed[] {
  const text = `${request}\n${brief?.axes.layout ?? ''}`.toLowerCase();
  if (matches(text, ['settings', 'preferences', 'permissions', 'настрой', 'доступ', 'разрешен'])) {
    return [
      region('Settings navigation', 'Switch between configuration groups.', ['settings-nav']),
      region('Settings sections', 'Group configuration controls and save context.', [
        'settings-section',
        'control',
      ]),
      region('Settings actions', 'Commit or reset configuration changes.', ['action-bar']),
    ];
  }
  if (
    matches(text, ['data entry', 'анкета', 'заявк']) ||
    /\bform\b/iu.test(text) ||
    /(?:^|[^\p{L}])(?:форма|форму|формы|формой|форме|формами)(?:[^\p{L}]|$)/iu.test(text) ||
    /\bcreate\s+(?:a\s+)?(?:request|application|record)\b/iu.test(text)
  ) {
    return [
      region('Page header', 'Orient the user and explain the form task.', ['page-header']),
      region('Form body', 'Group labelled fields, helper text, and validation.', [
        'form-section',
        'field',
        'inline-feedback',
      ]),
      region('Form actions', 'Expose the primary commit and secondary exit action.', [
        'action-bar',
      ]),
    ];
  }
  if (
    matches(text, [
      'table',
      'registry',
      'directory',
      'queue',
      'worklist',
      'список',
      'реестр',
      'таблиц',
      'очеред',
    ])
  ) {
    const collectionRoles = ['data-table'];
    if (matches(text, ['status', 'badge', 'статус', 'состояни'])) {
      collectionRoles.push('status-badge');
    }
    if (
      matches(text, ['row action', 'row menu', 'context menu', 'меню строк', 'контекстн']) ||
      (text.includes('действи') && text.includes('строк'))
    ) {
      collectionRoles.push('row-actions');
    }
    if (
      matches(text, [
        'mass action',
        'bulk action',
        'batch operation',
        'selected rows',
        'массов',
        'пакетн',
        'выбранные строки',
      ])
    ) {
      collectionRoles.push('mass-actions');
    }
    const regions = [
      region('Page header', 'Orient the user and summarize the working collection.', [
        'page-header',
      ]),
      region('Collection controls', 'Search, filter, and narrow the working set.', ['filters']),
      region(
        'Collection',
        'Support dense scanning, comparison, status, and row actions.',
        collectionRoles,
      ),
      region('Collection navigation', 'Move through a long result set.', ['pagination'], false),
    ];
    if (
      matches(text, [
        'side preview',
        'preview rail',
        'master detail',
        'details rail',
        'боков',
        'предпросмотр',
        'мастер-детал',
      ])
    ) {
      regions.push(
        region(
          'Side preview',
          'Inspect the selected row without leaving the collection.',
          ['side-preview'],
          false,
        ),
      );
    }
    return regions;
  }
  if (matches(text, ['dashboard', 'overview', 'analytics', 'kpi', 'дашборд', 'обзор', 'аналит'])) {
    return [
      region('Page header', 'Orient the user and establish overview hierarchy.', ['page-header']),
      region('Summary', 'Expose the few headline measures needed for fast scanning.', ['kpi-card']),
      region('Primary analysis', 'Carry the dominant chart, worklist, or decision surface.', [
        'chart-or-worklist',
      ]),
      region(
        'Supporting context',
        'Keep secondary status and decisions subordinate.',
        ['right-rail'],
        false,
      ),
    ];
  }
  if (matches(text, ['detail', 'profile', 'record', 'review', 'карточк', 'детал', 'профил'])) {
    return [
      region('Record header', 'Identify the record, status, and navigation context.', [
        'breadcrumbs',
        'page-header',
      ]),
      region('Record summary', 'Show identity and the most important facts.', ['summary-card']),
      region('Record sections', 'Organize detailed content and activity.', [
        'tabs',
        'detail-section',
      ]),
      region(
        'Supporting context',
        'Show timeline, risks, contacts, or next steps.',
        ['right-rail'],
        false,
      ),
    ];
  }
  if (matches(text, ['step', 'wizard', 'workflow', 'процесс', 'шаг', 'сценар'])) {
    return [
      region('Progress', 'Make the current step and remaining sequence explicit.', ['stepper']),
      region('Current task', 'Carry the fields, evidence, or decision for this step.', [
        'workflow-content',
      ]),
      region('Workflow actions', 'Move backward, forward, or commit the decision.', ['action-bar']),
    ];
  }
  return [
    region('Page header', 'Orient the user and expose explicit page actions.', ['page-header']),
    region('Primary content', 'Implement the central user-requested information and workflow.', [
      'primary-content',
    ]),
  ];
}

function generatedScreenUserInstruction(request: string): string | null {
  const match = request.match(
    /(?:^|\n)User instruction:\s*\n([\s\S]*?)(?=\n\n(?:Selected template:|Existing-screen reference policy:|The screen already exists in the project|Import safety:|Use the existing Storybook catalog|Available catalog snapshot:)|$)/iu,
  );
  const instruction = normalizeLine(match?.[1] ?? '');
  return instruction || null;
}

function region(label: string, purpose: string, roles: string[], required = true): RegionSeed {
  return { label, purpose, roles, required };
}

function uniqueRegions(seeds: RegionSeed[]): ScreenStructureRegion[] {
  const used = new Map<string, number>();
  return seeds.map((seed) => {
    const base = slug(seed.label) || 'region';
    const next = (used.get(base) ?? 0) + 1;
    used.set(base, next);
    return {
      id: next === 1 ? base : `${base}-${next}`,
      label: normalizeLine(seed.label),
      purpose: normalizeLine(seed.purpose),
      uiRoles: uniqueStrings(seed.roles.map(normalizeRole)).filter(Boolean),
      required: seed.required !== false,
    };
  });
}

function dataForRegion(
  region: ScreenStructureRegion,
  source: ScreenStructureDataRequirement['source'],
): ScreenStructureDataRequirement[] {
  const text = `${region.label} ${region.purpose} ${region.uiRoles.join(' ')}`.toLowerCase();
  const kind = matches(text, ['table', 'list', 'collection', 'pagination', 'worklist', 'queue'])
    ? 'collection'
    : matches(text, ['kpi', 'metric', 'chart', 'analytics'])
      ? 'metric'
      : matches(text, ['form', 'field', 'control', 'setting'])
        ? 'form'
        : matches(text, ['record', 'summary', 'detail', 'profile', 'right-rail'])
          ? 'record'
          : 'content';
  if (kind === 'content' && region.uiRoles.every(isPureNavigationRole)) return [];
  return [
    {
      id: `${region.id}-data`,
      regionId: region.id,
      kind,
      description: region.purpose,
      source,
    },
  ];
}

function actionsForRegion(
  region: ScreenStructureRegion,
  source: ScreenStructureActionRequirement['source'],
  intent: string,
): ScreenStructureActionRequirement[] {
  const text = `${region.label} ${region.purpose} ${region.uiRoles.join(' ')}`.toLowerCase();
  const actions: ScreenStructureActionRequirement[] = [];
  if (matches(text, ['action-bar', 'form actions', 'workflow actions'])) {
    actions.push(
      action(region.id, 'Commit the current task', 'primary', source),
      action(region.id, 'Cancel or go back', 'secondary', source),
    );
  } else if (
    matches(text, ['page-header', 'record header']) &&
    (source === 'template' || hasExplicitActionCue(intent))
  ) {
    actions.push(action(region.id, 'Primary page action', 'primary', source));
  }
  if (matches(text, ['row-actions', 'row actions'])) {
    actions.push(action(region.id, 'Contextual row action', 'row', source));
  }
  if (matches(text, ['navigation', 'breadcrumbs', 'tabs', 'stepper', 'pagination'])) {
    actions.push(action(region.id, 'Navigate within the task', 'navigation', source));
  }
  return actions;
}

function action(
  regionId: string,
  label: string,
  priority: ScreenStructureActionRequirement['priority'],
  source: ScreenStructureActionRequirement['source'],
): ScreenStructureActionRequirement {
  return { id: `${regionId}-${slug(label)}`, regionId, label, priority, source };
}

function stateRequirements(
  request: string,
  regions: ScreenStructureRegion[],
  source: ScreenStructurePlanSource,
): ScreenStructureStateRequirement[] {
  const explicit = extractTemplateStates(request);
  const dataRegion = regions.find((region) =>
    region.uiRoles.some((role) =>
      matches(role, [
        'table',
        'list',
        'collection',
        'chart',
        'worklist',
        'form',
        'settings',
        'summary-card',
        'detail-section',
        'right-rail',
      ]),
    ),
  );
  const inferred =
    explicit.length > 0
      ? explicit
      : dataRegion
        ? dataRegion.uiRoles.some((role) => matches(role, ['form', 'field', 'settings', 'control']))
          ? ['error', 'success', 'disabled']
          : dataRegion.uiRoles.some((role) =>
                matches(role, ['summary-card', 'detail-section', 'right-rail']),
              )
            ? ['loading', 'error']
            : ['loading', 'empty', 'error']
        : [];
  return uniqueStrings(inferred).flatMap((state) => {
    if (!isScreenState(state)) return [];
    return [
      {
        id: `state-${state}`,
        state,
        ...(dataRegion ? { regionId: dataRegion.id } : {}),
        source: explicit.length > 0 || source === 'screen-template' ? 'template' : 'inferred',
      },
    ];
  });
}

function extractTemplateStates(request: string): string[] {
  const frontmatter = request.match(/(?:^|\n)states:\s*\[([^\]]+)\]/iu)?.[1];
  if (frontmatter) return frontmatter.split(',').map(normalizeLine);
  const section = request.match(/(?:^|\n)## States\s*\n([\s\S]*?)(?=\n##\s|$)/iu)?.[1];
  if (!section) return [];
  return Array.from(
    section.matchAll(/^\s*-\s*(Loading|Empty|Error|Success|Disabled|Unsaved)\b/gimu),
    (match) => match[1]?.toLowerCase() ?? '',
  );
}

function planAssumptions(input: {
  request: string;
  source: ScreenStructurePlanSource;
  regions: ScreenStructureRegion[];
  taskKind: ScreenStructureTaskKind;
}): string[] {
  const assumptions: string[] = [];
  if (input.source !== 'screen-template') {
    assumptions.push(
      'Region boundaries are inferred from the request and must be checked against project evidence before writing.',
    );
  }
  if (input.taskKind === 'image-to-screen') {
    assumptions.push(
      'Reconcile region order and visible states with the attached visual reference before the first write.',
    );
  }
  if (input.regions.some((region) => region.uiRoles.includes('primary-content'))) {
    assumptions.push(
      'The brief does not name a more specific primary surface; refine this role from the product facts without inventing extra sections.',
    );
  }
  if (
    !/\b(?:loading|empty|error|success|disabled)\b|(?:загруз|пуст|ошиб|успеш|недоступ)/iu.test(
      input.request,
    )
  ) {
    assumptions.push(
      'Lifecycle states are inferred only where the planned surface is data- or form-driven.',
    );
  }
  return assumptions;
}

function extractIntent(request: string): string {
  const userInstruction = request.match(
    /(?:^|\n)User instruction:\s*\n([\s\S]*?)(?=\n(?:Selected template:|The screen already exists|The page already exists|Import safety:|Use the current project index)|$)/iu,
  )?.[1];
  const candidate = normalizeLine(userInstruction ?? request.replace(/^\[act-mode\]\s*/iu, ''));
  return candidate.slice(0, 600) || 'Create the requested screen from the available run context.';
}

function compactPurpose(value: string): string {
  return normalizeLine(
    value
      .replace(/\bRole:\s*`[^`]+`\.?/giu, '')
      .replace(/\bContent:\s*/giu, '')
      .replace(/\s+/gu, ' '),
  ).slice(0, 360);
}

function isPureNavigationRole(role: string): boolean {
  return matches(role, ['breadcrumbs', 'pagination', 'settings-nav', 'tabs', 'stepper']);
}

function isScreenState(value: string): value is ScreenStructureStateRequirement['state'] {
  return ['loading', 'empty', 'error', 'success', 'disabled', 'unsaved'].includes(value);
}

function matches(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function hasExplicitActionCue(value: string): boolean {
  return /\b(?:create|add|export|submit|save|approve|reject|delete|edit|open|retry|cancel|back)\b|(?:созда|добав|экспорт|сохран|отправ|одобр|отклон|удал|редакт|откры|повтор|отмен|назад)/iu.test(
    value,
  );
}

function normalizeRole(value: string): string {
  return slug(value);
}

function normalizeLine(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function slug(value: string): string {
  return normalizeLine(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map(normalizeLine).filter(Boolean)));
}
