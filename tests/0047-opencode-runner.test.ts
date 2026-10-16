import { expect, test } from 'bun:test';

import {
  buildOpenCodeRunArgs,
  parseOpenCodeLine,
} from '../services/api/src/agent-runtimes/opencode-runner';

test('builds non-interactive OpenCode JSON run args without dangerous permission bypass', () => {
  const args = buildOpenCodeRunArgs('providerA/selected-model');

  expect(args).toEqual(['run', '--format', 'json', '--model', 'providerA/selected-model']);
  expect(args).not.toContain('--dangerously-skip-permissions');
});

test('omits model flag when no model is selected', () => {
  expect(buildOpenCodeRunArgs(null)).toEqual(['run', '--format', 'json']);
});

test('omits OpenCode default pseudo-model flag', () => {
  expect(buildOpenCodeRunArgs('default')).toEqual(['run', '--format', 'json']);
});

test('pins OpenCode handoff to the selected project directory', () => {
  expect(buildOpenCodeRunArgs('providerA/selected-model', '/work/demo-project')).toEqual([
    'run',
    '--format',
    'json',
    '--dir',
    '/work/demo-project',
    '--model',
    'providerA/selected-model',
  ]);
});

test('filters OpenCode stdout fallback noise without dropping assistant text', () => {
  expect(parseOpenCodeLine('Here is the result', new Set())).toEqual([
    { type: 'text_delta', delta: 'Here is the result\n' },
  ]);
  expect(parseOpenCodeLine('info: connecting to provider', new Set())).toEqual([]);
  expect(parseOpenCodeLine('Checking credentials', new Set())).toEqual([]);
});

test('reports OpenCode stdout fallback noise reasons for observability', () => {
  const reasons: string[] = [];
  expect(
    parseOpenCodeLine('Checking credentials', new Set(), {
      onRuntimeNoise: (reason) => reasons.push(reason),
    }),
  ).toEqual([]);

  expect(reasons).toEqual(['status-line']);
});
