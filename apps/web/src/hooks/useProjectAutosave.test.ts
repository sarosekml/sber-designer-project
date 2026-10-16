import { expect, test } from 'bun:test';
import type { SberDesignerProject } from '@sber-designer/shared-types';

import { reconcileAutosaveSuccess } from './useProjectAutosave';

function project(patch: Partial<SberDesignerProject> = {}): SberDesignerProject {
  return {
    version: 1,
    name: 'Project',
    workspacePath: '/workspace',
    screens: [],
    flow: [],
    savedAt: 10,
    assistant: { storageVersion: 1, activeSessionByScreenId: {}, sessions: [] },
    ...patch,
  };
}

test('autosave success merges fresh assistant changes and settles baseline', () => {
  const sent = project();
  const current = project({
    assistant: {
      storageVersion: 1,
      activeSessionByScreenId: { 'screen-1': 'session-1' },
      sessions: [
        {
          id: 'session-1',
          title: 'Generate screen',
          primaryScreenId: 'screen-1',
          status: 'active',
          sessionMode: 'design',
          messages: [],
          createdAt: '2026-06-06T20:00:00.000Z',
          updatedAt: '2026-06-06T20:00:01.000Z',
        },
      ],
    },
  });
  const saved = project({ savedAt: 20 });

  const result = reconcileAutosaveSuccess({
    current,
    payloadSnapshot: JSON.stringify(sent),
    saved,
  });

  expect(result.followUpRequired).toBe(false);
  expect(result.project.savedAt).toBe(20);
  expect(result.project.assistant?.activeSessionByScreenId).toEqual({
    'screen-1': 'session-1',
  });
  expect(result.baseline).toBe(JSON.stringify(result.project));
});

test('autosave success keeps unsaved non-assistant changes dirty for one follow-up save', () => {
  const sent = project({ screens: [{ id: 'screen-1', name: 'Old', kind: 'story' }] });
  const current = project({ screens: [{ id: 'screen-1', name: 'New', kind: 'story' }] });
  const saved = project({ savedAt: 20, screens: [{ id: 'screen-1', name: 'Old', kind: 'story' }] });

  const result = reconcileAutosaveSuccess({
    current,
    payloadSnapshot: JSON.stringify(sent),
    saved,
  });

  expect(result.followUpRequired).toBe(true);
  expect(result.project).toEqual(current);
  expect(JSON.parse(result.baseline)).toMatchObject({
    savedAt: 20,
    screens: [{ id: 'screen-1', name: 'Old', kind: 'story' }],
  });
});
