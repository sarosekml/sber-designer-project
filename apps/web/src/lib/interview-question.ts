/**
 * 0083 UX-1 / UX-1a — structured "Description for AI" interview questions.
 *
 * The `ai-description-layer` agent emits the current component's questions as a
 * fenced ```sd:interview JSON block. The chat renders that block as interactive
 * controls (accept the suggested answer / type your own / skip). The user's
 * choices are composed back into a normal chat reply the agent reads — so this
 * stays turn-based with no agent-loop changes.
 */
import type { SberDesignerProjectKind } from '@sber-designer/shared-types';

export interface InterviewQuestion {
  id: string;
  label: string;
  prompt?: string;
  /** Agent-suggested answer — the "accept" default. */
  suggestion?: string;
}

export interface InterviewBlock {
  componentId: string;
  componentName?: string;
  /** 1-based position in the pass, e.g. component 1 of 8. */
  progress?: { index: number; total: number };
  questions: InterviewQuestion[];
}

export type InterviewAnswerMode = 'accept' | 'own' | 'skip';

export interface InterviewAnswer {
  questionId: string;
  mode: InterviewAnswerMode;
  text?: string;
}

/** Where the confirmed description for this component should be written. */
export type InterviewWriteTarget = 'sidecar' | 'storybook' | 'design-system';

export interface InterviewAnswerBlock {
  componentId: string;
  answers: Record<string, string | null>;
  writeTarget: InterviewWriteTarget;
}

export interface InterviewWriteTargetOption {
  target: InterviewWriteTarget;
  label: string;
  title: string;
}

export function defaultInterviewWriteTarget(
  projectKind?: SberDesignerProjectKind | null,
): InterviewWriteTarget {
  return projectKind === 'html-first' ? 'design-system' : 'sidecar';
}

export function interviewWriteTargetOptions(
  projectKind?: SberDesignerProjectKind | null,
): InterviewWriteTargetOption[] {
  if (projectKind === 'html-first') {
    return [
      {
        target: 'design-system',
        label: 'Design system',
        title: 'Write the canonical sidecar and project it into design-system/index.html.',
      },
      {
        target: 'sidecar',
        label: 'Sidecar only',
        title: 'Write only .sber-designer/components/<id>.md.',
      },
    ];
  }
  return [
    {
      target: 'sidecar',
      label: 'Sidecar',
      title: 'Write only .sber-designer/components/<id>.md.',
    },
    {
      target: 'storybook',
      label: 'Storybook',
      title: 'Write the canonical sidecar and project it into Storybook docs.',
    },
  ];
}

const FENCE_RE = /```([^\n]*)\n([\s\S]*?)```/g;
const INFO_RE = /sd[\s:_-]*interview/i;
const ANSWER_INFO_RE = /sd[\s:_-]*answer/i;

/**
 * Extract the `sd:interview` block from an assistant message. Returns the parsed
 * block plus `rest` (the message with the block removed, so prose still shows).
 * Tolerant: any malformed/absent block yields `{ block: null, rest: content }`.
 */
export function parseInterviewBlock(content: string): {
  block: InterviewBlock | null;
  rest: string;
} {
  FENCE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FENCE_RE.exec(content)) !== null) {
    if (!INFO_RE.test(match[1] ?? '')) continue;
    try {
      const block = coerceBlock(JSON.parse(match[2] ?? ''));
      if (block) {
        const rest = (
          content.slice(0, match.index) + content.slice(match.index + match[0].length)
        ).trim();
        return { block, rest };
      }
    } catch {
      // Malformed JSON — keep scanning, fall through to no-block.
    }
  }
  // 0083 E3: the target on-prem model (deepseek-v4-flash) often writes the
  // questions as prose instead of the fenced JSON block, so controls never
  // render. Fall back to a tolerant prose parser. It is deliberately strict
  // (needs a component id + interview-specific labels) so it never fires on an
  // ordinary screen-generation reply.
  const prose = parseInterviewProse(content);
  return prose ? { block: prose, rest: content } : { block: null, rest: content };
}

/**
 * Parse the additive `sd:answer` reply block emitted with a write target. The
 * legacy prose remains the primary UI surface, while this gives weaker models a
 * compact machine-readable fallback for `write_component_description`.
 */
export function parseInterviewAnswerBlock(content: string): InterviewAnswerBlock | null {
  FENCE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FENCE_RE.exec(content)) !== null) {
    if (!ANSWER_INFO_RE.test(match[1] ?? '')) continue;
    try {
      return coerceAnswerBlock(JSON.parse(match[2] ?? ''));
    } catch {
      return null;
    }
  }
  return null;
}

/** Canonical interview labels → display label, for the tolerant prose parser. */
const KNOWN_QUESTION_LABELS = new Map<string, string>([
  ['purpose', 'Purpose'],
  ['use when', 'Use when'],
  ['when to use', 'Use when'],
  ['use instead', 'Use instead'],
  ['use not when', 'Use instead'],
  ['variants', 'Variants'],
  ['variant', 'Variants'],
  ['variant meanings', 'Variants'],
  ['required props', 'Required props'],
  ['required', 'Required props'],
  ['props that matter', 'Required props'],
  ['keywords', 'Keywords'],
  ['canonical usage', 'Canonical usage'],
  ['canonical', 'Canonical usage'],
]);

// "Purpose" is a weak signal on its own; a prose block needs at least one of
// these stronger interview-specific labels to be treated as an interview.
const STRONG_QUESTION_LABELS = new Set([
  'Use when',
  'Use instead',
  'Variants',
  'Required props',
  'Keywords',
  'Canonical usage',
]);

const COMPONENT_ID_RE = /[a-z][a-z0-9]*(?:-[a-z0-9]+)+/;
const QUESTION_LINE_RE =
  /^\s*(?:[-*]\s*|\d+[.)]\s*)?(?:\*\*\s*)?([A-Za-z][A-Za-z '/]{2,40}?)\s*(?:\*\*)?\s*[:?]\s*(.*)$/;
const SUGGESTION_RE =
  /(?:\*{0,2}\s*(?:suggestion|suggested|default|proposed)\s*\*{0,2}\s*[:=]\s*)\*?([^*\n]+?)\*?\s*$/i;

function findComponentId(content: string): string | null {
  const labelled = /\bid\s*[:=]\s*`?([a-z][a-z0-9]*(?:-[a-z0-9]+)+)`?/i.exec(content);
  if (labelled?.[1]) return labelled[1];
  const backtick = /`([a-z][a-z0-9]*(?:-[a-z0-9]+)+)`/.exec(content);
  if (backtick?.[1]) return backtick[1];
  const paren = /\(([a-z][a-z0-9]*(?:-[a-z0-9]+)+)\)/.exec(content);
  if (paren?.[1]) return paren[1];
  return null;
}

/**
 * Best-effort extraction of interview questions from prose. Returns null unless a
 * component id and at least two known labels (one of them a strong signal) are
 * present, so ordinary assistant prose is never misread as an interview.
 */
function parseInterviewProse(content: string): InterviewBlock | null {
  if (!COMPONENT_ID_RE.test(content)) return null;
  const componentId = findComponentId(content);
  if (!componentId) return null;

  const lines = content.split(/\r?\n/);
  const questions: InterviewQuestion[] = [];
  const seen = new Set<string>();
  let strongSeen = false;
  let current: { question: InterviewQuestion; lines: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const suggestion = extractProseSuggestion(current.lines);
    if (suggestion && !current.question.suggestion) current.question.suggestion = suggestion;
    questions.push(current.question);
    current = null;
  };

  for (const line of lines) {
    const match = QUESTION_LINE_RE.exec(line);
    const label = match ? KNOWN_QUESTION_LABELS.get(match[1]!.trim().toLowerCase()) : undefined;
    if (match && label && !seen.has(label)) {
      flush();
      seen.add(label);
      if (STRONG_QUESTION_LABELS.has(label)) strongSeen = true;
      const rest = (match[2] ?? '').trim();
      const inlineSuggestion = extractProseSuggestion([rest]);
      const prompt = rest.replace(SUGGESTION_RE, '').trim();
      current = {
        question: {
          id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          label,
          ...(prompt ? { prompt } : {}),
          ...(inlineSuggestion ? { suggestion: inlineSuggestion } : {}),
        },
        lines: [rest],
      };
      continue;
    }
    if (current) current.lines.push(line);
  }
  flush();

  if (questions.length < 2 || !strongSeen) return null;
  const componentName = findComponentName(content, componentId);
  return {
    componentId,
    ...(componentName ? { componentName } : {}),
    questions,
  };
}

function extractProseSuggestion(lines: string[]): string | undefined {
  for (const line of lines) {
    const match = SUGGESTION_RE.exec(line.trim());
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return undefined;
}

/** A bolded component name (not a question label); else derived from the id. */
function findComponentName(content: string, componentId: string): string | undefined {
  for (const match of content.matchAll(/\*\*([A-Z][A-Za-z0-9]+)\*\*/g)) {
    const name = match[1]!;
    if (!KNOWN_QUESTION_LABELS.has(name.toLowerCase())) return name;
  }
  const tailSegment = componentId.split('-').pop();
  return tailSegment ? tailSegment.charAt(0).toUpperCase() + tailSegment.slice(1) : undefined;
}

function coerceBlock(value: unknown): InterviewBlock | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.componentId !== 'string') return null;
  const questions = Array.isArray(v.questions)
    ? v.questions.filter(isQuestionLike).map(normalizeQuestion)
    : [];
  if (questions.length === 0) return null;
  const progress = isProgressLike(v.progress)
    ? { index: v.progress.index, total: v.progress.total }
    : undefined;
  return {
    componentId: v.componentId,
    ...(typeof v.componentName === 'string' ? { componentName: v.componentName } : {}),
    ...(progress ? { progress } : {}),
    questions,
  };
}

function coerceAnswerBlock(value: unknown): InterviewAnswerBlock | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.componentId !== 'string') return null;
  if (!isInterviewWriteTarget(v.writeTarget)) return null;
  if (!v.answers || typeof v.answers !== 'object' || Array.isArray(v.answers)) return null;
  const answers: Record<string, string | null> = {};
  for (const [key, answer] of Object.entries(v.answers as Record<string, unknown>)) {
    if (!key.trim()) continue;
    if (answer === null) {
      answers[key] = null;
      continue;
    }
    if (typeof answer === 'string') answers[key] = answer;
  }
  return { componentId: v.componentId, answers, writeTarget: v.writeTarget };
}

function isInterviewWriteTarget(value: unknown): value is InterviewWriteTarget {
  return value === 'sidecar' || value === 'storybook' || value === 'design-system';
}

function isQuestionLike(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string',
  );
}

function normalizeQuestion(value: Record<string, unknown>): InterviewQuestion {
  return {
    id: String(value.id),
    label: typeof value.label === 'string' && value.label.trim() ? value.label : String(value.id),
    ...(typeof value.prompt === 'string' ? { prompt: value.prompt } : {}),
    ...(typeof value.suggestion === 'string' ? { suggestion: value.suggestion } : {}),
  };
}

function isProgressLike(value: unknown): value is { index: number; total: number } {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as { index?: unknown }).index === 'number' &&
    typeof (value as { total?: unknown }).total === 'number',
  );
}

/** The default answer mode for a question: accept when a suggestion exists. */
export function defaultAnswerMode(question: InterviewQuestion): InterviewAnswerMode {
  return question.suggestion?.trim() ? 'accept' : 'own';
}

/**
 * Compose the structured chat reply the agent reads after the user answers.
 * When `target` is given, a trailing `Write target: …` directive tells the agent
 * which `write_component_description` target to use (0083 Phase 3.1).
 */
export function composeInterviewReply(
  block: InterviewBlock,
  answers: InterviewAnswer[],
  target?: InterviewWriteTarget,
): string {
  const byId = new Map(answers.map((answer) => [answer.questionId, answer]));
  const lines = block.questions.map((question) => {
    const resolved = resolveAnswerText(question, byId.get(question.id));
    return `- ${question.label}: ${resolved ?? '(skip)'}`;
  });
  const name = block.componentName ?? block.componentId;
  const reply = `Answers for ${name} (${block.componentId}):\n${lines.join('\n')}`;
  if (!target) return reply;
  const payload: InterviewAnswerBlock = {
    componentId: block.componentId,
    answers: Object.fromEntries(
      block.questions.map((question) => [
        question.id,
        resolveAnswerText(question, byId.get(question.id)),
      ]),
    ),
    writeTarget: target,
  };
  return `${reply}\nWrite target: ${target}\n\`\`\`sd:answer\n${JSON.stringify(payload)}\n\`\`\``;
}

function resolveAnswerText(
  question: InterviewQuestion,
  answer: InterviewAnswer | undefined,
): string | null {
  if (!answer || answer.mode === 'skip') return null;
  if (answer.mode === 'own') {
    const own = (answer.text ?? '').trim();
    return own || null;
  }
  const suggestion = (question.suggestion ?? '').trim();
  return suggestion || null;
}
