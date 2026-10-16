/** Screen templates and legacy project templates. */
import type { ModalDefaults, ProjectScreenSurface } from './modal-surface';

/**
 * Where a screen template comes from. `built-in` templates ship with the
 * product (`packages/agent-kit/kit/screen-templates`); `project` templates are
 * authored by the connected team
 * (`<project>/.sber-designer/screen-templates/*.screen.md`).
 */
export type ScreenTemplateSource = 'built-in' | 'project';

/** Authoring lifecycle for a template. `deprecated` hides it from the dialog. */
export type ScreenTemplateStatus = 'draft' | 'stable' | 'deprecated';

/** A component role a template expects, resolved to a real project component. */
export interface ScreenTemplateComponentRole {
  /** Universal role in built-in templates; may be a concrete name in project ones. */
  role: string;
  /** Short note on what the role carries in this screen. */
  intent?: string;
}

/**
 * Role → concrete project component binding (0080). Only meaningful in
 * project templates; built-ins stay role-only per the universality rule.
 */
export interface ScreenTemplateComponentBinding {
  /** Role name this binding resolves, matching a componentRoles entry. */
  role: string;
  /** Indexed component ids or unique shortNames from this project. */
  components: string[];
  /** Prop hints for the slot, e.g. "sortable columns, footer totals row". */
  preset?: string;
}

/** Coarse taxonomy bucket for grouping in the dialog. */
export type ScreenTemplateKind =
  | 'dashboard'
  | 'list-table'
  | 'detail'
  | 'form'
  | 'settings'
  | 'custom';

export interface ScreenTemplate {
  /** Stable id within a source, e.g. "dashboard". */
  id: string;
  /** Display name shown in the new-screen dialog. */
  name: string;
  /** Short human explanation for tooltips, prompts, and docs. */
  description: string;
  /** Built-in (product) or project-authored. */
  source: ScreenTemplateSource;
  /** Markdown body (sections + ASCII schema) used as assistant context. */
  content: string;
  /** Coarse taxonomy bucket for grouping/inference. */
  kind?: ScreenTemplateKind;
  /**
   * Surface the template targets (0132). Absent reads as `page`. Orthogonal to
   * `kind`: a `modal-form` template keeps `kind: 'form'` and adds
   * `surface: 'modal'`, so structure taxonomy and surface filtering stay
   * independent (Р-9).
   */
  surface?: ProjectScreenSurface;
  /**
   * Manual size + long-content contract for modal templates only (Р-3/Р-14).
   * Materialized into the first file at creation; page templates leave this
   * absent.
   */
  modalDefaults?: ModalDefaults;
  /** Free-form labels for search/grouping. */
  tags?: string[];
  /** Authoring status; defaults to `stable`. */
  status?: ScreenTemplateStatus;
  /** Author-managed revision counter. */
  version?: number;
  /** States the generated screen must handle (loading/empty/error/…). */
  states?: string[];
  /** Roles the agent should resolve to real project components. */
  componentRoles?: ScreenTemplateComponentRole[];
  /** Role → concrete component bindings; project templates only (0080). */
  componentBindings?: ScreenTemplateComponentBinding[];
  /** Reference-screen ids / screenshot paths the template was derived from. */
  evidence?: string[];
  /** Intended viewport width in px, e.g. 1920. */
  viewport?: number;
  /** Workspace-relative path for project templates; undefined for built-ins. */
  filePath?: string;
  /** Extracted ASCII block from `## Layout`, for the dialog preview. */
  layoutSchema?: string;
}

/**
 * Reference persisted on a screen so the chosen template is auditable. The
 * `{ id, source }` pair disambiguates same-id built-in/project templates.
 */
export interface ScreenTemplateRef {
  id: string;
  source: ScreenTemplateSource;
}

export interface ProjectTemplate {
  /** Filename without extension, e.g. "dashboard-page". */
  id: string;
  /** Display name, usually the first H1 in the markdown file. */
  name: string;
  /** Optional short explanation. Present for built-in compatibility aliases. */
  description?: string;
  /** Compatibility marker for older callers. */
  source?: 'built-in' | 'project';
  /** Workspace-relative markdown path or built-in sber-designer URI. */
  filePath: string;
  /** Markdown content, capped by the API/indexer layer when needed. */
  content: string;
}
