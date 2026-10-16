import { expect, test } from 'bun:test';

import {
  designCapabilityAllows,
  designCapabilityReason,
  hasDesignSourceTarget,
} from '../apps/web/src/lib/design-capabilities';
import type { DesignInspectResult } from '../apps/web/src/lib/design-types';

test('design capabilities allow direct edits independently of legacy editable flag', () => {
  const info = inspectResult({
    editable: false,
    capabilities: {
      props: {
        status: 'editable',
        operations: ['set-prop', 'remove-prop'],
      },
    },
  });

  expect(hasDesignSourceTarget(info)).toBe(true);
  expect(designCapabilityAllows(info, 'props', 'set-prop')).toBe(true);
  expect(designCapabilityAllows(info, 'props', 'set-style')).toBe(false);
});

test('design capability reason prefers capability-level lock reasons', () => {
  const info = inspectResult({
    editable: true,
    reason: 'Legacy bridge says editable.',
    capabilities: {
      style: {
        status: 'assistant-only',
        operations: [],
        reason: 'Style is a computed expression.',
      },
    },
  });

  expect(designCapabilityReason(info, ['style'], 'Fallback reason.')).toBe(
    'Style is a computed expression.',
  );
});

function inspectResult(
  overrides: Partial<DesignInspectResult> & {
    capabilities?: Partial<DesignInspectResult['capabilities']>;
  } = {},
): DesignInspectResult {
  const defaultCapability = { status: 'unmapped' as const, operations: [] };
  return {
    target: {
      id: 'target-1',
      loc: 'src/App.tsx:10:5',
      filePath: 'src/App.tsx',
      line: 10,
      column: 5,
      sourceKind: 'react-source',
      tagName: 'button',
      rect: { x: 0, y: 0, width: 120, height: 32 },
    },
    editable: true,
    projectSupport: 'design-readable',
    sourceScope: 'screen-instance',
    capabilities: {
      text: defaultCapability,
      props: defaultCapability,
      style: defaultCapability,
      className: defaultCapability,
      insert: defaultCapability,
      ...overrides.capabilities,
    },
    diagnostics: [],
    ...overrides,
  };
}
