import { expect, test } from 'bun:test';
import type { ProjectFlowEdge, ProjectScreen } from '@sber-designer/shared-types';

import {
  resolveBaseEdgeActivation,
  resolveOverlayEdgeActivation,
  shouldCloseStaleOverlay,
} from './overlay-runtime';

const screens: ProjectScreen[] = [
  { id: 'list', name: 'List', kind: 'page' },
  { id: 'confirm', name: 'Delete confirm', kind: 'page', surface: 'modal' },
  { id: 'detail', name: 'Detail', kind: 'page' },
];

const edge = (over: Partial<ProjectFlowEdge>): ProjectFlowEdge => ({
  id: 'e',
  fromScreenId: 'list',
  toScreenId: 'confirm',
  trigger: { kind: 'click', label: 'Delete' },
  ...over,
});

test('base edge into a modal opens an overlay; into a page navigates (Р-5)', () => {
  expect(resolveBaseEdgeActivation(edge({ toScreenId: 'confirm' }), screens)).toEqual({
    kind: 'open-overlay',
    screenId: 'confirm',
  });
  expect(resolveBaseEdgeActivation(edge({ toScreenId: 'detail' }), screens)).toEqual({
    kind: 'navigate',
    screenId: 'detail',
  });
});

test('explicit presentation overrides the target-derived base default', () => {
  expect(
    resolveBaseEdgeActivation(edge({ toScreenId: 'confirm', presentation: 'navigate' }), screens),
  ).toEqual({ kind: 'navigate', screenId: 'confirm' });
  expect(
    resolveBaseEdgeActivation(edge({ toScreenId: 'detail', presentation: 'overlay' }), screens),
  ).toEqual({ kind: 'open-overlay', screenId: 'detail' });
});

test('an overlay closes when its live underlay changes externally', () => {
  expect(shouldCloseStaleOverlay('list', 'list')).toBe(false);
  expect(shouldCloseStaleOverlay('list', 'detail')).toBe(true);
  expect(shouldCloseStaleOverlay(null, 'detail')).toBe(false);
});

test('overlay Cancel back to the underlay just closes (Р-6)', () => {
  expect(
    resolveOverlayEdgeActivation(
      edge({ fromScreenId: 'confirm', toScreenId: 'list' }),
      screens,
      'list',
    ),
  ).toEqual({ kind: 'close-overlay' });
});

test('overlay navigate to another screen closes and navigates', () => {
  expect(
    resolveOverlayEdgeActivation(
      edge({ fromScreenId: 'confirm', toScreenId: 'detail' }),
      screens,
      'list',
    ),
  ).toEqual({ kind: 'navigate-and-close', screenId: 'detail' });
});

test('overlay edge into another modal replaces, never stacks (Р-6/Р-8)', () => {
  const screensWithTwoModals: ProjectScreen[] = [
    ...screens,
    { id: 'confirm2', name: 'Second modal', kind: 'page', surface: 'modal' },
  ];
  expect(
    resolveOverlayEdgeActivation(
      edge({ fromScreenId: 'confirm', toScreenId: 'confirm2' }),
      screensWithTwoModals,
      'list',
    ),
  ).toEqual({ kind: 'replace-overlay', screenId: 'confirm2' });
});
