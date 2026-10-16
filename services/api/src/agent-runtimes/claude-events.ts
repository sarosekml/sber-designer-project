import type { NormalizedRunEvent } from './opencode-events';

export type ClaudeCodeRawEvent =
  | ClaudeAssistantRawEvent
  | ClaudeUserRawEvent
  | { type: 'system'; subtype?: string }
  | { type: 'result'; result?: string; usage?: unknown }
  | ClaudeErrorRawEvent
  | { type: string; [key: string]: unknown };

type ClaudeErrorRawEvent = {
  type: 'error';
  error?: { message?: string } | string;
  message?: string;
};

type ClaudeAssistantRawEvent = {
  type: 'assistant';
  message?: {
    content?: ClaudeContentBlock[];
  };
  error?: string;
  isApiErrorMessage?: boolean;
  apiErrorStatus?: number;
};

type ClaudeUserRawEvent = {
  type: 'user';
  message?: {
    content?: ClaudeContentBlock[];
  };
};

type ClaudeContentBlock =
  | { type?: 'text'; text?: string }
  | { type?: 'tool_use'; id?: string; name?: string; input?: unknown }
  | { type?: 'tool_result'; tool_use_id?: string; content?: unknown; is_error?: boolean }
  | { type?: string; [key: string]: unknown };

export function mapClaudeCodeRawEvent(event: ClaudeCodeRawEvent): NormalizedRunEvent[] {
  // The union ends in an open `{ type: string; [key: string]: unknown }`
  // member for forward compatibility with unknown Claude Code events. That
  // member also matches every known literal, so narrowing on `type` alone
  // never eliminates it — read the known shape explicitly instead.
  switch (event.type) {
    case 'assistant':
    case 'user': {
      const known = event as ClaudeAssistantRawEvent | ClaudeUserRawEvent;
      const events = mapContentBlocks(known.message?.content);
      if (known.type === 'assistant' && isAssistantApiError(known)) {
        events.push({ type: 'error', message: readAssistantApiErrorMessage(known, events) });
      }
      return events;
    }
    case 'system':
      return [{ type: 'status', label: 'running' }];
    case 'result':
      return readUsage((event as { usage?: unknown }).usage);
    case 'error':
      return [{ type: 'error', message: readErrorMessage(event as ClaudeErrorRawEvent) }];
    default:
      return [];
  }
}

function isAssistantApiError(event: ClaudeAssistantRawEvent): boolean {
  return event.isApiErrorMessage === true || typeof event.error === 'string';
}

function readAssistantApiErrorMessage(
  event: ClaudeAssistantRawEvent,
  events: NormalizedRunEvent[],
): string {
  const text = events
    .filter(
      (item): item is Extract<NormalizedRunEvent, { type: 'text_delta' }> =>
        item.type === 'text_delta',
    )
    .map((item) => item.delta)
    .join('')
    .trim();
  if (text) return text;
  if (typeof event.error === 'string' && event.error.trim()) return event.error.trim();
  if (typeof event.apiErrorStatus === 'number') {
    return `Claude Code runtime error: HTTP ${event.apiErrorStatus}`;
  }
  return 'Claude Code runtime error';
}

function mapContentBlocks(blocks: ClaudeContentBlock[] | undefined): NormalizedRunEvent[] {
  if (!Array.isArray(blocks)) return [];
  const events: NormalizedRunEvent[] = [];
  let text = '';
  for (const block of blocks) {
    if (block.type === 'text' && typeof block.text === 'string') {
      text += block.text;
      continue;
    }
    if (text) {
      events.push({ type: 'text_delta', delta: text });
      text = '';
    }
    if (block.type === 'tool_use' && typeof block.id === 'string') {
      events.push({
        type: 'tool_use',
        id: block.id,
        name: typeof block.name === 'string' ? block.name : 'tool',
        input: block.input ?? {},
      });
      continue;
    }
    if (block.type === 'tool_result' && typeof block.tool_use_id === 'string') {
      events.push({
        type: 'tool_result',
        toolUseId: block.tool_use_id,
        content: stringify(block.content),
        isError: block.is_error === true,
      });
    }
  }
  if (text) events.push({ type: 'text_delta', delta: text });
  return events;
}

function readUsage(raw: unknown): NormalizedRunEvent[] {
  if (!raw || typeof raw !== 'object') return [];
  const record = raw as Record<string, unknown>;
  const input = record.input_tokens ?? record.inputTokens ?? record.cache_read_input_tokens;
  const output = record.output_tokens ?? record.outputTokens;
  if (typeof input !== 'number' && typeof output !== 'number') return [];
  return [
    {
      type: 'usage',
      ...(typeof input === 'number' ? { inputTokens: input } : {}),
      ...(typeof output === 'number' ? { outputTokens: output } : {}),
    },
  ];
}

function readErrorMessage(event: ClaudeErrorRawEvent): string {
  if (typeof event.error === 'string') return event.error;
  if (typeof event.error?.message === 'string') return event.error.message;
  if (typeof event.message === 'string') return event.message;
  return 'Claude Code runtime error';
}

function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
