/**
 * Resumed-session handoff (0136 R12 — extracted from agent-kit-handoff.ts).
 *
 * When a CLI runtime keeps its own session, the second and later turns send a
 * delta instead of the whole prompt. This module builds that delta, its
 * contract sections, and the stable-context digest that lets both sides agree
 * on what the runtime already has.
 */
import { createHash } from 'node:crypto';
import { formatPromptAttachmentReferences } from '../prompt-attachments';
import {
  designBriefPromptSection,
  generationModePromptSection,
  instructionHierarchyPromptSection,
} from '../generation-mode';
import {
  allowedTargetsFromState,
  allowedTargetsOptionsForRun,
  selectedTargetHardContractSection,
} from './handoff-prompt';
import { compactText, joinPromptSections } from './agent-kit-handoff-budget';
import {
  activeScreenLines,
  designSourceSection,
  outputContractSection,
} from './agent-kit-handoff-context';
import {
  runtimeIdentitySection,
  runtimeWarningsSection,
  taskVariantContextSection,
} from './agent-kit-handoff-contracts';
import type {
  AgentKitPreviousStableContext,
  BuildAgentKitHandoffInput,
} from './agent-kit-handoff-types';

export function runtimeSessionDeltaPrompt(input: {
  input: BuildAgentKitHandoffInput;
  userRequest: string;
  cleanUserRequest: string;
  stableContextDigest: string;
  stableContextBytes: number;
  previous: AgentKitPreviousStableContext | null;
}): string {
  const session = input.input.runtimeSession;
  const boundedScreenEdit = isBoundedRuntimeScreenEdit(input.input);
  const targets = allowedTargetsFromState(
    input.input.state,
    input.userRequest,
    allowedTargetsOptionsForRun(input.input.agentRunId),
  );
  const lines = [
    '# sber-designer external runtime continuation',
    '',
    '## Runtime Session Resume',
    '',
    `- runtime: ${input.input.runtimeLabel}`,
    session?.sessionId ? `- runtimeSessionId: ${session.sessionId}` : null,
    session?.model ? `- model: ${session.model}` : null,
    session?.workspacePath ? `- workspace: ${session.workspacePath}` : null,
    `- stableContextDigest: ${input.stableContextDigest}`,
    `- stableContextBytes: ${input.stableContextBytes}`,
    '- stableContextResend: delta',
    input.previous?.contextBundlePath
      ? `- previousContextBundle: ${input.previous.contextBundlePath}`
      : null,
    '',
    'Resume the existing CLI conversation. The unchanged agent persona, skill inventory, knowledge inventory, and stable project-index context were already supplied in the previous context bundle.',
    'Task-specific project hints and component-pack guidance for the latest request are supplied below. Do not rebuild or rescan broad inventories just to recover stable context.',
  ]
    .filter(Boolean)
    .join('\n');

  return joinPromptSections([
    runtimeIdentitySection(input.input),
    runtimeSessionDeltaContractSection(input.input, boundedScreenEdit),
    instructionHierarchyPromptSection(),
    runtimeWarningsSection(input.input),
    generationModePromptSection(input.input.generation),
    designBriefPromptSection(input.input.generation),
    lines,
    runtimeSessionDeltaTaskContextSection(input.input, input.userRequest),
    [
      '## Active Target Delta',
      '',
      activeScreenLines(input.input.state),
      '',
      'Allowed target files:',
      ...(targets.length ? targets.map((target) => `- ${target}`) : ['- none']),
    ].join('\n'),
    selectedTargetHardContractSection(input.input.state.selection ?? null),
    formatPromptAttachmentReferences(input.input.promptAttachments),
    designSourceSection(input.userRequest, input.input.agentRunId),
    ['## User Request', '', input.cleanUserRequest || '(No user request text.)'].join('\n'),
    outputContractSection(input.input),
  ]);
}

function isBoundedRuntimeScreenEdit(input: BuildAgentKitHandoffInput): boolean {
  return (
    input.runtimeSession?.mode === 'resume' &&
    input.componentPack?.taskKind === 'screen-edit' &&
    Boolean(input.state.activeScreen?.implementationFilePath?.trim())
  );
}

function runtimeSessionDeltaContractSection(
  input: BuildAgentKitHandoffInput,
  boundedScreenEdit = isBoundedRuntimeScreenEdit(input),
): string {
  const lines = [
    '## Delta Contract',
    '',
    `- Continue the existing ${input.runtimeLabel} runtime session; do not restart broad discovery.`,
    '- Treat the previous context bundle as the stable source for agent role, skills, knowledge, and stable project-index context.',
    '- Use the task-specific component guidance in this delta prompt for the latest request.',
    '- Read exact previous details only when needed, then focus on the new user request.',
    '- Make implementation changes in allowed target files only.',
    '- Do not launch Storybook, Playwright, Chrome, browser automation, or dev-server smoke checks unless the user explicitly asks.',
  ];
  if (boundedScreenEdit) {
    lines.push(
      '',
      '### Bounded Screen-Edit Execution',
      '',
      '- This is a local follow-up on an existing implementation. Treat the active implementation as the source of truth and preserve its current component choices unless the user explicitly requests a replacement.',
      '- The resumed session already contains the agent, skill, knowledge, repository-instruction, and project-index context. Do not reopen or reread global SKILL.md, AGENTS.md, CLAUDE.md, knowledge, or inventory files.',
      '- Do not rescan the repository or component catalog. Inspect only the active target and an explicitly named dependency when the requested edit cannot be made from the target alone.',
      '- Use a bounded `inspect once → patch once → verify once` workflow. Combine related read-only checks and stay within six CLI/tool calls for this follow-up.',
      '- Run only target-scoped verification. Do not run package-wide typecheck, Storybook, or repeated format/diff/status checks; the harness owns broader verification.',
      '- If the bounded attempt cannot be verified, stop with the concrete blocker instead of expanding discovery or retrying the same command.',
    );
  }
  return lines.join('\n');
}

function runtimeSessionDeltaTaskContextSection(
  input: BuildAgentKitHandoffInput,
  userRequest: string,
): string {
  if (!isBoundedRuntimeScreenEdit(input)) return taskVariantContextSection(input, userRequest);

  const pack = input.componentPack;
  const requiredCandidates =
    pack?.candidates.filter((candidate) => candidate.userRequired).slice(0, 4) ?? [];
  const lines = [
    '## Task Variant Context',
    '',
    '- taskKind: screen-edit',
    pack ? `- componentPackStatus: ${pack.status}` : null,
    pack ? `- componentPackStale: ${pack.stale ? 'yes' : 'no'}` : null,
    '- Existing imports and project components in the active implementation are canonical for this local edit.',
    '- Full project description-map, selection-map, and component hydration are intentionally omitted from this resumed delta.',
  ].filter(Boolean) as string[];

  if (requiredCandidates.length > 0) {
    lines.push('', '### Explicit component requirements');
    for (const candidate of requiredCandidates) {
      const publicImport = candidate.publicImport;
      lines.push(
        `- ${candidate.role}: ${candidate.shortName}${publicImport ? ` from ${publicImport.module}` : candidate.importHint ? ` from ${candidate.importHint}` : ''}`,
      );
      for (const guidance of candidate.guidance.slice(0, 2)) {
        lines.push(`  - ${compactText(guidance, 240)}`);
      }
    }
  }

  return lines.join('\n');
}

export function stableContextDigestSection(digest: string, bytes: number): string {
  return [
    '## Stable Context Digest',
    '',
    `- stableContextDigest: ${digest}`,
    `- stableContextBytes: ${bytes}`,
    '- stableContextResend: full',
    '- Future continuation handoffs may reference this digest instead of resending unchanged agent, inventory, and stable project-index context.',
  ].join('\n');
}

export function stableContextReuseSection(input: {
  digest: string;
  bytes: number;
  previous: AgentKitPreviousStableContext | null;
}): string {
  const lines = [
    '## Stable Context Reuse',
    '',
    `- stableContextDigest: ${input.digest}`,
    `- stableContextBytes: ${input.bytes}`,
    '- stableContextResend: reference',
  ];
  if (input.previous?.contextBundlePath) {
    lines.push(`- previousContextBundle: ${input.previous.contextBundlePath}`);
  }
  if (input.previous?.runManifestPath) {
    lines.push(`- previousRunManifest: ${input.previous.runManifestPath}`);
  }
  lines.push(
    '',
    'The agent persona, skill inventory, knowledge inventory, and stable project-index context are unchanged from the previous context bundle.',
    'Task-specific component guidance, selected element context, and user request details are supplied in this prompt. Do not re-scan broad inventories just to rebuild stable context.',
  );
  return lines.join('\n');
}

export function stableContextDigestFor(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

export function normalizeStableContextDigest(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) return null;
  if (/^sha256:[a-f0-9]{64}$/u.test(trimmed)) return trimmed;
  if (/^[a-f0-9]{64}$/u.test(trimmed)) return `sha256:${trimmed}`;
  return trimmed;
}
