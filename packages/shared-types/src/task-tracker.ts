/** Task tracker integration shapes. */
import type { ProjectAssistantState } from './assistant-history';
import type {
  ProjectCommentThread,
  ProjectFlowEdge,
  ProjectFlowViewSettings,
  ProjectScreen,
  ProjectScreensPanelSettings,
} from './project-file';
import type { ScreenReadinessProfile } from './screen-readiness';
import type { ProjectGenerationDefaults } from './generation-pipeline';

export type TaskTrackerType = 'linear' | 'jira';

export interface LinearTrackerConfig {
  type: 'linear';
  /** Linear workspace/team/project URL. Secrets stay server-side in LINEAR_API_KEY. */
  projectUrl: string;
  /** Optional label filter. Empty means all issues in the linked Linear project. */
  labelFilter?: string;
}

export interface JiraTrackerConfig {
  type: 'jira';
  /** Jira project URL, e.g. https://company.atlassian.net/jira/software/projects/ABC/. */
  projectUrl: string;
  /** Extracted Jira project key. */
  projectKey?: string;
}

export type TaskTrackerConfig = LinearTrackerConfig | JiraTrackerConfig;

/** A work item surfaced from a tracker or parsed from a screen comment. */
export interface ProjectTask {
  id: string;
  title: string;
  description?: string;
  /** Link back to the tracker item. */
  url?: string;
  source: 'linear' | 'jira' | 'comment';
  /** Screens this task is associated with. Empty means unassigned to a specific screen. */
  screenIds: string[];
  /** When source='comment': the comment thread id. */
  commentId?: string;
  status?: string;
  priority?: string;
}

export interface ProjectAgentDefault {
  provider: string;
  model: string;
}

export interface ScreenDesignExportTemplate {
  /** Workspace-relative markdown path, usually `.sber-designer/screen.design.md`. */
  path: string;
  /** Original uploaded filename shown in Project settings. */
  fileName: string;
  /** Epoch ms when the template was imported into the project workspace. */
  uploadedAt: number;
}

export type ProjectAssetPackKind = 'icons' | 'illustrations';

export interface ProjectAssetPackSettings {
  /** Last local source folder selected in Settings -> Indexing project. */
  localSourcePath?: string;
  /** Asset families selected for the next import. */
  kinds?: ProjectAssetPackKind[];
  /** Epoch ms when the preference was last changed. */
  updatedAt?: number;
}

export type ProjectIconSourceFamily = 'icons' | 'illustrations';
export type ProjectIconSourceMode = 'workspace' | 'external';

export interface ProjectIconSource {
  /** Stable id stored in `.sdproj`; generated once when the source is added. */
  id: string;
  /** Human-readable label shown in Settings. */
  name: string;
  /** Currently only local folders are supported, but the field keeps the shape open. */
  kind: 'local-folder';
  /** Selected families. `icons` is the default when omitted for old project files. */
  families?: ProjectIconSourceFamily[] | undefined;
  /** Explicit source mode. If omitted, indexer derives it from `localPath` and workspace. */
  mode?: ProjectIconSourceMode | undefined;
  /** Absolute path on this machine. Used only by local indexing/materialization. */
  localPath?: string | undefined;
  /** Workspace-relative path when the source lives inside the connected project. */
  workspacePath?: string | undefined;
  /** Epoch ms when the source was last changed in Settings. */
  updatedAt?: number | undefined;
}

export interface ProjectExternalAssetSources {
  icons?: ProjectIconSource[] | undefined;
}

export type ProjectGitSessionStatus = 'branch' | 'review-open' | 'merged' | 'closed' | 'stale';

export interface ProjectGitSession {
  provider: 'github' | 'gitlab' | 'bitbucket' | 'unknown';
  remote: string;
  remoteUrl: string;
  baseBranch: string;
  workingBranch: string;
  status?: ProjectGitSessionStatus;
  createdAt: number;
  updatedAt: number;
  prUrl?: string;
  compareUrl?: string;
  prNumber?: string;
  commitSha?: string;
  pushedAt?: number;
  /** When true, later agent edits can update this branch/PR automatically. */
  autoPush?: boolean;
}

/** Kind of a single working-tree change (task 0110). */
export type GitChangeKind =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'renamed'
  | 'untracked'
  | 'conflicted';

/**
 * One uncommitted working-tree change (task 0110). Read fresh from
 * `git status --porcelain=v2`; git is the single source of truth, so there is
 * no editor-owned "who changed it" flag (rule 11).
 */
export interface GitChange {
  /** Repo-relative path, POSIX slashes. */
  path: string;
  kind: GitChangeKind;
  /** True when the index carries a change (porcelain XY: X !== '.'). */
  staged: boolean;
  /** Only set for renamed/copied entries — the pre-rename path. */
  origPath?: string;
}

/**
 * Working-tree change counts for the status bar (task 0110). Derived purely
 * from git — no ownership split. `untracked`/`conflicted` are subsets of
 * `total` surfaced for badges and conflict warnings.
 */
export interface GitChangeCounts {
  total: number;
  untracked: number;
  conflicted: number;
}

/**
 * One commit in the Git Graph viewer (task 0096). Parsed from `git log`.
 * Lane/column layout is computed client-side by the renderer.
 */
export interface GitCommitNode {
  sha: string;
  parents: string[];
  /** Decorations from `%D`: "HEAD -> main", "origin/main", "tag: v1.0". */
  refs: string[];
  author: string;
  authorEmail: string;
  /** ISO-8601 author date (`%aI`). */
  date: string;
  subject: string;
}

/** A branch ref for the branch picker / graph branch heads (task 0096). */
export interface GitBranchRef {
  name: string;
  sha: string;
  isCurrent: boolean;
  isRemote: boolean;
  upstream?: string;
}

export interface GitGraphResponse {
  ok: true;
  commits: GitCommitNode[];
  branches: GitBranchRef[];
  head: string | null;
  currentBranch: string | null;
  hasMore: boolean;
}

/** One changed file inside a diff range (task 0096). */
export interface GitFileDiffEntry {
  path: string;
  /** "added" | "modified" | "deleted" | "renamed" | raw porcelain code. */
  status: string;
  additions: number;
  deletions: number;
  binary: boolean;
}

export interface GitFileDiff {
  ok: true;
  base: string | null;
  head: string | null;
  /** Pre-rename path, echoed back for a renamed file so the UI can label it. */
  origPath?: string;
  files: GitFileDiffEntry[];
  /** Unified patch for a single requested file. Omitted for list-only diffs. */
  patch?: string;
  /** True when the patch was clipped to a size limit. */
  truncated?: boolean;
}

export interface VisualEditingPolicy {
  tokenMode?: 'prefer-tokens' | 'strict-tokens' | 'allow-raw';
  allowInlineStyles?: boolean;
  allowClassNameEdits?: boolean;
  allowComponentSwaps?: boolean;
}

export interface ProjectMcpToolOverride {
  enabled: boolean;
  updatedAt: number;
}

export interface ProjectMcpToolSelection {
  mode: 'explicit';
  selectedTools: string[];
  updatedAt: number;
}

export interface ProjectMcpServerOverride {
  enabled: boolean;
  configHash: string;
  updatedAt: number;
  /** Legacy runtime switches kept for read compatibility. New writes use toolSelection. */
  toolOverrides?: Record<string, ProjectMcpToolOverride>;
  toolSelection?: ProjectMcpToolSelection;
}

export interface ProjectMcpSettings {
  serverOverrides?: Record<string, ProjectMcpServerOverride>;
}

export interface ProjectScreenCreationSettings {
  /** Last successful folder selected in Add a screen. Stored in `.sdproj`. */
  lastFolder?: string;
}

export interface ProjectPostCheckSettings {
  /** @deprecated Generation post-checks are user-wide; retained for legacy project reads. */
  screenReadiness?: ScreenReadinessProfile;
}

export interface ProjectAgentMemorySettings {
  /** Defaults to true. False keeps evidence on disk but omits style memory from future prompts. */
  styleMemoryEnabled?: boolean;
}

export type SberDesignerProjectKind = 'react-vite' | 'html-first';

/**
 * `.sdproj` JSON file. Versioned so we can evolve the shape without
 * breaking existing files; a future loader does a migration step on
 * `version < CURRENT`.
 */
export interface SberDesignerProject {
  /** Format version. Bump on breaking schema changes. */
  version: 1;
  /** Display name shown in the editor and in shared previews. */
  name: string;
  /** Absolute or workspace-relative path to the connected repo root. */
  workspacePath: string;
  /** Explicit project creation kind. Existing connected repos may omit this and rely on profile detection. */
  projectKind?: SberDesignerProjectKind;
  /** Screens, in display order. */
  screens: ProjectScreen[];
  /** Project-owned Add a screen workflow settings. */
  screenCreation?: ProjectScreenCreationSettings;
  /** Project-owned Screens panel display preferences. */
  screensPanel?: ProjectScreensPanelSettings;
  /** @deprecated User-wide Generation pipeline settings supersede this legacy project field. */
  postChecks?: ProjectPostCheckSettings;
  /** @deprecated User-wide Generation pipeline settings supersede this legacy project field. */
  generationDefaults?: ProjectGenerationDefaults;
  /** Flow graph between screens. */
  flow: ProjectFlowEdge[];
  /** Flow-map display preferences and non-destructive visibility state. */
  flowView?: ProjectFlowViewSettings;
  /** Demo-mode review comments pinned to project screens. */
  comments?: ProjectCommentThread[];
  /** Screen-scoped assistant task history and context policy. */
  assistant?: ProjectAssistantState;
  /** Manual project-level instructions injected into assistant and runtime prompts. */
  projectInstructions?: string;
  /** Project-owned agent memory controls. */
  agentMemory?: ProjectAgentMemorySettings;
  /** Deprecated legacy field. Loaded for backward compatibility; ignored by the editor. */
  agentDefault?: ProjectAgentDefault;
  /** Task tracker connection. Stored URL-only; secrets are resolved server-side. */
  taskTracker?: TaskTrackerConfig;
  /** When true, Auto mode creates a PR after each completed task turn. */
  agentAutoPr?: boolean;
  /** Active Git branch / PR lifecycle metadata. Secrets are never stored here. */
  gitSession?: ProjectGitSession;
  /** Project-level template for future screen.design.md exports. */
  screenDesignExportTemplate?: ScreenDesignExportTemplate;
  /** Project-level local asset pack import preferences.
   *  Explicit `undefined` is a valid patch value: the editor clears the
   *  preferences back to defaults by writing `assetPacks: undefined`. */
  assetPacks?: ProjectAssetPackSettings | undefined;
  /** Project-owned portable icon/illustration source references for project indexing. */
  externalAssetSources?: ProjectExternalAssetSources | undefined;
  /** Project-level Visual Design MVP safety policy. Defaults are applied by the UI/API. */
  visualEditing?: VisualEditingPolicy;
  /** Runtime-only MCP switcher state. Config entries remain in sber-designer.json. */
  mcpSettings?: ProjectMcpSettings;
  /** Free-form notes / brief shown in Settings → Project. */
  description?: string;
  /** Epoch ms of last save (for the "saved at HH:MM" indicator). */
  savedAt?: number;
}

export function isProjectStyleMemoryEnabled(
  project: Pick<SberDesignerProject, 'agentMemory'> | null | undefined,
): boolean {
  return project?.agentMemory?.styleMemoryEnabled !== false;
}
