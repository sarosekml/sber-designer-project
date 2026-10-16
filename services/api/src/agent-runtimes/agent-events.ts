import type { AgentStreamEvent } from '../agent/stream';

export type AgentEvent =
  | { type: 'text_delta'; iteration: number; delta: string }
  | { type: 'tool_call'; iteration: number; id: string; name: string; arguments: string }
  | {
      type: 'tool_result';
      iteration: number;
      toolCallId: string;
      isError: boolean;
      content: string;
    }
  | { type: 'file_write'; path: string; source: 'tool-result'; iteration: number }
  | { type: 'usage'; iteration: number; usage: AgentStreamEventUsage }
  | { type: 'done'; hadErrors: boolean; iterations: number }
  | { type: 'error'; message: string };

type AgentStreamEventUsage = Extract<AgentStreamEvent, { type: 'usage' }>['usage'];

export function normalizeAgentStreamEvent(event: AgentStreamEvent): AgentEvent[] {
  switch (event.type) {
    case 'text-delta':
      return [{ type: 'text_delta', iteration: event.iteration, delta: event.delta }];
    case 'tool-call':
      return [
        {
          type: 'tool_call',
          iteration: event.iteration,
          id: event.call.id,
          name: event.call.name,
          arguments: event.call.arguments,
        },
      ];
    case 'tool-result':
      return [
        {
          type: 'tool_result',
          iteration: event.iteration,
          toolCallId: event.toolCallId,
          isError: event.isError,
          content: event.content,
        },
        ...(event.changedFiles ?? []).map(
          (path): AgentEvent => ({
            type: 'file_write',
            path,
            source: 'tool-result',
            iteration: event.iteration,
          }),
        ),
      ];
    case 'usage':
      return [{ type: 'usage', iteration: event.iteration, usage: event.usage }];
    case 'done':
      return [{ type: 'done', hadErrors: event.hadErrors, iterations: event.iterations }];
    case 'error':
      return [{ type: 'error', message: event.message }];
    default:
      return [];
  }
}
