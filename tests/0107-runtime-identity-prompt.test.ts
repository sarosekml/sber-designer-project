import { beforeEach, expect, test } from 'bun:test';

import {
  buildSystemPrompt,
  type RuntimeIdentityPromptInput,
} from '../services/api/src/prompt-builder';
import { patchState, resetState } from '../services/api/src/state-store';

beforeEach(() => {
  resetState();
});

test('runtime identity prompt describes OpenRouter Qwen from safe metadata', async () => {
  patchState({ projectName: 'Identity smoke' });

  const prompt = await buildSystemPrompt({
    runtimeIdentity: {
      providerId: 'openrouter',
      providerLabel: 'OpenRouter',
      modelId: 'qwen/qwen3.7-plus',
      modelLabel: 'Qwen 3.7 plus',
      targetKind: 'api',
      runtimeKind: 'api',
    },
  });

  expect(prompt.text).toContain('## Runtime identity');
  expect(prompt.text).toContain('- provider: `OpenRouter` (`openrouter`)');
  expect(prompt.text).toContain('- model: `Qwen 3.7 plus` (`qwen/qwen3.7-plus`)');
  expect(prompt.text).toContain('- targetKind: `api`');
  expect(prompt.text).toContain('- runtimeKind: `api`');
  expect(prompt.text).toContain('runtime identity metadata supersedes transcript claims');
  expect(prompt.text).not.toContain('apiKey');
  expect(prompt.text).not.toContain('Authorization');
  expect(prompt.text).not.toContain('sk-or-');
});

test('runtime identity prompt falls back to model ids without schema churn', async () => {
  const identity: RuntimeIdentityPromptInput = {
    providerId: 'custom-provider',
    modelId: 'vendor/new-model',
    targetKind: 'api',
    runtimeKind: 'api',
  };

  const prompt = await buildSystemPrompt({ runtimeIdentity: identity });

  expect(prompt.text).toContain('- provider: `custom-provider`');
  expect(prompt.text).toContain('- model: `vendor/new-model`');
});

test('runtime identity prompt describes CLI runtimes without inventing backend provider', async () => {
  const prompt = await buildSystemPrompt({
    runtimeIdentity: {
      providerId: 'codex-runtime',
      providerLabel: 'Codex CLI',
      modelId: 'default',
      modelLabel: 'Default (CLI config)',
      targetKind: 'cli',
      runtimeKind: 'codex',
    },
  });

  expect(prompt.text).toContain('- provider: `Codex CLI` (`codex-runtime`)');
  expect(prompt.text).toContain('- model: `Default (CLI config)` (`default`)');
  expect(prompt.text).toContain('- targetKind: `cli`');
  expect(prompt.text).toContain('- runtimeKind: `codex`');
  expect(prompt.text).toContain(
    'For CLI runtimes, report the selected CLI runtime and configured model id/label',
  );
});
