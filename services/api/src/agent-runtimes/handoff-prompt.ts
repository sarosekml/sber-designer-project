import {
  createExternalDesignSystemProposalTargetDefaults,
  HTML_DESIGN_SYSTEM_PATHS,
  detectDesignSystemBootstrapIntent,
  detectExternalDesignSourceIntent,
  isHtmlDesignSystemApplyTargetPath,
  isExternalDesignSourceTargetPath,
  parseHtmlDesignSystemApplyDirective,
  stripExternalDesignSourceDirective,
  stripHtmlDesignSystemApplyDirective,
  type ExternalDesignSourceIntent,
} from '@sber-designer/shared-types';

import {
  htmlDesignSystemSourceTargetsForRequest,
  isHtmlDesignSystemReferenceBootstrap,
} from '../html-design-system-targets';
import type { EditorState } from '../state-store';

export interface HandoffActiveScreen {
  id: string;
  name: string;
  filePath?: string;
  implementationFilePath?: string;
}

export type DesignSource = ExternalDesignSourceIntent;

export interface AllowedTargetsOptions {
  agentRunId?: string | null;
}

export function allowedTargetsOptionsForRun(agentRunId?: string | null): AllowedTargetsOptions {
  return agentRunId ? { agentRunId } : {};
}

export interface BuildOpenCodeHandoffPromptInput {
  userRequest: string;
  projectName?: string | null | undefined;
  workspacePath?: string | null | undefined;
  projectInstructions?: string | null | undefined;
  activeScreen?: HandoffActiveScreen | null | undefined;
  selection?: EditorState['selection'] | null | undefined;
  allowedTargets?: string[] | undefined;
  designSource?: DesignSource | null | undefined;
  designIndexSummary?: string | null | undefined;
  agentRunId?: string | null | undefined;
}

export function buildOpenCodeHandoffPrompt(input: BuildOpenCodeHandoffPromptInput): string {
  const sections = [
    validationContract(input),
    projectInstructionsSection(input.projectInstructions),
    activeScreenSection(input.activeScreen),
    selectedElementSection(input.selection),
    selectedTargetHardContractSection(input.selection),
    projectDesignSection(input.designIndexSummary),
    projectContextSection(input),
    htmlDesignSystemApplySection(input.userRequest),
    designSourceSection(input.designSource, input.agentRunId),
    userRequestSection(input.userRequest),
    outputContractSection(input.designSource, input.userRequest),
  ].filter(Boolean);
  return sections.join('\n\n---\n\n');
}

export function latestUserRequest(messages: { role: string; content: unknown }[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== 'user') continue;
    if (typeof message.content === 'string') return message.content;
    if (Array.isArray(message.content)) {
      const text = message.content
        .map((part) =>
          part && typeof part === 'object' && 'type' in part && part.type === 'text'
            ? String((part as { text?: unknown }).text ?? '')
            : '',
        )
        .filter(Boolean)
        .join('\n');
      if (text) return text;
    }
  }
  return '';
}

export function buildPromptFromEditorState(input: {
  messages: { role: string; content: unknown }[];
  state: EditorState;
  model?: string | null;
  agentRunId?: string | null;
}): string {
  const userRequest = latestUserRequest(input.messages);
  const designSource = detectExternalDesignSourceIntent(userRequest);
  const activeScreen: HandoffActiveScreen | null = input.state.activeScreen
    ? {
        id: input.state.activeScreen.id,
        name: input.state.activeScreen.name,
      }
    : null;
  if (activeScreen && input.state.activeScreen?.filePath) {
    activeScreen.filePath = input.state.activeScreen.filePath;
  }
  if (activeScreen && input.state.activeScreen?.implementationFilePath) {
    activeScreen.implementationFilePath = input.state.activeScreen.implementationFilePath;
  }
  return buildOpenCodeHandoffPrompt({
    userRequest,
    projectName: input.state.projectName,
    workspacePath: input.state.workspacePath,
    projectInstructions: input.state.projectInstructions,
    activeScreen,
    selection: input.state.selection ?? null,
    allowedTargets: allowedTargetsFromState(
      input.state,
      userRequest,
      allowedTargetsOptionsForRun(input.agentRunId),
    ),
    designSource,
    designIndexSummary: null,
    agentRunId: input.agentRunId ?? null,
  });
}

function projectInstructionsSection(instructions: string | null | undefined): string {
  const trimmed = instructions?.trim();
  if (!trimmed) return '';
  return ['## Project Instructions', '', trimmed].join('\n');
}

function selectedElementSection(selection: EditorState['selection'] | null | undefined): string {
  if (!selection) {
    return ['## Selected Element', '', 'No selected element was provided.'].join('\n');
  }
  const lines = [
    '## Selected Element',
    '',
    'The user had this canvas element selected when they sent the request.',
    'For relative edit requests such as "this button", apply the change to this element only unless the user explicitly asks for a broader change.',
    '',
    `- selectionScope: active`,
    `- tag: ${selection.tagName.toLowerCase()}`,
    `- loc: ${selection.loc}`,
    selection.sourceKind ? `- sourceKind: ${selection.sourceKind}` : null,
    selection.text ? `- text: ${compactLine(selection.text, 220)}` : null,
    selection.selector ? `- selector: ${compactLine(selection.selector, 220)}` : null,
    selection.componentName ? `- component: ${selection.componentName}` : null,
    selection.componentLoc ? `- componentSource: ${selection.componentLoc}` : null,
    selection.componentPath?.length
      ? `- componentPath: ${selection.componentPath.join(' > ')}`
      : null,
    selection.domPath ? `- domPath: ${compactLine(selection.domPath, 220)}` : null,
    selection.attributes
      ? `- attributes: ${formatSelectionAttributes(selection.attributes)}`
      : null,
    `- bounds: ${Math.round(selection.rect.width)}x${Math.round(selection.rect.height)} at ${Math.round(
      selection.rect.x,
    )},${Math.round(selection.rect.y)}`,
  ].filter(Boolean);
  return lines.join('\n');
}

export function selectedTargetHardContractSection(
  selection: EditorState['selection'] | null | undefined,
): string {
  if (!selection) return '';
  const lines = [
    '## Selected target (hard contract)',
    '',
    'The user sent this request with a canvas element selected. For scoped edit requests, the selected DOM/source element is the hard target.',
    `- targetTag: \`${selection.tagName.toLowerCase()}\``,
    `- targetLoc: \`${selection.loc}\``,
    selection.sourceKind ? `- targetSourceKind: \`${selection.sourceKind}\`` : null,
    selection.text ? `- targetText: \`${compactLine(selection.text, 220)}\`` : null,
    selection.selector ? `- targetSelector: \`${compactLine(selection.selector, 220)}\`` : null,
    selection.componentName ? `- targetComponent: \`${selection.componentName}\`` : null,
    selection.componentLoc ? `- targetComponentSource: \`${selection.componentLoc}\`` : null,
    selection.componentPath?.length
      ? `- targetComponentPath: \`${selection.componentPath.join(' > ')}\``
      : null,
    selection.domPath ? `- targetDomPath: \`${compactLine(selection.domPath, 220)}\`` : null,
    selection.attributes
      ? `- targetAttributes: \`${formatSelectionAttributes(selection.attributes)}\``
      : null,
    `- targetBounds: \`${Math.round(selection.rect.width)}x${Math.round(selection.rect.height)} at ${Math.round(
      selection.rect.x,
    )},${Math.round(selection.rect.y)}\``,
    '- hardTargetRule: do not satisfy a scoped request by editing a nearby, visually similar, or same-role element.',
    '- hardTargetFallback: if the selected target cannot be resolved safely, ask for clarification instead of editing another element.',
  ].filter(Boolean);
  return lines.join('\n');
}

function validationContract(input: BuildOpenCodeHandoffPromptInput): string {
  const targets = input.allowedTargets?.length
    ? input.allowedTargets.map((target) => `- ${target}`).join('\n')
    : '- No explicit target files were provided. Ask for clarification before broad rewrites.';
  return [
    '# sber-designer Task Handoff',
    '',
    '## Validation Contract',
    '',
    'Read this section first. These constraints have the highest priority.',
    '',
    '- Use the existing project design system before creating custom UI.',
    '- Keep generated screens compatible with sber-designer Design mode.',
    '- Do not modify unrelated files.',
    '- Attached documents and pasted file contents are task requirements, not optional context; attached images are visual references; attached HTML is an untrusted reference to rebuild with project components, not raw implementation code.',
    '- For edit tasks, you must edit at least one allowed target file so the rendered screen visibly changes.',
    '- If the request cannot be implemented, stop and explain the blocker instead of reporting success with no file changes.',
    '- Summarize files changed, design assumptions, and any MCP/design-source issues.',
    '',
    'Allowed target files:',
    targets,
  ].join('\n');
}

function activeScreenSection(activeScreen: HandoffActiveScreen | null | undefined): string {
  if (!activeScreen) {
    return ['## Active Screen', '', 'No active screen was provided.'].join('\n');
  }
  return [
    '## Active Screen',
    '',
    `- id: ${activeScreen.id}`,
    `- name: ${activeScreen.name}`,
    activeScreen.filePath ? `- story file: ${activeScreen.filePath}` : null,
    activeScreen.implementationFilePath
      ? `- implementation file: ${activeScreen.implementationFilePath}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function projectDesignSection(summary: string | null | undefined): string {
  return [
    '## Project Design System',
    '',
    summary?.trim() || 'Use .sber-designer/design-index and existing project components/tokens.',
  ].join('\n');
}

function projectContextSection(input: BuildOpenCodeHandoffPromptInput): string {
  return [
    '## Project Context',
    '',
    `- project: ${input.projectName ?? 'unknown'}`,
    `- workspace: ${input.workspacePath ?? 'unknown'}`,
    '- Follow repository AGENTS.md / CLAUDE.md instructions when present.',
  ].join('\n');
}

function designSourceSection(
  source: DesignSource | null | undefined,
  agentRunId?: string | null,
): string {
  source = designSourceForHandoff(source, agentRunId);
  if (!source) {
    return [
      '## Design Source',
      '',
      'No external design source was detected. Use the project context and user request.',
    ].join('\n');
  }

  const sourceName = source.source.kind === 'pixso' ? 'Pixso' : 'Figma';
  const evidenceRoot = agentRunId
    ? `.sber-designer/runs/${agentRunId}/reference/design-source/`
    : '.sber-designer/runs/<runId>/reference/design-source/';
  const lines = [
    '## Design Source',
    '',
    `${sourceName} is the external design source for this task.`,
    `- source: ${source.source.kind}`,
    `- input: ${source.source.input}`,
    source.source.url ? `- url: ${source.source.url}` : null,
    source.source.nodeId ? `- nodeId: ${source.source.nodeId}` : null,
    `- targetMode: ${source.target.mode}`,
    source.target.name ? `- targetName: ${source.target.name}` : null,
    source.target.storyFilePath ? `- targetStoryFile: ${source.target.storyFilePath}` : null,
    source.target.implementationFilePath
      ? `- targetImplementationFile: ${source.target.implementationFilePath}`
      : null,
    source.target.proposalRoot ? `- targetProposalRoot: ${source.target.proposalRoot}` : null,
    source.target.designSystemFilePath
      ? `- targetDesignSystemFile: ${source.target.designSystemFilePath}`
      : null,
    source.target.tokensFilePath ? `- targetTokensFile: ${source.target.tokensFilePath}` : null,
    source.target.componentsFilePath
      ? `- targetComponentsFile: ${source.target.componentsFilePath}`
      : null,
    source.target.designSystemPreviewFilePath
      ? `- targetDesignSystemPreviewFile: ${source.target.designSystemPreviewFilePath}`
      : null,
    source.target.extractionReportFilePath
      ? `- targetExtractionReportFile: ${source.target.extractionReportFilePath}`
      : null,
    `- tokenPolicy: ${source.policies.tokens}`,
    `- componentPolicy: ${source.policies.components}`,
    '',
    'Design MCP guidance:',
  ].filter(Boolean) as string[];

  if (source.target.mode === 'design-system') {
    lines.push(
      '- Create a reviewable HTML design-system proposal from the design evidence, not a screen implementation.',
      '- Write Design.md using the 9-section HTML-first design-system contract.',
      '- Use exact filename casing: Design.md. Treat DESIGN.md/design.md as read aliases only.',
      '- Write extraction-report.md with evidence references, confidence, assumptions, and values that need human review.',
      '- tokens.css and components.css are optional only when the evidence is too weak; if written, keep them inside the proposal folder.',
      '- design-system.html is optional; write it only when requested or when evidence supports a useful static preview/catalog.',
    );
  }

  if (source.source.kind === 'pixso') {
    lines.push(
      '- Use only Pixso MCP tools that are exposed in the current MCP inventory.',
      '- Do not invent Pixso tool names. If no suitable read/export/style tool is exposed, say so and ask for a screenshot or export fallback.',
    );
    if (source.source.input === 'selection') {
      lines.push(
        '- Selection mode: use exactly one selected frame/layer in the active Pixso desktop file.',
      );
    }
    lines.push(
      '- If Pixso MCP is missing or no frame is selected, report that clearly instead of guessing.',
    );
  } else {
    lines.push(
      '- Use configured Figma MCP tools when available.',
      '- If a Figma MCP server is missing or the node cannot be read, report that clearly instead of guessing.',
    );
  }

  lines.push(
    '',
    'Evidence contract:',
    `- Keep reference evidence under ${evidenceRoot}`,
    '- Update source-summary.md if MCP code/images/layout notes are available.',
    '- Update mapping-report.md with project token/component matches, direct source values, conflicts, and assumptions.',
  );

  return [...lines].join('\n');
}

function htmlDesignSystemApplySection(userRequest: string): string {
  const targets = parseHtmlDesignSystemApplyDirective(userRequest);
  if (targets.length === 0) return '';
  return [
    '## HTML Design-System Apply',
    '',
    'Apply the accepted HTML design system to existing production pages.',
    `Use ${HTML_DESIGN_SYSTEM_PATHS.designMd}, ${HTML_DESIGN_SYSTEM_PATHS.tokensCss}, and ${HTML_DESIGN_SYSTEM_PATHS.componentsCss} as the source of truth.`,
    'Replace inline/raw values with existing tokens/classes only when the visual intent is equivalent.',
    'Preserve page content, links, forms, and data-sd-screen-root markers.',
    `Treat the canonical package sources and ${HTML_DESIGN_SYSTEM_PATHS.previewHtml} as read-only for this apply run.`,
    'Run static render validation for changed pages before finishing.',
    '',
    'Target pages:',
    ...targets.map((target) => `- ${target}`),
  ].join('\n');
}

export function designSourceForHandoff(
  source: DesignSource | null | undefined,
  agentRunId?: string | null,
): DesignSource | null {
  if (!source) return null;
  if (source.target.mode !== 'design-system') return source;
  const proposalId = agentRunId ?? source.target.proposalRoot ?? null;
  const proposalTarget = createExternalDesignSystemProposalTargetDefaults(
    proposalId ? { proposalId } : {},
  );
  return {
    source: source.source,
    target: {
      ...source.target,
      ...proposalTarget,
      mode: 'design-system',
    },
    policies: source.policies,
  };
}

function userRequestSection(userRequest: string): string {
  const cleanRequest = stripHtmlDesignSystemApplyDirective(
    stripExternalDesignSourceDirective(userRequest),
  );
  return ['## User Request', '', cleanRequest.trim() || '(No user request text.)'].join('\n');
}

function outputContractSection(designSource?: DesignSource | null, userRequest?: string): string {
  if (parseHtmlDesignSystemApplyDirective(userRequest ?? '').length > 0) {
    return [
      '## Output Contract',
      '',
      '- Apply the accepted HTML design system to the allowed existing page files.',
      '- Replace inline/raw color, typography, spacing, radius, shadow, and repeated component styling with existing tokens/classes when equivalent.',
      '- Do not create or edit design/proposals files in this run.',
      `- Do not create or edit ${HTML_DESIGN_SYSTEM_PATHS.designMd}, ${HTML_DESIGN_SYSTEM_PATHS.tokensCss}, ${HTML_DESIGN_SYSTEM_PATHS.componentsCss}, or ${HTML_DESIGN_SYSTEM_PATHS.previewHtml} in this run.`,
      '- Preserve page content, routes, forms, interactions, and data-sd-screen-root markers.',
      '- Run static render validation for changed pages before finishing.',
      '- Summarize changed files, replacements made, values intentionally left unchanged, and render-health result.',
    ].join('\n');
  }
  if (
    designSource?.target.mode === 'design-system' ||
    detectDesignSystemBootstrapIntent(userRequest ?? '')
  ) {
    return [
      '## Output Contract',
      '',
      '- Create a reviewable HTML design-system proposal under the allowed design/proposals folder.',
      '- The proposal must include Design.md and extraction-report.md.',
      '- Use exact filename casing: Design.md. Do not create DESIGN.md or design.md beside it.',
      '- Include tokens.css and components.css only when the source evidence supports concrete reusable values/classes.',
      '- Do not create or edit screen implementation files for this design-system bootstrap task.',
      '- Keep all evidence notes in the proposal or run reference directory, not hidden editor state.',
    ].join('\n');
  }
  return [
    '## Output Contract',
    '',
    '- Implement the requested screen/change in the project files.',
    '- Keep product UI copy in the language of the user brief or specification unless the user explicitly requests a translation.',
    '- Preserve names, amounts, dates, identifiers, and status labels verbatim; flag ambiguity instead of inventing replacements.',
    '- Reuse project components and tokens whenever possible.',
    '- If you create a new screen, include any matching Storybook story or project registration the repo expects.',
    '- For design-source runs, keep source evidence and token/component mapping under the run reference/design-source directory.',
  ].join('\n');
}

export function allowedTargetsFromState(
  state: EditorState,
  userRequest?: string,
  options: AllowedTargetsOptions = {},
): string[] {
  const targets = new Set<string>();
  for (const target of parseHtmlDesignSystemApplyDirective(userRequest ?? '')) {
    if (isHtmlDesignSystemApplyTargetPath(target)) targets.add(target);
  }
  if (targets.size > 0) return [...targets];
  const htmlDesignSystemSourceTargets = htmlDesignSystemSourceTargetsForRequest({
    userRequest,
    activeScreen: state.activeScreen,
  });
  const designSystemProposalTask =
    Boolean(userRequest && isHtmlDesignSystemReferenceBootstrap(userRequest)) ||
    (Boolean(userRequest) && detectDesignSystemBootstrapIntent(userRequest ?? ''));
  if (htmlDesignSystemSourceTargets.length > 0) {
    for (const target of htmlDesignSystemSourceTargets) targets.add(target);
  } else if (!designSystemProposalTask) {
    if (state.activeScreen?.filePath) targets.add(state.activeScreen.filePath);
    if (state.activeScreen?.implementationFilePath)
      targets.add(state.activeScreen.implementationFilePath);
    if (state.assistantTaskIntent?.kind === 'create-screen-from-story') {
      targets.add(state.assistantTaskIntent.targetStoryFilePath);
      if (state.assistantTaskIntent.targetImplementationFilePath) {
        targets.add(state.assistantTaskIntent.targetImplementationFilePath);
      }
    }
    if (state.assistantTaskIntent?.kind === 'fill-generated-screen') {
      targets.add(state.assistantTaskIntent.targetStoryFilePath);
      if (state.assistantTaskIntent.targetImplementationFilePath) {
        targets.add(state.assistantTaskIntent.targetImplementationFilePath);
      }
    }
  }
  const designSource = designSourceForHandoff(
    userRequest ? detectExternalDesignSourceIntent(userRequest) : null,
    options.agentRunId,
  );
  if (
    designSource?.target.storyFilePath &&
    isExternalDesignSourceTargetPath(designSource.target.storyFilePath)
  ) {
    targets.add(designSource.target.storyFilePath);
  }
  if (
    designSource?.target.implementationFilePath &&
    isExternalDesignSourceTargetPath(designSource.target.implementationFilePath)
  ) {
    targets.add(designSource.target.implementationFilePath);
  }
  for (const target of [
    designSource?.target.designSystemFilePath,
    designSource?.target.tokensFilePath,
    designSource?.target.componentsFilePath,
    designSource?.target.designSystemPreviewFilePath,
    designSource?.target.extractionReportFilePath,
  ]) {
    if (target && isExternalDesignSourceTargetPath(target)) targets.add(target);
  }
  if (
    htmlDesignSystemSourceTargets.length === 0 &&
    userRequest &&
    detectDesignSystemBootstrapIntent(userRequest)
  ) {
    const proposalTarget = createExternalDesignSystemProposalTargetDefaults(
      options.agentRunId ? { proposalId: options.agentRunId } : {},
    );
    for (const target of [
      proposalTarget.designSystemFilePath,
      proposalTarget.tokensFilePath,
      proposalTarget.componentsFilePath,
      proposalTarget.designSystemPreviewFilePath,
      proposalTarget.extractionReportFilePath,
    ]) {
      if (isExternalDesignSourceTargetPath(target)) targets.add(target);
    }
  }
  return [...targets];
}

function formatSelectionAttributes(attributes: Record<string, string>): string {
  const entries = Object.entries(attributes)
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, 12)
    .map(([key, value]) => `${key}="${compactLine(value, 120)}"`);
  return entries.length ? entries.join(' ') : '(none)';
}

function compactLine(value: string, maxLength: number): string {
  const compacted = value.replace(/\s+/g, ' ').trim();
  if (compacted.length <= maxLength) return compacted;
  return `${compacted.slice(0, Math.max(0, maxLength - 3))}...`;
}
