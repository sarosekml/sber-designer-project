/** SSE frame writer, permission-request registry, transcript notices. */
import { type ChatMessage, type ChatResponse } from '@sber-designer/llm-gateway';
import { agentRunManifestPath, type AgentRunManifest } from '../../agent/run-recorder';
import {
  type AgentPermissionRequest,
  type AgentPermissionResponse,
  type AgentStreamEvent,
} from '../../agent/stream';
import {
  registerAgentPermissionRequest,
  resolveRememberedAgentPermission,
  resolveAgentPermissionRequest,
} from '../../agent/permission-requests';

export function withExternalRunMetadata(
  event: Extract<AgentStreamEvent, { type: 'done' }>,
  agentRun: AgentRunManifest | null,
): unknown {
  if (!agentRun) return event;
  return {
    ...event,
    runId: agentRun.runId,
    runManifestPath: agentRunManifestPath(agentRun.runId),
  };
}

export function appendNoticeToDoneEvent(
  event: unknown,
  notice: string,
  finishReason?: ChatResponse['finishReason'],
  terminalStatus?: 'failed' | 'needs_review',
): Extract<AgentStreamEvent, { type: 'done' }> & { runId?: string; runManifestPath?: string } {
  const done = terminalStatus
    ? normalizeDoneEventForTerminalStatus(event, terminalStatus)
    : (event as Extract<AgentStreamEvent, { type: 'done' }> & {
        runId?: string;
        runManifestPath?: string;
      });
  const finalResponse: ChatResponse = {
    ...done.finalResponse,
    text: `${done.finalResponse.text}${notice}`,
    ...(finishReason ? { finishReason } : {}),
  };
  return {
    ...done,
    transcript: appendNoticeToTranscript(done.transcript, notice),
    finalResponse,
  };
}

/**
 * L7.2 (0107): the terminal finalizer owns failed/needs-review truth. Preserve
 * useful implementation facts from the model's final reply, but remove claims
 * that assert successful render/verification after machine evidence disproves
 * or cannot prove them. The authoritative notice is appended afterwards.
 */
export function normalizeDoneEventForTerminalStatus(
  event: unknown,
  _status: 'failed' | 'needs_review',
): Extract<AgentStreamEvent, { type: 'done' }> & { runId?: string; runManifestPath?: string } {
  const done = event as Extract<AgentStreamEvent, { type: 'done' }> & {
    runId?: string;
    runManifestPath?: string;
  };
  const finalText = stripOverconfidentTerminalClaims(done.finalResponse.text);
  const transcript = [...done.transcript];
  for (let index = transcript.length - 1; index >= 0; index -= 1) {
    const message = transcript[index];
    if (message?.role !== 'assistant' || typeof message.content !== 'string') continue;
    transcript[index] = {
      ...message,
      content: stripOverconfidentTerminalClaims(message.content),
    };
    break;
  }
  return {
    ...done,
    transcript,
    finalResponse: {
      ...done.finalResponse,
      text: finalText,
    },
  };
}

function stripOverconfidentTerminalClaims(text: string): string {
  const withoutPriorFinalizer = text.replace(
    /\n{0,2}── Run status: (?:FAILED|NEEDS REVIEW) ──[\s\S]*$/u,
    '',
  );
  const segments = withoutPriorFinalizer.match(/[^.!?\n]+(?:[.!?]+|$)|\n+/gu) ?? [
    withoutPriorFinalizer,
  ];
  return segments
    .filter((segment) => !isOverconfidentTerminalClaim(segment.trim()))
    .join('')
    .replace(/[ \t]+\n/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

function isOverconfidentTerminalClaim(sentence: string): boolean {
  if (!sentence) return false;
  return [
    /\b(?:all|every)\s+(?:checks?|tests?|validations?)\s+(?:have\s+)?passed\b/iu,
    /\b(?:fully|successfully)\s+(?:verified|validated|tested)\b/iu,
    /\b(?:verification|validation|testing)\s+(?:is\s+)?(?:complete|successful|passed)\b/iu,
    /\b(?:the\s+)?(?:screen|page|interface|ui|it|this)\s+(?:has\s+|is\s+|now\s+)*(?:rendered|renders?|works?|working)\b/iu,
    /\brenders?\s+(?:correctly|successfully|on\s+(?:the\s+)?canvas|in\s+(?:the\s+)?browser)\b/iu,
    /\b(?:ready|complete)\s+and\s+(?:working|verified|validated)\b/iu,
    /\b(?:все|всё)\s+(?:проверки|тесты)\s+(?:успешно\s+)?(?:пройдены|прошли)\b/iu,
    /\bуспешно\s+(?:проверен[аоы]?|протестирован[аоы]?|валидирован[аоы]?)\b/iu,
    /\b(?:экран|страница|интерфейс|всё)\s+(?:успешно\s+)?(?:рендерится|отображается|работает)\b/iu,
    /\b(?:все|всё)\s+готово\b/iu,
  ].some((pattern) => pattern.test(sentence));
}

function appendNoticeToTranscript(transcript: ChatMessage[], notice: string): ChatMessage[] {
  const next = [...transcript];
  const last = next[next.length - 1];
  if (last?.role === 'assistant' && typeof last.content === 'string') {
    next[next.length - 1] = { ...last, content: `${last.content}${notice}` };
    return next;
  }
  next.push({ role: 'assistant', content: notice.trimStart() });
  return next;
}

export async function writeSSE(
  stream: { writeSSE(input: { data: string }): Promise<unknown> | unknown },
  event: unknown,
): Promise<void> {
  await stream.writeSSE({ data: JSON.stringify(event) });
}

export function registerStreamPermissionRequest(
  request: AgentPermissionRequest,
  user: string,
  workspacePath: string | null,
  runId: string | null | undefined,
  signal: AbortSignal,
): AgentPermissionResponse | Promise<AgentPermissionResponse> {
  const remembered = resolveRememberedAgentPermission(request, { user, workspacePath, runId });
  if (remembered) return remembered;

  const response = registerAgentPermissionRequest(request, { user, workspacePath, runId });
  if (signal.aborted) {
    resolveAgentPermissionRequest({ id: request.id, user, decision: 'deny' });
    return response;
  }
  const abort = () => {
    resolveAgentPermissionRequest({ id: request.id, user, decision: 'deny' });
  };
  signal.addEventListener('abort', abort, { once: true });
  return response.finally(() => signal.removeEventListener('abort', abort));
}
