import { expect, test } from 'bun:test';

import {
  mergeSavedProjectForAutosaveBaseline,
  shouldAutosaveProjectChange,
} from '../apps/web/src/hooks/useProjectAutosave';
import { useProjectStore } from '../apps/web/src/stores/project-store';

test('autosave runs when assistant state changes after baseline', () => {
  const baseline = JSON.stringify({
    version: 1,
    name: 'Project',
    workspacePath: '/workspace',
    screens: [],
    flow: [],
  });
  const project = {
    version: 1 as const,
    name: 'Project',
    workspacePath: '/workspace',
    screens: [],
    flow: [],
    assistant: { storageVersion: 1, activeSessionByScreenId: {}, sessions: [] },
  };

  expect(shouldAutosaveProjectChange({ project, baseline, saving: false })).toBe(true);
});

test('autosave is gated while an assistant run is active', () => {
  const baseline = JSON.stringify({
    version: 1,
    name: 'Project',
    workspacePath: '/workspace',
    screens: [],
    flow: [],
  });
  const project = {
    version: 1 as const,
    name: 'Project',
    workspacePath: '/workspace',
    screens: [],
    flow: [],
    assistant: { storageVersion: 1, activeSessionByScreenId: {}, sessions: [] },
  };

  expect(
    shouldAutosaveProjectChange({
      project,
      baseline,
      saving: false,
      assistantRunActive: true,
    }),
  ).toBe(false);
});

test('autosave does not run while a save is already active', () => {
  expect(
    shouldAutosaveProjectChange({
      project: {
        version: 1,
        name: 'Project',
        workspacePath: '/workspace',
        screens: [],
        flow: [],
      },
      baseline: null,
      saving: true,
    }),
  ).toBe(false);
});

test('autosave baseline keeps newer local assistant messages over older saved snapshots', () => {
  const saved = {
    version: 1 as const,
    name: 'Project',
    workspacePath: '/workspace',
    screens: [],
    flow: [],
    assistant: {
      storageVersion: 1,
      activeSessionByScreenId: { 'screen-a': 'session-a' },
      sessions: [
        {
          id: 'session-a',
          title: 'Saved',
          primaryScreenId: 'screen-a',
          status: 'active' as const,
          contextMode: 'current-task' as const,
          messages: [
            {
              id: 'old-user',
              role: 'user' as const,
              content: 'Older saved message',
              createdAt: '2026-05-26T00:00:01.000Z',
            },
          ],
          createdAt: '2026-05-26T00:00:00.000Z',
          updatedAt: '2026-05-26T00:00:01.000Z',
        },
      ],
    },
  };
  const current = {
    ...saved,
    assistant: {
      storageVersion: 1,
      activeSessionByScreenId: { 'screen-a': 'session-a' },
      sessions: [
        {
          ...saved.assistant.sessions[0]!,
          title: 'Local',
          messages: [
            {
              id: 'new-user',
              role: 'user' as const,
              content: 'Newer local message',
              createdAt: '2026-05-26T00:00:02.000Z',
            },
          ],
          updatedAt: '2026-05-26T00:00:02.000Z',
        },
      ],
    },
  };

  const merged = mergeSavedProjectForAutosaveBaseline({ current, saved });

  expect(merged.assistant?.sessions[0]?.messages.map((message) => message.id)).toEqual([
    'new-user',
  ]);
});

test('project refresh baseline keeps newer local assistant messages over stale snapshots', () => {
  const incoming = {
    version: 1 as const,
    name: 'Project',
    workspacePath: '/workspace',
    screens: [],
    flow: [],
    assistant: {
      storageVersion: 1,
      activeSessionByScreenId: { 'screen-a': 'session-a' },
      sessions: [
        {
          id: 'session-a',
          title: 'Incoming',
          primaryScreenId: 'screen-a',
          status: 'active' as const,
          contextMode: 'current-task' as const,
          messages: [
            {
              id: 'old-user',
              role: 'user' as const,
              content: 'Older server message',
              createdAt: '2026-05-26T00:00:01.000Z',
            },
          ],
          createdAt: '2026-05-26T00:00:00.000Z',
          updatedAt: '2026-05-26T00:00:01.000Z',
        },
      ],
    },
  };
  const local = {
    ...incoming,
    assistant: {
      storageVersion: 1,
      activeSessionByScreenId: { 'screen-a': 'session-a' },
      sessions: [
        {
          ...incoming.assistant.sessions[0]!,
          title: 'Local',
          messages: [
            {
              id: 'local-user',
              role: 'user' as const,
              content: 'Fresh local message',
              createdAt: '2026-05-26T00:00:02.000Z',
            },
          ],
          updatedAt: '2026-05-26T00:00:02.000Z',
        },
      ],
    },
  };

  useProjectStore.setState({
    project: local,
    baseline: JSON.stringify(local),
    saving: false,
    loadError: null,
    saveError: null,
  });

  useProjectStore.getState().setBaseline(incoming);

  expect(
    useProjectStore
      .getState()
      .project?.assistant?.sessions[0]?.messages.map((message) => message.id),
  ).toEqual(['local-user']);
});

test('project refresh baseline keeps local Screens panel state when stale snapshot has none', () => {
  const incoming = {
    version: 1 as const,
    name: 'Project',
    workspacePath: '/workspace',
    screens: [],
    flow: [],
  };
  const local = {
    ...incoming,
    screensPanel: {
      collapsedFolderNames: ['Archive'],
    },
  };

  useProjectStore.setState({
    project: local,
    baseline: JSON.stringify(incoming),
    saving: false,
    loadError: null,
    saveError: null,
  });

  useProjectStore.getState().setBaseline(incoming);

  expect(useProjectStore.getState().project?.screensPanel?.collapsedFolderNames).toEqual([
    'Archive',
  ]);
});
