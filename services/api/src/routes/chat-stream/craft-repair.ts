import type { ChatMessage } from '@sber-designer/llm-gateway';

import type { AgentRunManifest } from '../../agent/run-recorder';
import type { EditorState } from '../../state-store';
import { allowedTargetsFromState, latestUserRequest } from '../../agent-runtimes/handoff-prompt';

export function buildBuiltInCraftRepairMessages(input: {
  agentRun: AgentRunManifest;
  summary: string;
  findings: unknown[];
}): ChatMessage[] {
  const target =
    input.agentRun.activeScreen?.implementationFilePath ??
    input.agentRun.activeScreen?.filePath ??
    'the active screen source';
  return [
    {
      role: 'system',
      content: [
        'Perform one bounded craft repair of the existing active screen.',
        `Allowed target: ${target}.`,
        'Preserve screen identity, story identity, routes, behavior, business facts, language, and already-correct project components.',
        'Address only the supplied blocking craft findings. Do not create a replacement screen or broaden the task.',
        'Use the available screen tools, validate the repaired target once, then stop.',
        `Original user goal: ${input.agentRun.userGoal}`,
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        'Repair the blocking screen-craft findings below.',
        `Validation summary: ${input.summary}`,
        formatFindings(input.findings),
      ].join('\n\n'),
    },
  ];
}

export function buildExternalRuntimeCraftRepairPrompt(input: {
  runtimeLabel: string;
  summary: string;
  findings: unknown[];
  messages: { role: string; content: unknown }[];
  state: EditorState;
  agentRunId?: string | null;
}): string {
  const userRequest = latestUserRequest(input.messages);
  const targets = allowedTargetsFromState(
    input.state,
    userRequest,
    input.agentRunId ? { agentRunId: input.agentRunId } : {},
  );
  return [
    '# sber-designer bounded craft repair',
    '',
    `The previous ${input.runtimeLabel} pass saved the screen but left blocking craft findings.`,
    `Validation summary: ${input.summary}`,
    '',
    formatFindings(input.findings),
    '',
    'Repair contract:',
    '- Make the smallest targeted repair in the existing active screen.',
    '- Preserve screen/story identity, routes, behavior, business facts, language, and already-correct project components.',
    '- Do not create a replacement screen, broaden the task, or edit unrelated files.',
    '- The current runtime session already contains its agent and skill instructions. Do not read or reopen SKILL.md, AGENTS.md, CLAUDE.md, knowledge, inventory, or unrelated project files.',
    '- Stay within four CLI/tool calls: locate the exact finding, patch it once, then run one target-scoped verification.',
    '- Do not run package-wide typecheck, Storybook, browser checks, or repeated format/diff/status checks; the harness owns broader verification.',
    '- Validate the repaired source once, then finish. This craft repair will not be repeated.',
    '',
    'Allowed target files:',
    ...(targets.length ? targets.map((target) => `- ${target}`) : ['- none']),
    '',
    `Original user request: ${userRequest || '(No user request text.)'}`,
  ].join('\n');
}

function formatFindings(findings: unknown[]): string {
  if (findings.length === 0) return 'Blocking findings: see the validation summary.';
  const lines = findings.slice(0, 12).map((finding, index) => {
    if (!finding || typeof finding !== 'object') return `${index + 1}. ${String(finding)}`;
    const value = finding as Record<string, unknown>;
    const rule = typeof value.ruleId === 'string' ? value.ruleId : `finding-${index + 1}`;
    const message =
      typeof value.message === 'string'
        ? value.message
        : typeof value.detail === 'string'
          ? value.detail
          : JSON.stringify(finding);
    return `${index + 1}. ${rule}: ${message}`;
  });
  return ['Blocking findings:', ...lines].join('\n');
}
