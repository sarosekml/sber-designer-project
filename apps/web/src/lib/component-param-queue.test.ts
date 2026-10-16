import { describe, expect, test } from 'bun:test';
import type { DesignTarget, VisualChange } from '@/lib/design-types';

import {
  componentParamContextKey,
  createComponentParamApplyQueue,
  type ComponentParamApplyResult,
  type ComponentParamQueueEntry,
} from './component-param-queue';

function target(id: string, filePath: string, line = 4): DesignTarget {
  return {
    id,
    loc: `${filePath}:${line}:5`,
    filePath,
    line,
    column: 5,
    tagName: 'BUTTON',
    rect: { x: 0, y: 0, width: 80, height: 32 },
    sourceKind: 'react-source',
  };
}

function change(targetId: string, filePath: string, prop: string, value: string): VisualChange {
  return {
    kind: 'set-prop',
    targetId,
    filePath,
    loc: { line: 4, column: 5 },
    name: prop,
    value: JSON.stringify(value),
    label: prop,
  };
}

function entry(input: {
  workspacePath: string;
  targetId: string;
  filePath: string;
  prop: string;
  value: string;
  baseline?: string;
  reload?: () => Promise<void>;
}): ComponentParamQueueEntry {
  const selected = target(input.targetId, input.filePath);
  const visualChange = change(input.targetId, input.filePath, input.prop, input.value);
  return {
    contextKey: componentParamContextKey({
      workspacePath: input.workspacePath,
      target: selected,
      change: visualChange,
    }),
    workspacePath: input.workspacePath,
    target: selected,
    baseline: { filePath: input.filePath, hash: input.baseline ?? 'hash-1' },
    prop: input.prop,
    value: input.value,
    change: visualChange,
    reload: input.reload ?? (async () => undefined),
  };
}

function result(filePath: string, hash: string): ComponentParamApplyResult {
  return {
    changedFiles: [filePath],
    ops: [{ kind: 'set-prop', file: filePath }],
    diffs: [{ path: filePath, before: '', after: '' }],
    baselines: [{ filePath, hash }],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('ComponentParamApplyQueue', () => {
  test('keeps workspace and target snapshots isolated across selection changes', async () => {
    const first = deferred<ComponentParamApplyResult>();
    const applyCalls: Array<{
      workspacePath?: string;
      target: DesignTarget;
      changes: VisualChange[];
    }> = [];
    let call = 0;
    const queue = createComponentParamApplyQueue({
      apply: async (input) => {
        applyCalls.push(input);
        call += 1;
        return call === 1 ? first.promise : result(input.changes[0]!.filePath, `hash-${call + 1}`);
      },
      isCurrentContext: () => false,
    });

    const a = entry({
      workspacePath: '/workspace-a',
      targetId: 'target-a',
      filePath: 'src/A.tsx',
      prop: 'size',
      value: 'sm',
    });
    const b = entry({
      workspacePath: '/workspace-b',
      targetId: 'target-b',
      filePath: 'src/B.tsx',
      prop: 'size',
      value: 'lg',
    });
    queue.enqueue(a);
    await Promise.resolve();
    queue.enqueue(b);
    first.resolve(result('src/A.tsx', 'hash-a2'));
    await queue.whenIdle();

    expect(applyCalls).toHaveLength(2);
    expect(applyCalls[0]).toMatchObject({
      workspacePath: '/workspace-a',
      target: { id: 'target-a' },
      changes: [{ filePath: 'src/A.tsx', name: 'size' }],
    });
    expect(applyCalls[1]).toMatchObject({
      workspacePath: '/workspace-b',
      target: { id: 'target-b' },
      changes: [{ filePath: 'src/B.tsx', name: 'size' }],
    });
  });

  test('uses the server baseline for the next in-flight batch', async () => {
    const first = deferred<ComponentParamApplyResult>();
    const baselines: string[] = [];
    let call = 0;
    const queue = createComponentParamApplyQueue({
      apply: async (input) => {
        baselines.push(input.baseline.hash);
        call += 1;
        return call === 1 ? first.promise : result('src/A.tsx', 'hash-3');
      },
      isCurrentContext: () => false,
    });
    const initial = entry({
      workspacePath: '/workspace',
      targetId: 'target',
      filePath: 'src/A.tsx',
      prop: 'size',
      value: 'sm',
    });
    queue.enqueue(initial);
    await Promise.resolve();
    queue.enqueue({
      ...initial,
      prop: 'disabled',
      value: 'true',
      change: change('target', 'src/A.tsx', 'disabled', 'true'),
    });
    first.resolve(result('src/A.tsx', 'hash-2'));
    await queue.whenIdle();

    expect(baselines).toEqual(['hash-1', 'hash-2']);
  });

  test('accepts a fresh inspect baseline when the same context is edited later', async () => {
    const baselines: string[] = [];
    const queue = createComponentParamApplyQueue({
      apply: async (input) => {
        baselines.push(input.baseline.hash);
        return result('src/A.tsx', `server-${baselines.length}`);
      },
      isCurrentContext: () => false,
    });
    const first = entry({
      workspacePath: '/workspace',
      targetId: 'target',
      filePath: 'src/A.tsx',
      prop: 'size',
      value: 'sm',
      baseline: 'inspect-1',
    });
    queue.enqueue(first);
    await queue.whenIdle();
    queue.enqueue({
      ...first,
      value: 'lg',
      baseline: { filePath: 'src/A.tsx', hash: 'inspect-2' },
      change: change('target', 'src/A.tsx', 'size', 'lg'),
    });
    await queue.whenIdle();

    expect(baselines).toEqual(['inspect-1', 'inspect-2']);
  });

  test('coalesces only the same prop in the same component context', async () => {
    const blocker = deferred<ComponentParamApplyResult>();
    const applied: VisualChange[][] = [];
    let call = 0;
    const queue = createComponentParamApplyQueue({
      apply: async (input) => {
        applied.push(input.changes);
        call += 1;
        return call === 1 ? blocker.promise : result(input.changes[0]!.filePath, 'next');
      },
      isCurrentContext: () => false,
    });
    const blocking = entry({
      workspacePath: '/workspace',
      targetId: 'blocker',
      filePath: 'src/Blocker.tsx',
      prop: 'tone',
      value: 'first',
    });
    const pending = entry({
      workspacePath: '/workspace',
      targetId: 'target',
      filePath: 'src/A.tsx',
      prop: 'size',
      value: 'sm',
    });
    queue.enqueue(blocking);
    await Promise.resolve();
    queue.enqueue(pending);
    queue.enqueue({
      ...pending,
      value: 'lg',
      change: change('target', 'src/A.tsx', 'size', 'lg'),
    });
    blocker.resolve(result('src/Blocker.tsx', 'blocker-2'));
    await queue.whenIdle();

    expect(applied).toHaveLength(2);
    expect(applied[1]).toMatchObject([{ name: 'size', value: '"lg"' }]);
  });

  test('drops only the failed context and continues unrelated queued writes', async () => {
    const errors: Array<{ context: string; props: string[] }> = [];
    const appliedTargets: string[] = [];
    const queue = createComponentParamApplyQueue({
      apply: async (input) => {
        appliedTargets.push(input.target.id);
        if (input.target.id === 'target-a') throw new Error('stale baseline');
        return result(input.changes[0]!.filePath, 'next');
      },
      isCurrentContext: () => false,
      onContextError: (failed, props) => {
        errors.push({ context: failed.contextKey, props });
      },
    });
    const a = entry({
      workspacePath: '/workspace',
      targetId: 'target-a',
      filePath: 'src/A.tsx',
      prop: 'size',
      value: 'sm',
    });
    const b = entry({
      workspacePath: '/workspace',
      targetId: 'target-b',
      filePath: 'src/B.tsx',
      prop: 'size',
      value: 'lg',
    });
    queue.enqueue(a);
    queue.enqueue(b);
    await queue.whenIdle();

    expect(appliedTargets).toEqual(['target-a', 'target-b']);
    expect(errors).toEqual([{ context: a.contextKey, props: ['size'] }]);
  });
});
