/**
 * Contract and inventory sections of the external-runtime handoff prompt
 * (0136 R12 — extracted from agent-kit-handoff.ts).
 *
 * Everything the runtime is told about *rules*: priority order, the write
 * checkpoint, the runtime and identity contracts, the project profile, the
 * active agent body, and the skill / knowledge inventories it may draw on.
 *
 * Prompt text is a product contract replayed by the eval fixtures, so the
 * strings are unchanged by the move.
 */
import {
  detectDesignSystemBootstrapIntent,
  detectExternalDesignSourceIntent,
  HTML_DESIGN_SYSTEM_PATHS,
  isHtmlDesignSystemCanonical,
  modalLayoutContractText,
  screenSurface,
  type AgentKitAgent,
  type AgentKitSkill,
} from '@sber-designer/shared-types';
import { filterAgentSkills } from '../agent-kit/permissions';
import type { LoadedAgentKit } from '../agent-kit/loader';
import { renderTaskRelevantComponentPack } from '../component-intelligence/component-pack';
import {
  renderTaskRelevantDescriptionMap,
  renderTaskRelevantProjectIndexSummary,
} from '../project-index/prompt-context';
import type { EditorState } from '../state-store';
import { allowedTargetsFromState, allowedTargetsOptionsForRun } from './handoff-prompt';
import { renderScreenStructurePlan } from '../screen-planning/screen-structure-plan';
import { capSection, compactText, stripFrontmatter } from './agent-kit-handoff-budget';
import { cleanUserRequestText, isDescriptionLayerRun } from './agent-kit-handoff-context';
import type {
  AgentKitHandoffInventoryItem,
  AgentKitHandoffKnowledgeItem,
  BuildAgentKitHandoffInput,
} from './agent-kit-handoff-types';
import { adaptAgentBodyForExternalRuntime } from './agent-kit-handoff';

export function runtimeWarningsSection(input: BuildAgentKitHandoffInput): string {
  if (!input.runtimeWarnings?.length) return '';
  return [
    '## Runtime Warnings',
    '',
    ...input.runtimeWarnings.map((warning) => `- ${warning}`),
  ].join('\n');
}

export function buildSkillInventory(
  kit: LoadedAgentKit,
  activeAgent: AgentKitAgent,
  projectProfile?: string | null,
): AgentKitHandoffInventoryItem[] {
  return filterAgentSkills(kit.skills, { policy: activeAgent.permissionPolicy })
    .filter((skill) => skillAppliesToProfile(skill, projectProfile))
    .map((skill) => ({
      name: skill.name,
      description: skill.description,
      whenToUse: deriveWhenToUse(skill.description),
      path: skill.path,
      source: skill.source,
    }));
}

export function buildKnowledgeInventory(
  kit: LoadedAgentKit,
  projectProfile?: string | null,
): AgentKitHandoffKnowledgeItem[] {
  return kit.knowledge
    .filter(
      (resource) =>
        projectProfile !== 'html-css' ||
        !/storybook|tsx/iu.test(`${resource.id} ${resource.description} ${resource.path}`),
    )
    .map((resource) => ({
      id: resource.id,
      description: resource.description,
      path: resource.path,
      source: resource.source,
    }));
}

function deriveWhenToUse(description: string): string {
  const clean = compactText(description, 180);
  if (/screen|page|brd|generate/iu.test(clean)) return `Use when the task matches: ${clean}`;
  if (/design|visual|selected/iu.test(clean)) {
    return `Use for design-system or visual-edit tasks: ${clean}`;
  }
  return `Use when ai-product-designer guidance or task context calls for it: ${clean}`;
}

export function projectProfileForHandoff(state: EditorState): string | null {
  return state.canvasView === 'design-system' || isHtmlCssPageState(state) ? 'html-css' : null;
}

export function isHtmlCssPageState(state: EditorState): boolean {
  return state.activeScreen?.kind === 'page';
}

function skillAppliesToProfile(skill: AgentKitSkill, projectProfile?: string | null): boolean {
  if (!projectProfile) return true;
  if (skill.profiles && skill.profiles.length > 0) return skill.profiles.includes(projectProfile);
  if (projectProfile === 'html-css' && /^storybook-/iu.test(skill.name)) return false;
  return true;
}

export function stripStorybookOnlyLines(value: string): string {
  return value
    .split('\n')
    .filter((line) => !/\bstorybook\b|\.stories\b|\btsx\b|meta\.title/iu.test(line))
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

export function priorityContractSection(
  input: BuildAgentKitHandoffInput,
  userRequest: string,
): string {
  const designSource = detectExternalDesignSourceIntent(userRequest);
  const isDesignSystemBootstrap =
    designSource?.target.mode === 'design-system' || detectDesignSystemBootstrapIntent(userRequest);
  const targets = allowedTargetsFromState(
    input.state,
    userRequest,
    allowedTargetsOptionsForRun(input.agentRunId),
  );
  const targetLines = targets.length
    ? targets.map((target) => `- ${target}`)
    : ['- No explicit target files were provided. Ask for clarification before broad rewrites.'];
  // 0083 section A: in Storybook mode (component work / the Description for AI
  // interview) the screen-generation "must change a file" rules are wrong — the
  // run may legitimately only present questions or write description sidecars.
  // 0083 E4: the description interview is sidecar-only — say so in the
  // highest-priority section, because an external CLI runtime does not enforce
  // the agent's `apply_patch` deny (it must be held by the contract instead).
  const isDescriptionRole = isDescriptionLayerRun(input);
  const editRules = isDesignSystemBootstrap
    ? [
        '- This is an HTML design-system bootstrap task, not screen generation.',
        '- Change the allowed proposal files only; do not create or edit screen implementation files.',
        '- Before finishing, verify that Design.md and extraction-report.md exist in the proposal folder.',
        '- If the source evidence is too weak to infer tokens/components, write that uncertainty in extraction-report.md instead of inventing values.',
      ]
    : isDescriptionRole
      ? [
          '- This is the Description for AI interview, not screen generation.',
          '- You may legitimately respond without editing a screen — e.g. present interview questions, or write component description sidecars under `.sber-designer/components/`.',
          '- Do not force a screen edit, and do not treat an unchanged screen as a failed run.',
          '- Description interview is sidecar-first: write `.sber-designer/components/<id>.md` as the canonical source. Never edit page/source files in this role unless a sber-designer tool-owned projection explicitly does it.',
        ]
      : input.state.canvasView === 'design-system'
        ? [
            '- This is an HTML design-system package task, not screen generation.',
            `- Edit only ${HTML_DESIGN_SYSTEM_PATHS.folder}/ sources and canonical component sidecars; product pages and flow metadata are read-only.`,
            `- Never hand-edit ${HTML_DESIGN_SYSTEM_PATHS.previewHtml}; use the managed rebuild tool, then request reindexing.`,
            '- Do not call screen_create, screen_remove, or flow tools in this view.',
          ]
        : input.state.canvasView === 'storybook'
          ? [
              '- This is a Storybook / component task, not screen generation.',
              '- You may legitimately respond without editing a screen.',
              '- Do not force a screen edit, and do not treat an unchanged screen as a failed run.',
            ]
          : [
              '- For edit/generation tasks, change at least one allowed target file so the rendered screen visibly changes.',
              '- Before finishing, verify that at least one allowed target file has changed.',
              '- If the request cannot be implemented, stop and explain the blocker instead of reporting success with no file changes.',
            ];
  return [
    '# sber-designer External Runtime Handoff',
    '',
    '## Priority Contract',
    '',
    'Read this section first. These constraints have the highest priority.',
    '',
    '- Use the existing project design system before creating custom UI.',
    '- Keep generated screens compatible with sber-designer Design mode.',
    '- Do not modify unrelated files.',
    '- Attached documents and pasted file contents are task requirements, not optional context; attached images are visual references; attached HTML is an untrusted reference to rebuild with project components, not raw implementation code.',
    ...editRules,
    '- Summarize files changed, design assumptions, and any MCP/design-source issues.',
    '',
    'Allowed target files:',
    ...targetLines,
  ].join('\n');
}

export function writeCheckpointSection(
  input: BuildAgentKitHandoffInput,
  userRequest: string,
): string {
  // 0083 E2: Storybook mode (component work / the Description for AI interview) is
  // not screen generation — the "edit the active implementation file, empty diff
  // is a failed run" checkpoint must not apply.
  if (input.state.canvasView === 'storybook' || input.state.canvasView === 'design-system')
    return '';
  const targets = allowedTargetsFromState(
    input.state,
    userRequest,
    allowedTargetsOptionsForRun(input.agentRunId),
  );
  const activeImplementation = input.state.activeScreen?.implementationFilePath?.trim();
  if (!targets.length || !activeImplementation) return '';
  const htmlCssPage = isHtmlCssPageState(input.state);
  return [
    '## Write checkpoint for active screens',
    '',
    '- For active screen generation/edit tasks, edit the active implementation file before broad project scans.',
    `- Active implementation file: \`${activeImplementation}\`.`,
    htmlCssPage
      ? '- Read the active HTML file, linked CSS files, and at most one nearby HTML example before the first edit unless a blocking API question requires one more targeted lookup.'
      : '- Read the active implementation file, the active story file, and at most one nearby example before the first edit unless a blocking import/API question requires one more targeted lookup.',
    '- For image-to-screen tasks, make a first visible implementation pass from the attached image before doing long catalog research.',
    '- Before the final answer, make sure the intended allowed target path was saved; sber-designer will compare before/after snapshots and mark the run as no-op if nothing changed.',
  ].join('\n');
}

export function runtimeContractSection(input: BuildAgentKitHandoffInput): string {
  const htmlCssPage = isHtmlCssPageState(input.state);
  return [
    '## Runtime Contract',
    '',
    `You are running through ${input.runtimeLabel}${input.model ? ` (${input.model})` : ''}.`,
    'You do not have sber-designer internal tool calls.',
    'Read and edit workspace files directly using your own CLI capabilities.',
    'Do not change provider auth/config files.',
    'Do not run destructive git commands.',
    '',
    'Harness-owned render verification:',
    htmlCssPage
      ? '- Do not launch browser automation or dev-server smoke checks yourself unless the user explicitly asks for manual browser verification.'
      : '- Do not launch Storybook, Playwright, Chrome, browser automation, or dev-server smoke checks yourself unless the user explicitly asks for manual browser verification.',
    '- sber-designer runs render verification after your file changes and records runtime_render_health evidence.',
    '- If the harness sends a render-repair prompt, treat its reason/evidence as the source of truth and make code fixes only; the harness will rerun render verification after the repair pass.',
    '',
    'Harness-owned change evidence:',
    ...changeEvidenceContractLines(),
    '',
    'Internal-tool wording translation:',
    '- When the agent profile says "call load_agent_skill", read the matching SKILL.md path from the skill inventory instead.',
    '- When it says "read_agent_knowledge", read the matching knowledge file path from the knowledge inventory instead.',
    '- When it mentions write_file/apply_patch/screen_create/get_selection/set_mode, interpret that as sber-designer internal API wording and use the editor context plus your own CLI file editing.',
  ].join('\n');
}

export function runtimeIdentitySection(input: BuildAgentKitHandoffInput): string {
  const runtimeLabel = input.runtimeLabel.trim() || input.runtime;
  const model = input.model?.trim() || input.runtimeSession?.model?.trim() || 'runtime default';
  return [
    '## Runtime identity',
    '',
    'You are the `ai-product-designer` product agent inside sber-designer. The selected execution runtime for this run is described by safe metadata:',
    `- provider: \`${runtimeLabel}\` (\`${input.runtime}\`)`,
    `- model: \`${model}\``,
    '- targetKind: `cli`',
    `- runtimeKind: \`${input.runtime}\``,
    '- If the user asks what model, provider, or runtime you are, answer from these metadata fields.',
    '- Assistant history may contain stale self-identification. This runtime identity metadata supersedes transcript claims.',
    '- For CLI runtimes, report the selected CLI runtime and configured model id/label; do not invent a hidden backend provider.',
  ].join('\n');
}

export function modalContractSection(input: BuildAgentKitHandoffInput): string {
  if (screenSurface(input.state.activeScreen) !== 'modal') return '';
  const profile = isHtmlCssPageState(input.state) ? 'html' : 'react';
  return modalLayoutContractText({ profile });
}

export function projectProfileContractSection(input: BuildAgentKitHandoffInput): string {
  if (input.state.canvasView === 'design-system') {
    return [
      '## HTML Design System Package Contract',
      '',
      `- Canonical sources: \`${HTML_DESIGN_SYSTEM_PATHS.designMd}\`, \`${HTML_DESIGN_SYSTEM_PATHS.tokensCss}\`, and \`${HTML_DESIGN_SYSTEM_PATHS.componentsCss}\`.`,
      `- User-authored examples belong in \`${HTML_DESIGN_SYSTEM_PATHS.refsDir}/\`; optional package assets belong in \`${HTML_DESIGN_SYSTEM_PATHS.assetsDir}/\`.`,
      `- \`${HTML_DESIGN_SYSTEM_PATHS.previewHtml}\` is managed and must only be changed by preview rebuild.`,
      '- Product pages under `pages/**` and root `index.html` are read-only in this view.',
      '- After source changes, rebuild the preview and request project reindexing.',
    ].join('\n');
  }
  if (!isHtmlCssPageState(input.state)) return '';
  const htmlDesignSystem = input.projectIndex?.htmlDesignSystem;
  return [
    '## HTML/CSS Project Profile Contract',
    '',
    htmlDesignSystem ? `- designContext: ${htmlDesignSystem.status}` : null,
    htmlDesignSystem?.missingRequired.length
      ? `- missingDesignSystemSources: ${htmlDesignSystem.missingRequired.join(', ')}`
      : null,
    '- Target a static page file with semantic HTML and existing CSS.',
    '- Prefer CSS catalog classes from the project index before adding new classes.',
    '- Use token-backed custom properties such as `var(--color-*)`; do not add inline hex colors.',
    !isHtmlDesignSystemCanonical(htmlDesignSystem?.status)
      ? `- Design context is not canonical: do not author reusable sources until the project is restructured into ${HTML_DESIGN_SYSTEM_PATHS.folder}/.`
      : `- Connected design context: follow ${HTML_DESIGN_SYSTEM_PATHS.designMd}, ${HTML_DESIGN_SYSTEM_PATHS.tokensCss}, and ${HTML_DESIGN_SYSTEM_PATHS.componentsCss} before adding new page-specific rules.`,
    isHtmlDesignSystemCanonical(htmlDesignSystem?.status)
      ? `- Do not invent a palette: reuse only ${HTML_DESIGN_SYSTEM_PATHS.tokensCss} color values and \`var(--font-*)\` typography tokens. Raw hex colors, default utility palettes, or raw font-family literals are blocking and send the run to needs_review.`
      : null,
    '- Keep scripts minimal and source-owned; static preview/render health is harness-owned.',
    '- Do not introduce framework components, JSX, or utility palettes that are absent from the connected project.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function changeEvidenceContractLines(): string[] {
  return [
    '- sber-designer snapshots allowed target files before the run and compares before/after file contents after you finish.',
    '- The harness records the external_runtime_target_diff receipt with created/modified/deleted target files; treat that receipt as the authoritative change proof.',
    '- Do not run git add -N or write to the git index just to make untracked files diffable.',
    '- If you want a local self-check, read the file you edited or use read-only commands such as `git status --short -- <allowed target files>`; do not rely on git diff as the only proof for new/untracked files.',
  ];
}

export function activeAgentSection(
  activeAgent: AgentKitAgent,
  requestedAgent: AgentKitAgent | null,
  requestedSkillBodies: { name: string; body: string }[],
  runtimeLabel: string,
  trimActiveBody: boolean,
  projectProfile?: string | null,
): string {
  // 0083 H3: in a Storybook/component run with a requested subagent, the full
  // screen-generation persona body of the primary agent is dead weight (the
  // subagent body + skill below carry the task). Drop it to shrink the per-turn
  // CLI handoff (~39KB → much smaller) so cheap models don't re-read it each turn.
  const bodyLine = trimActiveBody
    ? `(The requested subagent below carries this task's instructions. The full ${activeAgent.name} persona body is omitted for this Storybook/component run to keep the prompt small.)`
    : capSection(
        'active-agent-body',
        adaptAgentBodyForExternalRuntime(activeAgent.body, projectProfile),
      );
  const lines = [
    '## Active Product Agent Delegation',
    '',
    `You are acting as sber-designer's ${activeAgent.name} through ${runtimeLabel}.`,
    `Description: ${activeAgent.description}`,
    `Agent prompt path: ${activeAgent.path}`,
    activeAgent.temperature !== undefined ? `Temperature: ${activeAgent.temperature}` : null,
    activeAgent.maxIterations !== undefined ? `Max iterations: ${activeAgent.maxIterations}` : null,
    '',
    bodyLine,
  ].filter(Boolean) as string[];
  if (requestedAgent) {
    lines.push(
      '',
      '## Requested Subagent Lens',
      '',
      `The user requested @${requestedAgent.name}. Its full instructions follow and`,
      `take precedence for this task: ${requestedAgent.description}`,
      // 0083 section A: the CLI runs in the connected project's cwd, where the
      // .agents/ prompt path is not readable — inline the subagent body (and the
      // skills it names) instead of pointing at paths the runtime cannot open.
      '',
      capSection(
        'requested-subagent-body',
        adaptAgentBodyForExternalRuntime(requestedAgent.body, projectProfile),
      ),
    );
    for (const skill of requestedSkillBodies) {
      lines.push(
        '',
        `### Inlined skill: ${skill.name}`,
        '',
        capSection(`skill-${skill.name}`, skill.body),
      );
    }
    lines.push(
      '',
      `You remain sber-designer's ${activeAgent.name} through ${runtimeLabel}, but follow the`,
      `@${requestedAgent.name} instructions (and any inlined skills) above for this task. Knowledge`,
      'bodies may not be on disk here — work from these inlined instructions and the inventories below.',
    );
  }
  return lines.join('\n');
}

/** Skills whose name the agent body references — inlined for external runtimes. */
export function skillBodiesReferencedBy(
  kit: LoadedAgentKit,
  agent: AgentKitAgent,
): { name: string; body: string }[] {
  return filterAgentSkills(kit.skills, { policy: agent.permissionPolicy })
    .filter((skill): skill is AgentKitSkill & { body: string } =>
      Boolean(skill.body && agent.body.includes(skill.name)),
    )
    .map((skill) => ({ name: skill.name, body: skill.body }));
}

export function instructionsSection(
  kit: LoadedAgentKit,
  activeAgentPath: string,
  projectProfile?: string | null,
): string {
  const agentPromptPaths = new Set(kit.agents.map((agent) => agent.path));
  const instructions = kit.instructions.filter(
    (instruction) =>
      instruction.path !== activeAgentPath && !agentPromptPaths.has(instruction.path),
  );
  if (instructions.length === 0) {
    return [
      '## Always-on Instructions',
      '',
      'No extra always-on instruction files were loaded.',
    ].join('\n');
  }
  const lines = ['## Always-on Instructions'];
  for (const instruction of instructions.slice(0, 8)) {
    lines.push(
      '',
      `### ${instruction.path} (${instruction.source})`,
      '',
      capSection(
        instruction.path,
        projectProfile === 'html-css'
          ? stripStorybookOnlyLines(stripFrontmatter(instruction.contents))
          : stripFrontmatter(instruction.contents),
      ),
    );
  }
  if (instructions.length > 8) {
    lines.push('', `_${instructions.length - 8} more instruction file(s) omitted._`);
  }
  return lines.join('\n');
}

export function skillInventorySection(skills: AgentKitHandoffInventoryItem[]): string {
  const lines = [
    '## Agent Kit Inventory',
    '',
    'Available skills are listed for discovery only. Skill bodies are not inlined in this prompt.',
    'Read the matching SKILL.md file directly when ai-product-designer guidance or the task calls for it.',
  ];
  if (skills.length === 0) {
    lines.push('', '- skills: none');
    return lines.join('\n');
  }
  lines.push('', '- skills:');
  for (const skill of skills) {
    lines.push(
      `  - \`${skill.name}\` (${skill.source})`,
      `    - description: ${compactText(skill.description, 260)}`,
      `    - whenToUse: ${compactText(skill.whenToUse, 260)}`,
      `    - path: ${skill.path}`,
    );
  }
  return lines.join('\n');
}

export function knowledgeInventorySection(knowledge: AgentKitHandoffKnowledgeItem[]): string {
  const lines = [
    '## Knowledge Inventory',
    '',
    'Knowledge bodies are not inlined. Read the listed files directly when details are needed.',
  ];
  if (knowledge.length === 0) {
    lines.push('', '- knowledge: none');
    return lines.join('\n');
  }
  lines.push('', '- knowledge:');
  for (const resource of knowledge.slice(0, 32)) {
    lines.push(
      `  - \`${resource.id}\` (${resource.source})`,
      `    - description: ${compactText(resource.description, 260)}`,
      `    - path: ${resource.path}`,
    );
  }
  if (knowledge.length > 32) {
    lines.push(`  - ${knowledge.length - 32} more knowledge resource(s) omitted.`);
  }
  return lines.join('\n');
}

export function projectSystemStableSection(input: BuildAgentKitHandoffInput): string {
  const lines = ['## Project System Context', ''];
  const projectIndex = input.projectIndex;
  if (input.state.projectInstructions?.trim()) {
    lines.push('### Project Instructions', '', input.state.projectInstructions.trim(), '');
  }
  if (!projectIndex) {
    lines.push(
      '- projectIndex: use `.sber-designer/design-index/` and existing project components/tokens when available.',
    );
    return lines.join('\n');
  }
  lines.push(
    `- projectIndexStatus: ${projectIndex.status}`,
    `- projectIndexStale: ${projectIndex.stale ? 'yes' : 'no'}`,
  );
  if (projectIndex.freshness) lines.push(`- projectSystemFreshness: ${projectIndex.freshness}`);
  if (projectIndex.nextAction) lines.push(`- projectSystemNextAction: ${projectIndex.nextAction}`);
  if (projectIndex.htmlDesignSystem) {
    lines.push(`- designContext: ${projectIndex.htmlDesignSystem.status}`);
    if (projectIndex.htmlDesignSystem.missingRequired.length > 0) {
      lines.push(
        `- missingDesignSystemSources: ${projectIndex.htmlDesignSystem.missingRequired.join(', ')}`,
      );
    }
  }
  if (projectIndex.promptSummary.trim()) {
    lines.push(
      '- projectIndexSummary: available in Task Variant Context after task-relevant pruning.',
    );
  }
  if (projectIndex.counts) {
    lines.push('', '### Project Index Counts');
    for (const [key, value] of Object.entries(projectIndex.counts)) {
      if (typeof value === 'number') lines.push(`- ${key}: ${value}`);
    }
  }
  if (projectIndex.artifacts?.length) {
    lines.push(
      '',
      '### Project Index Artifacts',
      ...projectIndex.artifacts.map((path) => `- ${path}`),
    );
  }
  if (projectIndex.warnings?.length) {
    lines.push(
      '',
      '### Project Index Warnings',
      ...projectIndex.warnings.map((item) => `- ${item}`),
    );
  }
  return lines.join('\n');
}

export function projectStyleMemorySection(memory: string | null | undefined): string {
  return memory?.trim() ?? '';
}

export function taskVariantContextSection(
  input: BuildAgentKitHandoffInput,
  userRequest: string,
): string {
  const lines = ['## Task Variant Context', ''];
  let hasTaskContext = false;
  if (input.state.assistantTaskIntent) {
    lines.push(`- assistantTaskIntent: ${input.state.assistantTaskIntent.kind}`);
    hasTaskContext = true;
  }
  if (input.projectIndex) {
    const projectPromptContext = projectIndexPromptContext(input, userRequest);
    const promptSummary = renderTaskRelevantProjectIndexSummary(projectPromptContext);
    if (promptSummary) {
      lines.push('', promptSummary);
      hasTaskContext = true;
    }
    const descriptionMap = renderTaskRelevantDescriptionMap(projectPromptContext);
    if (descriptionMap) {
      lines.push('', descriptionMap);
      hasTaskContext = true;
    }
  }
  if (input.screenStructurePlan) {
    lines.push('', renderScreenStructurePlan(input.screenStructurePlan));
    hasTaskContext = true;
  }
  if (input.componentPack) {
    lines.push('', renderTaskRelevantComponentPack(input.componentPack));
    hasTaskContext = true;
  }
  if (!hasTaskContext) {
    lines.push('- No task-specific project index or component-pack hints were prepared.');
  }
  return lines.join('\n');
}

function projectIndexPromptContext(input: BuildAgentKitHandoffInput, userRequest: string) {
  return {
    promptSummary: input.projectIndex?.promptSummary,
    descriptionMap: input.projectIndex?.descriptionMap,
    userRequest: cleanUserRequestText(userRequest),
    activeScreenName: input.state.activeScreen?.name,
    activeScreenDescription: input.state.activeScreen?.description,
    taskKind: input.componentPack?.taskKind,
    assistantTaskIntentKind: input.state.assistantTaskIntent?.kind,
  };
}
