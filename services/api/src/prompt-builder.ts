/**
 * Builds the system message that prefixes every /api/chat call.
 *
 * Three sections (per ADR-0012):
 *   1. Behavior   — how the agent should act inside sber-designer.
 *   2. Editor     — current mode, selection, workspace, canvas URL.
 *   3. Catalog    — components available in the connected project,
 *                   fetched via storybook-indexer.
 *
 * Designed to fail gracefully: if the catalog fetch breaks, we still
 * return a system message with explicit "catalog unavailable: <reason>"
 * so the model knows it's blind instead of hallucinating components.
 */
import {
  designBriefForbidsExistingScreenReferences,
  HTML_DESIGN_SYSTEM_PATHS,
  isProjectStyleMemoryEnabled,
  normalizeAssistantSessionMode,
  type AssistantSessionMode,
  type ComponentEntry,
  type ScreenStructurePlan,
} from '@sber-designer/shared-types';
import { loadAgentKit } from './agent-kit/loader';
import { resolvePromptAgent } from './agent-kit/active-agent';
import { filterAgentSkills } from './agent-kit/permissions';
import { resolveCatalog } from './catalog-cache';
import type { TaskRelevantComponentPack } from './component-intelligence/component-pack';
import { resolveScreenTemplates } from './screen-templates';
import { readWorkspaceFile } from './safe-fs';
import { getProject } from './project-store';
import { loadProjectStyleMemoryPrompt } from './project-preferences';
import { getState, type EditorState } from './state-store';
import {
  designBriefPromptSection,
  generationModePromptSection,
  instructionHierarchyPromptSection,
  type GenerationOptions,
} from './generation-mode';
import type { AgentModelTarget } from './agent-model-target';
import { sessionModePromptSection } from './session-mode';
import {
  compactLine,
  renderCatalogBlock,
  renderCommentsContextBlock,
  renderEditorBlock,
  renderProjectProfileContractBlock,
  renderScreenTemplatesBlock,
  renderSelectedTargetHardContractBlock,
  renderTasksContextBlock,
  renderVisualDesignBlock,
  resolveActiveScreenCatalogHint,
  trimTemplateContent,
} from './prompt-blocks';
import {
  resolveProjectIndexBlock,
  resolveTaskRelevantComponentPackBlock,
} from './prompt-project-context';

const FALLBACK_BEHAVIOR_BLOCK = `You are the emergency fallback agent for sber-designer.

The product agent kit did not load, so operate cautiously: inspect the
available editor, project index, catalog, template, task, comment, and
selection context before edits; keep changes scoped to the connected project;
avoid exposing secrets or raw environment values; and tell the user that the
agent kit is unavailable.`;

export interface BuiltSystemPrompt {
  text: string;
  /** Number of components surfaced in the prompt. Useful for audit. */
  contextSize: number;
  /** Whether the catalog block was real (storybook) or a notice. */
  catalogStatus: 'attached' | 'unavailable' | 'no_project' | 'skipped';
}

export interface RuntimeIdentityPromptInput {
  providerId: string;
  modelId: string;
  providerLabel?: string;
  modelLabel?: string;
  targetKind: 'api' | 'cli';
  runtimeKind: string;
}

export interface BuildSystemPromptOptions {
  /** Immutable editor snapshot captured for this request/run. */
  state?: EditorState;
  agentName?: string;
  taskKind?: TaskRelevantComponentPack['taskKind'];
  userRequest?: string;
  componentPack?: TaskRelevantComponentPack | null;
  generation?: GenerationOptions | null;
  runtimeIdentity?: RuntimeIdentityPromptInput | null;
  sessionMode?: AssistantSessionMode;
  screenStructurePlan?: ScreenStructurePlan | null;
}

export function runtimeIdentityPromptInputForTarget(input: {
  target: AgentModelTarget;
  providerLabel?: string | undefined;
  modelLabel?: string | undefined;
}): RuntimeIdentityPromptInput {
  const providerLabel = input.providerLabel?.trim();
  const modelLabel = input.modelLabel?.trim();
  return {
    providerId: input.target.provider,
    modelId: input.target.model,
    targetKind: input.target.kind,
    runtimeKind: input.target.runtimeKind,
    ...(providerLabel ? { providerLabel } : {}),
    ...(modelLabel ? { modelLabel } : {}),
  };
}

export async function buildSystemPrompt(
  options: BuildSystemPromptOptions = {},
): Promise<BuiltSystemPrompt> {
  const state = options.state ?? getState();
  const sessionMode = normalizeAssistantSessionMode(options.sessionMode);
  const isDescriptionLayerRun = isDescriptionLayerAgent(options.agentName);
  const agentKitBlock = await resolveAgentKitPromptBlock(state.workspacePath, options.agentName);
  const projectIndexBlock = await resolveProjectIndexBlock(state.workspacePath, {
    userRequest: options.userRequest,
    activeScreenName: isDescriptionLayerRun ? undefined : state.activeScreen?.name,
    activeScreenDescription: isDescriptionLayerRun ? undefined : state.activeScreen?.description,
    taskKind: options.taskKind,
    assistantTaskIntentKind: isDescriptionLayerRun ? undefined : state.assistantTaskIntent?.kind,
  });
  if (isDescriptionLayerRun) {
    return buildDescriptionLayerSystemPrompt(
      state,
      projectIndexBlock,
      agentKitBlock,
      options.runtimeIdentity,
    );
  }
  if (sessionMode === 'ask') {
    return buildLightweightSessionModePrompt({
      sessionMode,
      state,
      projectIndexBlock,
      agentKitBlock,
      runtimeIdentity: options.runtimeIdentity,
    });
  }
  if (sessionMode === 'plan') {
    const projectStyleMemoryBlock = await loadProjectStyleMemoryPrompt(
      state.workspacePath,
      options.taskKind ?? 'unknown',
      { enabled: isProjectStyleMemoryEnabled(getProject(state.workspacePath)) },
    );
    return buildLightweightSessionModePrompt({
      sessionMode,
      state,
      projectIndexBlock,
      agentKitBlock,
      runtimeIdentity: options.runtimeIdentity,
      projectStyleMemoryBlock,
    });
  }
  if (state.canvasView === 'storybook') {
    // 0083 UX-4: the Storybook profile omits the screen-generation component
    // pack — component work / the description interview do not need it.
    return buildStorybookSystemPrompt(
      state,
      projectIndexBlock,
      agentKitBlock,
      options.runtimeIdentity,
      sessionMode,
    );
  }
  if (state.canvasView === 'design-system') {
    return buildHtmlDesignSystemSystemPrompt(
      state,
      projectIndexBlock,
      agentKitBlock,
      options.runtimeIdentity,
      sessionMode,
    );
  }

  const projectStyleMemoryBlock = await loadProjectStyleMemoryPrompt(
    state.workspacePath,
    options.taskKind ?? 'unknown',
    { enabled: isProjectStyleMemoryEnabled(getProject(state.workspacePath)) },
  );

  const componentPackBlock = await resolveTaskRelevantComponentPackBlock(
    state.workspacePath,
    options.taskKind ?? 'unknown',
    options.userRequest,
    options.componentPack,
    options.generation?.designBrief,
    options.screenStructurePlan,
  );

  const { templates } = await resolveScreenTemplates(state.workspacePath);
  const screenReferencesForbidden = designBriefForbidsExistingScreenReferences(
    options.generation?.designBrief,
  );

  if (!state.canvasUrl && !state.workspacePath) {
    return {
      text: assemble(
        sessionModePromptSection(sessionMode),
        renderProjectProfileContractBlock(state),
        agentKitBlock,
        renderRuntimeIdentityBlock(options.runtimeIdentity),
        instructionHierarchyPromptSection(),
        generationModePromptSection(options.generation),
        designBriefPromptSection(options.generation),
        renderProjectInstructionsBlock(state),
        projectStyleMemoryBlock,
        renderEditorBlock(state),
        renderVisualDesignBlock(state),
        renderSelectedTargetHardContractBlock(state),
        renderCommentsContextBlock(state),
        renderTasksContextBlock(state),
        projectIndexBlock,
        componentPackBlock,
        '## Catalog\n\n_No project connected — catalog is empty._',
        renderScreenTemplatesBlock([], screenReferencesForbidden),
      ),
      contextSize: 0,
      catalogStatus: 'no_project',
    };
  }

  const result = await resolveCatalog(resolveCatalogOptions(state));
  if ('catalog' in result) {
    const activeScreenHint = resolveActiveScreenCatalogHint(
      state.activeScreen,
      result.catalog.components,
    );
    return {
      text: assemble(
        sessionModePromptSection(sessionMode),
        renderProjectProfileContractBlock(state),
        agentKitBlock,
        renderRuntimeIdentityBlock(options.runtimeIdentity),
        instructionHierarchyPromptSection(),
        generationModePromptSection(options.generation),
        designBriefPromptSection(options.generation),
        renderProjectInstructionsBlock(state),
        projectStyleMemoryBlock,
        renderEditorBlock(state, activeScreenHint),
        renderVisualDesignBlock(state),
        renderSelectedTargetHardContractBlock(state),
        renderCommentsContextBlock(state),
        renderTasksContextBlock(state),
        projectIndexBlock,
        componentPackBlock,
        renderCatalogBlock(result.catalog.components, result.catalog.source),
        renderScreenTemplatesBlock(templates, screenReferencesForbidden),
      ),
      contextSize: result.catalog.components.length,
      catalogStatus: 'attached',
    };
  }
  return {
    text: assemble(
      sessionModePromptSection(sessionMode),
      renderProjectProfileContractBlock(state),
      agentKitBlock,
      renderRuntimeIdentityBlock(options.runtimeIdentity),
      instructionHierarchyPromptSection(),
      generationModePromptSection(options.generation),
      designBriefPromptSection(options.generation),
      renderProjectInstructionsBlock(state),
      projectStyleMemoryBlock,
      renderEditorBlock(state),
      renderVisualDesignBlock(state),
      renderSelectedTargetHardContractBlock(state),
      renderCommentsContextBlock(state),
      renderTasksContextBlock(state),
      projectIndexBlock,
      componentPackBlock,
      `## Catalog\n\n_Catalog unavailable: ${result.unavailable}_`,
      renderScreenTemplatesBlock(templates, screenReferencesForbidden),
    ),
    contextSize: 0,
    catalogStatus: 'unavailable',
  };
}

function buildLightweightSessionModePrompt(input: {
  sessionMode: 'ask' | 'plan';
  state: ReturnType<typeof getState>;
  projectIndexBlock: string;
  agentKitBlock: string;
  runtimeIdentity: RuntimeIdentityPromptInput | null | undefined;
  projectStyleMemoryBlock?: string;
}): BuiltSystemPrompt {
  const editorBlock =
    input.state.canvasView === 'storybook'
      ? renderStorybookComponentBlock(
          input.state,
          normalizeStateComponent(input.state.activeComponent),
        )
      : input.state.canvasView === 'design-system'
        ? renderHtmlDesignSystemComponentBlock(
            input.state,
            normalizeStateComponent(input.state.activeComponent),
          )
        : renderEditorBlock(input.state);
  return {
    text: assemble(
      sessionModePromptSection(input.sessionMode),
      renderProjectProfileContractBlock(input.state),
      input.agentKitBlock,
      renderRuntimeIdentityBlock(input.runtimeIdentity),
      renderProjectInstructionsBlock(input.state),
      input.projectStyleMemoryBlock ?? '',
      editorBlock,
      renderSelectedTargetHardContractBlock(input.state),
      renderCommentsContextBlock(input.state),
      renderTasksContextBlock(input.state),
      input.projectIndexBlock,
    ),
    contextSize: 0,
    catalogStatus: 'skipped',
  };
}

async function buildStorybookSystemPrompt(
  state: ReturnType<typeof getState>,
  projectIndexBlock: string,
  agentKitBlock: string,
  runtimeIdentity: RuntimeIdentityPromptInput | null | undefined,
  sessionMode: AssistantSessionMode,
): Promise<BuiltSystemPrompt> {
  const componentTemplateBlock = await resolveComponentTemplateBlock(state.workspacePath);
  const result = await resolveCatalog(resolveCatalogOptions(state));

  if ('catalog' in result) {
    const activeComponent =
      (state.activeComponent?.id
        ? result.catalog.components.find((component) => component.id === state.activeComponent?.id)
        : null) ??
      normalizeStateComponent(state.activeComponent) ??
      null;
    return {
      text: assemble(
        sessionModePromptSection(sessionMode),
        agentKitBlock,
        renderRuntimeIdentityBlock(runtimeIdentity),
        renderStorybookBehaviorBlock(),
        renderProjectInstructionsBlock(state),
        renderStorybookComponentBlock(state, activeComponent),
        projectIndexBlock,
        componentTemplateBlock,
        renderCatalogBlock(result.catalog.components, result.catalog.source),
        renderTasksContextBlock(state),
      ),
      contextSize: result.catalog.components.length,
      catalogStatus: 'attached',
    };
  }

  return {
    text: assemble(
      sessionModePromptSection(sessionMode),
      agentKitBlock,
      renderRuntimeIdentityBlock(runtimeIdentity),
      renderStorybookBehaviorBlock(),
      renderProjectInstructionsBlock(state),
      renderStorybookComponentBlock(state, normalizeStateComponent(state.activeComponent)),
      projectIndexBlock,
      componentTemplateBlock,
      `## Catalog\n\n_Catalog unavailable: ${result.unavailable}_`,
      renderTasksContextBlock(state),
    ),
    contextSize: 0,
    catalogStatus: 'unavailable',
  };
}

async function buildHtmlDesignSystemSystemPrompt(
  state: ReturnType<typeof getState>,
  projectIndexBlock: string,
  agentKitBlock: string,
  runtimeIdentity: RuntimeIdentityPromptInput | null | undefined,
  sessionMode: AssistantSessionMode,
): Promise<BuiltSystemPrompt> {
  const result = await resolveCatalog(resolveCatalogOptions(state));
  const activeComponent =
    'catalog' in result
      ? ((state.activeComponent?.id
          ? result.catalog.components.find(
              (component) => component.id === state.activeComponent?.id,
            )
          : null) ?? normalizeStateComponent(state.activeComponent))
      : normalizeStateComponent(state.activeComponent);
  const catalogBlock =
    'catalog' in result
      ? renderCatalogBlock(result.catalog.components, result.catalog.source)
      : `## Catalog\n\n_Catalog unavailable: ${result.unavailable}_`;
  return {
    text: assemble(
      sessionModePromptSection(sessionMode),
      agentKitBlock,
      renderRuntimeIdentityBlock(runtimeIdentity),
      renderHtmlDesignSystemBehaviorBlock(),
      renderProjectInstructionsBlock(state),
      renderHtmlDesignSystemComponentBlock(state, activeComponent ?? null),
      projectIndexBlock,
      catalogBlock,
      renderTasksContextBlock(state),
    ),
    contextSize: 'catalog' in result ? result.catalog.components.length : 0,
    catalogStatus: 'catalog' in result ? 'attached' : 'unavailable',
  };
}

function renderHtmlDesignSystemBehaviorBlock(): string {
  return `## HTML Design System View

- Work only in the project-owned \`${HTML_DESIGN_SYSTEM_PATHS.folder}/\` package and canonical component sidecars.
- Editable sources are \`${HTML_DESIGN_SYSTEM_PATHS.designMd}\`, \`${HTML_DESIGN_SYSTEM_PATHS.tokensCss}\`, \`${HTML_DESIGN_SYSTEM_PATHS.componentsCss}\`, \`${HTML_DESIGN_SYSTEM_PATHS.refsDir}/**\`, and \`${HTML_DESIGN_SYSTEM_PATHS.assetsDir}/**\`.
- Product pages under \`pages/**\`, the root \`index.html\`, and project flow metadata are read-only evidence in this view.
- Never hand-edit \`${HTML_DESIGN_SYSTEM_PATHS.previewHtml}\`; rebuild it with \`rebuild_design_system_preview\`, then request project reindexing.
- Do not call screen_create, screen_remove, or flow tools from this view.
- Reuse existing tokens and block/modifier class conventions before adding new sources.`;
}

function renderHtmlDesignSystemComponentBlock(
  state: ReturnType<typeof getState>,
  component: ComponentEntry | null,
): string {
  const lines = ['## HTML design-system context', '- canvasView: `design-system`'];
  if (state.projectName) lines.push(`- project: \`${state.projectName}\``);
  if (state.workspacePath) lines.push(`- workspacePath: \`${state.workspacePath}\``);
  if (state.canvasUrl) lines.push(`- canvasUrl: ${state.canvasUrl}`);
  if (component) {
    lines.push(`- activeComponent: \`${component.shortName}\` (${component.id})`);
    lines.push(`- activeComponentFile: \`${component.filePath}\``);
  } else {
    lines.push('- activeComponent: none');
  }
  return lines.join('\n');
}

async function buildDescriptionLayerSystemPrompt(
  state: ReturnType<typeof getState>,
  projectIndexBlock: string,
  agentKitBlock: string,
  runtimeIdentity: RuntimeIdentityPromptInput | null | undefined,
): Promise<BuiltSystemPrompt> {
  const componentTemplateBlock = await resolveComponentTemplateBlock(state.workspacePath);
  const result = await resolveCatalog(resolveCatalogOptions(state));

  if ('catalog' in result) {
    const activeComponent =
      (state.activeComponent?.id
        ? result.catalog.components.find((component) => component.id === state.activeComponent?.id)
        : null) ??
      normalizeStateComponent(state.activeComponent) ??
      null;
    return {
      text: assemble(
        agentKitBlock,
        renderRuntimeIdentityBlock(runtimeIdentity),
        renderProjectInstructionsBlock(state),
        renderDescriptionLayerComponentBlock(state, activeComponent),
        projectIndexBlock,
        componentTemplateBlock,
        renderCatalogBlock(result.catalog.components, result.catalog.source),
        renderTasksContextBlock(state),
      ),
      contextSize: result.catalog.components.length,
      catalogStatus: 'attached',
    };
  }

  return {
    text: assemble(
      agentKitBlock,
      renderRuntimeIdentityBlock(runtimeIdentity),
      renderProjectInstructionsBlock(state),
      renderDescriptionLayerComponentBlock(state, normalizeStateComponent(state.activeComponent)),
      projectIndexBlock,
      componentTemplateBlock,
      `## Catalog\n\n_Catalog unavailable: ${result.unavailable}_`,
      renderTasksContextBlock(state),
    ),
    contextSize: 0,
    catalogStatus: 'unavailable',
  };
}

function resolveCatalogOptions(state: ReturnType<typeof getState>): {
  canvasUrl?: string | null;
  workspacePath?: string | null;
} {
  return {
    ...(state.canvasUrl !== undefined ? { canvasUrl: state.canvasUrl } : {}),
    ...(state.workspacePath !== undefined ? { workspacePath: state.workspacePath } : {}),
  };
}

function normalizeStateComponent(
  component: ReturnType<typeof getState>['activeComponent'],
): ComponentEntry | null {
  if (!component) return null;
  return {
    id: component.id,
    title: component.title,
    shortName: component.shortName,
    filePath: component.filePath,
    stories: component.stories.map((story) => ({
      id: story.id,
      name: story.name,
      previewUrl: story.previewUrl,
      ...(story.description ? { description: story.description } : {}),
    })),
    ...(component.description ? { description: component.description } : {}),
  };
}

function renderStorybookBehaviorBlock(): string {
  return `You are the built-in agent for sber-designer in Storybook component mode.

Help the user inspect, improve, duplicate, document, or create reusable components inside the connected project's Storybook.

Storybook mode rules:
- Treat the active component as the default scope. Do not assume the user wants to edit the active screen.
- Prefer narrow component/story edits in the active component source file.
- Use catalog descriptions and Project index artifacts as design-system guidance.
- If creating a component, follow the component template when available, add a Storybook story, and keep examples realistic.
- Do not use screen_create, screen_remove, flow_add_edge, or screen-specific tools unless the user explicitly asks to manage screens.
- Do not address screen comments, selected screen elements, or generated-screen task intents in this mode.
- Keep replies tight. In Plan mode, end with a single clear question.`;
}

async function resolveComponentTemplateBlock(
  workspacePath: string | null | undefined,
): Promise<string> {
  if (!workspacePath) {
    return '## Component template\n\n_No workspace connected — component template is empty._';
  }
  try {
    const template = await readWorkspaceFile(workspacePath, '.sber-designer/component-template.md');
    return `## Component template\n\n${trimTemplateContent(template)}`;
  } catch {
    return '## Component template\n\n_No `.sber-designer/component-template.md` file found. Use catalog conventions from nearby components._';
  }
}

function renderStorybookComponentBlock(
  state: ReturnType<typeof getState>,
  component: ComponentEntry | null,
): string {
  const lines = ['## Storybook component context'];
  lines.push('- canvasView: `storybook`');
  lines.push(`- mode: \`${state.mode ?? 'interact'}\``);
  if (state.projectName) lines.push(`- project: \`${state.projectName}\``);
  if (state.workspacePath) lines.push(`- workspacePath: \`${state.workspacePath}\``);
  if (state.canvasUrl) lines.push(`- canvasUrl: ${state.canvasUrl}`);
  if (!component) {
    lines.push('- activeComponent: none');
    lines.push('- componentScope: choose the closest catalog component before editing');
    return lines.join('\n');
  }
  lines.push(`- activeComponent: \`${component.shortName}\` (${component.title})`);
  lines.push(`- activeComponentId: \`${component.id}\``);
  lines.push(`- activeComponentFile: \`${component.filePath}\``);
  const firstStory = component.stories[0];
  if (firstStory) {
    lines.push(`- activeStory: \`${firstStory.name}\` (${firstStory.id})`);
  }
  if (component.description) {
    lines.push(`- activeComponentDescription: ${compactLine(component.description, 520)}`);
  }
  if (component.descriptionLayer) {
    lines.push(`- activeComponentPurpose: ${compactLine(component.descriptionLayer.purpose, 520)}`);
    const guidance = component.descriptionLayer.agentGuidance.slice(0, 6).join(' | ');
    if (guidance) lines.push(`- activeComponentGuidance: ${compactLine(guidance, 720)}`);
  }
  lines.push(
    '- componentScope: active — inspect this component/story first; avoid scanning unrelated screens',
  );
  return lines.join('\n');
}

function renderDescriptionLayerComponentBlock(
  state: ReturnType<typeof getState>,
  component: ComponentEntry | null,
): string {
  const lines = ['## Component description context'];
  lines.push(`- canvasView: \`${state.canvasView ?? 'screen'}\``);
  lines.push(`- mode: \`${state.mode ?? 'interact'}\``);
  if (state.projectName) lines.push(`- project: \`${state.projectName}\``);
  if (state.workspacePath) lines.push(`- workspacePath: \`${state.workspacePath}\``);
  if (state.canvasUrl) lines.push(`- canvasUrl: ${state.canvasUrl}`);
  if (component) {
    lines.push(`- activeComponent: \`${component.shortName}\` (${component.title})`);
    lines.push(`- activeComponentId: \`${component.id}\``);
    lines.push(`- activeComponentFile: \`${component.filePath}\``);
  } else {
    lines.push('- activeComponent: none');
  }
  lines.push(
    '- descriptionScope: component catalog only — use list_undescribed_components and get_usage_card before writing descriptions',
  );
  lines.push(
    '- screenContextPolicy: ignore active screens, selected DOM elements, visual drafts, comments, and screen edit task intents for this interview role',
  );
  return lines.join('\n');
}

function isDescriptionLayerAgent(agentName: string | undefined): boolean {
  return agentName === 'ai-description-layer';
}

function assemble(...blocks: string[]): string {
  return blocks.filter(Boolean).join('\n\n');
}

function renderRuntimeIdentityBlock(
  identity: RuntimeIdentityPromptInput | null | undefined,
): string {
  if (!identity) return '';
  const lines = [
    '## Runtime identity',
    '',
    'You are the `ai-product-designer` product agent. The selected runtime for this run is described by this safe metadata:',
    `- provider: ${renderRuntimeIdentityValue(identity.providerId, identity.providerLabel)}`,
    `- model: ${renderRuntimeIdentityValue(identity.modelId, identity.modelLabel)}`,
    `- targetKind: \`${identity.targetKind}\``,
    `- runtimeKind: \`${identity.runtimeKind}\``,
    '',
    'If the user asks what model, provider, or runtime you are, answer from this runtime identity metadata.',
    'Assistant history may contain stale self-identification from previous runs; runtime identity metadata supersedes transcript claims.',
  ];
  if (identity.targetKind === 'cli') {
    lines.push(
      'For CLI runtimes, report the selected CLI runtime and configured model id/label; do not invent a hidden backend provider.',
    );
  }
  return lines.join('\n');
}

function renderRuntimeIdentityValue(id: string, label: string | undefined): string {
  const cleanId = id.trim();
  const cleanLabel = label?.trim();
  if (cleanLabel && cleanLabel !== cleanId) return `\`${cleanLabel}\` (\`${cleanId}\`)`;
  return `\`${cleanId}\``;
}

function renderProjectInstructionsBlock(state: ReturnType<typeof getState>): string {
  const instructions = state.projectInstructions?.trim();
  if (!instructions) return '';
  return ['## Project Instructions', '', instructions].join('\n');
}

async function resolveAgentKitPromptBlock(
  workspacePath: string | null | undefined,
  agentName: string | undefined,
): Promise<string> {
  try {
    const kit = await loadAgentKit(workspacePath === undefined ? {} : { workspacePath });
    const resolved = resolvePromptAgent(kit, agentName);
    const activeAgent = resolved.ok ? resolved.agent : kit.defaultAgent;
    const lines: string[] = ['## Agent profile', '', activeAgent.body || FALLBACK_BEHAVIOR_BLOCK];
    const agentPromptPaths = new Set(kit.agents.map((agent) => agent.path));
    const projectInstructions = kit.instructions.filter(
      (instruction) =>
        instruction.path !== activeAgent.path && !agentPromptPaths.has(instruction.path),
    );
    if (projectInstructions.length > 0) {
      lines.push('', '## Project agent instructions');
      for (const instruction of projectInstructions.slice(0, 8)) {
        lines.push(
          '',
          `### ${instruction.path} (${instruction.source})`,
          '',
          stripFrontmatter(instruction.contents).trim(),
        );
      }
      if (projectInstructions.length > 8) {
        lines.push('', `_${projectInstructions.length - 8} more instruction file(s) omitted._`);
      }
    }
    lines.push('', renderAgentKitInventoryBlock(kit, activeAgent));
    return lines.join('\n');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `${FALLBACK_BEHAVIOR_BLOCK}\n\n## Agent kit\n\n_Agent kit unavailable: ${compactLine(message, 360)}_`;
  }
}

function renderAgentKitInventoryBlock(
  kit: Awaited<ReturnType<typeof loadAgentKit>>,
  activeAgent = kit.defaultAgent,
): string {
  const lines: string[] = ['## Agent kit'];
  const visibleSkills = filterAgentSkills(kit.skills, {
    policy: activeAgent.permissionPolicy,
  });
  const subagents = kit.agents.filter((agent) => agent.mode === 'subagent' || agent.mode === 'all');
  lines.push(`- activeAgent: \`${activeAgent.name}\` (${activeAgent.source})`);
  lines.push(`- activeAgentMode: \`${activeAgent.mode}\``);
  lines.push(`- agentPrompt: \`${activeAgent.path}\``);
  if (subagents.length > 0) {
    lines.push('- subagents:');
    for (const agent of subagents.slice(0, 12)) {
      lines.push(
        `  - \`@${agent.name}\` (${agent.source}): ${compactLine(agent.description, 180)}`,
      );
    }
    if (subagents.length > 12) {
      lines.push(`  - ${subagents.length - 12} more subagent(s) omitted.`);
    }
  }
  if (visibleSkills.length === 0) {
    lines.push('- skills: none');
  } else {
    lines.push('- skills:');
    for (const skill of visibleSkills.slice(0, 24)) {
      lines.push(`  - \`${skill.name}\` (${skill.source}): ${compactLine(skill.description, 220)}`);
    }
    if (visibleSkills.length > 24) {
      lines.push(`  - ${visibleSkills.length - 24} more skill(s) omitted.`);
    }
    lines.push('- skillUsage: call `load_agent_skill` before following a skill body.');
  }
  if (kit.knowledge.length === 0) {
    lines.push('- knowledge: none');
  } else {
    lines.push('- knowledge:');
    for (const resource of kit.knowledge.slice(0, 24)) {
      lines.push(
        `  - \`${resource.id}\` (${resource.source}, ${resource.path}): ${compactLine(resource.description, 220)}`,
      );
    }
    if (kit.knowledge.length > 24) {
      lines.push(`  - ${kit.knowledge.length - 24} more knowledge resource(s) omitted.`);
    }
    lines.push('- knowledgeUsage: call `read_agent_knowledge` only when the task needs details.');
  }
  if (kit.scripts.length > 0) {
    lines.push('- scripts:');
    for (const script of kit.scripts.slice(0, 12)) {
      lines.push(
        `  - \`${script.name}\` (${script.source}, permission=${script.permission}): ${compactLine(script.description, 180)}`,
      );
    }
    lines.push(
      '- scriptUsage: scripts require explicit manifest permissions; never ask for raw shell.',
    );
  }
  const diagnostics = kit.diagnostics.filter((diagnostic) => diagnostic.level !== 'info');
  if (diagnostics.length > 0) {
    lines.push('- diagnostics:');
    for (const diagnostic of diagnostics.slice(0, 8)) {
      lines.push(
        `  - ${diagnostic.level}: ${diagnostic.code} — ${compactLine(diagnostic.message, 220)}`,
      );
    }
  }
  return lines.join('\n');
}

function stripFrontmatter(markdown: string): string {
  const normalized = markdown.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) return markdown;
  const end = normalized.indexOf('\n---', 4);
  if (end === -1) return markdown;
  const body = normalized.slice(end + '\n---'.length);
  return body.startsWith('\n') ? body.slice(1) : body;
}
