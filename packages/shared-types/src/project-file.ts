/** Project file (.sdproj) model (Phase 5.1). */
import type { ProjectScreenSurface } from './modal-surface';
import type { ScreenTemplateRef } from './screen-templates';

/**
 * One screen in a project — either a pinned Storybook story or a
 * generated page that lives in the workspace.
 */
export type ProjectScreenHealthStatus = 'ok' | 'broken' | 'needs-review';

export interface ProjectScreenHealth {
  status: ProjectScreenHealthStatus;
  /** Human-readable reason shown in the editor tooltip. */
  reason: string;
  /** Optional origin for diagnostics and future filtering. */
  source?: 'sync' | 'failed-run' | 'validation' | 'fallback' | 'manual';
  /** Epoch ms when the health status was assigned. */
  updatedAt?: number;
}

export interface ProjectScreen {
  id: string;
  name: string;
  /** Epoch ms when the screen was registered in the project. */
  createdAt?: number | undefined;
  /** Epoch ms of the latest agent or manual source/metadata edit. */
  updatedAt?: number | undefined;
  /** 'story' = points at a Storybook entry id (lives in the connected catalog).
   *  'page'  = points at a workspace-relative .tsx/.html file rendered by the sandbox. */
  kind: 'story' | 'page';
  /**
   * How the screen lives in the product (0132). Absent reads as `page`
   * (full-viewport). `modal` marks an overlay dialog: its scrim, window and
   * size live in the screen file (Р-2/Р-14), and flow edges into it default to
   * `overlay` presentation (Р-5). Independent of `kind`. Additive/ignorable in
   * `.sdproj`; the writer omits it for `page` screens so canonical files stay
   * unchanged for old readers. Read through `screenSurface(screen)`.
   */
  surface?: ProjectScreenSurface;
  /** When kind='story': Storybook story id (e.g. "atoms-button--primary"). */
  storyId?: string;
  /** Storybook wrapper or page entry path. Generated story screens keep this as the thin CSF file. */
  filePath?: string;
  /** Primary editable implementation file for generated screens. */
  implementationFilePath?: string;
  /** Optional thumbnail (data URL or path under the workspace). */
  thumbnail?: string;
  /** Free-form notes shown alongside the screen tile. */
  description?: string;
  /** Optional health marker. `ok` renders without a label; absent means healthy by default. */
  health?: ProjectScreenHealth;
  /** Optional user-facing folder in the editor's Screens panel. */
  folder?: string;
  /**
   * Screen template the screen was generated from, if any. Persisted in
   * `.sdproj` so the choice is auditable and git-reviewable.
   */
  template?: ScreenTemplateRef;
  /**
   * Persisted Flow-view position (Phase 6.2). When absent the FlowCanvas
   * falls back to auto-layout based on screen index. Saved into .sdproj
   * so users see the same diagram next session.
   */
  position?: { x: number; y: number };
}

/**
 * One edge between two screens. Triggers describe what causes the
 * transition during a Demo run (button click, link, on-mount, etc.).
 */
export interface ProjectFlowEdge {
  id: string;
  fromScreenId: string;
  toScreenId: string;
  /** Default 'navigate'. 'overlay' opens the target screen above the source. */
  presentation?: 'navigate' | 'overlay';
  trigger:
    | { kind: 'click'; selector?: string; label?: string }
    | { kind: 'link'; href: string }
    | { kind: 'on-mount' }
    | { kind: 'manual'; label?: string };
  label?: string;
}

export interface ProjectFlowPreviewCapture {
  screenId: string;
  imagePath: string;
  viewport: { width: number; height: number };
  capturedAt: number;
  sourceFingerprint: string;
}

export interface ProjectFlowViewSettings {
  /** Flow map preview size. `frames` uses larger 16:9 screen previews. */
  previewSize?: 'compact' | 'frames';
  /** When false, the Flow map hides every edge without changing Demo runtime behavior. */
  showConnections?: boolean;
  /** Show `ProjectScreen.description` notes below Flow nodes. */
  showDescriptions?: boolean;
  /** Screen ids hidden from the Flow map only. */
  hiddenScreenIds?: string[];
  /** Normalized folder names hidden from the Flow map only. */
  hiddenFolderNames?: string[];
  /** Edge ids hidden from the Flow map only. */
  hiddenEdgeIds?: string[];
  /** Stable viewport used for truthful preview frames and screenshot capture. */
  previewViewport?: { width: number; height: number };
  /** Cached preview screenshots keyed by screen id. */
  previewCaptures?: ProjectFlowPreviewCapture[];
}

export interface ProjectScreensPanelSettings {
  /** Normalized folder names collapsed in the editor's Screens panel. */
  collapsedFolderNames?: string[];
  /** One-shot HTML-first distillation nudge dismissal key. */
  htmlDesignSystemDistillNudgeDismissedKey?: string;
}

/**
 * Product review comment pinned to a screen in Demo mode.
 *
 * Anchors are normalized to the rendered screen bounds (0..1) so the
 * pin survives viewport and window size changes.
 */
export interface ProjectCommentThread {
  id: string;
  screenId: string;
  anchor: { x: number; y: number };
  /** Optional DOM fallback captured while placing the comment. */
  selector?: string;
  /** Optional visible text near the anchor, useful for agent context. */
  elementText?: string;
  status: 'open' | 'resolved';
  createdAt: number;
  updatedAt: number;
  messages: ProjectCommentMessage[];
}

export interface ProjectCommentMessage {
  id: string;
  authorName: string;
  body: string;
  createdAt: number;
  updatedAt?: number;
}
