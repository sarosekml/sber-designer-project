import { expect, test } from 'bun:test';
import {
  DEFAULT_GENERATION_PIPELINE_DEFAULTS,
  resolveGenerationPipelineDefaults,
} from '@sber-designer/shared-types';

test('0114 generation pipeline defaults stay build-first when no user override exists', () => {
  expect(resolveGenerationPipelineDefaults(undefined)).toEqual(
    DEFAULT_GENERATION_PIPELINE_DEFAULTS,
  );
});

test('0114 user defaults override the legacy JSON direction-picker switch', () => {
  expect(resolveGenerationPipelineDefaults(undefined, true).directionPicker).toBe(true);
  expect(
    resolveGenerationPipelineDefaults(
      { directionPicker: false, wireframe: true, designJury: true },
      true,
    ),
  ).toEqual({
    directionPicker: false,
    wireframe: true,
    designJury: true,
  });
});
