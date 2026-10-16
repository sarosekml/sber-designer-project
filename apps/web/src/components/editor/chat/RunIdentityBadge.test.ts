import { describe, expect, test } from 'bun:test';
import type { AssistantActiveRun } from '@sber-designer/shared-types';

import { buildAssistantRunIdentityBadgeState } from './RunIdentityBadge';
import { CODEX_RUNTIME_PROVIDER_ID } from '@/lib/api/agent-runs';

function run(overrides: Partial<AssistantActiveRun> = {}): AssistantActiveRun {
  return {
    clientRunId: 'client-run',
    runId: 'server-run',
    sessionId: 'session-a',
    screenId: 'screen-a',
    provider: CODEX_RUNTIME_PROVIDER_ID,
    model: 'qwen/qwen3.7-plus',
    status: 'running',
    startedAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe('buildAssistantRunIdentityBadgeState', () => {
  test('uses selected live-run metadata instead of the global model selector', () => {
    const badge = buildAssistantRunIdentityBadgeState({
      selectedRun: run(),
      messages: [
        {
          id: 'assistant-old',
          role: 'assistant',
          content: 'old response',
          meta: { provider: 'openrouter', model: 'deepseek/deepseek-v4-pro' },
        },
      ],
      apiProviders: [{ providerId: 'openrouter', label: 'OpenRouter' }],
    });

    expect(badge?.label).toBe('Current run · Codex CLI · qwen/qwen3.7-plus');
    expect(badge?.title).toContain('codex-runtime / qwen/qwen3.7-plus');
    expect(badge?.label).not.toContain('DeepSeek');
  });

  test('falls back to the latest assistant message metadata for completed chats', () => {
    const badge = buildAssistantRunIdentityBadgeState({
      selectedRun: null,
      messages: [
        {
          id: 'assistant-a',
          role: 'assistant',
          content: 'first',
          meta: { provider: 'openrouter', model: 'deepseek/deepseek-v4-pro' },
        },
        {
          id: 'user-b',
          role: 'user',
          content: 'next',
        },
        {
          id: 'assistant-b',
          role: 'assistant',
          content: 'second',
          meta: { provider: 'openrouter', model: 'qwen/qwen3.7-plus' },
        },
      ],
      apiProviders: [{ providerId: 'openrouter', label: 'OpenRouter' }],
    });

    expect(badge?.label).toBe('Last run · OpenRouter · qwen/qwen3.7-plus');
    expect(badge?.providerId).toBe('openrouter');
  });
});
