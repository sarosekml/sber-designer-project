export type ToolMutationRollbackReason = 'cancelled' | 'handler_error' | 'stream_error';

export interface ToolMutationSpec {
  toolName: string;
  changedFiles: string[];
  rollback: () => Promise<void>;
  afterRollback?: (reason: ToolMutationRollbackReason) => Promise<void>;
}

export interface ToolMutationTransaction {
  markMutationStarted(): void;
  markMutated(): Promise<void>;
  checkpoint(): Promise<void>;
  deferCommit(effect: () => Promise<void>): void;
  rollback(reason: ToolMutationRollbackReason): Promise<void>;
}

export interface ToolMutationCoordinator {
  begin(spec: ToolMutationSpec): ToolMutationTransaction;
  settleActive(input: { commit: boolean }): Promise<void>;
  rollbackActive(reason: ToolMutationRollbackReason): Promise<boolean>;
}

interface ActiveToolMutation {
  spec: ToolMutationSpec;
  mutationStarted: boolean;
  mutated: boolean;
  mutationStateSettled: boolean;
  resolveMutationState: () => void;
  mutationState: Promise<void>;
  rollbackReason: ToolMutationRollbackReason | null;
  rollbackPromise: Promise<void> | null;
  commitEffects: Array<() => Promise<void>>;
  closed: boolean;
}

export function createToolMutationCoordinator(signal?: AbortSignal): ToolMutationCoordinator {
  let active: ActiveToolMutation | null = null;

  const onAbort = () => {
    if (active) void requestRollback(active, 'cancelled');
  };
  signal?.addEventListener('abort', onAbort);

  const close = (mutation: ActiveToolMutation) => {
    if (mutation.closed) return;
    mutation.closed = true;
    settleMutationState(mutation);
    if (active === mutation) active = null;
  };

  const requestRollback = async (
    mutation: ActiveToolMutation,
    reason: ToolMutationRollbackReason,
  ): Promise<void> => {
    if (mutation.closed) {
      await mutation.rollbackPromise;
      return;
    }
    mutation.rollbackReason ??= reason;
    if (!mutation.mutationStarted) {
      close(mutation);
      return;
    }
    if (!mutation.mutationStateSettled) await mutation.mutationState;
    if (!mutation.mutated) {
      close(mutation);
      return;
    }
    mutation.rollbackPromise ??= (async () => {
      await mutation.spec.rollback();
      await mutation.spec.afterRollback?.(mutation.rollbackReason ?? reason);
    })();
    await mutation.rollbackPromise;
    close(mutation);
  };

  return {
    begin(spec) {
      if (active && !active.closed) {
        throw new Error(
          `Cannot start ${spec.toolName}; ${active.spec.toolName} mutation is still active.`,
        );
      }
      let resolveMutationState: () => void = () => undefined;
      const mutationState = new Promise<void>((resolve) => {
        resolveMutationState = resolve;
      });
      const mutation: ActiveToolMutation = {
        spec,
        mutationStarted: false,
        mutated: false,
        mutationStateSettled: false,
        resolveMutationState,
        mutationState,
        rollbackReason: signal?.aborted ? 'cancelled' : null,
        rollbackPromise: null,
        commitEffects: [],
        closed: false,
      };
      active = mutation;

      return {
        markMutationStarted() {
          if (mutation.closed || mutation.rollbackReason || signal?.aborted) {
            throw cancellationError(signal);
          }
          mutation.mutationStarted = true;
        },
        async markMutated() {
          if (mutation.closed) throw cancellationError(signal);
          mutation.mutated = true;
          settleMutationState(mutation);
          if (mutation.rollbackReason || signal?.aborted) {
            await requestRollback(mutation, mutation.rollbackReason ?? 'cancelled');
            throw cancellationError(signal);
          }
        },
        async checkpoint() {
          if (!mutation.rollbackReason && !signal?.aborted) return;
          await requestRollback(mutation, mutation.rollbackReason ?? 'cancelled');
          throw cancellationError(signal);
        },
        deferCommit(effect) {
          if (mutation.closed) throw new Error('Cannot defer an effect after mutation settlement.');
          mutation.commitEffects.push(effect);
        },
        rollback(reason) {
          // A handler calls rollback only after a mutation attempt has either
          // completed or failed. Restore the snapshot even when the underlying
          // write threw after making a partial change.
          mutation.mutationStarted = true;
          mutation.mutated = true;
          settleMutationState(mutation);
          return requestRollback(mutation, reason);
        },
      };
    },

    async settleActive({ commit }) {
      const mutation = active;
      if (!mutation) return;
      settleMutationState(mutation);
      if (!commit || mutation.rollbackReason || signal?.aborted) {
        const reason = mutation.rollbackReason ?? (signal?.aborted ? 'cancelled' : 'handler_error');
        await requestRollback(mutation, reason);
        if (reason === 'cancelled') throw cancellationError(signal);
        return;
      }

      const effects = [...mutation.commitEffects];
      close(mutation);
      for (const effect of effects) await effect();
    },

    async rollbackActive(reason) {
      const mutation = active;
      if (!mutation) return false;
      await requestRollback(mutation, reason);
      return mutation.mutated;
    },
  };
}

function settleMutationState(mutation: ActiveToolMutation): void {
  if (mutation.mutationStateSettled) return;
  mutation.mutationStateSettled = true;
  mutation.resolveMutationState();
}

function cancellationError(signal: AbortSignal | undefined): Error {
  return signal?.reason instanceof Error ? signal.reason : new Error('Agent run cancelled.');
}
