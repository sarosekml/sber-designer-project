import { create } from 'zustand';

import { applyVisualChanges } from '@/lib/api-client';
import {
  componentParamContextKey,
  createComponentParamApplyQueue,
  type ComponentParamBaseline,
} from '@/lib/component-param-queue';
import type {
  DesignInspectResult,
  DesignPanelTab,
  DesignTokens,
  LayerNode,
  VisualChange,
} from '@/lib/design-types';
import { usePatchStore } from '@/stores/patch-store';

const EMPTY_TOKENS: DesignTokens = {
  colors: [],
  spacing: [],
  typography: [],
  radius: [],
  shadows: [],
};

type ApplyStatus = 'idle' | 'applying' | 'success' | 'error';

interface DesignStoreState {
  activeTab: DesignPanelTab;
  targetInfo: DesignInspectResult | null;
  loadingTargetInfo: boolean;
  inspectError: string | null;
  draftChanges: VisualChange[];
  applyStatus: ApplyStatus;
  applyError: string | null;
  lastApplyResult: {
    changedFiles: string[];
    ops: Array<{ kind: string; file: string }>;
  } | null;
  tokens: DesignTokens;
  tokensLoading: boolean;
  tokensError: string | null;
  layerTree: LayerNode | null;
  previewWindow: Window | null;
  /** Optimistic Component-tab values while a write is in flight (task 0133). */
  paramOverrides: Record<string, string | null>;
  paramContextKey: string | null;
  paramStatus: ApplyStatus;
  paramError: string | null;
  setTab: (tab: DesignPanelTab) => void;
  beginInspect: () => void;
  setTargetInfo: (info: DesignInspectResult | null) => void;
  setInspectError: (error: string | null) => void;
  setTokensLoading: (loading: boolean) => void;
  setTokens: (tokens: DesignTokens) => void;
  setTokensError: (error: string | null) => void;
  setLayerTree: (tree: LayerNode | null) => void;
  setPreviewWindow: (previewWindow: Window | null) => void;
  upsertChange: (change: VisualChange) => void;
  removeChange: (change: VisualChange) => void;
  resetDraft: () => void;
  clearForSelection: (targetId: string | null) => void;
  applyDraft: (workspacePath?: string) => Promise<void>;
  applyComponentParam: (input: ComponentParamApplyInput) => void;
}

export interface ComponentParamApplyInput {
  workspacePath?: string | undefined;
  screenId?: string | undefined;
  /** Immutable target snapshot captured when the user changed the control. */
  target: DesignInspectResult['target'];
  /** Conflict guard returned for this component usage by inspect. */
  baseline: ComponentParamBaseline;
  /** Prop being edited; coalesced only inside the same component usage. */
  prop: string;
  /** Optimistic control value (`null` = prop removed). */
  value: string | null;
  change: VisualChange;
  /** Re-inspect, so props and source locations come back from the file. */
  reload: () => Promise<void>;
}

export const useDesignStore = create<DesignStoreState>((set, get) => ({
  activeTab: 'inspect',
  targetInfo: null,
  loadingTargetInfo: false,
  inspectError: null,
  draftChanges: [],
  applyStatus: 'idle',
  applyError: null,
  lastApplyResult: null,
  tokens: EMPTY_TOKENS,
  tokensLoading: false,
  tokensError: null,
  layerTree: null,
  previewWindow: null,
  paramOverrides: {},
  paramContextKey: null,
  paramStatus: 'idle',
  paramError: null,

  setTab: (activeTab) => set({ activeTab }),
  beginInspect: () => set({ loadingTargetInfo: true, inspectError: null }),
  setTargetInfo: (targetInfo) =>
    set({
      targetInfo,
      loadingTargetInfo: false,
      inspectError: null,
      applyStatus: 'idle',
      applyError: null,
    }),
  setInspectError: (inspectError) =>
    set({ inspectError, loadingTargetInfo: false, targetInfo: null }),
  setTokensLoading: (tokensLoading) => set({ tokensLoading }),
  setTokens: (tokens) => set({ tokens, tokensLoading: false, tokensError: null }),
  setTokensError: (tokensError) => set({ tokensError, tokensLoading: false }),
  setLayerTree: (layerTree) => set({ layerTree }),
  setPreviewWindow: (previewWindow) => set({ previewWindow }),

  upsertChange: (change) =>
    set((state) => {
      const key = changeKey(change);
      return {
        draftChanges: [...state.draftChanges.filter((item) => changeKey(item) !== key), change],
        applyStatus: 'idle',
        applyError: null,
      };
    }),

  removeChange: (change) =>
    set((state) => ({
      draftChanges: state.draftChanges.filter((item) => changeKey(item) !== changeKey(change)),
      applyStatus: 'idle',
      applyError: null,
    })),

  resetDraft: () => set({ draftChanges: [], applyStatus: 'idle', applyError: null }),

  clearForSelection: (targetId) =>
    set((state) => {
      if (state.targetInfo?.target.id === targetId) return {};
      return {
        targetInfo: null,
        loadingTargetInfo: false,
        inspectError: null,
        draftChanges: [],
        applyStatus: 'idle',
        applyError: null,
        lastApplyResult: null,
        paramOverrides: {},
        paramContextKey: null,
        paramStatus: 'idle',
        paramError: null,
      };
    }),

  applyDraft: async (workspacePath) => {
    const state = get();
    if (!state.targetInfo || state.draftChanges.length === 0 || state.applyStatus === 'applying') {
      return;
    }
    set({ applyStatus: 'applying', applyError: null });
    try {
      const result = await applyVisualChanges({
        ...(workspacePath ? { workspacePath } : {}),
        target: state.targetInfo.target,
        changes: state.draftChanges,
        ...(state.targetInfo.baseline ? { baseline: state.targetInfo.baseline } : {}),
      });
      if (result.diffs.length > 0) {
        usePatchStore
          .getState()
          .recordDiffs(result.diffs.map((diff) => ({ ...diff, source: 'visual' as const })));
      }
      set({
        draftChanges: [],
        applyStatus: 'success',
        applyError: null,
        lastApplyResult: {
          changedFiles: result.changedFiles,
          ops: result.ops,
        },
      });
    } catch (err) {
      set({
        applyStatus: 'error',
        applyError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  /**
   * Component-tab edits skip the draft footer: a prop change cannot be
   * previewed by mutating the DOM (the component has to re-render from source),
   * so writing the file *is* the preview. Edits queue per prop and flush as one
   * batch, then a re-inspect brings props and source locations back from disk.
   */
  applyComponentParam: (input) => {
    const contextKey = componentParamContextKey(input);
    set((state) => ({
      paramOverrides:
        state.paramContextKey === contextKey
          ? { ...state.paramOverrides, [input.prop]: input.value }
          : { [input.prop]: input.value },
      paramContextKey: contextKey,
      paramStatus: 'applying',
      paramError: null,
    }));
    componentParamQueue.enqueue({ ...input, contextKey });
  },
}));

const componentParamQueue = createComponentParamApplyQueue({
  apply: applyVisualChanges,
  isCurrentContext: (contextKey) => useDesignStore.getState().paramContextKey === contextKey,
  onBatchApplied: (_entry, result) => {
    if (result.diffs.length === 0) return;
    usePatchStore
      .getState()
      .recordDiffs(result.diffs.map((diff) => ({ ...diff, source: 'visual' as const })));
  },
  onContextError: (entry, props, error) => {
    const state = useDesignStore.getState();
    if (state.paramContextKey !== entry.contextKey) return;
    useDesignStore.setState({
      paramStatus: 'error',
      paramError: error instanceof Error ? error.message : String(error),
      paramOverrides: withoutProps(state.paramOverrides, props),
    });
  },
  onContextSettled: (entry) => {
    if (useDesignStore.getState().paramContextKey !== entry.contextKey) return;
    useDesignStore.setState({
      paramStatus: 'success',
      paramError: null,
      paramOverrides: {},
    });
  },
});

function withoutProps(
  overrides: Record<string, string | null>,
  props: string[],
): Record<string, string | null> {
  const next = { ...overrides };
  for (const prop of props) delete next[prop];
  return next;
}

function changeKey(change: VisualChange): string {
  const base = `${change.targetId}:${change.filePath}:${change.loc.line}:${change.loc.column}`;
  switch (change.kind) {
    case 'set-prop':
    case 'remove-prop':
      return `${base}:prop:${change.name}`;
    case 'set-children-text':
      return `${base}:children`;
    case 'set-style':
    case 'remove-style':
      return `${base}:style:${change.property}`;
    case 'set-class-token':
      return `${base}:class:${change.tokenGroup}`;
    default: {
      const exhaustive: never = change;
      return `${base}:${JSON.stringify(exhaustive)}`;
    }
  }
}
