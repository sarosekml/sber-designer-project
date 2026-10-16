import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReactFlowProvider, type NodeProps } from '@xyflow/react';
import type { ProjectScreen } from '@sber-designer/shared-types';

import { normalizeFlowView } from '@/lib/flow-view';
import { FlowScreenNode, type ScreenFlowNode } from './FlowScreenNode';

function screenFixture(): ProjectScreen {
  return {
    id: 'screen-1',
    name: 'Funds overview',
    kind: 'blank',
    surface: 'app',
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
  } as ProjectScreen;
}

function renderNode(selected: boolean): string {
  const props = {
    data: {
      screen: screenFixture(),
      flowView: normalizeFlowView(undefined),
      livePreviewAllowed: false,
      previewFrameWidth: 196,
      previewRefreshKey: 0,
    },
    selected,
  } as unknown as NodeProps<ScreenFlowNode>;
  return renderToStaticMarkup(
    <ReactFlowProvider>
      <FlowScreenNode {...props} />
    </ReactFlowProvider>,
  );
}

test('selected flow node carries the primary ring and active attributes', () => {
  const html = renderNode(true);
  expect(html).toContain('data-active-screen="true"');
  expect(html).toContain('aria-current="true"');
  expect(html).toContain('aria-label="Funds overview"');
  expect(html).toContain('border-primary');
  expect(html).toContain('ring-2');
  expect(html).toContain('ring-primary');
});

test('unselected flow node has no ring and no active attributes', () => {
  const html = renderNode(false);
  expect(html).not.toContain('data-active-screen');
  expect(html).not.toContain('aria-current');
  expect(html).not.toContain('ring-primary');
  expect(html).toContain('border-border');
  // The screen name stays available as the accessible content either way.
  expect(html).toContain('Funds overview');
});
