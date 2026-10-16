import { expect, test } from 'bun:test';
import {
  directionPickerModeFromConfig,
  parseConfig,
  shouldPresentDirectionPicker,
} from '@sber-designer/llm-gateway';

import {
  buildDesignDirectionOptions,
  findPendingDirectionPicker,
  formatDirectionPickerMessage,
  parseDirectionPickerMessagePayload,
  selectionFromDirectionOption,
} from '../apps/web/src/lib/design-direction-picker';
import {
  GenerationOptionsSchema,
  designBriefPromptSection,
} from '../services/api/src/generation-mode';

const baseConfig = {
  agent: { default: { provider: 'mock', model: 'echo' } },
  provider: {
    mock: { type: 'mock' as const, name: 'Mock', models: { echo: { name: 'Echo' } } },
  },
  mcpServers: {},
};

test('0114 B6 direction-picker config defaults off and scopes screens/always', () => {
  const off = parseConfig(baseConfig);
  const screens = parseConfig({
    ...baseConfig,
    agent: { ...baseConfig.agent, directionPicker: 'screens' },
  });
  const always = parseConfig({
    ...baseConfig,
    agent: { ...baseConfig.agent, directionPicker: 'always' },
  });

  expect(directionPickerModeFromConfig(off)).toBe('off');
  expect(shouldPresentDirectionPicker(off, 'screen')).toBe(false);
  expect(shouldPresentDirectionPicker(screens, 'screen')).toBe(true);
  expect(shouldPresentDirectionPicker(screens, 'other')).toBe(false);
  expect(shouldPresentDirectionPicker(always, 'screen')).toBe(true);
  expect(shouldPresentDirectionPicker(always, 'other')).toBe(true);
});

test('0114 B6 produces exactly three directions and preserves explicit brief axes', () => {
  const options = buildDesignDirectionOptions({
    version: 1,
    source: 'mini-form',
    axes: {
      palette: 'Project neutrals',
      density: 'compact',
      constraints: ['Keep navigation'],
    },
  });

  expect(options).toHaveLength(3);
  expect(options.map((option) => option.optionId)).toEqual(['1', '2', '3']);
  expect(new Set(options.map((option) => option.label)).size).toBe(3);
  for (const option of options) {
    expect(option.designBrief.source).toBe('direction-picker');
    expect(option.designBrief.axes.palette).toBe('Project neutrals');
    expect(option.designBrief.axes.density).toBe('compact');
    expect(option.designBrief.axes.constraints).toEqual(['Keep navigation']);
  }
  expect(formatDirectionPickerMessage(options)).toContain('Click one of the cards below');
  expect(formatDirectionPickerMessage(options)).not.toContain('1. **Workflow focus**');
});

test('0114 B6 persists a parseable picker payload and binds selection to its brief', () => {
  const options = buildDesignDirectionOptions(null);
  const payload = {
    version: 1 as const,
    requestMessageId: 'direction-request-1',
    baseGeneration: { wireframe: true },
    options,
  };
  const parsed = parseDirectionPickerMessagePayload({ directionPicker: payload });
  const selected = options[1]!;
  const directionSelection = selectionFromDirectionOption(selected);
  const generation = GenerationOptionsSchema.parse({
    ...payload.baseGeneration,
    designBrief: selected.designBrief,
    directionSelection,
  });

  expect(parsed).toEqual(payload);
  expect(directionSelection).toMatchObject({ optionId: '2', label: 'Operational overview' });
  expect(designBriefPromptSection(generation)).toContain(
    'Selected direction: 2. Operational overview',
  );
  expect(() => GenerationOptionsSchema.parse({ directionSelection })).toThrow(
    'requires a direction-picker design brief',
  );
  expect(parseDirectionPickerMessagePayload({ directionPicker: { ...payload, options: [] } })).toBe(
    null,
  );
});

test('0114 B6 keeps the picker pending until a card selection is recorded', () => {
  const options = buildDesignDirectionOptions(null);
  const picker = {
    id: 'picker',
    role: 'assistant',
    content: formatDirectionPickerMessage(options),
    metadata: {
      directionPicker: {
        version: 1 as const,
        requestMessageId: 'request',
        baseGeneration: {},
        options,
      },
    },
  };
  const base = [{ id: 'request', role: 'user', content: 'Create a screen' }, picker];

  expect(findPendingDirectionPicker(base)?.messageId).toBe('picker');
  expect(
    findPendingDirectionPicker([...base, { id: 'noise', role: 'user', content: '3' }])?.messageId,
  ).toBe('picker');
  expect(
    findPendingDirectionPicker([
      ...base,
      {
        id: 'selection',
        role: 'user',
        content: 'Use direction 3: Guided progression',
        metadata: { directionSelection: selectionFromDirectionOption(options[2]!) },
      },
    ]),
  ).toBeNull();
});
