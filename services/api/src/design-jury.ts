import {
  normalizeAssistantTokenUsage,
  type AssistantTokenUsage,
  type DesignBrief,
  type DesignDirectionSelection,
  type DesignJuryPolicy,
  type DesignJuryResult,
  type DesignJuryRole,
  type DesignJuryRoleScore,
  type DesignJuryRound,
} from '@sber-designer/shared-types';
import { z } from 'zod';

import { recordToolReceiptSafely } from './agent/run-recorder';
import { renderDesignBriefSummary, renderDirectionSelectionSummary } from './generation-mode';

export const DESIGN_JURY_THRESHOLD = 8;

export const DESIGN_JURY_ROLE_DEFINITIONS: ReadonlyArray<{
  role: DesignJuryRole;
  label: string;
  weight: number;
  instruction: string;
}> = [
  {
    role: 'layout_hierarchy',
    label: 'Layout & Hierarchy',
    weight: 0.25,
    instruction:
      'Judge information hierarchy, grouping, density, alignment, responsive structure, and whether the primary workflow is visually obvious.',
  },
  {
    role: 'brief_fit',
    label: 'Brief fit',
    weight: 0.25,
    instruction:
      'Judge coverage of the user brief, preservation of business facts, requested states, and fidelity to supplied references.',
  },
  {
    role: 'tokens_consistency',
    label: 'Tokens & Consistency',
    weight: 0.2,
    instruction:
      'Judge reuse of project components and tokens, consistency with nearby screens, and unsupported one-off styling.',
  },
  {
    role: 'accessibility',
    label: 'Accessibility',
    weight: 0.15,
    instruction:
      'Judge semantic structure, labels, keyboard affordances, contrast risks visible in source, focus behavior, and state communication.',
  },
  {
    role: 'copy_language',
    label: 'Copy & Language',
    weight: 0.15,
    instruction:
      'Judge language consistency, clarity, domain terminology, factual copy, and whether labels and actions are concise and unambiguous.',
  },
];

const DesignJuryRoleResponseSchema = z
  .object({
    role: z.enum([
      'layout_hierarchy',
      'brief_fit',
      'tokens_consistency',
      'accessibility',
      'copy_language',
    ]),
    score: z.number().min(0).max(10),
    summary: z.string().trim().min(1),
    mustFix: z.array(z.unknown()),
    evidence: z.array(z.unknown()),
  })
  .strict();

export interface DesignJuryContext {
  userGoal: string;
  taskKind: 'screen_generation' | 'screen_redesign';
  targetFiles: Array<{ path: string; contents: string }>;
  evidence?: string[];
  designBrief?: DesignBrief;
  directionSelection?: DesignDirectionSelection;
}

export interface DesignJuryReviewRequest {
  role: DesignJuryRole;
  round: number;
  prompt: string;
}

export interface DesignJuryReviewResponse {
  text: string;
  usage?: AssistantTokenUsage;
}

export interface DesignJuryRevisionRequest {
  round: DesignJuryRound;
  prompt: string;
}

export interface RunDesignJuryInput {
  context: DesignJuryContext;
  review: (request: DesignJuryReviewRequest) => Promise<DesignJuryReviewResponse>;
  revise?: (
    request: DesignJuryRevisionRequest,
  ) => Promise<DesignJuryContext | null | undefined | void>;
  threshold?: number;
  onRound?: (round: DesignJuryRound) => Promise<void> | void;
}

export function resolveDesignJuryEnabled(
  policy: DesignJuryPolicy | null | undefined,
  runChoice: boolean | null | undefined,
): boolean {
  if (policy === 'required') return true;
  if (policy === 'opt-out') return runChoice !== false;
  return runChoice === true;
}

export function parseDesignJuryRoleResponse(
  text: string,
  expectedRole: DesignJuryRole,
): DesignJuryRoleScore {
  const parsed = DesignJuryRoleResponseSchema.parse(JSON.parse(extractJsonObject(text)));
  if (parsed.role !== expectedRole) {
    throw new Error(
      `Design Jury returned role "${parsed.role}" while "${expectedRole}" was requested.`,
    );
  }
  return {
    role: parsed.role,
    score: roundScore(parsed.score),
    summary: parsed.summary.slice(0, 600),
    mustFix: compactJuryItems(parsed.mustFix),
    evidence: compactJuryItems(parsed.evidence),
  };
}

export function designJuryComposite(roles: readonly DesignJuryRoleScore[]): number {
  const byRole = new Map(roles.map((result) => [result.role, result]));
  if (byRole.size !== DESIGN_JURY_ROLE_DEFINITIONS.length) {
    throw new Error('Design Jury composite requires one score from every role.');
  }
  const composite = DESIGN_JURY_ROLE_DEFINITIONS.reduce((sum, definition) => {
    const result = byRole.get(definition.role);
    if (!result) throw new Error(`Design Jury result is missing role "${definition.role}".`);
    return sum + result.score * definition.weight;
  }, 0);
  return roundScore(composite);
}

export async function runDesignJury(input: RunDesignJuryInput): Promise<DesignJuryResult> {
  const threshold = input.threshold ?? DESIGN_JURY_THRESHOLD;
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 10) {
    throw new Error('Design Jury threshold must be between 0 and 10.');
  }

  let context = input.context;
  let aggregateUsage: AssistantTokenUsage | null = null;
  const rounds: DesignJuryRound[] = [];

  const reviewRound = async (roundNumber: number): Promise<DesignJuryRound> => {
    const roles: DesignJuryRoleScore[] = [];
    let roundUsage: AssistantTokenUsage | null = null;
    for (const definition of DESIGN_JURY_ROLE_DEFINITIONS) {
      const response = await input.review({
        role: definition.role,
        round: roundNumber,
        prompt: buildDesignJuryRolePrompt(context, definition),
      });
      roles.push(parseDesignJuryRoleResponse(response.text, definition.role));
      roundUsage = addTokenUsage(roundUsage, response.usage);
      aggregateUsage = addTokenUsage(aggregateUsage, response.usage);
    }
    const composite = designJuryComposite(roles);
    const round: DesignJuryRound = {
      round: roundNumber,
      roles,
      composite,
      threshold,
      passed: composite >= threshold,
      ...(roundUsage ? { usage: roundUsage } : {}),
    };
    rounds.push(round);
    await input.onRound?.(round);
    return round;
  };

  let latest = await reviewRound(1);
  let revisionAttempted = false;
  if (!latest.passed && input.revise) {
    revisionAttempted = true;
    const revisedContext = await input.revise({
      round: latest,
      prompt: buildDesignJuryRevisionPrompt(latest, context),
    });
    if (revisedContext) context = revisedContext;
    latest = await reviewRound(2);
  }

  return {
    status: latest.passed ? 'passed' : 'needs_review',
    rounds,
    juryComposite: latest.composite,
    revisionAttempted,
    ...(aggregateUsage ? { usage: aggregateUsage } : {}),
  };
}

export async function recordDesignJuryRoundSafely(input: {
  workspacePath: string | null;
  runId: string | null | undefined;
  changedFiles?: string[];
  round: DesignJuryRound;
}): Promise<void> {
  await recordToolReceiptSafely({
    workspacePath: input.workspacePath,
    runId: input.runId,
    tool: 'jury_round',
    status: 'ok',
    changedFiles: input.changedFiles ?? [],
    summary: `Design Jury round ${input.round.round}: ${input.round.composite.toFixed(1)}/10 (${input.round.passed ? 'passed' : 'below threshold'}).`,
    metadata: {
      designJury: input.round,
      juryComposite: input.round.composite,
    },
  });
}

export function formatDesignJuryNotice(result: DesignJuryResult): string {
  const latest = result.rounds.at(-1);
  if (!latest) return '';
  if (result.status === 'passed') {
    return `\n\nDesign Jury: ${latest.composite.toFixed(1)}/10, passed in round ${latest.round}.`;
  }
  const mustFix = uniqueStrings(latest.roles.flatMap((role) => role.mustFix)).slice(0, 5);
  return [
    '',
    '',
    `Design Jury: ${latest.composite.toFixed(1)}/10, below ${latest.threshold.toFixed(1)}. The run needs review; it is not marked failed.`,
    ...(mustFix.length > 0 ? [`Must fix: ${mustFix.join('; ')}`] : []),
  ].join('\n');
}

function buildDesignJuryRolePrompt(
  context: DesignJuryContext,
  definition: (typeof DESIGN_JURY_ROLE_DEFINITIONS)[number],
): string {
  return [
    `You are the ${definition.label} reviewer in a design jury.`,
    definition.instruction,
    'Review only the supplied target and evidence. Do not edit files and do not infer unavailable visual facts.',
    'Score from 0 to 10. Put only concrete blockers in mustFix; use an empty array when none exist.',
    'Return JSON only with this exact shape:',
    `{"role":"${definition.role}","score":0,"summary":"...","mustFix":[],"evidence":[]}`,
    '',
    `Task kind: ${context.taskKind}`,
    `User goal: ${compactText(context.userGoal, 2_000)}`,
    ...(context.designBrief
      ? [
          '',
          `Structured design brief (${context.designBrief.source}):`,
          ...renderDesignBriefSummary(context.designBrief),
        ]
      : []),
    ...(context.directionSelection
      ? ['', `Selected direction: ${renderDirectionSelectionSummary(context.directionSelection)}`]
      : []),
    ...(context.evidence?.length
      ? [
          '',
          'Run evidence:',
          ...context.evidence.slice(0, 12).map((item) => `- ${compactText(item, 500)}`),
        ]
      : []),
    '',
    'Target source:',
    renderTargetFiles(context.targetFiles),
  ].join('\n');
}

export function buildDesignJuryRevisionPrompt(
  round: DesignJuryRound,
  context?: Pick<DesignJuryContext, 'designBrief' | 'directionSelection'>,
): string {
  const mustFix = uniqueStrings(round.roles.flatMap((role) => role.mustFix));
  return [
    `Design Jury round ${round.round} scored ${round.composite.toFixed(1)}/10 against a ${round.threshold.toFixed(1)} threshold.`,
    'Make one bounded revision of the existing target. Preserve working behavior, routes, business facts, screen identity, and project component/token contracts.',
    'The exact current target source is already supplied. Do not call read, search, index, or usage-card tools during this bounded revision.',
    'Your first assistant action must write or patch the active target; then run the required validators and stop.',
    ...(context?.designBrief
      ? [
          `Preserve the structured design brief (${context.designBrief.source}):`,
          ...renderDesignBriefSummary(context.designBrief),
        ]
      : []),
    ...(context?.directionSelection
      ? [
          `Keep the selected direction: ${renderDirectionSelectionSummary(context.directionSelection)}.`,
        ]
      : []),
    'Address only these jury findings, then stop:',
    ...(mustFix.length > 0
      ? mustFix.map((item) => `- ${item}`)
      : ['- Reconcile the role summaries with the current target.']),
  ].join('\n');
}

function renderTargetFiles(files: DesignJuryContext['targetFiles']): string {
  let remaining = 36_000;
  const rendered: string[] = [];
  for (const file of files.slice(0, 4)) {
    if (remaining <= 0) break;
    const contents = compactText(file.contents, Math.min(remaining, 18_000));
    remaining -= contents.length;
    rendered.push(`--- ${file.path} ---\n${contents}`);
  }
  return rendered.join('\n\n') || '(no target source supplied)';
}

function extractJsonObject(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/iu.exec(text);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Design Jury response did not contain JSON.');
  return candidate.slice(start, end + 1);
}

function compactJuryItems(items: unknown[]): string[] {
  return uniqueStrings(
    items
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item === null || item === undefined) return '';
        try {
          return JSON.stringify(item);
        } catch {
          return String(item);
        }
      })
      .filter(Boolean)
      .map((item) => item.slice(0, 300)),
  ).slice(0, 5);
}

function addTokenUsage(
  current: AssistantTokenUsage | null,
  next: AssistantTokenUsage | null | undefined,
): AssistantTokenUsage | null {
  const normalizedNext = normalizeAssistantTokenUsage(next);
  if (!normalizedNext) return current;
  return normalizeAssistantTokenUsage({
    ...(current?.inputTokens !== undefined || normalizedNext.inputTokens !== undefined
      ? { inputTokens: (current?.inputTokens ?? 0) + (normalizedNext.inputTokens ?? 0) }
      : {}),
    ...(current?.outputTokens !== undefined || normalizedNext.outputTokens !== undefined
      ? { outputTokens: (current?.outputTokens ?? 0) + (normalizedNext.outputTokens ?? 0) }
      : {}),
    ...(current?.totalTokens !== undefined || normalizedNext.totalTokens !== undefined
      ? { totalTokens: (current?.totalTokens ?? 0) + (normalizedNext.totalTokens ?? 0) }
      : {}),
  });
}

function compactText(value: string, maxLength: number): string {
  const normalized = value.trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 20))}\n...[truncated]`;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}
