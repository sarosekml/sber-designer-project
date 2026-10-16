import type { ChatContent, ChatRequest, ChatResponse, ToolCall } from '../chat';

/**
 * Deterministic offline provider used in tests and as the built-in default
 * before any real provider is configured.
 *
 * Default behavior: echoes the last user message with a banner. The test
 * suite (and developers exploring offline) can also force a tool call by
 * embedding a directive in the user message:
 *
 *     <call:tool_name>{ "json": "args" }</call>
 *
 * The mock will return that as a single ToolCall, exactly as a real
 * model would. The runtime / agent loop is then exercised end-to-end
 * without an external API.
 *
 * If the mock receives `role: 'tool'` messages back (i.e. the tool was
 * executed), it concludes the conversation with a "[mock] tool result
 * received" final message — useful for asserting agent loops terminate.
 *
 * Golden tests can also inject a deterministic multi-turn script in any
 * message:
 *
 *     <mock-script>[{"toolCalls":[{"name":"read_file","arguments":{"path":"src/App.tsx"}}]}]</mock-script>
 *
 * The mock replays one script item per assistant turn, making tool traces
 * stable without a network model.
 */
const CALL_DIRECTIVE_RE = /<call:([A-Za-z_][A-Za-z0-9_]*)>([\s\S]*?)<\/call>/;
const SCRIPT_DIRECTIVE_RE = /<mock-script>([\s\S]*?)<\/mock-script>/;

let nextMockId = 1;

interface MockScriptToolCall {
  name: string;
  arguments?: unknown;
}

interface MockScriptStep {
  text?: string;
  toolCalls?: MockScriptToolCall[];
  finishReason?: ChatResponse['finishReason'];
}

export async function mockChat(
  req: ChatRequest,
  active: { provider: string; model: string },
): Promise<ChatResponse> {
  const scripted = scriptedResponse(req, active);
  if (scripted) return scripted;

  // If the previous turn was a tool result, terminate gracefully so the
  // agent loop in /api/chat doesn't spin forever during integration tests.
  const lastWasTool = req.messages[req.messages.length - 1]?.role === 'tool';
  if (lastWasTool) {
    return {
      text: '[mock] tool result received — done.',
      finishReason: 'stop',
      provider: active.provider,
      model: active.model,
    };
  }

  const last = [...req.messages].reverse().find((m) => m.role === 'user');
  if (!last) {
    return {
      text: '[mock] no user message in request',
      finishReason: 'stop',
      provider: active.provider,
      model: active.model,
    };
  }

  // Test directive — pretend to be a real model that asked for a tool.
  const lastText = contentToText(last.content);
  const directive = CALL_DIRECTIVE_RE.exec(lastText);
  if (directive && req.tools && req.tools.length > 0) {
    const name = directive[1]!;
    const argsText = directive[2]?.trim() ?? '{}';
    const known = req.tools.some((t) => t.name === name);
    if (known) {
      const toolCall: ToolCall = {
        id: `mock-call-${nextMockId++}`,
        name,
        arguments: argsText || '{}',
      };
      return {
        text: '',
        toolCalls: [toolCall],
        finishReason: 'tool_calls',
        provider: active.provider,
        model: active.model,
      };
    }
  }

  return {
    text: `[mock:${active.model}] echo → ${lastText}`,
    finishReason: 'stop',
    provider: active.provider,
    model: active.model,
    usage: { inputTokens: req.messages.reduce((n, m) => n + contentToText(m.content).length, 0) },
  };
}

function contentToText(content: ChatContent): string {
  if (typeof content === 'string') return content;
  return content
    .map((part) => {
      if (part.type === 'text') return part.text;
      return '[Attached image]';
    })
    .join('\n');
}

function scriptedResponse(
  req: ChatRequest,
  active: { provider: string; model: string },
): ChatResponse | null {
  const script = extractMockScript(req);
  if (!script) return null;

  const stepIndex = req.messages.filter((message) => message.role === 'assistant').length;
  const step = script[stepIndex];
  if (!step) {
    return {
      text: '[mock-script] complete',
      finishReason: 'stop',
      provider: active.provider,
      model: active.model,
    };
  }

  const toolCalls = (step.toolCalls ?? [])
    .filter((call) => req.tools?.some((tool) => tool.name === call.name))
    .map<ToolCall>((call) => ({
      id: `mock-script-call-${nextMockId++}`,
      name: call.name,
      arguments:
        typeof call.arguments === 'string' ? call.arguments : JSON.stringify(call.arguments ?? {}),
    }));

  return {
    text: step.text ?? '',
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
    finishReason: step.finishReason ?? (toolCalls.length > 0 ? 'tool_calls' : 'stop'),
    provider: active.provider,
    model: active.model,
  };
}

function extractMockScript(req: ChatRequest): MockScriptStep[] | null {
  for (const message of req.messages) {
    const match = SCRIPT_DIRECTIVE_RE.exec(contentToText(message.content));
    if (!match) continue;
    try {
      const parsed = JSON.parse(match[1]!.trim()) as unknown;
      if (Array.isArray(parsed)) return parsed.filter(isMockScriptStep);
    } catch {
      return null;
    }
  }
  return null;
}

function isMockScriptStep(value: unknown): value is MockScriptStep {
  if (!value || typeof value !== 'object') return false;
  const step = value as { toolCalls?: unknown };
  if (step.toolCalls === undefined) return true;
  if (!Array.isArray(step.toolCalls)) return false;
  return step.toolCalls.every((call) => {
    if (!call || typeof call !== 'object') return false;
    return typeof (call as { name?: unknown }).name === 'string';
  });
}
