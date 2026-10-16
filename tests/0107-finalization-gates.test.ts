import { expect, test } from 'bun:test';

import {
  finalizationFailureStatus,
  finalizationTaskKindFromComponentPack,
  runFinalizationGates,
  shouldRetryAutomaticCraftRepair,
  type RunFinalizationGate,
} from '../services/api/src/routes/chat-stream/finalization-gates';
import type { TaskRelevantComponentPack } from '../services/api/src/component-intelligence/component-pack';

test('finalization gate severity is data-driven by gate id and task kind', () => {
  expect(
    finalizationFailureStatus({
      gateId: 'component_replacement',
      taskKind: 'screen_generation',
      changedTargetCount: 1,
    }),
  ).toBe('failed');
  expect(
    finalizationFailureStatus({
      gateId: 'component_role_contract',
      taskKind: 'screen_generation',
      changedTargetCount: 1,
    }),
  ).toBe('needs_review');
  expect(
    finalizationFailureStatus({
      gateId: 'component_role_contract',
      taskKind: 'screen_generation',
      changedTargetCount: 0,
    }),
  ).toBe('failed');
  expect(
    finalizationFailureStatus({
      gateId: 'story_identity',
      taskKind: 'screen_edit',
      changedTargetCount: 1,
    }),
  ).toBe('failed');
});

test('finalization task kind follows component-pack task kind without importing component logic', () => {
  expect(
    finalizationTaskKindFromComponentPack({
      status: 'ready',
      source: 'design-index',
      stale: false,
      taskKind: 'image-to-screen',
      candidates: [],
      diagnostics: [],
    } satisfies TaskRelevantComponentPack),
  ).toBe('screen_generation');
  expect(
    finalizationTaskKindFromComponentPack({
      status: 'ready',
      source: 'design-index',
      stale: false,
      taskKind: 'screen-redesign',
      candidates: [],
      diagnostics: [],
    } satisfies TaskRelevantComponentPack),
  ).toBe('screen_redesign');
  expect(finalizationTaskKindFromComponentPack(null)).toBe('unknown');
});

test('automatic craft repair stays generation-scoped and never broadens a local screen edit', () => {
  expect(shouldRetryAutomaticCraftRepair('screen_generation')).toBe(true);
  expect(shouldRetryAutomaticCraftRepair('screen_redesign')).toBe(true);
  expect(shouldRetryAutomaticCraftRepair('screen_edit')).toBe(false);
  expect(shouldRetryAutomaticCraftRepair('unknown')).toBe(false);
});

test('finalization gate driver runs applicable gates in order and stops at first decision', async () => {
  const calls: string[] = [];
  const gates: RunFinalizationGate<{ changedTargetCount: number }>[] = [
    {
      id: 'preview_freshness',
      applies: () => false,
      run: () => {
        calls.push('preview_freshness');
        return null;
      },
    },
    {
      id: 'component_role_contract',
      applies: () => true,
      run: () => {
        calls.push('component_role_contract');
        return {
          summary: 'Role contract was not satisfied.',
          notice: 'role contract notice',
        };
      },
    },
    {
      id: 'render_acceptance',
      applies: () => true,
      run: () => {
        calls.push('render_acceptance');
        return null;
      },
    },
  ];

  const decision = await runFinalizationGates(
    {
      taskKind: 'screen_generation',
      changedTargetCount: 1,
    },
    gates,
  );

  expect(calls).toEqual(['component_role_contract']);
  expect(decision).toMatchObject({
    gateId: 'component_role_contract',
    status: 'needs_review',
    summary: 'Role contract was not satisfied.',
  });
});

test('finalization gate driver uses suggestedStatus only when severity table has no entry', async () => {
  const gates: RunFinalizationGate<{ changedTargetCount: number }>[] = [
    {
      id: 'future_gate' as never,
      applies: () => true,
      run: () => ({
        suggestedStatus: 'needs_review',
        summary: 'Future gate needs manual review.',
        notice: 'future gate notice',
      }),
    },
  ];

  const decision = await runFinalizationGates(
    {
      taskKind: 'screen_edit',
      changedTargetCount: 1,
    },
    gates,
  );

  expect(decision).toMatchObject({
    gateId: 'future_gate',
    status: 'needs_review',
    summary: 'Future gate needs manual review.',
  });
});
