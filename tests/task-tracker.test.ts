import { expect, test } from 'bun:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SberDesignerProject } from '@sber-designer/shared-types';

import { saveProject } from '../services/api/src/project-store';
import { tasksRouter } from '../services/api/src/routes/tasks';
import {
  extractCommentTasks,
  fetchLinearTasks,
  trackerEnvStatus,
} from '../services/api/src/task-tracker';

test('extractCommentTasks turns open screen comments into project tasks', () => {
  const project: SberDesignerProject = {
    version: 1,
    name: 'Task comments',
    workspacePath: '/workspace',
    screens: [
      { id: 'screen-a', name: 'Screen A', kind: 'story', storyId: 'screens-demo--screen-a' },
    ],
    flow: [],
    comments: [
      {
        id: 'comment-1',
        screenId: 'screen-a',
        anchor: { x: 0.5, y: 0.5 },
        status: 'open',
        createdAt: 1,
        updatedAt: 1,
        messages: [
          {
            id: 'message-1',
            authorName: 'Mikhail',
            body: 'JIRA-42 Make the approve button primary.',
            createdAt: 1,
          },
        ],
      },
      {
        id: 'comment-2',
        screenId: 'screen-a',
        anchor: { x: 0.2, y: 0.3 },
        status: 'resolved',
        createdAt: 1,
        updatedAt: 1,
        messages: [
          {
            id: 'message-2',
            authorName: 'Mikhail',
            body: 'Resolved task.',
            createdAt: 1,
          },
        ],
      },
      {
        id: 'comment-3',
        screenId: 'screen-a',
        anchor: { x: 0.7, y: 0.4 },
        status: 'open',
        createdAt: 1,
        updatedAt: 1,
        messages: [
          {
            id: 'message-3',
            authorName: 'Mikhail',
            body: 'исправить название на Stopped',
            createdAt: 1,
          },
        ],
      },
    ],
  };

  expect(extractCommentTasks(project)).toEqual([
    {
      id: 'comment-comment-1',
      title: 'JIRA-42 Make the approve button primary.',
      description: 'JIRA-42 Make the approve button primary.',
      source: 'comment',
      screenIds: ['screen-a'],
      commentId: 'comment-1',
      status: 'open',
    },
    {
      id: 'comment-comment-3',
      title: 'исправить название на Stopped',
      description: 'исправить название на Stopped',
      source: 'comment',
      screenIds: ['screen-a'],
      commentId: 'comment-3',
      status: 'open',
    },
  ]);
});

test('trackerEnvStatus reports missing server-side secrets', () => {
  const previous = process.env.LINEAR_API_KEY;
  const previousDisableLocalEnv = process.env.SBER_DESIGNER_DISABLE_LOCAL_ENV_LOAD;
  delete process.env.LINEAR_API_KEY;
  process.env.SBER_DESIGNER_DISABLE_LOCAL_ENV_LOAD = '1';

  expect(trackerEnvStatus('linear')).toEqual({
    type: 'linear',
    ok: false,
    missingEnvVars: ['LINEAR_API_KEY'],
  });

  if (previous === undefined) {
    delete process.env.LINEAR_API_KEY;
  } else {
    process.env.LINEAR_API_KEY = previous;
  }
  if (previousDisableLocalEnv === undefined) {
    delete process.env.SBER_DESIGNER_DISABLE_LOCAL_ENV_LOAD;
  } else {
    process.env.SBER_DESIGNER_DISABLE_LOCAL_ENV_LOAD = previousDisableLocalEnv;
  }
});

test('tasks route still returns comment tasks when tracker env is missing', async () => {
  const previous = process.env.LINEAR_API_KEY;
  const previousDisableLocalEnv = process.env.SBER_DESIGNER_DISABLE_LOCAL_ENV_LOAD;
  delete process.env.LINEAR_API_KEY;
  process.env.SBER_DESIGNER_DISABLE_LOCAL_ENV_LOAD = '1';

  try {
    const workspacePath = await mkdtemp(join(tmpdir(), 'sd-tasks-route-'));
    await saveProject({
      version: 1,
      name: 'Route tasks',
      workspacePath,
      screens: [
        {
          id: 'screen-a',
          name: 'Funds List',
          kind: 'story',
          storyId: 'screens-demo--funds-list-screen',
        },
      ],
      flow: [],
      taskTracker: {
        type: 'linear',
        projectUrl: 'https://linear.app/acme/project/demo',
        labelFilter: 'sber-designer',
      },
      comments: [
        {
          id: 'comment-1',
          screenId: 'screen-a',
          anchor: { x: 0.4, y: 0.4 },
          status: 'open',
          createdAt: 1,
          updatedAt: 1,
          messages: [
            {
              id: 'message-1',
              authorName: 'Mikhail',
              body: 'исправить название на Stopped',
              createdAt: 1,
            },
          ],
        },
      ],
    });

    const response = await tasksRouter.request('http://localhost/', {
      headers: { 'x-sber-designer-user': 'test' },
    });
    const body = (await response.json()) as {
      tasks: { id: string; source: string; screenIds: string[] }[];
      trackerError?: string;
    };

    expect(response.status).toBe(200);
    expect(body.tasks).toEqual([
      expect.objectContaining({
        id: 'comment-comment-1',
        source: 'comment',
        screenIds: ['screen-a'],
      }),
    ]);
    expect(body.trackerError).toContain('LINEAR_API_KEY');
  } finally {
    if (previous === undefined) {
      delete process.env.LINEAR_API_KEY;
    } else {
      process.env.LINEAR_API_KEY = previous;
    }
    if (previousDisableLocalEnv === undefined) {
      delete process.env.SBER_DESIGNER_DISABLE_LOCAL_ENV_LOAD;
    } else {
      process.env.SBER_DESIGNER_DISABLE_LOCAL_ENV_LOAD = previousDisableLocalEnv;
    }
  }
});

test('fetchLinearTasks reads issues from the linked Linear project URL', async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.LINEAR_API_KEY;
  const previousDisableLocalEnv = process.env.SBER_DESIGNER_DISABLE_LOCAL_ENV_LOAD;
  process.env.LINEAR_API_KEY = 'linear-test-key';
  process.env.SBER_DESIGNER_DISABLE_LOCAL_ENV_LOAD = '1';

  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      query?: string;
      variables?: Record<string, unknown>;
    };
    expect(body.query).toContain('projects(');
    expect(body.query).not.toContain('assignedIssues');
    expect(body.variables?.projectSlugId).toBe('sber-designer-b647c2f2ca05');
    return new Response(
      JSON.stringify({
        data: {
          projects: {
            nodes: [
              {
                issues: {
                  nodes: [
                    {
                      id: 'issue-1',
                      title: 'Fix comment alignment',
                      description: 'Comment badge is shifted up.',
                      url: 'https://linear.app/acme/issue/SD-1/fix-comment-alignment',
                      state: { name: 'Todo' },
                      priority: 2,
                    },
                  ],
                },
              },
            ],
          },
        },
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  }) as typeof fetch;

  try {
    const tasks = await fetchLinearTasks(
      {
        type: 'linear',
        projectUrl: 'https://linear.app/acme/project/sber-designer-b647c2f2ca05/issues',
      },
      {
        version: 1,
        name: 'Linear project',
        workspacePath: '/workspace',
        screens: [],
        flow: [],
      },
    );

    expect(tasks).toEqual([
      {
        id: 'linear-issue-1',
        title: 'Fix comment alignment',
        description: 'Comment badge is shifted up.',
        url: 'https://linear.app/acme/issue/SD-1/fix-comment-alignment',
        source: 'linear',
        screenIds: [],
        status: 'Todo',
        priority: '2',
      },
    ]);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) {
      delete process.env.LINEAR_API_KEY;
    } else {
      process.env.LINEAR_API_KEY = previousKey;
    }
    if (previousDisableLocalEnv === undefined) {
      delete process.env.SBER_DESIGNER_DISABLE_LOCAL_ENV_LOAD;
    } else {
      process.env.SBER_DESIGNER_DISABLE_LOCAL_ENV_LOAD = previousDisableLocalEnv;
    }
  }
});

test('fetchLinearTasks attaches Linear issues to screens mentioned in the issue text', async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.LINEAR_API_KEY;
  const previousDisableLocalEnv = process.env.SBER_DESIGNER_DISABLE_LOCAL_ENV_LOAD;
  process.env.LINEAR_API_KEY = 'linear-test-key';
  process.env.SBER_DESIGNER_DISABLE_LOCAL_ENV_LOAD = '1';

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        data: {
          projects: {
            nodes: [
              {
                issues: {
                  nodes: [
                    {
                      id: 'issue-2',
                      title: 'Изменить название кнопки',
                      description: 'Экран для изменения: Analyst dashboard.',
                      url: 'https://linear.app/acme/issue/SD-2/button-copy',
                      state: { name: 'Todo' },
                      priority: 0,
                    },
                  ],
                },
              },
            ],
          },
        },
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    )) as typeof fetch;

  try {
    const tasks = await fetchLinearTasks(
      {
        type: 'linear',
        projectUrl: 'https://linear.app/acme/project/sber-designer-b647c2f2ca05/issues',
      },
      {
        version: 1,
        name: 'Linear project',
        workspacePath: '/workspace',
        screens: [
          {
            id: 'screen-analyst-dashboard',
            name: 'Analyst Dashboard',
            kind: 'story',
            storyId: 'screens-demo--analyst-dashboard-screen',
          },
        ],
        flow: [],
      },
    );

    expect(tasks[0]?.screenIds).toEqual(['screen-analyst-dashboard']);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) {
      delete process.env.LINEAR_API_KEY;
    } else {
      process.env.LINEAR_API_KEY = previousKey;
    }
    if (previousDisableLocalEnv === undefined) {
      delete process.env.SBER_DESIGNER_DISABLE_LOCAL_ENV_LOAD;
    } else {
      process.env.SBER_DESIGNER_DISABLE_LOCAL_ENV_LOAD = previousDisableLocalEnv;
    }
  }
});
