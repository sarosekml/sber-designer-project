import { expect, test } from 'bun:test';
import type { ProjectFlowEdge, ProjectScreen } from '@sber-designer/shared-types';

import {
  FLOW_HANDLES,
  createFlowEdgeFromConnection,
  flowEdgeHandles,
  outgoingFlowEdges,
} from '../apps/web/src/lib/flow-graph';

const aiAnalysis: ProjectScreen = {
  id: 'ai-analysis',
  name: 'AI Analysis',
  kind: 'page',
  filePath: 'src/pages/AiAnalysis.tsx',
  position: { x: 0, y: 80 },
};

const changes: ProjectScreen = {
  id: 'changes',
  name: 'Changes',
  kind: 'page',
  filePath: 'src/pages/Changes.tsx',
  position: { x: 420, y: 80 },
};

test('flow edges keep opposite directions as separate outgoing transitions', () => {
  const forward = createFlowEdgeFromConnection(
    { source: aiAnalysis.id, target: changes.id },
    [],
    1000,
  );
  if (!forward) throw new Error('Expected forward edge');
  expect(forward).toEqual({
    id: 'flow-1000-ai-analysis-changes',
    fromScreenId: aiAnalysis.id,
    toScreenId: changes.id,
    trigger: { kind: 'click' },
  });

  const backward = createFlowEdgeFromConnection(
    { source: changes.id, target: aiAnalysis.id },
    [forward],
    1001,
  );
  if (!backward) throw new Error('Expected backward edge');
  expect(backward).toEqual({
    id: 'flow-1001-changes-ai-analysis',
    fromScreenId: changes.id,
    toScreenId: aiAnalysis.id,
    trigger: { kind: 'click' },
  });

  const edges = [forward, backward];

  expect(outgoingFlowEdges(edges, aiAnalysis.id).map((edge) => edge.id)).toEqual([forward?.id]);
  expect(outgoingFlowEdges(edges, changes.id).map((edge) => edge.id)).toEqual([backward?.id]);
});

test('flow edges choose handles from source position to target position', () => {
  const screens = [aiAnalysis, changes];
  const forward: ProjectFlowEdge = {
    id: 'forward',
    fromScreenId: aiAnalysis.id,
    toScreenId: changes.id,
    trigger: { kind: 'click', label: 'Next' },
  };
  const backward: ProjectFlowEdge = {
    id: 'backward',
    fromScreenId: changes.id,
    toScreenId: aiAnalysis.id,
    trigger: { kind: 'click', label: 'Back' },
  };

  expect(flowEdgeHandles(forward, screens)).toEqual({
    sourceHandle: FLOW_HANDLES.sourceRight,
    targetHandle: FLOW_HANDLES.targetLeft,
  });
  expect(flowEdgeHandles(backward, screens)).toEqual({
    sourceHandle: FLOW_HANDLES.sourceLeft,
    targetHandle: FLOW_HANDLES.targetRight,
  });
});
