/**
 * Screen-folder file operations (rename/move/delete sync — task 0077),
 * screen health annotation, flow previews, and screen/project templates.
 */
import type {
  ProjectFlowPreviewCapture,
  ProjectScreen,
  ProjectTemplate,
  ScreenGenerationInfo,
  ScreenTemplate,
} from '@sber-designer/shared-types';

import { API_URL, ApiError, authHeaders, safeJson, withSignal } from './http';

export async function renameScreenFolderFiles(
  input: { from: string; to: string },
  signal?: AbortSignal,
): Promise<{
  ok: true;
  movedPaths: { from: string; to: string }[];
  updatedFiles: string[];
}> {
  const res = await fetch(
    `${API_URL}/api/screen-folders/rename`,
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
  return (await res.json()) as {
    ok: true;
    movedPaths: { from: string; to: string }[];
    updatedFiles: string[];
  };
}

export async function renameScreenFiles(
  input: { storyFilePath: string; implementationFilePath?: string; toName: string },
  signal?: AbortSignal,
): Promise<{
  ok: true;
  storyFilePath: string;
  implementationFilePath?: string;
  storyId: string;
  movedPaths: { from: string; to: string }[];
  updatedFiles: string[];
}> {
  const res = await fetch(
    `${API_URL}/api/screen-folders/screen/rename`,
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
  return (await res.json()) as {
    ok: true;
    storyFilePath: string;
    implementationFilePath?: string;
    storyId: string;
    movedPaths: { from: string; to: string }[];
    updatedFiles: string[];
  };
}

export async function moveScreenFiles(
  input: { storyFilePath: string; implementationFilePath?: string; toFolder: string },
  signal?: AbortSignal,
): Promise<{
  ok: true;
  storyFilePath: string;
  implementationFilePath?: string;
  storyId: string;
  movedPaths: { from: string; to: string }[];
  updatedFiles: string[];
  removedEmptyDirs: string[];
}> {
  const res = await fetch(
    `${API_URL}/api/screen-folders/screen/move`,
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
  return (await res.json()) as {
    ok: true;
    storyFilePath: string;
    implementationFilePath?: string;
    storyId: string;
    movedPaths: { from: string; to: string }[];
    updatedFiles: string[];
    removedEmptyDirs: string[];
  };
}

export async function annotateScreenHealth(
  input: { screens: ProjectScreen[] },
  signal?: AbortSignal,
): Promise<{
  ok: true;
  screens: ProjectScreen[];
}> {
  const res = await fetch(
    `${API_URL}/api/screen-folders/health`,
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
  return (await res.json()) as {
    ok: true;
    screens: ProjectScreen[];
  };
}

export interface FlowPreviewCaptureRequest {
  viewport: { width: number; height: number };
  screens: {
    screenId: string;
    url: string;
    sourceFingerprint: string;
  }[];
}

export interface FlowPreviewCaptureResponse {
  status: 'captured' | 'partial' | 'unavailable';
  captures: ProjectFlowPreviewCapture[];
  message?: string;
}

export async function captureFlowScreenPreviews(
  input: FlowPreviewCaptureRequest,
  signal?: AbortSignal,
): Promise<FlowPreviewCaptureResponse> {
  const res = await fetch(
    `${API_URL}/api/flow/previews/screens/capture`,
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
  return (await res.json()) as FlowPreviewCaptureResponse;
}

export async function fetchProjectTemplates(signal?: AbortSignal): Promise<ProjectTemplate[]> {
  const res = await fetch(
    `${API_URL}/api/project/templates`,
    withSignal({ headers: authHeaders() }, signal),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  const data = (await res.json()) as { templates: ProjectTemplate[] };
  return data.templates;
}

export async function fetchScreenTemplates(
  workspacePath?: string,
  signal?: AbortSignal,
): Promise<ScreenTemplate[]> {
  const url = new URL(`${API_URL}/api/project/screen-templates`);
  if (workspacePath) url.searchParams.set('workspacePath', workspacePath);
  const res = await fetch(url, withSignal({ headers: authHeaders() }, signal));
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  const data = (await res.json()) as { templates: ScreenTemplate[] };
  return data.templates;
}

export async function fetchScreenGenerationInfo(
  screenId: string,
  signal?: AbortSignal,
): Promise<ScreenGenerationInfo> {
  const res = await fetch(
    `${API_URL}/api/screens/${encodeURIComponent(screenId)}/generation-info`,
    withSignal({ headers: authHeaders() }, signal),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as ScreenGenerationInfo;
}
