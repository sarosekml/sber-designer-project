import { expect, test } from 'bun:test';
import type { ProjectFlowEdge } from '@sber-designer/shared-types';

import {
  bridgeRuntimeEdges,
  isExecutableEdge,
  matchLinkEdge,
  transitionStatusLabel,
} from '../apps/web/src/lib/flow-runtime';

const baseEdge = {
  fromScreenId: 'screen-a',
  toScreenId: 'screen-b',
} satisfies Pick<ProjectFlowEdge, 'fromScreenId' | 'toScreenId'>;

test('click edges need a selector or label before they run', () => {
  const edge: ProjectFlowEdge = {
    ...baseEdge,
    id: 'empty-click',
    trigger: { kind: 'click' },
  };

  expect(isExecutableEdge(edge)).toBe(false);
  expect(transitionStatusLabel(edge)).toBe('Needs setup');
});

test('bridge runtime includes only configured click and link edges', () => {
  const edges: ProjectFlowEdge[] = [
    { ...baseEdge, id: 'manual', trigger: { kind: 'manual', label: 'Diagram only' } },
    { ...baseEdge, id: 'empty-click', trigger: { kind: 'click' } },
    { ...baseEdge, id: 'click-label', trigger: { kind: 'click', label: 'Approve' } },
    {
      ...baseEdge,
      id: 'click-selector',
      presentation: 'overlay',
      trigger: { kind: 'click', selector: '[data-sd-flow-id="approve"]' },
    },
    { ...baseEdge, id: 'empty-link', trigger: { kind: 'link', href: '   ' } },
    { ...baseEdge, id: 'link', trigger: { kind: 'link', href: '/funds' } },
    { ...baseEdge, id: 'mount', trigger: { kind: 'on-mount' } },
  ];

  expect(bridgeRuntimeEdges(edges)).toEqual([
    {
      id: 'click-label',
      toScreenId: 'screen-b',
      trigger: { kind: 'click', label: 'Approve' },
    },
    {
      id: 'click-selector',
      toScreenId: 'screen-b',
      trigger: { kind: 'click', selector: '[data-sd-flow-id="approve"]' },
    },
    {
      id: 'link',
      toScreenId: 'screen-b',
      trigger: { kind: 'link', href: '/funds' },
    },
  ]);
});

test('blank link href never matches every anchor', () => {
  const edges: ProjectFlowEdge[] = [
    { ...baseEdge, id: 'empty-link', trigger: { kind: 'link', href: '' } },
  ];

  expect(matchLinkEdge(edges, '/funds')).toBeUndefined();
});

test('html link edges normalize page-relative and preview URLs', () => {
  const edges: ProjectFlowEdge[] = [
    { ...baseEdge, id: 'checkout', trigger: { kind: 'link', href: 'pages/checkout.html' } },
  ];

  for (const href of [
    'pages/checkout.html',
    './pages/checkout.html',
    '/pages/checkout.html',
    './checkout.html',
    'checkout.html',
    'http://localhost:5173/pages/checkout.html',
    'http://localhost:5173/preview/pages/checkout.html?screen=checkout',
  ]) {
    expect(matchLinkEdge(edges, href)?.id).toBe('checkout');
  }

  expect(matchLinkEdge(edges, 'pages/settings.html')).toBeUndefined();
});
