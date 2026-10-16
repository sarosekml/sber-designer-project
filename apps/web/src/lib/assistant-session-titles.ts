import type {
  PersistedAssistantMessage,
  ProjectAssistantSession,
} from '@sber-designer/shared-types';

let sessionCounter = 0;

export function titleFromMessages(messages: PersistedAssistantMessage[], fallback: string): string {
  const user = messages.find((message) => message.role === 'user' && message.content.trim());
  if (!user) return fallback;
  const singleLine = user.content.replace(/\s+/g, ' ').trim();
  return singleLine.length > 42 ? `${singleLine.slice(0, 39)}...` : singleLine;
}

export function titleSourceFromMessages(
  messages: PersistedAssistantMessage[],
): NonNullable<ProjectAssistantSession['titleSource']> {
  return messages.some((message) => message.role === 'user' && message.content.trim())
    ? 'user'
    : 'fallback';
}

export function fallbackTaskTitle(now: string): string {
  const date = new Date(now);
  if (Number.isNaN(date.getTime())) return 'Task';
  return `Task · ${date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })}`;
}

export function nextAssistantSessionId(screenId: string): string {
  sessionCounter += 1;
  return `assistant-${screenId}-${Date.now()}-${sessionCounter}`;
}
