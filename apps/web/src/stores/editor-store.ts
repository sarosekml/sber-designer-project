import { create } from 'zustand';
import {
  DEFAULT_GENERATION_PIPELINE_DEFAULTS,
  DEFAULT_SCREEN_READINESS_PROFILE,
  resolveGenerationPipelineDefaults,
  resolveScreenReadinessProfile,
  type EditorMode,
  type DesignBrief,
  type DesignDirectionSelection,
  type GenerationPipelineDefaults,
  type ModalDefaults,
  type ProjectScreenSurface,
  type ResolvedGenerationPipelineDefaults,
  type ScreenReadinessProfile,
  type ScreenReadinessProfileInput,
} from '@sber-designer/shared-types';
import type { SberDesignerConfig } from '@sber-designer/llm-gateway';
import {
  DEFAULT_CANVAS_VIEWPORT_PRESET_ID,
  type CanvasViewportPresetId,
} from '@/lib/canvas-viewport';
import {
  DESIGN_SYSTEM_ASSISTANT_SCREEN_ID,
  STORYBOOK_ASSISTANT_SCREEN_ID,
  useChatStore,
} from '@/stores/chat-store';
import type { SourceKind } from '@/lib/dom-source';
import type { CommentContextMode } from '@/lib/project-comments';
import type { AssistantTargetPreference } from '@/lib/assistant-target';
import {
  appendScreenTab,
  nextActiveScreenTabId,
  pruneScreenTabIds,
  removeScreenTab,
} from '@/lib/screen-tabs';

const ACTIVE_AGENT_STORAGE_KEY = 'sber-designer.activeAgent';
const LOCAL_RUNTIME_PROVIDER_IDS = new Set([
  'opencode-runtime',
  'claude-code-runtime',
  'codex-runtime',
  'kimi-runtime',
  'gigacode-runtime',
]);

/**
 * Editor-wide state. Phase 0 PoC-2: now includes the loaded
 * sber-designer.json config and the active (provider, model) pair on
 * top of the three-mode + selection state from PoC-1.
 */

export interface SelectedNode {
  /** Source location: "file:line:col" when available, otherwise a `dom://…` fallback. */
  loc: string;
  /** How the source location was resolved. Drives visual-editing safety. */
  sourceKind?: SourceKind;
  /** Stable DOM path fallback used by Layers and unsupported-source messaging. */
  domPath?: string;
  /** React component ancestry nearest-first, capped by the DOM overlay. */
  componentPath?: string[];
  /** Tag name of the DOM element clicked, for display. */
  tagName: string;
  /** Short visible text, useful when repeated JSX maps share one source line. */
  text?: string;
  /** Stable CSS selector preferred for Flow click triggers. */
  selector?: string;
  /** React component name when the selected DOM node is the component root. */
  componentName?: string;
  /** Source/use-site for the component boundary when React exposes it. */
  componentLoc?: string;
  /** Flow-relevant DOM attributes such as data-sd-flow-id or aria-label. */
  attributes?: Record<string, string>;
  /** Notice shown when a click falls back to the nearest source-backed ancestor. */
  selectionNotice?: string;
  /** Bounding rect in iframe coordinates. */
  rect: { x: number; y: number; width: number; height: number };
  /** Runtime id assigned inside the iframe for live inspect preview patches. */
  inspectId?: string;
  /** Visible computed CSS snapshot captured when the element was selected. */
  computedStyles?: Record<string, string>;
}

export interface ActiveAgent {
  provider: string;
  model: string;
}

export interface PendingGenerationRequest {
  wireframe?: boolean;
  critique?: boolean;
  designBrief?: DesignBrief;
  directionSelection?: DesignDirectionSelection;
  surface?: ProjectScreenSurface;
  modal?: ModalDefaults;
}

export type AssistantTaskIntent =
  | {
      kind: 'edit-current-screen';
      targetScreenId: string;
    }
  | {
      kind: 'create-screen-from-story';
      targetScreenId: string;
      sourceStoryId: string;
      sourceStoryFilePath?: string;
      targetName: string;
      targetFolder: string;
      targetStoryFilePath: string;
      targetImplementationFilePath?: string;
      targetStoryId: string;
    }
  | {
      kind: 'fill-generated-screen';
      targetScreenId: string;
      targetName: string;
      targetFolder: string;
      targetStoryFilePath: string;
      targetImplementationFilePath?: string;
      targetStoryId: string;
    };

export type EditorView = 'edit' | 'flow' | 'demo';
export type CanvasView = 'screen' | 'storybook' | 'design-system';
export type ScreenSelectionSource = 'user' | 'auto' | 'flow' | 'programmatic';

export interface SetActiveScreenOptions {
  source?: ScreenSelectionSource;
}

interface EditorStoreState {
  /**
   * Top-level view (Phase 5.2 / 5.3):
   *   'edit' → ScreensPanel + Canvas + Mode tabs (Interact/Design/Code).
   *   'flow' → ScreensPanel + FlowCanvas (XYFlow).
   *   'demo' → full-screen prototype, no chrome (Phase 5.3).
   */
  view: EditorView;
  setView: (view: EditorView) => void;

  mode: EditorMode;
  setMode: (mode: EditorMode) => void;

  /**
   * Mark layer (0127): red-marker annotation overlay above the canvas.
   * A layer over the current mode, not a fourth EditorMode (ADR-0004).
   * Session-only UI state — never persisted or pushed to the project.
   */
  markActive: boolean;
  setMarkActive: (markActive: boolean) => void;

  /** Session-only visibility for the active screen's generation history sheet. */
  screenInfoOpen: boolean;
  setScreenInfoOpen: (open: boolean) => void;

  /** Ephemeral launcher state; Auto runs themselves always use Design session mode. */
  autoRunArmed: boolean;
  setAutoRunArmed: (armed: boolean) => void;

  activePrimaryAgentName: string | null;
  setActivePrimaryAgentName: (name: string | null) => void;

  /** Runs validate_screen_craft automatically after agent file edits. */
  agentCraftPostCheckEnabled: boolean;
  setAgentCraftPostCheckEnabled: (enabled: boolean) => void;

  /** User-wide screen readiness DoR profile cached for editor/runtime state. */
  screenReadiness: ScreenReadinessProfile;
  setScreenReadiness: (profile: ScreenReadinessProfileInput | ScreenReadinessProfile) => void;

  /** User-wide defaults for optional stages in the agent generation harness. */
  generationDefaults: ResolvedGenerationPipelineDefaults;
  setGenerationDefaults: (defaults: GenerationPipelineDefaults) => void;

  /** One-shot generation override consumed by the next Assistant send. */
  pendingGenerationRequest: PendingGenerationRequest | null;
  setPendingGenerationRequest: (request: PendingGenerationRequest | null) => void;

  selected: SelectedNode | null;
  setSelected: (node: SelectedNode | null) => void;

  /** URL the canvas iframe currently points at. */
  canvasUrl: string;
  setCanvasUrl: (url: string) => void;

  /** Registry id of the open project (0135: needed to store the Home cover). */
  projectId: string | null;
  setProjectId: (projectId: string | null) => void;

  /**
   * Screen pinned as the Home cover ("Set as thumbnail", 0135). null means the
   * cover follows whichever screen was generated last. Mirrors the registry.
   */
  coverScreenId: string | null;
  setCoverScreenId: (screenId: string | null) => void;

  /** Active screen id (Phase 5.2). null when no project / empty screens list. */
  activeScreenId: string | null;
  activeScreenSelectionSource: ScreenSelectionSource;
  setActiveScreenId: (id: string | null, options?: SetActiveScreenOptions) => void;

  /** Ordered, session-only screen tabs. Tabs do not own preview frames or agent runs. */
  openScreenTabIds: string[];
  openScreenTab: (id: string) => void;
  closeScreenTab: (id: string) => void;
  pruneScreenTabs: (availableScreenIds: readonly string[]) => void;
  resetScreenTabs: () => void;

  /** Active Storybook catalog component while Edit → Storybook is selected. */
  activeComponentId: string | null;
  setActiveComponentId: (id: string | null) => void;

  /** Active user-owned reference page while Edit → Design system is selected. */
  activeDesignSystemReferencePath: string | null;
  setActiveDesignSystemReferencePath: (path: string | null) => void;

  /** Flow edge currently being edited from the map or transitions panel. */
  editingFlowEdgeId: string | null;
  setEditingFlowEdgeId: (id: string | null) => void;

  /**
   * High-level agent task scope. Used for flows like "create a screen
   * from this Storybook template" where the active screen alone is too
   * ambiguous for the model.
   */
  assistantTaskIntent: AssistantTaskIntent | null;
  setAssistantTaskIntent: (intent: AssistantTaskIntent | null) => void;

  /** User-visible target preference for broad Assistant generation/edit requests. */
  assistantTargetPreference: AssistantTargetPreference;
  setAssistantTargetPreference: (preference: AssistantTargetPreference) => void;

  /** Demo comment thread selected as the next assistant target. */
  selectedCommentId: string | null;
  setSelectedCommentId: (id: string | null) => void;

  /** Which active-screen comments are included in the assistant context. */
  commentContextMode: CommentContextMode;
  commentContextIds: string[];
  setCommentContextMode: (mode: CommentContextMode) => void;
  setCommentContextIds: (ids: string[]) => void;

  /** Canvas target inside Edit view: focused project screen or full Storybook manager. */
  canvasView: CanvasView;
  setCanvasView: (view: CanvasView) => void;

  /** True when a Storybook/config/codegen write needs a manual iframe reload/catalog refresh. */
  storybookReloadPending: boolean;
  setStorybookReloadPending: (pending: boolean) => void;

  /** Monotonic key used to reload the active iframe after background Storybook readiness. */
  canvasReloadKey: number;
  bumpCanvasReloadKey: () => void;

  /** Screen-scoped hard-reload revisions used by the bounded passive preview cache. */
  screenPreviewRevisions: Record<string, number>;
  screenPreviewEpoch: number;
  invalidateScreenPreview: (screenId: string) => void;
  resetScreenPreviewPool: () => void;

  /** Responsive working width for Edit → Screen. In-memory only; new editor sessions start fluid. */
  canvasViewportPresetId: CanvasViewportPresetId;
  setCanvasViewportPresetId: (id: CanvasViewportPresetId) => void;

  /** Loaded sber-designer.json (or null if not yet fetched / failed). */
  config: SberDesignerConfig | null;
  configError: string | null;
  setConfig: (config: SberDesignerConfig | null, error?: string | null) => void;

  /** Active provider/model. Falls back to config.agent.default. */
  active: ActiveAgent | null;
  setActive: (active: ActiveAgent | null) => void;
}

export const useEditorStore = create<EditorStoreState>((set, get) => ({
  view: 'edit',
  setView: (view) =>
    set(() => ({
      view,
      ...(view === 'edit'
        ? {}
        : {
            canvasView: 'screen',
            activeComponentId: null,
            activeDesignSystemReferencePath: null,
            selected: null,
            selectedCommentId: null,
            commentContextMode: 'all',
            commentContextIds: [],
            assistantTaskIntent: null,
            assistantTargetPreference: 'current-screen',
            markActive: false,
            screenInfoOpen: false,
          }),
    })),

  mode: 'interact',
  setMode: (mode) => set({ mode, ...(mode === 'interact' ? { selected: null } : {}) }),

  markActive: false,
  setMarkActive: (markActive) => set({ markActive }),

  screenInfoOpen: false,
  setScreenInfoOpen: (screenInfoOpen) => set({ screenInfoOpen }),

  autoRunArmed: false,
  setAutoRunArmed: (autoRunArmed) => set({ autoRunArmed }),

  activePrimaryAgentName: null,
  setActivePrimaryAgentName: (activePrimaryAgentName) => set({ activePrimaryAgentName }),

  agentCraftPostCheckEnabled: true,
  setAgentCraftPostCheckEnabled: (agentCraftPostCheckEnabled) =>
    set((state) => ({
      agentCraftPostCheckEnabled,
      screenReadiness: {
        ...state.screenReadiness,
        enabled: agentCraftPostCheckEnabled,
      },
    })),

  screenReadiness: DEFAULT_SCREEN_READINESS_PROFILE,
  setScreenReadiness: (screenReadiness) =>
    set(() => {
      const next = resolveScreenReadinessProfile(screenReadiness);
      return {
        screenReadiness: next,
        agentCraftPostCheckEnabled: next.enabled,
      };
    }),

  generationDefaults: DEFAULT_GENERATION_PIPELINE_DEFAULTS,
  setGenerationDefaults: (generationDefaults) =>
    set({ generationDefaults: resolveGenerationPipelineDefaults(generationDefaults) }),

  pendingGenerationRequest: null,
  setPendingGenerationRequest: (pendingGenerationRequest) => set({ pendingGenerationRequest }),

  selected: null,
  setSelected: (node) => set({ selected: node }),

  // Phase 0: in-app demo target. Phase 1 swaps this for a real
  // sandbox dev-server URL returned by services/api.
  canvasUrl: '/demo-target/index.html',
  setCanvasUrl: (canvasUrl) => set({ canvasUrl }),

  projectId: null,
  setProjectId: (projectId) => set({ projectId }),

  coverScreenId: null,
  setCoverScreenId: (coverScreenId) => set({ coverScreenId }),

  activeScreenId: null,
  activeScreenSelectionSource: 'programmatic',
  setActiveScreenId: (activeScreenId, options) => {
    useChatStore.getState().switchToScreen(activeScreenId);
    set((state) => ({
      activeScreenId,
      activeScreenSelectionSource: options?.source ?? 'programmatic',
      openScreenTabIds:
        activeScreenId && options?.source === 'user'
          ? appendScreenTab(state.openScreenTabIds, activeScreenId)
          : state.openScreenTabIds,
      selected: null,
      selectedCommentId: null,
      commentContextMode: 'all',
      commentContextIds: [],
      assistantTaskIntent: null,
      // Marks are normalized to the current screen's frame; keeping them
      // across a screen switch would point them at the wrong content.
      markActive: false,
    }));
  },

  openScreenTabIds: [],
  openScreenTab: (id) =>
    set((state) => ({ openScreenTabIds: appendScreenTab(state.openScreenTabIds, id) })),
  closeScreenTab: (id) => {
    const state = get();
    if (state.openScreenTabIds.length <= 1 || !state.openScreenTabIds.includes(id)) return;
    const nextActiveId =
      state.activeScreenId === id
        ? nextActiveScreenTabId(state.openScreenTabIds, id)
        : state.activeScreenId;
    set({ openScreenTabIds: removeScreenTab(state.openScreenTabIds, id) });
    if (state.activeScreenId === id && nextActiveId) {
      get().setActiveScreenId(nextActiveId, { source: 'user' });
    }
  },
  pruneScreenTabs: (availableScreenIds) =>
    set((state) => ({
      openScreenTabIds: pruneScreenTabIds(state.openScreenTabIds, availableScreenIds),
    })),
  resetScreenTabs: () => set({ openScreenTabIds: [] }),

  activeComponentId: null,
  setActiveComponentId: (activeComponentId) =>
    set({
      activeComponentId,
      ...(activeComponentId ? { activeDesignSystemReferencePath: null } : {}),
    }),

  activeDesignSystemReferencePath: null,
  setActiveDesignSystemReferencePath: (activeDesignSystemReferencePath) =>
    set({
      activeDesignSystemReferencePath,
      ...(activeDesignSystemReferencePath ? { activeComponentId: null } : {}),
    }),

  editingFlowEdgeId: null,
  setEditingFlowEdgeId: (editingFlowEdgeId) => set({ editingFlowEdgeId }),

  assistantTaskIntent: null,
  setAssistantTaskIntent: (assistantTaskIntent) => set({ assistantTaskIntent }),

  assistantTargetPreference: 'current-screen',
  setAssistantTargetPreference: (assistantTargetPreference) => set({ assistantTargetPreference }),

  selectedCommentId: null,
  setSelectedCommentId: (selectedCommentId) => set({ selectedCommentId }),

  commentContextMode: 'all',
  commentContextIds: [],
  setCommentContextMode: (commentContextMode) => set({ commentContextMode }),
  setCommentContextIds: (commentContextIds) => set({ commentContextIds }),

  canvasView: 'screen',
  setCanvasView: (canvasView) =>
    set((state) => {
      const resourceView = canvasView !== 'screen';
      const assistantScreenId =
        canvasView === 'storybook'
          ? STORYBOOK_ASSISTANT_SCREEN_ID
          : canvasView === 'design-system'
            ? DESIGN_SYSTEM_ASSISTANT_SCREEN_ID
            : state.activeScreenId;
      useChatStore.getState().switchToScreen(assistantScreenId);

      return {
        canvasView,
        selected: null,
        selectedCommentId: null,
        commentContextMode: 'all',
        commentContextIds: [],
        assistantTaskIntent: resourceView ? null : state.assistantTaskIntent,
        assistantTargetPreference: resourceView ? 'auto' : 'current-screen',
        activeComponentId: canvasView === 'screen' ? null : state.activeComponentId,
        activeDesignSystemReferencePath:
          canvasView === 'design-system' ? state.activeDesignSystemReferencePath : null,
        mode: resourceView ? 'interact' : state.mode,
        autoRunArmed: resourceView ? false : state.autoRunArmed,
        markActive: resourceView ? false : state.markActive,
        screenInfoOpen: resourceView ? false : state.screenInfoOpen,
        screenPreviewEpoch:
          resourceView && state.canvasView !== canvasView
            ? state.screenPreviewEpoch + 1
            : state.screenPreviewEpoch,
      };
    }),

  storybookReloadPending: false,
  setStorybookReloadPending: (storybookReloadPending) => set({ storybookReloadPending }),

  canvasReloadKey: 0,
  bumpCanvasReloadKey: () =>
    set((state) => ({
      canvasReloadKey: state.canvasReloadKey + 1,
      screenPreviewEpoch: state.screenPreviewEpoch + 1,
    })),

  screenPreviewRevisions: {},
  screenPreviewEpoch: 0,
  invalidateScreenPreview: (screenId) =>
    set((state) => ({
      screenPreviewRevisions: {
        ...state.screenPreviewRevisions,
        [screenId]: (state.screenPreviewRevisions[screenId] ?? 0) + 1,
      },
    })),
  resetScreenPreviewPool: () =>
    set((state) => ({ screenPreviewEpoch: state.screenPreviewEpoch + 1 })),

  canvasViewportPresetId: DEFAULT_CANVAS_VIEWPORT_PRESET_ID,
  setCanvasViewportPresetId: (canvasViewportPresetId) => set({ canvasViewportPresetId }),

  config: null,
  configError: null,
  setConfig: (config, error = null) =>
    set((state) => ({
      config,
      configError: error,
      active: resolveConfigActiveAgent(state.active, config),
    })),

  active: readStoredActiveAgent(),
  setActive: (active) => {
    writeStoredActiveAgent(active);
    set({ active });
  },
}));

function readStoredActiveAgent(): ActiveAgent | null {
  const storage = browserLocalStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(ACTIVE_AGENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActiveAgent> & { disabled?: unknown };
    if (parsed.disabled === true) return null;
    if (typeof parsed.provider !== 'string' || typeof parsed.model !== 'string') return null;
    if (!parsed.provider || !parsed.model) return null;
    return { provider: parsed.provider, model: parsed.model };
  } catch {
    return null;
  }
}

function resolveConfigActiveAgent(
  current: ActiveAgent | null,
  config: SberDesignerConfig | null,
): ActiveAgent | null {
  if (current && LOCAL_RUNTIME_PROVIDER_IDS.has(current.provider)) return current;
  if (current && isConfigActiveAgentAvailable(current, config)) return current;
  const stored = readStoredActiveAgent();
  if (stored) {
    if (LOCAL_RUNTIME_PROVIDER_IDS.has(stored.provider)) return stored;
    if (isConfigActiveAgentAvailable(stored, config)) return stored;
    removeStoredActiveAgent();
  }
  if (readStoredAgentDisabled()) return null;
  return config?.agent.default ?? null;
}

function writeStoredActiveAgent(active: ActiveAgent | null): void {
  const storage = browserLocalStorage();
  if (!storage) return;
  try {
    if (!active) {
      storage.setItem(ACTIVE_AGENT_STORAGE_KEY, JSON.stringify({ disabled: true }));
      return;
    }
    storage.setItem(ACTIVE_AGENT_STORAGE_KEY, JSON.stringify(active));
  } catch {
    // Ignore private-mode / quota failures; the current session still updates.
  }
}

function removeStoredActiveAgent(): void {
  const storage = browserLocalStorage();
  if (!storage) return;
  try {
    storage.removeItem(ACTIVE_AGENT_STORAGE_KEY);
  } catch {
    // Ignore private-mode / quota failures; the current session still updates.
  }
}

function readStoredAgentDisabled(): boolean {
  const storage = browserLocalStorage();
  if (!storage) return false;
  try {
    const raw = storage.getItem(ACTIVE_AGENT_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { disabled?: unknown };
    return parsed.disabled === true;
  } catch {
    return false;
  }
}

function isConfigActiveAgentAvailable(
  active: ActiveAgent,
  config: SberDesignerConfig | null,
): boolean {
  if (!config) return true;
  const provider = config.provider[active.provider];
  if (!provider?.models || !(active.model in provider.models)) return false;

  const restrict = config.agent.restrict;
  if (!restrict?.enabled) return true;
  if (restrict.providers && !restrict.providers.includes(active.provider)) return false;
  if (restrict.models && !restrict.models.includes(active.model)) return false;
  return true;
}

function browserLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage ?? null;
}
