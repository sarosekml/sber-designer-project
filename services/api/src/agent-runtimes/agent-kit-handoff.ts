import { Buffer } from 'node:buffer';
import { type PromptAttachmentEvidence } from '@sber-designer/shared-types';

import { formatPromptAttachmentReferences } from '../prompt-attachments';
import {
  designBriefPromptSection,
  generationModePromptSection,
  instructionHierarchyPromptSection,
} from '../generation-mode';
import { resolvePrimaryAgent, resolveRequestedAgent } from '../agent-kit/active-agent';
import { renderComponentSelectionMap } from '../component-intelligence/component-pack';
import type { EditorState } from '../state-store';
import {
  allowedTargetsFromState,
  allowedTargetsOptionsForRun,
  latestUserRequest,
  selectedTargetHardContractSection,
} from './handoff-prompt';
import {
  applyPromptBudget,
  compactText,
  joinPromptSections,
  stripFrontmatter,
} from './agent-kit-handoff-budget';
import {
  activeScreenLines,
  cleanUserRequestText,
  designSourceSection,
  editorContextSection,
  htmlDesignSystemApplySection,
  outputContractSection,
} from './agent-kit-handoff-context';
import {
  activeAgentSection,
  buildKnowledgeInventory,
  buildSkillInventory,
  changeEvidenceContractLines,
  instructionsSection,
  knowledgeInventorySection,
  modalContractSection,
  priorityContractSection,
  projectProfileContractSection,
  projectProfileForHandoff,
  projectStyleMemorySection,
  projectSystemStableSection,
  runtimeContractSection,
  runtimeIdentitySection,
  runtimeWarningsSection,
  skillBodiesReferencedBy,
  skillInventorySection,
  stripStorybookOnlyLines,
  taskVariantContextSection,
  writeCheckpointSection,
} from './agent-kit-handoff-contracts';
import {
  normalizeStableContextDigest,
  runtimeSessionDeltaPrompt,
  stableContextDigestFor,
  stableContextDigestSection,
  stableContextReuseSection,
} from './agent-kit-handoff-session';
import {
  DEFAULT_MAX_PROMPT_BYTES,
  MAX_TASK_SUMMARY_CHARS,
  TASK_SUMMARY_PREFIX,
} from './agent-kit-handoff-types';
import type {
  AgentKitHandoffResult,
  ExternalRuntimeKind,
  BuildAgentKitHandoffInput,
} from './agent-kit-handoff-types';

// Facade: these types moved to ./agent-kit-handoff-types in 0136 R12.
// './agent-kit-handoff' stays the import path for existing consumers.
export type {
  AgentKitHandoffInventoryItem,
  AgentKitHandoffKnowledgeItem,
  AgentKitHandoffResult,
  AgentKitPreviousStableContext,
  AgentKitRuntimeSessionContext,
  BuildAgentKitHandoffInput,
  ExternalRuntimeKind,
  ExternalRuntimeProjectIndexContext,
} from './agent-kit-handoff-types';

export function buildAgentKitHandoff(input: BuildAgentKitHandoffInput): AgentKitHandoffResult {
  const primary = resolvePrimaryAgent(input.kit, input.primaryAgentName);
  const activeAgent = primary.ok ? primary.agent : input.kit.defaultAgent;
  const requested =
    input.requestedAgentName && input.requestedAgentName !== activeAgent.name
      ? resolveRequestedAgent(input.kit, input.requestedAgentName)
      : null;
  const requestedAgent = requested?.ok ? requested.agent : null;
  const requestedSkillBodies = requestedAgent
    ? skillBodiesReferencedBy(input.kit, requestedAgent)
    : [];
  const userRequest = latestUserRequest(input.messages);
  const cleanUserRequest = cleanUserRequestText(userRequest);
  const taskSummary = extractTaskHistorySummary(input);
  const projectProfile = projectProfileForHandoff(input.state);
  const skillInventory = buildSkillInventory(input.kit, activeAgent, projectProfile);
  const knowledgeInventory = buildKnowledgeInventory(input.kit, projectProfile);
  const omittedSections: AgentKitHandoffResult['omittedSections'] = [];
  const stableSections = [
    activeAgentSection(
      activeAgent,
      requestedAgent,
      requestedSkillBodies,
      input.runtimeLabel,
      (input.state.canvasView === 'storybook' || input.state.canvasView === 'design-system') &&
        Boolean(requestedAgent),
      projectProfile,
    ),
    instructionsSection(input.kit, activeAgent.path, projectProfile),
    skillInventorySection(skillInventory),
    knowledgeInventorySection(knowledgeInventory),
    projectSystemStableSection(input),
    renderComponentSelectionMap(input.componentPack?.selectionMap),
    projectStyleMemorySection(input.projectStyleMemory),
  ];
  const redactedStableContext = redactSecrets(joinPromptSections(stableSections));
  const stableContextDigest = stableContextDigestFor(redactedStableContext);
  const stableContextBytes = Buffer.byteLength(redactedStableContext, 'utf8');
  const taskContextSections = [
    taskVariantContextSection(input, userRequest),
    editorContextSection(input.state, userRequest, input.agentRunId),
    selectedTargetHardContractSection(input.state.selection ?? null),
    formatPromptAttachmentReferences(input.promptAttachments),
    taskSummary ? ['## Task History Summary', '', taskSummary].join('\n') : '',
    htmlDesignSystemApplySection(userRequest),
    designSourceSection(userRequest, input.agentRunId),
    ['## User Request', '', cleanUserRequest || '(No user request text.)'].join('\n'),
  ];
  const redactedTaskContext = redactSecrets(joinPromptSections(taskContextSections));
  const taskBytes = Buffer.byteLength(redactedTaskContext, 'utf8');
  const previousStableContextDigest = normalizeStableContextDigest(
    input.previousStableContext?.digest,
  );
  const canReuseStableContext = previousStableContextDigest === stableContextDigest;
  const stableContextSections = canReuseStableContext
    ? [
        stableContextReuseSection({
          digest: stableContextDigest,
          bytes: stableContextBytes,
          previous: input.previousStableContext ?? null,
        }),
      ]
    : [...stableSections, stableContextDigestSection(stableContextDigest, stableContextBytes)];
  const fullStableContextSections = [
    ...stableSections,
    stableContextDigestSection(stableContextDigest, stableContextBytes),
  ];
  const fullPromptSource = [
    priorityContractSection(input, userRequest),
    instructionHierarchyPromptSection(),
    writeCheckpointSection(input, userRequest),
    runtimeIdentitySection(input),
    runtimeContractSection(input),
    projectProfileContractSection(input),
    modalContractSection(input),
    runtimeWarningsSection(input),
    generationModePromptSection(input.generation),
    designBriefPromptSection(input.generation),
    ...stableContextSections,
    ...taskContextSections,
    outputContractSection(input),
  ]
    .filter(Boolean)
    .join('\n\n---\n\n');
  const resumeFallbackPromptSource = [
    priorityContractSection(input, userRequest),
    instructionHierarchyPromptSection(),
    writeCheckpointSection(input, userRequest),
    runtimeIdentitySection(input),
    runtimeContractSection(input),
    projectProfileContractSection(input),
    modalContractSection(input),
    runtimeWarningsSection(input),
    generationModePromptSection(input.generation),
    designBriefPromptSection(input.generation),
    ...fullStableContextSections,
    ...taskContextSections,
    outputContractSection(input),
  ]
    .filter(Boolean)
    .join('\n\n---\n\n');
  const maxPromptBytes = input.maxPromptBytes ?? DEFAULT_MAX_PROMPT_BYTES;
  const resumeUsed = input.runtimeSession?.mode === 'resume';
  const deltaPrompt =
    resumeUsed && canReuseStableContext
      ? runtimeSessionDeltaPrompt({
          input,
          userRequest,
          cleanUserRequest,
          stableContextDigest,
          stableContextBytes,
          previous: input.previousStableContext ?? null,
        })
      : null;
  const prompt = deltaPrompt
    ? applyPromptBudget(deltaPrompt, maxPromptBytes, omittedSections)
    : applyPromptBudget(fullPromptSource, maxPromptBytes, omittedSections);
  const redactedPrompt = redactSecrets(prompt);
  const estimatedBytes = Buffer.byteLength(redactedPrompt, 'utf8');
  const runtimeSessionId = input.runtimeSession?.sessionId?.trim() || undefined;
  const resumeFallbackPrompt = deltaPrompt
    ? redactSecrets(applyPromptBudget(resumeFallbackPromptSource, maxPromptBytes, []))
    : undefined;

  return {
    prompt: redactedPrompt,
    agentName: activeAgent.name,
    skillInventory,
    knowledgeInventory,
    includedKnowledge: knowledgeInventory.map((item) => item.id),
    includedTaskHistorySummary: Boolean(taskSummary),
    omittedSections,
    estimatedBytes,
    runtimeWarnings: [
      ...(input.runtimeWarnings ?? []),
      ...omittedSections.map((item) => `Prompt context omitted: ${item.section} (${item.reason})`),
    ],
    stableContextDigest,
    stableContextBytes,
    kitStableDigest: stableContextDigest,
    kitStableBytes: stableContextBytes,
    taskBytes,
    stableContextReuse: canReuseStableContext ? 'reference' : 'full',
    resumeUsed,
    ...(deltaPrompt ? { deltaBytes: estimatedBytes } : {}),
    ...(runtimeSessionId ? { runtimeSessionId } : {}),
    ...(resumeFallbackPrompt ? { resumeFallbackPrompt } : {}),
    ...(previousStableContextDigest ? { previousStableContextDigest } : {}),
    ...(input.previousStableContext?.contextBundlePath
      ? { previousStableContextBundlePath: input.previousStableContext.contextBundlePath }
      : {}),
    ...(input.previousStableContext?.source
      ? { previousStableContextSource: input.previousStableContext.source }
      : {}),
    ...(input.componentPack ? { componentPack: input.componentPack } : {}),
    ...(input.screenStructurePlan ? { screenStructurePlan: input.screenStructurePlan } : {}),
  };
}

export function buildExternalRuntimeNoTargetChangeRetryPrompt(input: {
  runtimeLabel: string;
  reason: string;
  messages: { role: string; content: unknown }[];
  state: EditorState;
  agentRunId?: string | null;
  promptAttachments?: PromptAttachmentEvidence[];
}): string {
  const userRequest = cleanUserRequestText(latestUserRequest(input.messages));
  const targets = allowedTargetsFromState(
    input.state,
    userRequest,
    allowedTargetsOptionsForRun(input.agentRunId),
  );
  const activeImplementation = input.state.activeScreen?.implementationFilePath?.trim();
  const noVisibleWrite = input.reason.includes('no_visible_write');
  const prompt = [
    '# sber-designer external runtime retry',
    '',
    '## Why this retry exists',
    '',
    noVisibleWrite
      ? `The previous ${input.runtimeLabel} pass finished without a first visible implementation write.`
      : `The previous ${input.runtimeLabel} pass finished without changing any allowed target files.`,
    `Validation reason: ${input.reason}`,
    '',
    '## Mandatory edit pass',
    '',
    '- Treat this as a failed no-op continuation, not as a planning-only task.',
    noVisibleWrite ? '- Write the active implementation file now before any further analysis.' : '',
    activeImplementation
      ? `- Edit the active implementation file first: \`${activeImplementation}\`.`
      : '- Edit one allowed target file before doing any broad project scan.',
    '- You may read at most three small source files before the first edit.',
    '- If the current active screen is an empty placeholder, replace it with a visible React screen that matches the user request and attached image/reference context.',
    '- After editing, reread the target file or use read-only status checks if you need a local self-check; do not rely on git diff as the only proof for new/untracked files.',
    '- Do not finish until at least one allowed target file changed.',
    '- Do not launch Storybook, Playwright, Chrome, browser automation, or dev-server smoke checks yourself unless the user explicitly asks for manual browser verification.',
    '- sber-designer runs render verification after your file changes and records runtime_render_health evidence.',
    ...changeEvidenceContractLines(),
    '',
    'Allowed target files:',
    ...(targets.length ? targets.map((target) => `- ${target}`) : ['- none']),
    '',
    '## Active screen',
    '',
    activeScreenLines(input.state),
    '',
    formatPromptAttachmentReferences(input.promptAttachments),
    '',
    '## User request',
    '',
    userRequest || '(No user request text.)',
  ]
    .filter(Boolean)
    .join('\n');
  return redactSecrets(prompt);
}

export function buildExternalRuntimeComponentGapRepairPrompt(input: {
  runtimeLabel: string;
  role: string;
  reason: string;
  messages: { role: string; content: unknown }[];
  state: EditorState;
  agentRunId?: string | null;
  promptAttachments?: PromptAttachmentEvidence[];
}): string {
  const userRequest = cleanUserRequestText(latestUserRequest(input.messages));
  const targets = allowedTargetsFromState(
    input.state,
    userRequest,
    allowedTargetsOptionsForRun(input.agentRunId),
  );
  const activeImplementation = input.state.activeScreen?.implementationFilePath?.trim();
  const prompt = [
    '# sber-designer external runtime component readiness repair',
    '',
    '## Why this repair exists',
    '',
    `The previous ${input.runtimeLabel} pass found no selected design-system component for required role ${input.role}.`,
    `Validation reason: ${input.reason}`,
    '',
    '## Single bounded retrieve → hydrate → repair pass',
    '',
    `- Call the injected proj-mcp search_project_index tool with types=["component"] and a focused query for role ${input.role}.`,
    '- Select one compatible project component from that result; do not broaden into a project-wide scan.',
    '- Call the injected proj-mcp get_usage_card tool for that component.',
    `- Call the injected proj-mcp update_component_selection tool with action="add" and role="${input.role}".`,
    activeImplementation
      ? `- Repair the active implementation file using the hydrated contract: \`${activeImplementation}\`.`
      : '- Repair one allowed target file using the hydrated component contract.',
    '- Validate the repaired source once, then finish. Do not repeat this readiness loop.',
    '- Do not replace an intentionally unused optional shortlist candidate merely to improve shortlist coverage.',
    '',
    'Allowed target files:',
    ...(targets.length ? targets.map((target) => `- ${target}`) : ['- none']),
    '',
    '## Active screen',
    '',
    activeScreenLines(input.state),
    '',
    formatPromptAttachmentReferences(input.promptAttachments),
    '',
    '## User request',
    '',
    userRequest || '(No user request text.)',
  ]
    .filter(Boolean)
    .join('\n');
  return redactSecrets(prompt);
}

export function buildExternalRuntimeRenderRepairPrompt(input: {
  runtimeLabel: string;
  reason: string;
  changedFiles: string[];
  attempt: number;
  maxAttempts: number;
  messages: { role: string; content: unknown }[];
  state: EditorState;
  agentRunId?: string | null;
  promptAttachments?: PromptAttachmentEvidence[];
}): string {
  const userRequest = cleanUserRequestText(latestUserRequest(input.messages));
  const targets = allowedTargetsFromState(
    input.state,
    userRequest,
    allowedTargetsOptionsForRun(input.agentRunId),
  );
  const activeImplementation = input.state.activeScreen?.implementationFilePath?.trim();
  const prompt = [
    '# sber-designer external runtime render repair',
    '',
    '## Why this repair exists',
    '',
    `The previous ${input.runtimeLabel} pass changed source, but Storybook render verification failed.`,
    `Repair attempt: ${input.attempt} of ${input.maxAttempts}.`,
    `Render error: ${input.reason}`,
    '',
    '## Mandatory repair pass',
    '',
    '- Preserve the generated source and make the smallest targeted fix.',
    activeImplementation
      ? `- Start with the active implementation file: \`${activeImplementation}\`.`
      : '- Start with the changed target files listed below.',
    '- Fix import/export/module/runtime errors before making visual improvements.',
    '- If the render error says a symbol is not defined, validate the whole import block and component usage, not only the named symbol; stale preview errors can name the wrong symbol.',
    '- After import fixes, run available clean render/typecheck verification only when it does not launch Storybook/browser orchestration.',
    '- Do not launch Storybook, Playwright, Chrome, browser automation, or dev-server smoke checks yourself unless the user explicitly asks for manual browser verification.',
    '- Treat the render error above as harness-owned evidence; sber-designer will rerun render verification after this repair pass.',
    '- If a text patch or replace-text attempt reports not found/not unique, reread the target file before retrying. Do not repeat the same failed patch unchanged.',
    '- For freshly generated screen files, prefer a full-file write of the active implementation file over a fragile text patch when local context is stale.',
    '- Do not rewrite unrelated files or change Storybook meta.title/story identity.',
    '- After editing, verify that at least one changed target file still contains a visible screen root.',
    '',
    'Changed target files:',
    ...(input.changedFiles.length ? input.changedFiles.map((target) => `- ${target}`) : ['- none']),
    '',
    'Allowed target files:',
    ...(targets.length ? targets.map((target) => `- ${target}`) : ['- none']),
    '',
    '## Active screen',
    '',
    activeScreenLines(input.state),
    '',
    formatPromptAttachmentReferences(input.promptAttachments),
    '',
    '## User request',
    '',
    userRequest || '(No user request text.)',
  ]
    .filter(Boolean)
    .join('\n');
  return redactSecrets(prompt);
}

export function extractTaskHistorySummary(input: {
  messages: { role: string; content: unknown }[];
  taskHistorySummary?: string | null;
}): string | null {
  const explicit = compactText(input.taskHistorySummary ?? '', MAX_TASK_SUMMARY_CHARS);
  if (explicit) return redactSecrets(explicit);

  for (let index = input.messages.length - 1; index >= 0; index -= 1) {
    const message = input.messages[index];
    if (message?.role !== 'system' || typeof message.content !== 'string') continue;
    const trimmed = message.content.trim();
    if (!trimmed.startsWith(TASK_SUMMARY_PREFIX)) continue;
    const summary = compactText(trimmed.slice(TASK_SUMMARY_PREFIX.length), MAX_TASK_SUMMARY_CHARS);
    return summary ? redactSecrets(summary) : null;
  }
  return null;
}

export function redactSecrets(value: string): string {
  return value
    .replace(/\b(sk|pk|rk|ak)-[A-Za-z0-9_-]{12,}\b/gu, '[redacted-secret]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/giu, 'Bearer [redacted-secret]')
    .replace(
      /\b([A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD))\s*=\s*[^\s]+/giu,
      '$1=[redacted-secret]',
    );
}

export function adaptAgentBodyForExternalRuntime(
  body: string,
  projectProfile?: string | null,
): string {
  const adapted = stripFrontmatter(body).replace(
    'If the user already invoked a subagent with `@...`, respect that routing and do not restate the primary-agent persona.',
    'If the user already invoked a subagent with `@...`, treat that subagent as a focused lens while keeping the external runtime persona as ai-product-designer.',
  );
  return projectProfile === 'html-css' ? stripStorybookOnlyLines(adapted) : adapted;
}
