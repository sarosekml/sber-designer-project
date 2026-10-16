import { describe, expect, test } from 'bun:test';

import {
  filterModelSelectGroups,
  groupModelSelectOptions,
  modelIdFromModelSelectValue,
  normalizeModelSelectOptions,
} from './model-select-options';

describe('normalizeModelSelectOptions', () => {
  test('adds the CLI default and preserves a current custom model id', () => {
    const options = normalizeModelSelectOptions({
      models: [
        { value: 'claude-sonnet-4-5', label: 'Sonnet (alias)' },
        { value: 'anthropic/claude-opus-4-5' },
      ],
      value: 'custom/provider-model',
      includeDefault: true,
    });

    expect(options.map((option) => option.value)).toEqual([
      'default',
      'custom/provider-model',
      'claude-sonnet-4-5',
      'anthropic/claude-opus-4-5',
    ]);
    expect(options[0]?.label).toBe('Default (CLI config)');
    expect(options[1]?.label).toBe('custom/provider-model');
    expect(options[2]?.label).toBe('Sonnet (alias)');
  });

  test('deduplicates default and trims empty model ids', () => {
    const options = normalizeModelSelectOptions({
      models: [{ value: 'default' }, { value: ' ' }, { value: 'default', label: 'Default' }],
      value: 'default',
      includeDefault: true,
    });

    expect(options).toEqual([{ value: 'default', label: 'Default (CLI config)' }]);
  });

  test('keeps the provided label for the selected value', () => {
    const options = normalizeModelSelectOptions({
      value: 'codex-runtime::default',
      models: [
        {
          value: 'codex-runtime::default',
          label: 'Codex CLI · Default (CLI config)',
        },
      ],
    });

    expect(options[0]).toEqual({
      value: 'codex-runtime::default',
      label: 'Codex CLI · Default (CLI config)',
    });
  });
});

describe('groupModelSelectOptions', () => {
  test('groups provider/model ids while keeping the full value', () => {
    const groups = groupModelSelectOptions([
      { value: 'default', label: 'Default (CLI config)' },
      { value: 'anthropic/claude-sonnet-4-5' },
      { value: 'anthropic/claude-opus-4-5' },
      { value: 'openai/gpt-5.1-codex' },
    ]);

    expect(groups.map((group) => group.provider)).toEqual(['', 'anthropic', 'openai']);
    expect(groups[1]?.options.map((option) => option.value)).toEqual([
      'anthropic/claude-sonnet-4-5',
      'anthropic/claude-opus-4-5',
    ]);
  });

  test('uses explicit provider identity for composite settings values', () => {
    const groups = groupModelSelectOptions([
      {
        value: 'deepseek::deepseek-v4-pro',
        provider: 'deepseek',
        label: 'DeepSeek · V4 Pro',
      },
      {
        value: 'openrouter::deepseek/deepseek-v4-pro',
        provider: 'openrouter',
        label: 'OpenRouter · DeepSeek V4 Pro',
      },
    ]);

    expect(groups.map((group) => group.provider)).toEqual(['deepseek', 'openrouter']);
    expect(groups[1]?.options[0]).toMatchObject({
      value: 'openrouter::deepseek/deepseek-v4-pro',
      provider: 'openrouter',
    });
  });
});

describe('filterModelSelectGroups', () => {
  test('matches labels, full ids and provider group headings', () => {
    const groups = groupModelSelectOptions([
      { value: 'default', label: 'Default (CLI config)' },
      { value: 'anthropic/claude-sonnet-4-5', label: 'Sonnet' },
      { value: 'openai/gpt-5.1-codex' },
    ]);

    expect(
      filterModelSelectGroups(groups, 'sonnet')[0]?.options.map((option) => option.value),
    ).toEqual(['anthropic/claude-sonnet-4-5']);
    expect(
      filterModelSelectGroups(groups, 'openai')[0]?.options.map((option) => option.value),
    ).toEqual(['openai/gpt-5.1-codex']);
    expect(filterModelSelectGroups(groups, 'missing')).toEqual([]);
  });
});

describe('modelIdFromModelSelectValue', () => {
  test('keeps provider and model identity separate for DOM diagnostics', () => {
    expect(modelIdFromModelSelectValue('deepseek::deepseek-v4-pro', 'deepseek')).toBe(
      'deepseek-v4-pro',
    );
    expect(modelIdFromModelSelectValue('openrouter/deepseek/deepseek-v4-pro', 'openrouter')).toBe(
      'deepseek/deepseek-v4-pro',
    );
    expect(modelIdFromModelSelectValue('default')).toBe('default');
  });
});
