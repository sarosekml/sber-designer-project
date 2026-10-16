/**
 * Active project lifecycle: fetch/save the .sdproj, screen health,
 * scaffolding, filesystem browsing, and the local projects registry.
 */
import type {
  HtmlDesignSystemPresetId,
  ProjectScreenHealthStatus,
  SberDesignerProjectKind,
} from '@sber-designer/shared-types';

import { API_URL, ApiError, authHeaders, safeJson, withSignal } from './http';
import { projectRevisionHeader, withProjectRevision } from '../project-revision';

export async function fetchProject(
  signal?: AbortSignal,
): Promise<import('@sber-designer/shared-types').SberDesignerProject> {
  const res = await fetch(`${API_URL}/api/project`, withSignal({ headers: authHeaders() }, signal));
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return withProjectRevision(await res.json(), res.headers.get('etag'));
}

export async function updateScreenHealth(
  screenId: string,
  input: { status: ProjectScreenHealthStatus; reason?: string },
  signal?: AbortSignal,
): Promise<import('@sber-designer/shared-types').SberDesignerProject> {
  const res = await fetch(
    `${API_URL}/api/project/screens/${encodeURIComponent(screenId)}/health`,
    withSignal(
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify(input),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return withProjectRevision(await res.json(), res.headers.get('etag'));
}

export interface ScaffoldInput {
  parentDir: string;
  name: string;
  createProjectSubfolder?: boolean;
  projectKind?: SberDesignerProjectKind;
  withStorybook?: boolean;
  createStarterFiles?: boolean;
  htmlDesignSystemPresetId?: HtmlDesignSystemPresetId;
}

export interface ScaffoldResult {
  workspacePath: string;
  steps: { name: string; ok: boolean; durationMs: number; detail?: string }[];
}

export async function scaffoldProject(
  input: ScaffoldInput,
  signal?: AbortSignal,
): Promise<ScaffoldResult> {
  const res = await fetch(
    `${API_URL}/api/scaffold`,
    withSignal(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify(input),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as ScaffoldResult;
}

// ---------- /api/fs (folder picker, backlog 0001 prep) ----------

export interface FsEntry {
  name: string;
  isDir: boolean;
}

export interface FsListResult {
  path: string;
  parent: string | null;
  entries: FsEntry[];
  isHome: boolean;
}

export async function fsList(path?: string, signal?: AbortSignal): Promise<FsListResult> {
  const url = new URL(`${API_URL}/api/fs/list`);
  if (path) url.searchParams.set('path', path);
  const res = await fetch(url, withSignal({ headers: authHeaders() }, signal));
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as FsListResult;
}

export async function saveProjectToApi(
  project: import('@sber-designer/shared-types').SberDesignerProject,
  signal?: AbortSignal,
): Promise<import('@sber-designer/shared-types').SberDesignerProject> {
  const res = await fetch(
    `${API_URL}/api/project`,
    withSignal(
      {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          ...authHeaders(),
          'if-match': projectRevisionHeader(project),
        },
        body: JSON.stringify(project),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return withProjectRevision(await res.json(), res.headers.get('etag'));
}

// ---------- /api/projects (Backlog 0001) ----------

export interface ProjectEntry {
  id: string;
  name: string;
  workspacePath: string;
  thumbnailPath?: string;
  /** Screen pinned as the cover source ("Set as thumbnail", 0135). */
  coverScreenId?: string;
  legacy?: boolean;
  projectType: 'storybook' | 'html' | 'react' | 'unknown';
  lastOpenedAt: number;
  createdAt: number;
}

export interface ProjectsRegistry {
  version: 1;
  projects: ProjectEntry[];
}

export interface ProjectOpenResult {
  entry: ProjectEntry;
  project: import('@sber-designer/shared-types').SberDesignerProject;
}

export async function fetchProjects(signal?: AbortSignal): Promise<ProjectsRegistry> {
  const res = await fetch(
    `${API_URL}/api/projects`,
    withSignal({ headers: authHeaders() }, signal),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as ProjectsRegistry;
}

export async function registerProject(
  input: { workspacePath: string; name?: string },
  signal?: AbortSignal,
): Promise<ProjectEntry> {
  const res = await fetch(
    `${API_URL}/api/projects`,
    withSignal(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify(input),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as ProjectEntry;
}

export async function openProjectEntry(
  id: string,
  signal?: AbortSignal,
): Promise<ProjectOpenResult> {
  const res = await fetch(
    `${API_URL}/api/projects/${encodeURIComponent(id)}/open`,
    withSignal(
      {
        method: 'POST',
        headers: authHeaders(),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as ProjectOpenResult;
}

export async function deleteProjectEntry(id: string, signal?: AbortSignal): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/projects/${encodeURIComponent(id)}`,
    withSignal(
      {
        method: 'DELETE',
        headers: authHeaders(),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
}

export async function renameProjectEntry(
  id: string,
  name: string,
  signal?: AbortSignal,
): Promise<ProjectEntry> {
  const res = await fetch(
    `${API_URL}/api/projects/${encodeURIComponent(id)}`,
    withSignal(
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ name }),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as ProjectEntry;
}

export async function duplicateProjectEntry(
  id: string,
  input: { name: string; parentDir: string },
  signal?: AbortSignal,
): Promise<ProjectEntry> {
  const res = await fetch(
    `${API_URL}/api/projects/${encodeURIComponent(id)}/duplicate`,
    withSignal(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify(input),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as ProjectEntry;
}

export async function updateProjectThumbnail(
  id: string,
  input: { dataUrl: string } | { thumbnailPath: string } | { reset: true },
  signal?: AbortSignal,
): Promise<ProjectEntry> {
  const res = await fetch(
    `${API_URL}/api/projects/${encodeURIComponent(id)}/thumbnail`,
    withSignal(
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify(input),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as ProjectEntry;
}

/** Clear the explicit thumbnail so the generated cover wins (0135). */
export function resetProjectThumbnail(id: string, signal?: AbortSignal): Promise<ProjectEntry> {
  return updateProjectThumbnail(id, { reset: true }, signal);
}

// ---------- 0135: generated project cover ----------

export interface ProjectCoverWriteResult {
  bytes: number;
  capturedAt: number;
}

/** Project artwork must be fetched through the authenticated client in OIDC. */
export function isProjectArtworkUrl(input: string): boolean {
  try {
    const url = new URL(input, API_URL);
    const api = new URL(API_URL);
    return (
      url.origin === api.origin &&
      /^\/api\/projects\/[^/]+\/(?:cover|thumbnail)$/u.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export async function fetchProjectArtworkBlob(
  url: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<Blob> {
  const res = await fetcher(url, withSignal({ headers: authHeaders() }, signal));
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return await res.blob();
}

export async function updateProjectCover(
  id: string,
  input: { dataUrl: string; screenId: string },
  signal?: AbortSignal,
): Promise<ProjectCoverWriteResult> {
  const res = await fetch(
    `${API_URL}/api/projects/${encodeURIComponent(id)}/cover`,
    withSignal(
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify(input),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as ProjectCoverWriteResult;
}

/** Pin a screen as the cover source, or pass `null` to return to auto. */
export async function setProjectCoverScreen(
  id: string,
  screenId: string | null,
  signal?: AbortSignal,
): Promise<ProjectEntry> {
  const res = await fetch(
    `${API_URL}/api/projects/${encodeURIComponent(id)}/cover-screen`,
    withSignal(
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ screenId }),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as ProjectEntry;
}
