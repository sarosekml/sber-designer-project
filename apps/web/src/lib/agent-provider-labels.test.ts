import { describe, expect, test } from 'bun:test';

import {
  compactAgentLabel,
  fullAgentLabel,
  groupModelIdsByProvider,
  isDefaultCliModel,
  modelOptionLabel,
} from './agent-provider-labels';

describe('isDefaultCliModel', () => {
  test('treats default/empty as the CLI config default', () => {
    expect(isDefaultCliModel('default')).toBe(true);
    expect(isDefaultCliModel('DEFAULT')).toBe(true);
    expect(isDefaultCliModel('')).toBe(true);
    expect(isDefaultCliModel(null)).toBe(true);
    expect(isDefaultCliModel('claude-sonnet-4-5')).toBe(false);
  });
});

describe('modelOptionLabel', () => {
  test('normalizes default and keeps concrete ids', () => {
    expect(modelOptionLabel('default')).toBe('Default (CLI config)');
    expect(modelOptionLabel('claude-opus-4-5')).toBe('claude-opus-4-5');
    expect(modelOptionLabel('anthropic/claude-sonnet-4-5')).toBe('anthropic/claude-sonnet-4-5');
  });
});

describe('compactAgentLabel', () => {
  test('CLI default drops the raw model from the chip', () => {
    expect(compactAgentLabel({ kind: 'cli', providerLabel: 'Claude Code', model: 'default' })).toBe(
      'Claude Code',
    );
  });

  test('CLI with concrete model shows Provider · Model', () => {
    expect(
      compactAgentLabel({ kind: 'cli', providerLabel: 'Codex CLI', model: 'gpt-5.1-codex' }),
    ).toBe('Codex CLI · gpt-5.1-codex');
  });

  test('API uses the friendly model name when present', () => {
    expect(
      compactAgentLabel({
        kind: 'api',
        providerLabel: 'OpenRouter',
        model: 'deepseek/deepseek-v4-flash',
        modelDisplay: 'DeepSeek V4 Flash',
      }),
    ).toBe('OpenRouter · DeepSeek V4 Flash');
  });
});

describe('fullAgentLabel', () => {
  test('keeps Default (CLI config) visible for settings rows', () => {
    expect(fullAgentLabel({ kind: 'cli', providerLabel: 'Codex CLI', model: 'default' })).toBe(
      'Codex CLI · Default (CLI config)',
    );
  });

  test('shows the concrete CLI model', () => {
    expect(
      fullAgentLabel({
        kind: 'cli',
        providerLabel: 'OpenCode',
        model: 'anthropic/claude-sonnet-4-5',
      }),
    ).toBe('OpenCode · anthropic/claude-sonnet-4-5');
  });
});

describe('groupModelIdsByProvider', () => {
  test('groups provider/model ids and keeps the full value', () => {
    const groups = groupModelIdsByProvider([
      'anthropic/claude-sonnet-4-5',
      'anthropic/claude-opus-4-5',
      'default',
      'gpt-5.1-codex',
    ]);
    expect(groups.map((group) => group.provider)).toEqual(['', 'anthropic']);
    const anthropic = groups.find((group) => group.provider === 'anthropic');
    expect(anthropic?.models.map((model) => model.value)).toEqual([
      'anthropic/claude-sonnet-4-5',
      'anthropic/claude-opus-4-5',
    ]);
    const ungrouped = groups.find((group) => group.provider === '');
    expect(ungrouped?.models.map((model) => model.label)).toEqual([
      'Default (CLI config)',
      'gpt-5.1-codex',
    ]);
  });
});
