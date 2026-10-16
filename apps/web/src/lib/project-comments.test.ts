import { describe, expect, test } from 'bun:test';
import type { SberDesignerProject } from '@sber-designer/shared-types';

import {
  addProjectComment,
  commentsForScreen,
  deleteProjectComment,
  normalizedAnchorFromClientPoint,
  resolveCommentContext,
  updateProjectCommentBody,
} from './project-comments';

const baseProject: SberDesignerProject = {
  version: 1,
  name: 'Demo',
  workspacePath: '/tmp/demo',
  screens: [
    { id: 'screen-a', name: 'Screen A', kind: 'page', filePath: 'src/A.tsx' },
    { id: 'screen-b', name: 'Screen B', kind: 'page', filePath: 'src/B.tsx' },
  ],
  flow: [],
};

describe('project comments', () => {
  test('adds a comment thread without mutating the original project', () => {
    const next = addProjectComment(
      baseProject,
      {
        screenId: 'screen-a',
        anchor: { x: 0.25, y: 0.75 },
        body: 'Check this CTA label',
      },
      { now: () => 123, id: () => 'comment-1' },
    );

    expect(baseProject.comments).toBeUndefined();
    expect(next.comments).toHaveLength(1);
    expect(next.comments?.[0]).toMatchObject({
      id: 'comment-1',
      screenId: 'screen-a',
      anchor: { x: 0.25, y: 0.75 },
      status: 'open',
      createdAt: 123,
      updatedAt: 123,
      messages: [
        {
          id: 'comment-1-message',
          authorName: 'You',
          body: 'Check this CTA label',
          createdAt: 123,
        },
      ],
    });
  });

  test('filters comments by screen and hides resolved threads by default', () => {
    const project = {
      ...baseProject,
      comments: [
        comment('open-a', 'screen-a', 'open'),
        comment('resolved-a', 'screen-a', 'resolved'),
        comment('open-b', 'screen-b', 'open'),
      ],
    };

    expect(commentsForScreen(project, 'screen-a').map((thread) => thread.id)).toEqual(['open-a']);
    expect(
      commentsForScreen(project, 'screen-a', { includeResolved: true }).map((thread) => thread.id),
    ).toEqual(['open-a', 'resolved-a']);
  });

  test('updates and deletes comment threads immutably', () => {
    const project = { ...baseProject, comments: [comment('comment-1', 'screen-a', 'open')] };
    const updated = updateProjectCommentBody(project, 'comment-1', 'Updated body', {
      now: () => 456,
    });
    const deleted = deleteProjectComment(updated, 'comment-1');

    expect(project.comments[0]?.messages[0]?.body).toBe('Body comment-1');
    expect(updated.comments?.[0]?.messages[0]?.body).toBe('Updated body');
    expect(updated.comments?.[0]?.updatedAt).toBe(456);
    expect(deleted.comments).toEqual([]);
  });

  test('normalizes client coordinates to a clamped screen anchor', () => {
    const rect = { left: 100, top: 50, width: 800, height: 400 };

    expect(normalizedAnchorFromClientPoint(rect, 300, 150)).toEqual({ x: 0.25, y: 0.25 });
    expect(normalizedAnchorFromClientPoint(rect, 1200, -50)).toEqual({ x: 1, y: 0 });
  });

  test('resolves assistant comment context for all, custom, and none modes', () => {
    const project = {
      ...baseProject,
      comments: [
        comment('open-a', 'screen-a', 'open'),
        comment('resolved-a', 'screen-a', 'resolved'),
        comment('open-b', 'screen-b', 'open'),
      ],
    };

    expect(
      resolveCommentContext(project, 'screen-a', 'all', []).map((thread) => thread.id),
    ).toEqual(['open-a']);
    expect(
      resolveCommentContext(project, 'screen-a', 'custom', ['open-a', 'open-b']).map(
        (thread) => thread.id,
      ),
    ).toEqual(['open-a']);
    expect(resolveCommentContext(project, 'screen-a', 'none', ['open-a'])).toEqual([]);
  });
});

function comment(id: string, screenId: string, status: 'open' | 'resolved') {
  return {
    id,
    screenId,
    anchor: { x: 0.5, y: 0.5 },
    status,
    createdAt: 1,
    updatedAt: 1,
    messages: [{ id: `${id}-message`, authorName: 'You', body: `Body ${id}`, createdAt: 1 }],
  };
}
