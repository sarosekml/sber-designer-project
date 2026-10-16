import type { NormalizedRunEvent } from './opencode-events';

export type CodexRawEvent =
  | { type: 'task_started' | 'turn_started' | 'TurnStarted' }
  | { type: 'task_complete' | 'turn_complete' | 'TurnComplete'; usage?: unknown }
  | { type: 'thread.started'; thread_id?: string }
  | { type: 'turn.started' }
  | { type: 'turn.completed'; usage?: unknown }
  | { type: 'item.started' | 'item.completed'; item?: Record<string, unknown> }
  | { type: 'agent_message' | 'AgentMessage'; message?: string; text?: string; delta?: string }
  | { type: 'agent_message_delta' | 'AgentMessageContentDelta'; delta?: string }
  | CodexExecBeginEvent
  | CodexExecEndEvent
  | CodexMcpCallEvent
  | { type: 'stream_error' | 'StreamError' | 'error'; message?: string }
  | { type: string; [key: string]: unknown };

export type CodexExecBeginEvent = {
  type: 'exec_command_begin' | 'ExecCommandBegin';
  call_id?: string;
  callId?: string;
  item_id?: string;
  command?: string;
  parsed_cmd?: string[];
  parsedCmd?: string[];
};

export type CodexExecEndEvent = {
  type: 'exec_command_end' | 'ExecCommandEnd';
  call_id?: string;
  callId?: string;
  item_id?: string;
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  exitCode?: number;
};

export type CodexMcpCallEvent = {
  type: 'mcp_tool_call_begin' | 'McpToolCallBegin' | 'mcp_tool_call_end' | 'McpToolCallEnd';
  invocation?: Record<string, unknown>;
};

export function mapCodexRawEvent(event: CodexRawEvent): NormalizedRunEvent[] {
  // The union ends in an open `{ type: string; [key: string]: unknown }`
  // member so unknown Codex events still parse. That member matches every
  // literal too, so a `case` never narrows it away — each branch reads the
  // shape it expects explicitly.
  switch (event.type) {
    case 'task_started':
    case 'turn_started':
    case 'TurnStarted':
    case 'thread.started':
    case 'turn.started':
      return [{ type: 'status', label: 'running' }];
    case 'agent_message':
    case 'AgentMessage': {
      const message = event as { message?: string; text?: string; delta?: string };
      const delta = textValue(message.message ?? message.text ?? message.delta);
      return delta ? [{ type: 'text_delta', delta }] : [];
    }
    case 'agent_message_delta':
    case 'AgentMessageContentDelta': {
      const delta = textValue((event as { delta?: string }).delta);
      return delta ? [{ type: 'text_delta', delta }] : [];
    }
    case 'exec_command_begin':
    case 'ExecCommandBegin':
      return mapExecBegin(event as CodexExecBeginEvent);
    case 'exec_command_end':
    case 'ExecCommandEnd':
      return mapExecEnd(event as CodexExecEndEvent);
    case 'mcp_tool_call_begin':
    case 'McpToolCallBegin':
      return mapMcpBegin((event as CodexMcpCallEvent).invocation);
    case 'mcp_tool_call_end':
    case 'McpToolCallEnd':
      return mapMcpEnd((event as CodexMcpCallEvent).invocation);
    case 'item.started':
      return mapCodexItemStarted((event as { item?: Record<string, unknown> }).item);
    case 'item.completed':
      return mapCodexItemCompleted((event as { item?: Record<string, unknown> }).item);
    case 'task_complete':
    case 'turn_complete':
    case 'TurnComplete':
    case 'turn.completed':
      return readUsage((event as { usage?: unknown }).usage);
    case 'stream_error':
    case 'StreamError':
    case 'error':
      return [
        {
          type: 'error',
          message: (event as { message?: string }).message ?? 'Codex runtime error',
        },
      ];
    default:
      return [];
  }
}

function mapCodexItemStarted(item: Record<string, unknown> | undefined): NormalizedRunEvent[] {
  const id = stringProp(item, 'id');
  if (!id) return [];
  const type = stringProp(item, 'type');
  if (type === 'command_execution') {
    return [
      {
        type: 'tool_use',
        id,
        name: 'exec_command',
        input: { command: stringProp(item, 'command') ?? '' },
      },
    ];
  }
  return [];
}

function mapCodexItemCompleted(item: Record<string, unknown> | undefined): NormalizedRunEvent[] {
  const type = stringProp(item, 'type');
  if (type === 'agent_message') {
    const delta = textValue(item?.text ?? item?.message ?? item?.delta);
    return delta ? [{ type: 'text_delta', delta }] : [];
  }
  if (type === 'command_execution') {
    const id = stringProp(item, 'id');
    if (!id) return [];
    const exitCode = numberProp(item, 'exit_code') ?? numberProp(item, 'exitCode');
    return [
      {
        type: 'tool_result',
        toolUseId: id,
        content: textValue(item?.aggregated_output ?? item?.output ?? item?.stdout),
        isError: typeof exitCode === 'number' ? exitCode !== 0 : false,
      },
    ];
  }
  return [];
}

function mapExecBegin(
  event: Extract<CodexRawEvent, { type: 'exec_command_begin' | 'ExecCommandBegin' }>,
): NormalizedRunEvent[] {
  const id = event.call_id ?? event.callId ?? event.item_id;
  if (!id) return [];
  const command = event.command ?? event.parsed_cmd?.join(' ') ?? event.parsedCmd?.join(' ') ?? '';
  return [{ type: 'tool_use', id, name: 'exec_command', input: { command } }];
}

function mapExecEnd(
  event: Extract<CodexRawEvent, { type: 'exec_command_end' | 'ExecCommandEnd' }>,
): NormalizedRunEvent[] {
  const id = event.call_id ?? event.callId ?? event.item_id;
  if (!id) return [];
  const stdout = event.stdout ?? '';
  const stderr = event.stderr ?? '';
  const content = [stdout, stderr].filter(Boolean).join(stderr && stdout ? '\n' : '');
  const exitCode = event.exit_code ?? event.exitCode;
  return [
    {
      type: 'tool_result',
      toolUseId: id,
      content,
      isError: typeof exitCode === 'number' ? exitCode !== 0 : false,
    },
  ];
}

function mapMcpBegin(invocation: Record<string, unknown> | undefined): NormalizedRunEvent[] {
  const id = stringProp(invocation, 'callId') ?? stringProp(invocation, 'call_id');
  if (!id) return [];
  const server = stringProp(invocation, 'server');
  const tool = stringProp(invocation, 'tool') ?? stringProp(invocation, 'name') ?? 'mcp_tool';
  const name = server && !tool.includes('.') ? `${server}.${tool}` : tool;
  return [
    {
      type: 'tool_use',
      id,
      name,
      input: invocation?.arguments ?? invocation?.args ?? invocation?.input ?? {},
    },
  ];
}

function mapMcpEnd(invocation: Record<string, unknown> | undefined): NormalizedRunEvent[] {
  const id = stringProp(invocation, 'callId') ?? stringProp(invocation, 'call_id');
  if (!id) return [];
  const output = invocation?.result ?? invocation?.output ?? '';
  return [
    {
      type: 'tool_result',
      toolUseId: id,
      content: stringify(output),
      isError: Boolean(invocation?.isError ?? invocation?.is_error),
    },
  ];
}

function readUsage(raw: unknown): NormalizedRunEvent[] {
  if (!raw || typeof raw !== 'object') return [];
  const record = raw as Record<string, unknown>;
  const input = record.inputTokens ?? record.input_tokens ?? record.prompt_tokens;
  const cachedInput = record.cachedInputTokens ?? record.cached_input_tokens;
  const output = record.outputTokens ?? record.output_tokens ?? record.completion_tokens;
  if (typeof input !== 'number' && typeof output !== 'number') return [];
  const effectiveInput =
    typeof input === 'number' &&
    typeof cachedInput === 'number' &&
    Number.isFinite(cachedInput) &&
    cachedInput >= 0 &&
    cachedInput <= input
      ? input - cachedInput
      : input;
  return [
    {
      type: 'usage',
      ...(typeof effectiveInput === 'number' ? { inputTokens: effectiveInput } : {}),
      ...(typeof output === 'number' ? { outputTokens: output } : {}),
      ...(typeof cachedInput === 'number' ? { cachedInputTokens: cachedInput } : {}),
    },
  ];
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function stringProp(record: Record<string, unknown> | undefined, key: string): string | null {
  const value = record?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberProp(record: Record<string, unknown> | undefined, key: string): number | null {
  const value = record?.[key];
  return typeof value === 'number' ? value : null;
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
