export type OpenCodeRawEvent =
  | { type: 'step_start'; sessionID?: string }
  | { type: 'text'; sessionID?: string; part?: { text?: string } }
  | {
      type: 'tool_use';
      sessionID?: string;
      callID?: string;
      part?: {
        tool?: string;
        callID?: string;
        input?: unknown;
        state?: { status?: string; input?: unknown; output?: unknown };
      };
      state?: { status?: string; input?: unknown; output?: unknown };
    }
  | { type: 'step_finish'; sessionID?: string; part?: { tokens?: unknown; cost?: number } }
  | { type: 'error'; sessionID?: string; message?: string };

export type NormalizedRunEvent =
  | { type: 'status'; label: 'initializing' | 'running' | 'done' | 'error' }
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; toolUseId: string; content: string; isError: boolean }
  | {
      type: 'usage';
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
      cachedInputTokens?: number;
      costUsd?: number;
    }
  | { type: 'error'; message: string };

export function mapOpenCodeRawEvent(
  event: OpenCodeRawEvent,
  seenToolUses: Set<string> = new Set<string>(),
): NormalizedRunEvent[] {
  switch (event.type) {
    case 'step_start':
      return [{ type: 'status', label: 'running' }];
    case 'text':
      return typeof event.part?.text === 'string' && event.part.text.length > 0
        ? [{ type: 'text_delta', delta: event.part.text }]
        : [];
    case 'tool_use':
      return mapToolUse(event, seenToolUses);
    case 'step_finish': {
      const tokens = readTokens(event.part?.tokens);
      return tokens.inputTokens !== undefined || tokens.outputTokens !== undefined
        ? [
            {
              type: 'usage',
              ...tokens,
              ...(typeof event.part?.cost === 'number' ? { costUsd: event.part.cost } : {}),
            },
          ]
        : [];
    }
    case 'error':
      return [{ type: 'error', message: event.message ?? 'OpenCode runtime error' }];
    default:
      return [];
  }
}

function mapToolUse(
  event: Extract<OpenCodeRawEvent, { type: 'tool_use' }>,
  seenToolUses: Set<string>,
): NormalizedRunEvent[] {
  const callId = event.callID ?? event.part?.callID;
  if (!callId) return [];
  const state = event.part?.state ?? event.state;
  if (state?.status === 'completed') {
    return [
      {
        type: 'tool_result',
        toolUseId: callId,
        content: stringifyToolOutput(state.output),
        isError: false,
      },
    ];
  }
  const tool = event.part?.tool;
  if (!tool) return [];
  const key = `${event.sessionID ?? 'session'}:${callId}`;
  if (seenToolUses.has(key)) return [];
  seenToolUses.add(key);
  return [
    {
      type: 'tool_use',
      id: callId,
      name: tool,
      input: parseToolInput(state?.input ?? event.part?.input),
    },
  ];
}

function parseToolInput(input: unknown): unknown {
  if (typeof input !== 'string') return input ?? {};
  try {
    return JSON.parse(input) as unknown;
  } catch {
    return input;
  }
}

function stringifyToolOutput(output: unknown): string {
  if (typeof output === 'string') return output;
  if (output === undefined || output === null) return '';
  try {
    return JSON.stringify(output);
  } catch {
    return String(output);
  }
}

function readTokens(raw: unknown): { inputTokens?: number; outputTokens?: number } {
  if (!raw || typeof raw !== 'object') return {};
  const record = raw as Record<string, unknown>;
  const input = record.input ?? record.input_tokens;
  const output = record.output ?? record.output_tokens;
  return {
    ...(typeof input === 'number' ? { inputTokens: input } : {}),
    ...(typeof output === 'number' ? { outputTokens: output } : {}),
  };
}
