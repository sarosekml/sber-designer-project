import { randomUUID } from 'node:crypto';
import { mkdir, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ChatMessage, ChatResponse } from '@sber-designer/llm-gateway';

import type { EditorState } from '../state-store';

export interface AgentDevRunLogger {
  runId: string;
  filePath: string;
  log: (event: string, data?: Record<string, unknown>) => Promise<void>;
  logLink: (input: AgentDevRunLogLinkInput) => Promise<void>;
}

export interface AgentAttemptLogger {
  attemptId: string;
  filePath: string;
  log: (event: string, data?: Record<string, unknown>) => Promise<void>;
  logLink: (input: AgentAttemptLogLinkInput) => Promise<void>;
}

export interface AgentDevRunLogLinkInput {
  attemptId: string;
  attemptLogPath: string;
  runManifestPath: string;
}

export interface AgentAttemptLogLinkInput {
  runId: string;
  devLogPath?: string;
  runManifestPath: string;
}

interface CreateAgentDevRunLoggerInput {
  route: 'chat' | 'chat-stream';
  user: string;
  provider?: string;
  model?: string;
  state: EditorState;
  messages: ChatMessage[];
  maxIterations: number;
}

export interface CreateAgentAttemptLoggerInput {
  route: 'chat' | 'chat-stream';
  user: string;
  provider?: string | null;
  model?: string | null;
  agentTarget?: Record<string, unknown> | null;
  state: EditorState;
  userGoal: string | null;
  messageCount: number;
}

export async function createAgentDevRunLogger(
  input: CreateAgentDevRunLoggerInput,
): Promise<AgentDevRunLogger | null> {
  if (!agentDevLogsEnabled()) return null;
  try {
    const runId = randomUUID();
    const root =
      process.env.SBER_DESIGNER_AGENT_LOG_DIR ?? join(tmpdir(), 'sber-designer', 'agent-runs');
    await mkdir(root, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = join(root, `${stamp}-${runId.slice(0, 8)}.jsonl`);
    const logger: AgentDevRunLogger = {
      runId,
      filePath,
      log: async (event, data = {}) => {
        const line = {
          ts: new Date().toISOString(),
          runId,
          event,
          ...data,
        };
        await appendFile(filePath, `${JSON.stringify(line)}\n`, 'utf8');
      },
      logLink: async (link) => {
        await logger.log('run.linked_attempt', { ...link });
      },
    };

    await logger.log('run.start', {
      route: input.route,
      user: input.user,
      provider: input.provider,
      model: input.model,
      maxIterations: input.maxIterations,
      context: editorStateContext(input.state),
      messages: input.messages.map(messagePreview),
    });
    return logger;
  } catch (err) {
    process.stderr.write(
      `[agent-dev-log] disabled after write failure: ${
        err instanceof Error ? err.message : String(err)
      }\n`,
    );
    return null;
  }
}

export async function createAgentAttemptLogger(
  input: CreateAgentAttemptLoggerInput,
): Promise<AgentAttemptLogger | null> {
  if (!agentDevLogsEnabled()) return null;
  try {
    const attemptId = `attempt-${randomUUID()}`;
    const filePath = await createAgentLogFilePath(attemptId);
    const logger: AgentAttemptLogger = {
      attemptId,
      filePath,
      log: async (event, data = {}) => {
        const line = {
          ts: new Date().toISOString(),
          attemptId,
          event,
          ...data,
        };
        await appendFile(filePath, `${JSON.stringify(line)}\n`, 'utf8');
      },
      logLink: async (link) => {
        await logger.log('attempt.linked_run', { ...link });
      },
    };

    await logger.log('attempt.start', {
      route: input.route,
      user: input.user,
      provider: input.provider ?? null,
      model: input.model ?? null,
      ...(input.agentTarget ? { agentTarget: input.agentTarget } : {}),
      userGoal: input.userGoal,
      messageCount: input.messageCount,
      context: editorStateContext(input.state),
    });
    return logger;
  } catch (err) {
    process.stderr.write(
      `[agent-dev-log] attempt logging disabled after write failure: ${
        err instanceof Error ? err.message : String(err)
      }\n`,
    );
    return null;
  }
}

export function compactForAgentLog(value: unknown, max = 4_000): unknown {
  if (typeof value !== 'string') return value;
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 16).trim()}... [truncated]`;
}

export function chatResponseForAgentLog(response: ChatResponse | null): Record<string, unknown> {
  if (!response) return {};
  return {
    provider: response.provider,
    model: response.model,
    // 0139 C3: the provider-reported id alongside the requested one.
    responseModel: response.responseModel,
    finishReason: response.finishReason,
    text: compactForAgentLog(response.text, 2_000),
    usage: response.usage,
    toolCalls: response.toolCalls?.map((call) => ({
      id: call.id,
      name: call.name,
      arguments: compactForAgentLog(call.arguments),
    })),
  };
}

function agentDevLogsEnabled(): boolean {
  const flag = process.env.SBER_DESIGNER_AGENT_DEV_LOG;
  if (flag === '0' || flag === 'false') return false;
  if (flag === '1' || flag === 'true') return true;
  return process.env.NODE_ENV !== 'production';
}

async function createAgentLogFilePath(id: string): Promise<string> {
  const root =
    process.env.SBER_DESIGNER_AGENT_LOG_DIR ?? join(tmpdir(), 'sber-designer', 'agent-runs');
  await mkdir(root, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return join(root, `${stamp}-${id.slice(0, 8)}.jsonl`);
}

function editorStateContext(state: EditorState): Record<string, unknown> {
  return {
    project: state.projectName
      ? {
          name: state.projectName,
          workspacePath: state.workspacePath ?? null,
        }
      : state.workspacePath
        ? { workspacePath: state.workspacePath }
        : null,
    activeScreen: state.activeScreen ?? null,
    selection: state.selection ?? null,
    selectedComment: state.selectedComment ?? null,
    commentContext: state.commentContext ?? [],
    mode: state.mode ?? null,
    canvasUrl: state.canvasUrl ?? null,
  };
}

function messagePreview(message: ChatMessage): Record<string, unknown> {
  return {
    role: message.role,
    toolCallId: message.toolCallId,
    toolCalls: message.toolCalls?.map((call) => ({
      id: call.id,
      name: call.name,
      arguments: compactForAgentLog(call.arguments),
    })),
    content: contentPreview(message.content),
  };
}

function contentPreview(content: ChatMessage['content']): unknown {
  if (typeof content === 'string') return compactForAgentLog(content, 2_000);
  return content.map((part) => {
    if (part.type === 'text') return { type: 'text', text: compactForAgentLog(part.text, 2_000) };
    const url = part.image_url.url;
    return {
      type: 'image_url',
      detail: part.image_url.detail,
      url: url.startsWith('data:')
        ? `${url.slice(0, 48)}... [${url.length} chars]`
        : compactForAgentLog(url, 500),
    };
  });
}
