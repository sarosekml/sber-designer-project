import { mkdtemp, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { getProject, resetProject, saveProject } from '../services/api/src/project-store';
import { projectRouter } from '../services/api/src/routes/project';

function projectBody(workspacePath: string, name: string) {
  return {
    version: 1,
    name,
    workspacePath,
    screens: [],
    flow: [],
  };
}

async function putProject(body: unknown): Promise<Response> {
  return projectRouter.request('http://localhost/', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('PUT /api/project saves the active workspace project', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-project-put-active-'));
  await saveProject(projectBody(workspace, 'Active project'));

  const response = await putProject({ ...projectBody(workspace, 'Active project renamed') });

  expect(response.status).toBe(200);
  const onDisk = JSON.parse(
    await readFile(join(workspace, '.sber-designer', 'project.sdproj'), 'utf8'),
  ) as { name: string };
  expect(onDisk.name).toBe('Active project renamed');
});

test('PUT /api/project keeps fresher active assistant history over stale payloads', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-project-put-assistant-'));
  const freshProject = {
    version: 1 as const,
    name: 'Assistant project',
    workspacePath: workspace,
    screens: [{ id: 'screen-a', name: 'Screen A', kind: 'page' as const }],
    flow: [],
    assistant: {
      storageVersion: 1,
      activeSessionByScreenId: { 'screen-a': 'session-a' },
      sessions: [
        {
          id: 'session-a',
          title: 'Generate screen',
          primaryScreenId: 'screen-a',
          status: 'active' as const,
          contextMode: 'current-task' as const,
          messages: [
            {
              id: 'user-a',
              role: 'user' as const,
              content: 'Generate the screen.',
              createdAt: '2026-06-13T00:00:00.000Z',
            },
            {
              id: 'assistant-a',
              role: 'assistant' as const,
              content: 'I wrote the screen and it needs review.',
              createdAt: '2026-06-13T00:00:01.000Z',
              runManifestId: '.sber-designer/runs/run-a/run-manifest.json',
            },
          ],
          linkedRunManifestIds: ['.sber-designer/runs/run-a/run-manifest.json'],
          metadata: {
            lastRunManifestPath: '.sber-designer/runs/run-a/run-manifest.json',
            lastRunStatus: 'needs_review' as const,
          },
          createdAt: '2026-06-13T00:00:00.000Z',
          updatedAt: '2026-06-13T00:00:01.000Z',
        },
      ],
    },
  };
  await saveProject(freshProject);

  const staleProject = {
    ...freshProject,
    assistant: {
      ...freshProject.assistant,
      sessions: [
        {
          ...freshProject.assistant.sessions[0]!,
          messages: [freshProject.assistant.sessions[0]!.messages[0]!],
          linkedRunManifestIds: undefined,
          metadata: undefined,
          updatedAt: '2026-06-13T00:00:00.000Z',
        },
      ],
    },
  };

  const response = await putProject(staleProject);

  expect(response.status).toBe(200);
  const onDisk = JSON.parse(
    await readFile(join(workspace, '.sber-designer', 'project.sdproj'), 'utf8'),
  );
  const session = onDisk.assistant.sessions[0];
  expect(session.messages.map((message: { id: string }) => message.id)).toEqual([
    'user-a',
    'assistant-a',
  ]);
  expect(session.linkedRunManifestIds).toEqual(['.sber-designer/runs/run-a/run-manifest.json']);
});

test('PUT /api/project rejects a save targeting another workspace', async () => {
  // 2026-06-12 corruption: a stale editor page PUT another project's
  // content with its own workspacePath, overwriting that repo's sdproj.
  const activeWorkspace = await mkdtemp(join(tmpdir(), 'sd-project-put-guard-active-'));
  const foreignWorkspace = await mkdtemp(join(tmpdir(), 'sd-project-put-guard-foreign-'));
  await saveProject(projectBody(activeWorkspace, 'Active project'));

  const response = await putProject(projectBody(foreignWorkspace, 'Stale tab payload'));

  expect(response.status).toBe(409);
  const body = (await response.json()) as { error: string };
  expect(body.error).toBe('workspace_mismatch');
  expect(existsSync(join(foreignWorkspace, '.sber-designer', 'project.sdproj'))).toBe(false);
  expect(getProject().name).toBe('Active project');
});

test('PUT /api/project allows the first save when no workspace is active', async () => {
  resetProject();
  const workspace = await mkdtemp(join(tmpdir(), 'sd-project-put-first-'));

  const response = await putProject(projectBody(workspace, 'Fresh project'));

  expect(response.status).toBe(200);
  expect(getProject().workspacePath).toBe(workspace);
});
