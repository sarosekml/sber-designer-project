import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { completeAgentRun, createAgentRun } from '../services/api/src/agent/run-record/manifest';
import {
  RUN_SOURCE_PREFERENCE_SNAPSHOT_FILE,
  type RunSourcePreferenceSnapshot,
} from '../services/api/src/agent/run-record/preference-signals';
import { recordToolReceipt } from '../services/api/src/agent/run-record/receipts';
import {
  PREFERENCE_EVENTS_PATH,
  PROJECT_PREFERENCES_PATH,
} from '../services/api/src/project-preferences';

const TARGET_PATH = 'src/screens/DensityScreen.tsx';

test('0114 B4 records follow-up density evidence and recognizes a source revert', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 'sd-0114-auto-preferences-'));
  await mkdir(join(workspacePath, 'src', 'screens'), { recursive: true });
  await writeFile(join(workspacePath, TARGET_PATH), screenSource(6, 6, 12), 'utf8');

  const baseline = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    workspacePath,
    activeScreen: activeScreen(),
    assistantTaskIntent: {
      kind: 'fill-generated-screen',
      targetScreenId: 'density-screen',
      targetName: 'Density screen',
      targetFolder: 'Ungrouped',
      targetStoryFilePath: 'src/screens/DensityScreen.stories.tsx',
      targetImplementationFilePath: TARGET_PATH,
      targetStoryId: 'screens-density-screen--default',
    },
  });
  await recordTargetWrite(workspacePath, baseline.runId);
  await completeAgentRun({ workspacePath, runId: baseline.runId, status: 'complete' });

  const baselineSnapshot = JSON.parse(
    await readFile(
      join(
        workspacePath,
        '.sber-designer',
        'runs',
        baseline.runId,
        RUN_SOURCE_PREFERENCE_SNAPSHOT_FILE,
      ),
      'utf8',
    ),
  ) as RunSourcePreferenceSnapshot;
  expect(baselineSnapshot).toMatchObject({
    screen_id: 'density-screen',
    target_path: TARGET_PATH,
  });
  expect(baselineSnapshot).not.toHaveProperty('source');

  await writeFile(join(workspacePath, TARGET_PATH), screenSource(3, 3, 8), 'utf8');
  const compactEdit = await createEditRun(workspacePath);
  await recordTargetWrite(workspacePath, compactEdit.runId);
  await completeAgentRun({ workspacePath, runId: compactEdit.runId, status: 'complete' });
  await completeAgentRun({ workspacePath, runId: compactEdit.runId, status: 'complete' });

  await writeFile(join(workspacePath, TARGET_PATH), screenSource(6, 6, 12), 'utf8');
  const revert = await createEditRun(workspacePath);
  await recordTargetWrite(workspacePath, revert.runId);
  await completeAgentRun({ workspacePath, runId: revert.runId, status: 'complete' });

  const events = jsonLines(await readFile(join(workspacePath, PREFERENCE_EVENTS_PATH), 'utf8'));
  expect(events).toHaveLength(2);
  expect(events[0]).toMatchObject({
    type: 'follow_up_edit',
    run_id: compactEdit.runId,
    previous_run_id: baseline.runId,
    changed_categories: ['density'],
    preference: {
      kind: 'prefer',
      text: 'Use denser screen layouts.',
      basis: 'density-decreased',
    },
  });
  expect(events[1]).toMatchObject({
    type: 'source_revert',
    run_id: revert.runId,
    previous_run_id: compactEdit.runId,
    reverted_run_id: compactEdit.runId,
    reverted_to_run_id: baseline.runId,
    preference: {
      kind: 'prefer',
      text: 'Use more spacious screen layouts.',
      basis: 'density-increased',
    },
  });

  const preferences = await readFile(join(workspacePath, PROJECT_PREFERENCES_PATH), 'utf8');
  expect(preferences).toContain('Use more spacious screen layouts.');
  expect(preferences).not.toContain('Use denser screen layouts.');
});

async function createEditRun(workspacePath: string) {
  return createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    workspacePath,
    activeScreen: activeScreen(),
    assistantTaskIntent: { kind: 'edit-current-screen', targetScreenId: 'density-screen' },
  });
}

async function recordTargetWrite(workspacePath: string, runId: string): Promise<void> {
  await recordToolReceipt({
    workspacePath,
    runId,
    tool: 'write_file',
    status: 'ok',
    changedFiles: [TARGET_PATH],
  });
}

function activeScreen() {
  return {
    id: 'density-screen',
    name: 'Density screen',
    kind: 'page',
    filePath: TARGET_PATH,
    implementationFilePath: TARGET_PATH,
  };
}

function screenSource(padding: number, gap: number, height: number): string {
  return `export function DensityScreen() {
  return <main className="p-${padding} gap-${gap}"><button className="h-${height}">Open</button></main>;
}\n`;
}

function jsonLines(contents: string): Array<Record<string, unknown>> {
  return contents
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}
