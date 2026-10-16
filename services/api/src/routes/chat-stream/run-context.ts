/**
 * Run targeting context: capabilities, target paths, task intents, and
 * the task-relevant component pack load/refresh.
 */
import {
  createExternalDesignSystemProposalTargetDefaults,
  detectDesignSystemBootstrapIntent,
  HTML_DESIGN_SYSTEM_PATHS,
  isHtmlDesignSystemCanonical,
  parseHtmlDesignSystemApplyDirective,
  type DesignDirectionSelection,
  type HtmlDesignSystemSources,
  type PromptAttachmentEvidence,
  type DesignBrief,
  type ScreenStructurePlan,
  screenSurface,
  type ModalDefaults,
  type ProjectScreenSurface,
} from '@sber-designer/shared-types';
import { type AgentRunTargetCapabilities } from '../../agent/run-recorder';
import { latestUserRequest } from '../../agent-runtimes/handoff-prompt';
import { type ExternalRuntimeProjectIndexContext } from '../../agent-runtimes/agent-kit-handoff';
import { type AgentModelTarget } from '../../agent-model-target';
import {
  htmlDesignSystemSourceTargetsForRequest,
  isHtmlDesignSystemReferenceBootstrap,
} from '../../html-design-system-targets';
import { loadProjectDesignIndex } from '../../design-index';
import {
  buildTaskRelevantComponentPack,
  type TaskRelevantComponentPack,
} from '../../component-intelligence/component-pack';
import { runProjectIndexJobNow } from '../../project-index/indexing-runner';
import { type EditorState } from '../../state-store';
import { buildScreenStructurePlan } from '../../screen-planning/screen-structure-plan';

export { componentPackRunSummary } from '../../component-intelligence/component-pack-summary';

const COMPONENT_PACK_REFRESH_TIMEOUT_MS = 8_000;
const HTML_DESIGN_SYSTEM_APPLY_NOT_CONNECTED_DETAIL =
  'Apply design system requires connected HTML design-system sources. Add or accept Design.md, tokens.css, and components.css before applying them to pages.';

export function agentRunTargetCapabilities(target: AgentModelTarget): AgentRunTargetCapabilities {
  return {
    targetKind: target.kind,
    runtimeKind: target.runtimeKind,
    imageInputMode: target.imageInputMode,
    imageDeliveryMode: target.capabilities.imageDeliveryMode,
    rasterImageInput: target.capabilities.rasterImageInput,
    svgSourceInput: target.capabilities.svgSourceInput,
    nativeFileInput: target.capabilities.nativeFileInput,
    projectMcpTools: target.capabilities.projectMcpTools,
    ownMcpConfig: target.capabilities.ownMcpConfig,
    ...(target.capabilities.mcpExpectedTargets.length > 0
      ? { mcpExpectedTargets: target.capabilities.mcpExpectedTargets }
      : {}),
  };
}

export function chatRunTargetPaths(state: EditorState, userRequest?: string): string[] {
  if (state.canvasView === 'design-system') {
    return [
      HTML_DESIGN_SYSTEM_PATHS.designMd,
      HTML_DESIGN_SYSTEM_PATHS.tokensCss,
      HTML_DESIGN_SYSTEM_PATHS.componentsCss,
      `${HTML_DESIGN_SYSTEM_PATHS.refsDir}/**`,
      `${HTML_DESIGN_SYSTEM_PATHS.assetsDir}/**`,
      '.sber-designer/components/**',
    ];
  }
  const paths = new Set<string>();
  const htmlDesignSystemApplyTargets = parseHtmlDesignSystemApplyDirective(userRequest ?? '');
  if (htmlDesignSystemApplyTargets.length > 0) return htmlDesignSystemApplyTargets;
  const htmlDesignSystemSourceTargets = htmlDesignSystemSourceTargetsForRequest({
    userRequest,
    activeScreen: state.activeScreen,
  });
  if (htmlDesignSystemSourceTargets.length > 0) return htmlDesignSystemSourceTargets;
  if (userRequest && isHtmlDesignSystemReferenceBootstrap(userRequest)) {
    return designSystemProposalRunTargets();
  }
  for (const path of [
    state.activeScreen?.filePath,
    state.activeScreen?.implementationFilePath,
    assistantTaskIntentStoryPath(state.assistantTaskIntent),
    assistantTaskIntentImplementationPath(state.assistantTaskIntent),
  ]) {
    if (path) paths.add(path);
  }
  return Array.from(paths);
}

export function validateHtmlDesignSystemApplyPreflight(input: {
  userRequest: string;
  htmlDesignSystem?: HtmlDesignSystemSources | null | undefined;
}): { error: 'html_design_system_not_connected'; detail: string } | null {
  const targets = parseHtmlDesignSystemApplyDirective(input.userRequest);
  if (targets.length === 0) return null;
  if (isHtmlDesignSystemCanonical(input.htmlDesignSystem?.status)) return null;
  return {
    error: 'html_design_system_not_connected',
    detail: HTML_DESIGN_SYSTEM_APPLY_NOT_CONNECTED_DETAIL,
  };
}

function designSystemProposalRunTargets(): string[] {
  const target = createExternalDesignSystemProposalTargetDefaults();
  return [
    target.designSystemFilePath,
    target.tokensFilePath,
    target.componentsFilePath,
    target.designSystemPreviewFilePath,
    target.extractionReportFilePath,
  ];
}

function assistantTaskIntentStoryPath(
  intent: EditorState['assistantTaskIntent'],
): string | undefined {
  if (!intent || intent.kind === 'edit-current-screen') return undefined;
  return intent.targetStoryFilePath;
}

function assistantTaskIntentImplementationPath(
  intent: EditorState['assistantTaskIntent'],
): string | undefined {
  if (!intent || intent.kind === 'edit-current-screen') return undefined;
  return intent.targetImplementationFilePath;
}

export function compactRunTitle(value: string): string {
  const trimmed = value.replace(/\s+/gu, ' ').trim();
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
}

export function combineAbortSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  if (a.aborted) return a;
  if (b.aborted) return b;
  const controller = new AbortController();
  const abort = (signal: AbortSignal) => {
    controller.abort(signal.reason);
    a.removeEventListener('abort', onA);
    b.removeEventListener('abort', onB);
  };
  const onA = () => abort(a);
  const onB = () => abort(b);
  a.addEventListener('abort', onA, { once: true });
  b.addEventListener('abort', onB, { once: true });
  return controller.signal;
}

export async function loadExternalRuntimeProjectIndexContext(
  workspacePath: string | null | undefined,
): Promise<ExternalRuntimeProjectIndexContext | null> {
  if (!workspacePath) return null;
  try {
    const context = await loadProjectDesignIndex(workspacePath);
    return {
      status: context.status,
      stale: context.stale,
      promptSummary: context.promptSummary,
      ...(context.projectSystem?.freshness ? { freshness: context.projectSystem.freshness } : {}),
      ...(context.projectSystem?.nextAction
        ? { nextAction: context.projectSystem.nextAction }
        : {}),
      ...(context.projectSystem?.htmlDesignSystem
        ? { htmlDesignSystem: context.projectSystem.htmlDesignSystem }
        : {}),
      ...(context.manifest?.counts ? { counts: { ...context.manifest.counts } } : {}),
      ...(context.descriptionMap?.length ? { descriptionMap: context.descriptionMap } : {}),
      artifacts: context.artifacts.map((artifact) => artifact.filePath),
      warnings: context.diagnostics
        .filter((diagnostic) => diagnostic.level !== 'info')
        .slice(0, 8)
        .map((diagnostic) => `${diagnostic.level}: ${diagnostic.filePath} - ${diagnostic.message}`),
    };
  } catch {
    return null;
  }
}

export async function loadRunComponentPack(input: {
  workspacePath: string | null | undefined;
  state: EditorState;
  messages: { role: string; content: unknown }[];
  promptAttachments: PromptAttachmentEvidence[];
  agentName?: string | null;
  designBrief?: DesignBrief | null;
  screenStructurePlan?: ScreenStructurePlan | null;
  taskKind?: TaskRelevantComponentPack['taskKind'];
}): Promise<TaskRelevantComponentPack | null> {
  if (!input.workspacePath) return null;
  // 0083 UX-4 / 0112: component work and the description interview use their
  // own context profile. Gate on role as well as view so html-first interviews
  // do not receive screen-generation component packs.
  if (input.state.canvasView !== 'screen' || input.agentName === 'ai-description-layer') {
    return null;
  }
  try {
    const userRequest = componentPlanningUserRequest(input.messages);
    const taskKind =
      input.screenStructurePlan?.taskKind ??
      input.taskKind ??
      resolveTaskRelevantComponentTaskKind(input.state, input.promptAttachments, userRequest);
    const pack = await buildTaskRelevantComponentPack({
      workspaceRoot: input.workspacePath,
      taskKind,
      userRequest,
      ...(input.designBrief ? { designBrief: input.designBrief } : {}),
      ...(input.screenStructurePlan ? { screenStructurePlan: input.screenStructurePlan } : {}),
    });
    if (!pack.stale) return pack;
    const refreshed = await refreshStaleComponentPackBeforeRun({
      workspacePath: input.workspacePath,
      state: input.state,
      taskKind,
      userRequest,
      ...(input.designBrief ? { designBrief: input.designBrief } : {}),
      ...(input.screenStructurePlan ? { screenStructurePlan: input.screenStructurePlan } : {}),
      original: pack,
    });
    return refreshed;
  } catch {
    return null;
  }
}

export function buildRunScreenStructurePlan(input: {
  state: EditorState;
  messages: { role: string; content: unknown }[];
  promptAttachments: PromptAttachmentEvidence[];
  designBrief?: DesignBrief | null;
  directionSelection?: DesignDirectionSelection | null;
  surface?: ProjectScreenSurface | null;
  modal?: ModalDefaults | null;
  taskKind?: TaskRelevantComponentPack['taskKind'];
}): ScreenStructurePlan | null {
  if (input.state.canvasView === 'design-system') return null;
  const userRequest = componentPlanningUserRequest(input.messages);
  const inferredTaskKind =
    input.taskKind ??
    resolveTaskRelevantComponentTaskKind(input.state, input.promptAttachments, userRequest);
  const taskKind =
    inferredTaskKind === 'unknown' && input.directionSelection && input.state.activeScreen
      ? 'screen-generation'
      : inferredTaskKind;
  const intent = input.state.assistantTaskIntent;
  const intentTarget = intent && intent.kind !== 'edit-current-screen' ? intent : null;
  const activeSurface = screenSurface(input.state.activeScreen);
  return buildScreenStructurePlan({
    taskKind,
    userRequest,
    ...(input.designBrief ? { designBrief: input.designBrief } : {}),
    ...(input.directionSelection ? { directionSelection: input.directionSelection } : {}),
    ...(input.surface
      ? { surface: input.surface }
      : activeSurface === 'modal'
        ? { surface: activeSurface }
        : {}),
    ...(input.modal ? { modal: input.modal } : {}),
    target: {
      ...(input.state.activeScreen?.id
        ? { screenId: input.state.activeScreen.id }
        : intentTarget?.targetScreenId
          ? { screenId: intentTarget.targetScreenId }
          : {}),
      ...(input.state.activeScreen?.name
        ? { screenName: input.state.activeScreen.name }
        : intentTarget?.targetName
          ? { screenName: intentTarget.targetName }
          : {}),
      files: chatRunTargetPaths(input.state, userRequest),
    },
  });
}

async function refreshStaleComponentPackBeforeRun(input: {
  workspacePath: string;
  state: EditorState;
  taskKind: TaskRelevantComponentPack['taskKind'];
  userRequest: string;
  designBrief?: DesignBrief | null;
  screenStructurePlan?: ScreenStructurePlan | null;
  original: TaskRelevantComponentPack;
}): Promise<TaskRelevantComponentPack> {
  const refresh = runProjectIndexJobNow({
    workspaceRoot: input.workspacePath,
    projectName: input.state.projectName ?? 'Untitled project',
    enrich: false,
    ...(input.state.canvasUrl ? { canvasUrl: input.state.canvasUrl } : {}),
  }).catch((err) => ({
    status: 'failed' as const,
    error: err instanceof Error ? err.message : String(err),
  }));
  const result = await Promise.race([
    refresh,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), COMPONENT_PACK_REFRESH_TIMEOUT_MS);
    }),
  ]);

  if (result && result.status === 'complete') {
    return buildTaskRelevantComponentPack({
      workspaceRoot: input.workspacePath,
      taskKind: input.taskKind,
      userRequest: input.userRequest,
      ...(input.designBrief ? { designBrief: input.designBrief } : {}),
      ...(input.screenStructurePlan ? { screenStructurePlan: input.screenStructurePlan } : {}),
    });
  }

  return {
    ...input.original,
    diagnostics: [
      ...input.original.diagnostics,
      result?.status === 'failed'
        ? `Project index refresh failed before generation: ${result.error ?? 'unknown error'}.`
        : 'Project index refresh did not finish before generation; continue with current source-first inspection.',
    ],
  };
}

export function resolveTaskRelevantComponentTaskKind(
  state: EditorState,
  promptAttachments: PromptAttachmentEvidence[],
  userRequest = '',
): TaskRelevantComponentPack['taskKind'] {
  if (detectDesignSystemBootstrapIntent(userRequest)) return 'unknown';
  if (
    state.activeScreen &&
    isScreenRedesignRequest(userRequest) &&
    !isSelectedElementRedesignRequest(state, userRequest)
  ) {
    return 'screen-redesign';
  }
  // Continuation messages can carry raster evidence from an earlier image-to-screen turn.
  // A current-screen edit remains a local edit unless the user explicitly asks for a broad
  // redesign above; otherwise the stale image would rebuild a generation structure plan and
  // make unrelated component roles blocking for a one-control patch.
  if (state.assistantTaskIntent?.kind === 'edit-current-screen') return 'screen-edit';
  if (state.selection && state.activeScreen && state.canvasView !== 'storybook') {
    return 'screen-edit';
  }
  if (
    promptAttachments.some(
      (attachment) => attachment.kind !== 'text' && attachment.mimeType.startsWith('image/'),
    )
  ) {
    return 'image-to-screen';
  }
  if (isGeneratedScreenCreationRequest(userRequest)) return 'screen-generation';
  if (
    promptAttachments.some(
      (attachment) => attachment.kind === 'text' && attachment.documentKind === 'html',
    )
  ) {
    return 'screen-generation';
  }
  if (
    state.assistantTaskIntent?.kind === 'create-screen-from-story' ||
    state.assistantTaskIntent?.kind === 'fill-generated-screen'
  ) {
    return 'screen-generation';
  }
  if (state.activeScreen && state.canvasView !== 'storybook' && !state.activeComponent) {
    return 'screen-generation';
  }
  return 'unknown';
}

function isGeneratedScreenCreationRequest(userRequest: string): boolean {
  return (
    /\[act-mode\]\s*Create a new production-quality screen named\s+["'`][^"'`]+["'`]/iu.test(
      userRequest,
    ) &&
    /(?:Target Storybook story|implementation file|The screen already exists in the project)/iu.test(
      userRequest,
    )
  );
}

function componentPlanningUserRequest(messages: { role: string; content: unknown }[]): string {
  const generatedRequest = [...messages]
    .reverse()
    .find(
      (message) =>
        message.role === 'user' &&
        typeof message.content === 'string' &&
        isGeneratedScreenCreationRequest(message.content),
    )?.content;
  return typeof generatedRequest === 'string' ? generatedRequest : latestUserRequest(messages);
}

function isSelectedElementRedesignRequest(state: EditorState, userRequest: string): boolean {
  if (!state.selection) return false;
  return /\b(?:this|that|selected|selection|button|icon|field|text)\b|(?:выдел|выбран|эту|этот|этой|кнопк|иконк|поле|текст)/iu.test(
    userRequest,
  );
}

function isScreenRedesignRequest(userRequest: string): boolean {
  const request = userRequest.trim().toLowerCase();
  if (!request) return false;
  return (
    /\b(?:redesign|restyle|re-style|rework)\b/iu.test(request) ||
    /\b(?:screen|page|layout|composition)\b[\s\S]{0,80}\b(?:redesign|restyle|rework|overhaul)\b/iu.test(
      request,
    ) ||
    /\b(?:redesign|restyle|rework|overhaul)\b[\s\S]{0,80}\b(?:screen|page|layout|composition)\b/iu.test(
      request,
    ) ||
    /(?:редизайн|передел[а-яё]*\s+(?:существующ[а-яё]*\s+)?экран|переоформ[а-яё]*\s+(?:экран|страниц)|переработ[а-яё]*\s+(?:композиц|макет|структур)|измени[а-яё]*\s+композиц)/iu.test(
      request,
    )
  );
}

export function activeTargetFromState(state: EditorState) {
  const screen = state.activeScreen;
  if (!screen) return null;
  return {
    screenId: screen.id,
    screenName: screen.name,
    ...(screen.implementationFilePath
      ? { implementationFilePath: screen.implementationFilePath }
      : {}),
    ...(screen.filePath ? { storyFilePath: screen.filePath } : {}),
  };
}
