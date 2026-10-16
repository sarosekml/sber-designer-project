/**
 * Editor-state sections of the handoff prompt (0136 R12 — extracted from
 * agent-kit-handoff.ts).
 *
 * What the runtime is told about the *situation*: active screen, selection,
 * project context, the design source for this run, and the output contract
 * it must satisfy.
 */
import {
  detectDesignSystemBootstrapIntent,
  detectExternalDesignSourceIntent,
  HTML_DESIGN_SYSTEM_PATHS,
  parseHtmlDesignSystemApplyDirective,
  screenSurface,
  stripExternalDesignSourceDirective,
  stripHtmlDesignSystemApplyDirective,
} from '@sber-designer/shared-types';
import type { EditorState } from '../state-store';
import {
  allowedTargetsFromState,
  allowedTargetsOptionsForRun,
  designSourceForHandoff,
  latestUserRequest,
} from './handoff-prompt';
import { compactText } from './agent-kit-handoff-budget';
import { isHtmlCssPageState } from './agent-kit-handoff-contracts';
import type { BuildAgentKitHandoffInput } from './agent-kit-handoff-types';

export function editorContextSection(
  state: EditorState,
  userRequest: string,
  agentRunId: string | null,
): string {
  return [
    '## Editor Context',
    '',
    activeScreenLines(state),
    '',
    selectedElementLines(state.selection ?? null),
    '',
    projectContextLines(state),
    '',
    'Allowed target files:',
    ...allowedTargetsFromState(state, userRequest, allowedTargetsOptionsForRun(agentRunId)).map(
      (target) => `- ${target}`,
    ),
  ].join('\n');
}

export function activeScreenLines(state: EditorState): string {
  const activeScreen = state.activeScreen;
  if (!activeScreen) return '### Active Screen\n\nNo active screen was provided.';
  return [
    '### Active Screen',
    '',
    `- id: ${activeScreen.id}`,
    `- name: ${activeScreen.name}`,
    `- kind: ${activeScreen.kind}`,
    screenSurface(activeScreen) === 'modal' ? '- surface: modal (overlay dialog)' : null,
    activeScreen.filePath
      ? activeScreen.kind === 'page'
        ? `- page file: ${activeScreen.filePath}`
        : `- story file: ${activeScreen.filePath}`
      : null,
    activeScreen.implementationFilePath
      ? `- implementation file: ${activeScreen.implementationFilePath}`
      : null,
    activeScreen.description
      ? `- description: ${compactText(activeScreen.description, 260)}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function selectedElementLines(selection: EditorState['selection'] | null): string {
  if (!selection) return '### Selected Element\n\nNo selected element was provided.';
  const lines = [
    '### Selected Element',
    '',
    'The user had this canvas element selected when they sent the request.',
    'For relative edit requests such as "this button", apply the change to this element only unless the user explicitly asks for a broader change.',
    '',
    `- selectionScope: active`,
    `- tag: ${selection.tagName.toLowerCase()}`,
    `- loc: ${selection.loc}`,
    selection.sourceKind ? `- sourceKind: ${selection.sourceKind}` : null,
    selection.text ? `- text: ${compactText(selection.text, 220)}` : null,
    selection.selector ? `- selector: ${compactText(selection.selector, 220)}` : null,
    selection.componentName ? `- component: ${selection.componentName}` : null,
    selection.componentLoc ? `- componentSource: ${selection.componentLoc}` : null,
    selection.componentPath?.length
      ? `- componentPath: ${selection.componentPath.join(' > ')}`
      : null,
    selection.domPath ? `- domPath: ${compactText(selection.domPath, 220)}` : null,
    selection.attributes
      ? `- attributes: ${formatSelectionAttributes(selection.attributes)}`
      : null,
    `- bounds: ${Math.round(selection.rect.width)}x${Math.round(selection.rect.height)} at ${Math.round(
      selection.rect.x,
    )},${Math.round(selection.rect.y)}`,
  ].filter(Boolean);
  return lines.join('\n');
}

function projectContextLines(state: EditorState): string {
  return [
    '### Project Context',
    '',
    `- project: ${state.projectName ?? 'unknown'}`,
    `- workspace: ${state.workspacePath ?? 'unknown'}`,
    '- Repository AGENTS.md / CLAUDE.md may be read as general repo instructions.',
    '- The authoritative product-agent role for this run is this ai-product-designer handoff.',
  ].join('\n');
}

export function designSourceSection(userRequest: string, agentRunId: string | null): string {
  const source = designSourceForHandoff(detectExternalDesignSourceIntent(userRequest), agentRunId);
  if (!source) {
    return [
      '## Design Source Context',
      '',
      'No external Pixso/Figma design source directive was detected.',
    ].join('\n');
  }
  const sourceName = source.source.kind === 'pixso' ? 'Pixso' : 'Figma';
  const evidenceRoot = agentRunId
    ? `.sber-designer/runs/${agentRunId}/reference/design-source/`
    : '.sber-designer/runs/<runId>/reference/design-source/';
  const lines = [
    '## Design Source Context',
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
    `- evidenceRoot: ${evidenceRoot}`,
  ].filter(Boolean) as string[];

  if (source.target.mode === 'design-system') {
    lines.push(
      '',
      'Design-system bootstrap contract:',
      '- Create a reviewable HTML design-system proposal from the design evidence, not a screen implementation.',
      '- Write Design.md using the 9-section HTML-first design-system contract.',
      '- Use exact filename casing: Design.md. Treat DESIGN.md/design.md as read aliases only.',
      '- Write extraction-report.md with source evidence, confidence, assumptions, and human-review notes.',
      '- Write tokens.css/components.css only when the evidence supports concrete reusable values/classes.',
      '- Write design-system.html only when requested or when evidence supports a useful static preview/catalog.',
    );
  }

  return lines.join('\n');
}

export function htmlDesignSystemApplySection(userRequest: string): string {
  const targets = parseHtmlDesignSystemApplyDirective(userRequest);
  if (targets.length === 0) return '';
  return [
    '## HTML Design-System Apply Context',
    '',
    'Apply the accepted HTML design system to existing production pages.',
    `- Use ${HTML_DESIGN_SYSTEM_PATHS.designMd}, ${HTML_DESIGN_SYSTEM_PATHS.tokensCss}, and ${HTML_DESIGN_SYSTEM_PATHS.componentsCss} as the source of truth.`,
    '- Replace inline/raw values with existing tokens/classes only when equivalent.',
    '- Preserve content, links, forms, interactions, and data-sd-screen-root markers.',
    `- Treat the canonical package sources and ${HTML_DESIGN_SYSTEM_PATHS.previewHtml} as read-only for this apply run.`,
    '- Run static render validation for changed pages before finishing.',
    '',
    'Target pages:',
    ...targets.map((target) => `- ${target}`),
  ].join('\n');
}

export function outputContractSection(input: BuildAgentKitHandoffInput): string {
  const userRequest = latestUserRequest(input.messages);
  const designSource = detectExternalDesignSourceIntent(userRequest);
  if (parseHtmlDesignSystemApplyDirective(userRequest).length > 0) {
    return [
      '## Output Contract',
      '',
      '- Apply the accepted HTML design system to the allowed existing page files.',
      '- Replace inline/raw color, typography, spacing, radius, shadow, and repeated component styling with existing tokens/classes when equivalent.',
      '- Do not create or edit design/proposals files in this run.',
      `- Do not create or edit ${HTML_DESIGN_SYSTEM_PATHS.designMd}, ${HTML_DESIGN_SYSTEM_PATHS.tokensCss}, ${HTML_DESIGN_SYSTEM_PATHS.componentsCss}, or ${HTML_DESIGN_SYSTEM_PATHS.previewHtml} in this run.`,
      '- Preserve page content, routes, forms, interactions, and data-sd-screen-root markers.',
      '- Run static render validation for changed pages before finishing.',
      '- Finish with changed files, replacements made, values intentionally left unchanged, and render-health result.',
    ].join('\n');
  }
  if (
    designSource?.target.mode === 'design-system' ||
    detectDesignSystemBootstrapIntent(userRequest)
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
      '- Finish with a concise summary of proposal files changed, evidence used, and remaining uncertainties.',
    ].join('\n');
  }
  // 0083 E2: the tail Output Contract must match the run mode. In Storybook mode
  // (component work / the Description for AI interview) the screen-generation
  // "implement a screen / never report success without a target-file change"
  // rules are wrong — the run may legitimately only ask questions or write a
  // description sidecar, so emit a description/component-aware contract instead.
  if (isDescriptionLayerRun(input)) {
    return [
      '## Output Contract',
      '',
      '- This is the Description for AI interview, not screen generation.',
      '- Finishing a turn without editing a screen or any source file is valid — for example after presenting interview questions and waiting for the user to answer.',
      '- When you persist a description, write the sidecar `.sber-designer/components/<id>.md` (human markdown + machine `sberDesigner` block) as the canonical source.',
      '- Never edit page/source files in this role; only sber-designer tool-owned projections may update Storybook or design-system preview surfaces.',
      '- After saving descriptions in a pass, recompile the cache with `request_project_reindex` (or its file-convention equivalent); do not edit `.sber-designer/design-index/*` by hand.',
      '- Do not treat an unchanged screen or an empty target-file diff as a failed run.',
      '- Finish with a concise summary of what you asked, what you saved, and what remains.',
    ].join('\n');
  }
  if (input.state.canvasView === 'storybook') {
    return [
      '## Output Contract',
      '',
      '- This is a Storybook / component task, not screen generation.',
      '- Finishing a turn without editing a screen or any source file is valid.',
      '- Do not treat an unchanged screen or an empty target-file diff as a failed run.',
      '- Finish with a concise summary of what you asked, what you saved, and what remains.',
    ].join('\n');
  }
  if (input.state.canvasView === 'design-system') {
    return [
      '## Output Contract',
      '',
      '- This is an HTML design-system component task, not screen generation.',
      `- Change only canonical package sources under \`${HTML_DESIGN_SYSTEM_PATHS.folder}/\` or component sidecars.`,
      `- Rebuild \`${HTML_DESIGN_SYSTEM_PATHS.previewHtml}\` through the managed tool and request reindexing after source changes.`,
      '- Do not treat unchanged product screens as a failure; they must remain untouched.',
      '- Finish with changed package files, preview/index status, and any remaining diagnostics.',
    ].join('\n');
  }
  if (isHtmlCssPageState(input.state)) {
    return [
      '## Output Contract',
      '',
      '- Implement the requested static page/change in project HTML/CSS files.',
      '- Keep product UI copy in the language of the user brief or specification unless the user explicitly requests a translation.',
      '- Preserve names, amounts, dates, identifiers, and status labels verbatim; flag ambiguity instead of inventing replacements.',
      '- Reuse project CSS catalog classes and token-backed custom properties whenever possible.',
      '- Preserve `data-sd-screen-root` on the page root so Design mode can inspect the rendered DOM.',
      '- Do not report success without allowed target-file changes for edit/generation tasks.',
      '- Finish with a concise summary of changed files, verification performed, and blockers.',
    ].join('\n');
  }
  return [
    '## Output Contract',
    '',
    '- Implement the requested screen/change in project files.',
    '- Keep product UI copy in the language of the user brief or specification unless the user explicitly requests a translation.',
    '- Preserve names, amounts, dates, identifiers, and status labels verbatim; flag ambiguity instead of inventing replacements.',
    '- Reuse project components and tokens whenever possible.',
    '- If you create/fill a screen, keep the Storybook wrapper thin and preserve project registration requirements.',
    '- If you create a new screen, use readable names consistently across screen name, story title/id, story file, and implementation file. Do not append random/hash suffixes; use `New screen NN` (`NewScreenNN.tsx`) only for untitled screens.',
    '- Do not change the existing Storybook meta.title, story export name, or registered storyId for an active screen unless you also update screen registration through sber-designer.',
    '- Do not report success without allowed target-file changes for edit/generation tasks.',
    '- Finish with a concise summary of changed files, verification performed, and blockers.',
  ].join('\n');
}

export function isDescriptionLayerRun(
  input: Pick<BuildAgentKitHandoffInput, 'requestedAgentName' | 'primaryAgentName'>,
): boolean {
  return (
    input.requestedAgentName === 'ai-description-layer' ||
    input.primaryAgentName === 'ai-description-layer'
  );
}

export function cleanUserRequestText(userRequest: string): string {
  return stripHtmlDesignSystemApplyDirective(
    stripExternalDesignSourceDirective(userRequest),
  ).trim();
}

function formatSelectionAttributes(attributes: Record<string, string>): string {
  const entries = Object.entries(attributes)
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, 12)
    .map(([key, value]) => `${key}="${compactText(value, 120)}"`);
  return entries.length ? entries.join(' ') : '(none)';
}
