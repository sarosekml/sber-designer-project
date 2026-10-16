import { expect, test } from 'bun:test';

import {
  buildClaudeCodeRunArgs,
  classifyClaudeCodePermissionFailure,
  parseClaudeLine,
} from '../services/api/src/agent-runtimes/claude-runner';

test('builds non-interactive Claude Code stream-json args', () => {
  expect(buildClaudeCodeRunArgs('selected-model')).toEqual([
    '-p',
    '--verbose',
    '--permission-mode',
    'acceptEdits',
    '--output-format',
    'stream-json',
    '--model',
    'selected-model',
  ]);
});

test('places per-run MCP config args before Claude print-mode args', () => {
  expect(
    buildClaudeCodeRunArgs('opus', [], null, [
      '--mcp-config',
      '/tmp/project/.mcp.json',
      '--allowedTools',
      'mcp__sber-designer__get_project_index_status',
    ]).slice(0, 4),
  ).toEqual([
    '--mcp-config',
    '/tmp/project/.mcp.json',
    '--allowedTools',
    'mcp__sber-designer__get_project_index_status',
  ]);
});

test('omits Claude Code default pseudo-model flag', () => {
  expect(buildClaudeCodeRunArgs('default')).toEqual([
    '-p',
    '--verbose',
    '--permission-mode',
    'acceptEdits',
    '--output-format',
    'stream-json',
  ]);
});

test('omits model flag when no Claude Code model is selected', () => {
  expect(buildClaudeCodeRunArgs(null)).toEqual([
    '-p',
    '--verbose',
    '--permission-mode',
    'acceptEdits',
    '--output-format',
    'stream-json',
  ]);
});

test('does not pass Claude Code image paths as native flags in print mode', () => {
  expect(buildClaudeCodeRunArgs('opus', ['/tmp/reference.png'])).toEqual([
    '-p',
    '--verbose',
    '--permission-mode',
    'acceptEdits',
    '--output-format',
    'stream-json',
    '--model',
    'opus',
  ]);
});

test('adds Claude Code session args for new and resumed runtime sessions', () => {
  expect(
    buildClaudeCodeRunArgs('sonnet', [], {
      mode: 'new',
      sessionId: '11111111-1111-4111-8111-111111111111',
    }),
  ).toEqual([
    '-p',
    '--verbose',
    '--permission-mode',
    'acceptEdits',
    '--output-format',
    'stream-json',
    '--model',
    'sonnet',
    '--session-id',
    '11111111-1111-4111-8111-111111111111',
  ]);

  expect(
    buildClaudeCodeRunArgs('sonnet', [], {
      mode: 'resume',
      sessionId: '22222222-2222-4222-8222-222222222222',
    }),
  ).toContain('--resume');
});

test('filters Claude Code stdout fallback noise without dropping assistant text', () => {
  expect(parseClaudeLine('Here is the result')).toEqual([
    { type: 'text_delta', delta: 'Here is the result\n' },
  ]);
  expect(parseClaudeLine('debug: stream-json event ignored')).toEqual([]);
  expect(parseClaudeLine('Authenticated with local account')).toEqual([]);
});

test('reports Claude Code stdout fallback noise reasons for observability', () => {
  const reasons: string[] = [];
  expect(
    parseClaudeLine('debug: stream-json event ignored', {
      onRuntimeNoise: (reason) => reasons.push(reason),
    }),
  ).toEqual([]);

  expect(reasons).toEqual(['log-prefix']);
});

test('classifies Claude Code permission-required exits before generic code failures', () => {
  const diagnostic = classifyClaudeCodePermissionFailure({
    code: 143,
    signal: null,
    stdoutTail: '',
    stderrTail:
      'Claude Code needs permission to use Bash: rg -n "Grid" src/screens/Misc/ImgTest03.tsx',
  });

  expect(diagnostic).toMatchObject({
    code: 'permission_required',
    severity: 'warning',
  });
  expect(diagnostic?.message).toContain('permission_required');
  expect(diagnostic?.message).toContain('Bash');
  expect(diagnostic?.message).toContain('rg -n');
});
