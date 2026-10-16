/**
 * Workspace-keyed project store + persistence (Phase 5.1, scoped in 0400).
 *
 * Local mode retains the latest active-project fallback. Remote requests are
 * resolved through workspace-context and never read another request's project.
 *
 * Resolution of where the file lives:
 *   1. SBER_DESIGNER_PROJECT_PATH env-var.
 *   2. <state.workspacePath>/.sber-designer/project.sdproj when a
 *      sandbox session is connected.
 *   3. <repoRoot>/.sber-designer/project.sdproj as a fallback for
 *      local dev with no connected workspace.
 *
 * Touching the disk is delegated to ./project-persistence (0136 R08): atomic
 * replace, one write queue per file, a content revision for compare-and-swap,
 * and a hard line between "no project yet" and "this project is damaged".
 * This module keeps schema, merges and timestamp reconciliation.
 */
import { basename, isAbsolute, relative, resolve } from 'node:path';
import type { ProjectAssistantSession, SberDesignerProject } from '@sber-designer/shared-types';

import type { AgentRunRuntimeSessionDiagnostics } from './agent/run-recorder';
import { audit } from './audit';
import {
  mergeProjectAssistantForSave,
  recoverProjectAssistantFromRunTranscripts,
} from './project-assistant-recovery';
import { projectPath } from './project-paths';
import { ProjectSchema } from './project-schema';
import {
  ProjectConflictError,
  ProjectCorruptError,
  projectRevision,
  quarantineProjectFile,
  readProjectFile,
  withProjectFileLock,
  writeProjectFileChecked,
  type ProjectRevision,
} from './project-persistence';
import { publish } from './event-bus';
import { syncHtmlScreenIndex } from './html-screen-index';
import { patchState } from './state-store';
import { requestWorkspacePath } from './workspace-context';

// Facade: schemas moved to ./project-schema in 0136 R12. Existing imports of
// `ProjectSchema` / `ScreenSchema` from this module keep resolving.
export { ProjectSchema, ScreenSchema, ScreenHealthSchema } from './project-schema';

export const DEFAULT_PROJECT: SberDesignerProject = {
  version: 1,
  name: 'Untitled project',
  workspacePath: '',
  screens: [],
  flow: [],
};

let active: SberDesignerProject = { ...DEFAULT_PROJECT };
const projectsByWorkspace = new Map<string, SberDesignerProject>();

const BASE_REVISION = Symbol('project-base-revision');
type RevisionedProject = SberDesignerProject & { [BASE_REVISION]?: ProjectRevision | null };
function withRevision(
  project: SberDesignerProject,
  revision: ProjectRevision | null,
): SberDesignerProject {
  return Object.assign(project, { [BASE_REVISION]: revision });
}

export function getProject(workspacePath?: string | null): SberDesignerProject {
  const contextual = workspacePath === undefined ? requestWorkspacePath() : workspacePath;
  if (contextual !== undefined) {
    if (!contextual?.trim()) return { ...DEFAULT_PROJECT };
    const canonical = resolve(contextual);
    return projectsByWorkspace.get(canonical) ?? { ...DEFAULT_PROJECT, workspacePath: canonical };
  }
  return active;
}

export function isProjectLoaded(workspacePath: string): boolean {
  return projectsByWorkspace.has(resolve(workspacePath));
}

export async function loadProjectFromDisk(): Promise<SberDesignerProject> {
  const contextual = requestWorkspacePath();
  if (contextual) return loadProjectForWorkspace(contextual);
  if (contextual === null) return { ...DEFAULT_PROJECT };
  const path = projectPath();
  const read = await readProjectFile(path, decodeProject);
  if (read.kind === 'ok') {
    revisions.set(resolve(path), read.revision);
    active = withRevision(
      await recoverProjectAssistantFromRunTranscripts(read.project),
      read.revision,
    );
    return active;
  }
  if (read.kind === 'corrupt') noteCorruptProject(path, read.detail);
  // No project on disk yet — keep defaults; the next save creates the file.
  return active;
}

function decodeProject(raw: unknown): SberDesignerProject {
  return ProjectSchema.parse(raw) as SberDesignerProject;
}

/**
 * Revision of the file each workspace's in-memory project was loaded from,
 * so a save can tell "nobody else touched it" from "this is stale".
 */
const revisions = new Map<string, ProjectRevision>();
/** Workspaces whose file is present but unreadable; never silently replaced. */
const corruptProjects = new Map<string, string>();

function noteCorruptProject(path: string, detail: string): void {
  corruptProjects.set(resolve(path), detail);
  audit({
    kind: 'error',
    user: 'project-store',
    errorMessage: `project file unreadable at ${path}: ${detail}. Refusing to overwrite it.`,
  });
}

/** Reason a workspace's project file could not be read, if any. */
export function projectCorruptionDetail(workspacePath?: string): string | null {
  return corruptProjects.get(resolve(projectPath(workspacePath))) ?? null;
}

/**
 * Deliberate recovery: move the damaged file aside so editing can resume.
 * Returns the quarantine path, or null when there was nothing to move.
 */
export async function recoverCorruptProject(workspacePath: string): Promise<string | null> {
  const path = projectPath(resolve(workspacePath));
  const moved = await withProjectFileLock(path, () => quarantineProjectFile(path));
  corruptProjects.delete(resolve(path));
  revisions.delete(resolve(path));
  audit({
    kind: 'config',
    user: 'project-store',
    errorMessage: `project file quarantined: ${moved ?? '(nothing to move)'}`,
  });
  return moved;
}

export async function loadProjectForWorkspace(
  workspacePath: string,
  fallbackName?: string,
): Promise<SberDesignerProject> {
  const resolvedWorkspace = resolve(workspacePath);
  const path = projectPath(resolvedWorkspace);
  patchState({ workspacePath: resolvedWorkspace });
  let loaded: SberDesignerProject;
  const read = await readProjectFile(path, decodeProject);
  if (read.kind === 'ok') {
    revisions.set(resolve(path), read.revision);
    corruptProjects.delete(resolve(path));
    loaded = await recoverProjectAssistantFromRunTranscripts({
      ...read.project,
      workspacePath: resolvedWorkspace,
    });
  } else {
    // 0136 R08 — a damaged file is not an empty project. Both cases still
    // open the editor on defaults, but a corrupt file is recorded so the
    // next save refuses rather than writing the emptiness over it.
    if (read.kind === 'corrupt') noteCorruptProject(path, read.detail);
    else corruptProjects.delete(resolve(path));
    revisions.delete(resolve(path));
    loaded = {
      ...DEFAULT_PROJECT,
      name: basename(resolvedWorkspace) || fallbackName?.trim() || DEFAULT_PROJECT.name,
      workspacePath: resolvedWorkspace,
    };
  }
  loaded = withRevision(loaded, read.kind === 'ok' ? read.revision : null);
  active = loaded;
  projectsByWorkspace.set(resolvedWorkspace, loaded);
  publish({ type: 'project.changed' });
  return loaded;
}

export interface SaveProjectOptions {
  /**
   * Revision the caller read before editing. When supplied, a save whose
   * base no longer matches the file on disk is refused with
   * {@link ProjectConflictError} instead of overwriting newer screens/flow.
   * Omit it for server-side callers that just re-read the current project.
   */
  expectedRevision?: ProjectRevision | null;
}

export async function saveProject(
  next: SberDesignerProject,
  options: SaveProjectOptions = {},
): Promise<SberDesignerProject> {
  const path = projectPath(next.workspacePath);
  const key = resolve(path);
  // Capture before joining the queue. Object spreads preserve this symbol,
  // while JSON excludes it, so server-side read/modify/write callers carry
  // the revision they actually edited without changing the .sdproj format.
  const expectedRevision =
    options.expectedRevision !== undefined
      ? options.expectedRevision
      : BASE_REVISION in next
        ? (next as RevisionedProject)[BASE_REVISION]!
        : (revisions.get(key) ?? null);

  // 0136 R08 — the whole read-modify-write runs under one per-file lock, so
  // a concurrent agent tool call and an editor autosave queue rather than
  // interleave and lose one side's screens.
  const saved = await withProjectFileLock(path, async () => {
    if (corruptProjects.has(key)) {
      throw new ProjectCorruptError(path, corruptProjects.get(key)!);
    }
    const disk = await readProjectFile(path, decodeProject);
    if (disk.kind === 'corrupt') {
      noteCorruptProject(path, disk.detail);
      throw new ProjectCorruptError(path, disk.detail);
    }
    const actualRevision = disk.kind === 'ok' ? disk.revision : null;
    if (expectedRevision !== actualRevision) {
      throw new ProjectConflictError(expectedRevision, actualRevision);
    }
    const current = disk.kind === 'ok' ? disk.project : getProject(next.workspacePath);
    const merged = mergeProjectAssistantForSave(current, next);
    const now = Date.now();
    const canonicalScreens = merged.screens.map(canonicalizeScreenSurfaceForSave);
    const validated = ProjectSchema.parse({
      ...merged,
      screens: reconcileProjectScreenTimestamps(current.screens, canonicalScreens, now),
      savedAt: now,
    }) as SberDesignerProject;
    const contents = `${JSON.stringify(validated, null, 2)}\n`;
    // Already inside withProjectFileLock — use the unlocked form.
    const revision = await writeProjectFileChecked({
      path,
      contents,
      expectedRevision,
      refuseOverCorrupt: async (target) =>
        (await readProjectFile(target, decodeProject)).kind === 'corrupt',
    });
    revisions.set(key, revision);
    const saved = withRevision(validated, revision);
    active = saved;
    projectsByWorkspace.set(resolve(saved.workspacePath), saved);
    await syncHtmlScreenIndex(validated).catch((err) => {
      const detail = err instanceof Error ? err.message : String(err);
      audit({
        kind: 'error',
        user: 'project-store',
        errorMessage: `sync html screen index failed: ${detail}`,
      });
    });
    return saved;
  });

  // Notify subscribers (the editor uses this WS event to re-fetch
  // /api/project after the agent toolset mutates it).
  publish({ type: 'project.changed' });
  return saved;
}

/** Revision the in-memory project for this workspace was last read/written at. */
export function projectRevisionFor(workspacePath?: string): ProjectRevision | null {
  return revisions.get(resolve(projectPath(workspacePath))) ?? null;
}

export { ProjectConflictError, ProjectCorruptError, projectRevision };

/**
 * Preserve recorded dates across stale editor saves, stamp genuinely new
 * screens, and advance Last edited when user-owned screen metadata changes.
 */
export function reconcileProjectScreenTimestamps(
  currentScreens: readonly SberDesignerProject['screens'][number][],
  incomingScreens: readonly SberDesignerProject['screens'][number][],
  now = Date.now(),
): SberDesignerProject['screens'] {
  const currentById = new Map(currentScreens.map((screen) => [screen.id, screen]));
  return incomingScreens.map((screen) => {
    const current = currentById.get(screen.id);
    if (!current) {
      const createdAt = screen.createdAt ?? now;
      return { ...screen, createdAt, updatedAt: screen.updatedAt ?? createdAt };
    }
    const changed = screenEditSignature(current) !== screenEditSignature(screen);
    const createdAt = screen.createdAt ?? current.createdAt;
    const previousUpdatedAt = Math.max(current.updatedAt ?? 0, screen.updatedAt ?? 0) || undefined;
    return {
      ...screen,
      ...(createdAt !== undefined ? { createdAt } : {}),
      ...(changed
        ? { updatedAt: now }
        : previousUpdatedAt !== undefined
          ? { updatedAt: previousUpdatedAt }
          : {}),
    };
  });
}

/** Advance project-owned screen dates from one product mutation boundary. */
export async function touchScreens(
  workspacePath: string,
  screenIds: readonly string[],
  options: { created?: boolean; at?: number } = {},
): Promise<SberDesignerProject> {
  const ids = new Set(screenIds.filter(Boolean));
  if (ids.size === 0) return getProject(workspacePath);
  const project = isProjectLoaded(workspacePath)
    ? getProject(workspacePath)
    : await loadProjectForWorkspace(workspacePath);
  const now = options.at ?? Date.now();
  let changed = false;
  const screens = project.screens.map((screen) => {
    if (!ids.has(screen.id)) return screen;
    changed = true;
    return {
      ...screen,
      ...(options.created && screen.createdAt === undefined ? { createdAt: now } : {}),
      updatedAt: now,
    };
  });
  return changed ? saveProject({ ...project, screens }) : project;
}

/** Resolve screen ids touched by Code/Design file operations. */
export function screenIdsForWorkspacePaths(
  workspacePath: string,
  paths: readonly string[],
  screens: readonly SberDesignerProject['screens'][number][] = getProject(workspacePath).screens,
): string[] {
  const normalizedPaths = new Set(
    paths.map((path) => normalizeScreenWorkspacePath(workspacePath, path)),
  );
  return screens
    .filter((screen) =>
      [screen.filePath, screen.implementationFilePath].some(
        (path) => path && normalizedPaths.has(normalizeScreenWorkspacePath(workspacePath, path)),
      ),
    )
    .map((screen) => screen.id);
}

export async function touchScreensForWorkspacePaths(
  workspacePath: string,
  paths: readonly string[],
  options: { at?: number } = {},
): Promise<SberDesignerProject> {
  const project = isProjectLoaded(workspacePath)
    ? getProject(workspacePath)
    : await loadProjectForWorkspace(workspacePath);
  return touchScreens(
    workspacePath,
    screenIdsForWorkspacePaths(workspacePath, paths, project.screens),
    options,
  );
}

/**
 * Canonical `.sdproj` surface writing (0132, Р-1): keep `surface: 'modal'`
 * explicit and drop `surface: 'page'` so page screens serialize exactly as they
 * did before this field existed. Applied before timestamp reconciliation so a
 * redundant `surface: 'page'` never counts as an edit.
 */
export function canonicalizeScreenSurfaceForSave(
  screen: SberDesignerProject['screens'][number],
): SberDesignerProject['screens'][number] {
  if (screen.surface === 'modal' || screen.surface === undefined) return screen;
  const { surface: _dropped, ...rest } = screen;
  return rest;
}

function screenEditSignature(screen: SberDesignerProject['screens'][number]): string {
  const { createdAt: _createdAt, updatedAt: _updatedAt, health: _health, ...editable } = screen;
  return JSON.stringify(editable);
}

function normalizeScreenWorkspacePath(workspacePath: string, path: string): string {
  const workspaceRelative = isAbsolute(path)
    ? relative(resolve(workspacePath), resolve(path))
    : path;
  return workspaceRelative.replace(/\\/gu, '/').replace(/^\.\//u, '');
}

export async function saveAssistantSessionRunMetadata(input: {
  sessionId: string | null | undefined;
  runManifestPath?: string | null;
  runStatus?: NonNullable<ProjectAssistantSession['metadata']>['lastRunStatus'];
  runSummary?: string | null;
  runErrorCode?: string | null;
  runtimeSession?: AgentRunRuntimeSessionDiagnostics | null;
}): Promise<SberDesignerProject> {
  const sessionId = input.sessionId?.trim();
  const project = getProject();
  const assistant = project.assistant;
  if (!sessionId || !assistant?.sessions.length) return project;
  const now = new Date().toISOString();
  let changed = false;
  const runManifestPath = input.runManifestPath?.trim() || null;
  const sessions = assistant.sessions.map((session) => {
    if (session.id !== sessionId) return session;
    changed = true;
    const linkedRunManifestIds = runManifestPath
      ? Array.from(new Set([...(session.linkedRunManifestIds ?? []), runManifestPath]))
      : session.linkedRunManifestIds;
    const metadata = {
      ...session.metadata,
      ...(runManifestPath ? { lastRunManifestPath: runManifestPath } : {}),
      ...(input.runStatus !== undefined ? { lastRunStatus: input.runStatus } : {}),
      ...(input.runSummary !== undefined ? { lastRunSummary: input.runSummary } : {}),
      ...(input.runErrorCode !== undefined ? { lastRunErrorCode: input.runErrorCode } : {}),
      ...runtimeSessionMetadata(input.runtimeSession),
    };
    return {
      ...session,
      ...(linkedRunManifestIds ? { linkedRunManifestIds } : {}),
      metadata,
      updatedAt: now,
    };
  });
  if (!changed) return project;
  return saveProject({
    ...project,
    assistant: {
      ...assistant,
      sessions,
    },
  });
}

function runtimeSessionMetadata(
  runtimeSession: AgentRunRuntimeSessionDiagnostics | null | undefined,
): Record<string, unknown> {
  const sessionId = runtimeSession?.sessionId?.trim();
  if (!runtimeSession || !sessionId) return {};
  return {
    runtimeSessionId: sessionId,
    runtimeSessionRuntime: runtimeSession.runtime,
    runtimeSessionModel: runtimeSession.model ?? null,
    runtimeSessionWorkspacePath: runtimeSession.workspacePath ?? null,
    runtimeSessionUpdatedAt: runtimeSession.updatedAt ?? new Date().toISOString(),
    ...(runtimeSession.cumulativeUsage
      ? { runtimeSessionUsage: runtimeSession.cumulativeUsage }
      : {}),
  };
}

export function resetProject(workspacePath?: string): void {
  if (workspacePath) {
    revisions.delete(resolve(projectPath(workspacePath)));
    corruptProjects.delete(resolve(projectPath(workspacePath)));
    projectsByWorkspace.delete(resolve(workspacePath));
    if (active.workspacePath && resolve(active.workspacePath) === resolve(workspacePath)) {
      active = { ...DEFAULT_PROJECT };
    }
    return;
  }
  projectsByWorkspace.clear();
  revisions.clear();
  corruptProjects.clear();
  active = { ...DEFAULT_PROJECT };
}

/**
 * Whether an untrusted (HTTP) save may replace the active project.
 *
 * The api keeps a single active project, so a PUT whose workspacePath
 * points at a *different* workspace comes from a stale editor page —
 * accepting it would write one project's content into another repo's
 * project.sdproj (cross-project corruption, 2026-06-12). Saves are
 * allowed when no workspace is active yet (first save / Connect repo).
 */
export function canReplaceActiveProject(
  current: Pick<SberDesignerProject, 'workspacePath'>,
  next: Pick<SberDesignerProject, 'workspacePath'>,
): boolean {
  const activeWorkspace = current.workspacePath.trim();
  if (!activeWorkspace) return true;
  return resolve(activeWorkspace) === resolve(next.workspacePath);
}

export function projectFilePath(workspacePath: string): string {
  return projectPath(workspacePath);
}
