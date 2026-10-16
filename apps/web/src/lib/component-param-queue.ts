/**
 * Sequential instant-apply queue for Component params (task 0133).
 *
 * Every entry owns an immutable workspace/target snapshot. Pending changes are
 * coalesced only inside that exact component usage, and a fresh server baseline
 * is carried into the next batch so rapid clicks do not disable conflict checks.
 */
import type { DesignTarget, VisualChange } from '@/lib/design-types';

export interface ComponentParamBaseline {
  filePath: string;
  hash: string;
}

export interface ComponentParamQueueEntry {
  contextKey: string;
  workspacePath?: string | undefined;
  screenId?: string | undefined;
  target: DesignTarget;
  baseline: ComponentParamBaseline;
  prop: string;
  value: string | null;
  change: VisualChange;
  reload: () => Promise<void>;
}

export interface ComponentParamApplyResult {
  changedFiles: string[];
  ops: Array<{ kind: string; file: string }>;
  diffs: Array<{ path: string; before: string; after: string }>;
  baselines: ComponentParamBaseline[];
}

export interface ComponentParamQueueHost {
  apply: (input: {
    workspacePath?: string;
    screenId?: string;
    target: DesignTarget;
    changes: VisualChange[];
    baseline: ComponentParamBaseline;
  }) => Promise<ComponentParamApplyResult>;
  isCurrentContext: (contextKey: string) => boolean;
  onBatchStart?: (entry: ComponentParamQueueEntry) => void;
  onBatchApplied?: (entry: ComponentParamQueueEntry, result: ComponentParamApplyResult) => void;
  onContextSettled?: (entry: ComponentParamQueueEntry) => void;
  onContextError?: (
    entry: ComponentParamQueueEntry,
    droppedProps: string[],
    error: unknown,
  ) => void;
}

export interface ComponentParamApplyQueue {
  enqueue(entry: ComponentParamQueueEntry): void;
  whenIdle(): Promise<void>;
  reset(): void;
}

export function createComponentParamApplyQueue(
  host: ComponentParamQueueHost,
): ComponentParamApplyQueue {
  const pending = new Map<string, ComponentParamQueueEntry>();
  const baselines = new Map<string, ComponentParamBaseline>();
  let flushing = false;
  let idleWaiters: Array<() => void> = [];

  const hasPendingContext = (contextKey: string) =>
    Array.from(pending.values()).some((entry) => entry.contextKey === contextKey);

  const dropPendingContext = (contextKey: string): string[] => {
    const props: string[] = [];
    for (const [key, entry] of pending) {
      if (entry.contextKey !== contextKey) continue;
      props.push(entry.prop);
      pending.delete(key);
    }
    return props;
  };

  const finishIdle = () => {
    if (flushing || pending.size > 0) return;
    const waiters = idleWaiters;
    idleWaiters = [];
    for (const resolve of waiters) resolve();
  };

  const flush = async () => {
    if (flushing) return;
    flushing = true;
    try {
      while (pending.size > 0) {
        const first = pending.values().next().value as ComponentParamQueueEntry | undefined;
        if (!first) break;

        const entries: ComponentParamQueueEntry[] = [];
        for (const [key, entry] of pending) {
          if (entry.contextKey !== first.contextKey) continue;
          entries.push(entry);
          pending.delete(key);
        }
        if (entries.length === 0) continue;

        const baseline = baselines.get(first.contextKey) ?? first.baseline;
        host.onBatchStart?.(first);
        try {
          const result = await host.apply({
            ...(first.workspacePath ? { workspacePath: first.workspacePath } : {}),
            ...(first.screenId ? { screenId: first.screenId } : {}),
            target: first.target,
            changes: entries.map((entry) => entry.change),
            baseline,
          });
          const nextBaseline = result.baselines.find(
            (candidate) => candidate.filePath === baseline.filePath,
          );
          if (nextBaseline) baselines.set(first.contextKey, nextBaseline);
          host.onBatchApplied?.(first, result);
        } catch (error) {
          const droppedProps = [
            ...entries.map((entry) => entry.prop),
            ...dropPendingContext(first.contextKey),
          ];
          baselines.delete(first.contextKey);
          host.onContextError?.(first, Array.from(new Set(droppedProps)), error);
          continue;
        }

        if (hasPendingContext(first.contextKey)) continue;
        if (host.isCurrentContext(first.contextKey)) {
          await first.reload().catch(() => undefined);
        }
        if (!hasPendingContext(first.contextKey)) {
          baselines.delete(first.contextKey);
          host.onContextSettled?.(first);
        }
      }
    } finally {
      flushing = false;
      finishIdle();
      // An enqueue can land after the loop condition but before `flushing`
      // flips back. Start another pass instead of leaving that entry stranded.
      if (pending.size > 0) void flush();
    }
  };

  return {
    enqueue(entry) {
      if (!baselines.has(entry.contextKey)) {
        baselines.set(entry.contextKey, entry.baseline);
      }
      pending.set(`${entry.contextKey}:${entry.prop}`, entry);
      void flush();
    },

    whenIdle() {
      if (!flushing && pending.size === 0) return Promise.resolve();
      return new Promise<void>((resolve) => idleWaiters.push(resolve));
    },

    reset() {
      pending.clear();
      baselines.clear();
      finishIdle();
    },
  };
}

export function componentParamContextKey(input: {
  workspacePath?: string | undefined;
  target: DesignTarget;
  change: VisualChange;
}): string {
  const change = input.change;
  return [
    input.workspacePath ?? '',
    input.target.id,
    change.filePath,
    change.loc.line,
    change.loc.column,
  ].join(':');
}
