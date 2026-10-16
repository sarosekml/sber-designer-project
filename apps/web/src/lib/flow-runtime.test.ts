import { expect, test } from 'bun:test';
import type { ProjectFlowEdge } from '@sber-designer/shared-types';

import {
  edgeTargetMode,
  matchClickEdge,
  resolveEdgePresentation,
  transitionStatusLabel,
  updateFlowEdgeSettings,
} from './flow-runtime';

const clickEdge = (presentation?: 'navigate' | 'overlay'): ProjectFlowEdge => ({
  id: 'e1',
  fromScreenId: 'a',
  toScreenId: 'b',
  trigger: { kind: 'click', label: 'Delete' },
  ...(presentation ? { presentation } : {}),
});

test('an edge without override follows the target surface (Р-5)', () => {
  expect(resolveEdgePresentation(clickEdge(), { surface: 'modal' })).toBe('overlay');
  expect(resolveEdgePresentation(clickEdge(), { surface: 'page' })).toBe('navigate');
  expect(resolveEdgePresentation(clickEdge(), undefined)).toBe('navigate');
});

test('an explicit presentation overrides the target-derived default', () => {
  // Force full navigation into a modal.
  expect(resolveEdgePresentation(clickEdge('navigate'), { surface: 'modal' })).toBe('navigate');
  // Float a normal page as an overlay.
  expect(resolveEdgePresentation(clickEdge('overlay'), { surface: 'page' })).toBe('overlay');
});

test('saving keeps an explicit presentation even when it equals the current default', () => {
  const edge = clickEdge('overlay');
  const saved = updateFlowEdgeSettings(edge, {
    trigger: edge.trigger,
    presentationOverride: 'overlay',
  });
  expect(saved.presentation).toBe('overlay');
  expect(resolveEdgePresentation(saved, { surface: 'page' })).toBe('overlay');

  const inherited = updateFlowEdgeSettings(edge, { trigger: edge.trigger });
  expect(inherited.presentation).toBeUndefined();
  expect(resolveEdgePresentation(inherited, { surface: 'page' })).toBe('navigate');
});

test('edgeTargetMode and status label reflect the target-aware default', () => {
  expect(edgeTargetMode(clickEdge(), { surface: 'modal' })).toBe('overlay');
  expect(transitionStatusLabel(clickEdge(), { surface: 'modal' })).toBe('Overlay');
  expect(transitionStatusLabel(clickEdge(), { surface: 'page' })).toBe('Runs in Interact + Demo');
});

test('matchClickEdge prefers the underlay-targeted edge for a reused Cancel (Р-19)', () => {
  const cancelFromA: ProjectFlowEdge = {
    id: 'cancel-a',
    fromScreenId: 'modal',
    toScreenId: 'screen-a',
    trigger: { kind: 'click', label: 'Cancel' },
  };
  const cancelFromB: ProjectFlowEdge = {
    id: 'cancel-b',
    fromScreenId: 'modal',
    toScreenId: 'screen-b',
    trigger: { kind: 'click', label: 'Cancel' },
  };
  const edges = [cancelFromA, cancelFromB];
  const target = { closest: () => null, textContent: 'Cancel' };

  // With no preference, the first match wins.
  expect(matchClickEdge(edges, target)?.id).toBe('cancel-a');
  // Prefer the edge whose target is the current underlay.
  expect(matchClickEdge(edges, target, 'screen-b')?.id).toBe('cancel-b');
  expect(matchClickEdge(edges, target, 'screen-a')?.id).toBe('cancel-a');
});
