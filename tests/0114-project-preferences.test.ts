import { appendFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { loadAgentKit, resetAgentKitCache } from '../services/api/src/agent-kit/loader';
import { buildAgentKitHandoff } from '../services/api/src/agent-runtimes/agent-kit-handoff';
import { saveProject } from '../services/api/src/project-store';
import {
  deriveProjectStyleMemoryEntries,
  ensureProjectPreferencesDerived,
  PREFERENCE_EVENTS_PATH,
  PROJECT_PREFERENCES_PATH,
} from '../services/api/src/project-preferences';
import { buildSystemPrompt } from '../services/api/src/prompt-builder';
import { patchState, resetState } from '../services/api/src/state-store';

test('0114 B4 derives compact Prefer/Avoid memory from the latest feedback per run', () => {
  const events = [
    event('run-1', 'accept', 'Good component reuse', '2026-07-18T10:00:00.000Z'),
    event('run-1', 'reject', 'Avoid oversized whitespace', '2026-07-18T10:01:00.000Z'),
    event('run-2', 'accept', 'Use compact table rows.', '2026-07-18T10:02:00.000Z'),
    event('run-3', 'accept', 'use compact table rows', '2026-07-18T10:03:00.000Z'),
    '{invalid-json',
  ].join('\n');

  expect(deriveProjectStyleMemoryEntries(events)).toEqual([
    {
      kind: 'prefer',
      text: 'use compact table rows',
      signals: 2,
      confidence: 'medium',
    },
    {
      kind: 'avoid',
      text: 'Avoid oversized whitespace',
      signals: 1,
      confidence: 'low',
    },
  ]);
});

test('0114 B4 promotes repeated deterministic density corrections without mining chat', () => {
  const events = [
    automaticEvent('run-density-1', 'follow_up_edit', 'Use denser screen layouts.'),
    automaticEvent('run-density-2', 'follow_up_edit', 'Use denser screen layouts.'),
  ].join('\n');

  expect(deriveProjectStyleMemoryEntries(events)).toEqual([
    {
      kind: 'prefer',
      text: 'Use denser screen layouts.',
      signals: 2,
      confidence: 'medium',
    },
  ]);
});

test('0114 B4 source revert suppresses the automatic preference from the reverted run', () => {
  const events = [
    automaticEvent('run-density-edit', 'follow_up_edit', 'Use denser screen layouts.'),
    automaticEvent('run-density-revert', 'source_revert', 'Use more spacious screen layouts.', {
      revertedRunId: 'run-density-edit',
    }),
  ].join('\n');

  expect(deriveProjectStyleMemoryEntries(events)).toEqual([
    {
      kind: 'prefer',
      text: 'Use more spacious screen layouts.',
      signals: 1,
      confidence: 'low',
    },
  ]);
});

test('0114 B4 preserves manual preferences while refreshing its managed markdown block', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 'sd-0114-preferences-'));
  const eventsPath = join(workspacePath, PREFERENCE_EVENTS_PATH);
  const preferencesPath = join(workspacePath, PROJECT_PREFERENCES_PATH);
  await mkdir(join(workspacePath, '.sber-designer', 'preferences'), { recursive: true });
  await writeFile(
    eventsPath,
    `${event('run-1', 'accept', 'Keep dense operational layouts', '2026-07-18T10:00:00.000Z')}\n`,
    'utf8',
  );

  const first = await ensureProjectPreferencesDerived(workspacePath);
  expect(first.promptBlock).toContain('Keep dense operational layouts');
  expect(await readFile(preferencesPath, 'utf8')).toContain(
    '<!-- sber-designer:project-style-memory:start -->',
  );

  await appendFile(
    preferencesPath,
    '\n## Team-owned rules\n\n- Prefer short Russian action labels.\n',
    'utf8',
  );
  await appendFile(
    eventsPath,
    `${event('run-2', 'reject', 'Avoid decorative hero sections', '2026-07-18T10:05:00.000Z')}\n`,
    'utf8',
  );

  const refreshed = await ensureProjectPreferencesDerived(workspacePath);
  expect(refreshed.markdown).toContain('Avoid decorative hero sections');
  expect(refreshed.markdown).toContain('Prefer short Russian action labels.');
  expect(refreshed.promptBlock).toContain('Prefer short Russian action labels.');
});

test('0114 B4 injects project style memory into generation prompts but not targeted edits', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 'sd-0114-prompt-memory-'));
  await mkdir(join(workspacePath, '.sber-designer', 'preferences'), { recursive: true });
  await writeFile(
    join(workspacePath, PREFERENCE_EVENTS_PATH),
    `${event('run-1', 'accept', 'Reuse compact data cards', '2026-07-18T10:00:00.000Z')}\n`,
    'utf8',
  );
  resetState();
  resetAgentKitCache();
  patchState({
    workspacePath,
    projectName: 'Preference prompt project',
    activeScreen: {
      id: 'screen-1',
      name: 'Operations',
      kind: 'page',
      filePath: 'src/screens/Operations.tsx',
      implementationFilePath: 'src/screens/Operations.tsx',
    },
  });

  const generation = await buildSystemPrompt({ taskKind: 'screen-generation' });
  const edit = await buildSystemPrompt({ taskKind: 'screen-edit' });
  resetState();
  resetAgentKitCache();

  expect(generation.text).toContain('## Project style memory');
  expect(generation.text).toContain('Reuse compact data cards');
  expect(edit.text).not.toContain('## Project style memory');
});

test('0114 B4 project kill-switch omits memory without deleting its files', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 'sd-0114-memory-switch-'));
  await mkdir(join(workspacePath, '.sber-designer', 'preferences'), { recursive: true });
  await writeFile(
    join(workspacePath, PREFERENCE_EVENTS_PATH),
    `${event('run-1', 'accept', 'Keep compact registries', '2026-07-18T10:00:00.000Z')}\n`,
    'utf8',
  );
  const derived = await ensureProjectPreferencesDerived(workspacePath);
  await saveProject({
    version: 1,
    name: 'Memory switch project',
    workspacePath,
    screens: [],
    flow: [],
    agentMemory: { styleMemoryEnabled: false },
  });
  resetState();
  resetAgentKitCache();
  patchState({ workspacePath, projectName: 'Memory switch project' });

  const disabled = await buildSystemPrompt({ taskKind: 'screen-generation' });
  expect(disabled.text).not.toContain('## Project style memory');
  expect(await readFile(join(workspacePath, PROJECT_PREFERENCES_PATH), 'utf8')).toBe(
    derived.markdown,
  );

  await saveProject({
    version: 1,
    name: 'Memory switch project',
    workspacePath,
    screens: [],
    flow: [],
    agentMemory: { styleMemoryEnabled: true },
  });
  const enabled = await buildSystemPrompt({ taskKind: 'screen-generation' });
  resetState();
  resetAgentKitCache();

  expect(enabled.text).toContain('## Project style memory');
  expect(enabled.text).toContain('Keep compact registries');
});

test('0114 B4 includes memory in CLI stable context and changes its digest', async () => {
  resetAgentKitCache();
  const kit = await loadAgentKit();
  const input = {
    runtime: 'codex' as const,
    runtimeLabel: 'Codex CLI',
    model: null,
    messages: [{ role: 'user', content: 'Create an operations dashboard.' }],
    state: { projectName: 'Memory project', workspacePath: process.cwd() },
    kit,
    primaryAgentName: 'ai-product-designer',
    agentRunId: 'run-memory',
  };
  const withoutMemory = buildAgentKitHandoff(input);
  const withMemory = buildAgentKitHandoff({
    ...input,
    projectStyleMemory: '## Project style memory\n\n### Prefer\n\n- Compact data cards',
  });

  expect(withMemory.prompt).toContain('Compact data cards');
  expect(withMemory.stableContextDigest).not.toBe(withoutMemory.stableContextDigest);
});

function event(runId: string, sentiment: 'accept' | 'reject', reason: string, createdAt: string) {
  return JSON.stringify({
    version: 1,
    type: 'run_feedback',
    created_at: createdAt,
    run_id: runId,
    sentiment,
    reason,
  });
}

function automaticEvent(
  runId: string,
  type: 'follow_up_edit' | 'source_revert',
  text: string,
  options: { revertedRunId?: string } = {},
) {
  return JSON.stringify({
    version: 1,
    type,
    created_at: '2026-07-18T10:00:00.000Z',
    run_id: runId,
    reverted_run_id: options.revertedRunId ?? null,
    preference: { kind: 'prefer', text },
  });
}
