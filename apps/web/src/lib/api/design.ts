/** Design mode endpoints: catalog, inspect, tokens, visual changes. */
import type { ComponentCatalog } from '@sber-designer/shared-types';
import type {
  DesignInspectResult,
  DesignTarget,
  DesignTokens,
  VisualChange,
} from '@/lib/design-types';
import { toDesignSelection } from '@/lib/design-types';
import type { SelectedNode } from '@/stores/editor-store';

import { API_URL, ApiError, authHeaders, safeJson, withSignal } from './http';

export async function fetchCatalog(
  options: { previewUrl?: string; refresh?: boolean } = {},
  signal?: AbortSignal,
): Promise<ComponentCatalog> {
  const url = new URL(`${API_URL}/api/catalog`);
  if (options.previewUrl) url.searchParams.set('previewUrl', options.previewUrl);
  if (options.refresh) url.searchParams.set('refresh', '1');
  const res = await fetch(url, withSignal({ headers: authHeaders() }, signal));
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as ComponentCatalog;
}

// ---------- /api/design (Visual Design MVP) ----------

export async function inspectDesignSelection(
  input: {
    workspacePath?: string;
    selection: SelectedNode;
    activeScreen?: {
      id: string;
      storyId?: string;
      filePath?: string;
      implementationFilePath?: string;
    };
  },
  signal?: AbortSignal,
): Promise<DesignInspectResult> {
  const res = await fetch(
    `${API_URL}/api/design/inspect`,
    withSignal(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          ...input,
          selection: toDesignSelection(input.selection),
        }),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as DesignInspectResult;
}

export async function fetchDesignTokens(
  workspacePath?: string,
  signal?: AbortSignal,
): Promise<DesignTokens> {
  const url = new URL(`${API_URL}/api/design/tokens`);
  if (workspacePath) url.searchParams.set('workspacePath', workspacePath);
  const res = await fetch(url, withSignal({ headers: authHeaders() }, signal));
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as DesignTokens;
}

export async function applyVisualChanges(
  input: {
    workspacePath?: string;
    screenId?: string;
    target: DesignTarget;
    changes: VisualChange[];
    baseline?: { filePath: string; hash: string };
  },
  signal?: AbortSignal,
): Promise<{
  ok: true;
  changedFiles: string[];
  ops: Array<{ kind: string; file: string }>;
  diffs: Array<{ path: string; before: string; after: string }>;
  baselines: Array<{ filePath: string; hash: string }>;
}> {
  const res = await fetch(
    `${API_URL}/api/design/apply`,
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
    changedFiles: string[];
    ops: Array<{ kind: string; file: string }>;
    diffs: Array<{ path: string; before: string; after: string }>;
    baselines: Array<{ filePath: string; hash: string }>;
  };
}

/**
 * Managed modal-size apply (0132.3). Writes the size contract on the screen's
 * `data-sd-modal-window` deterministically (HTML rewrite or JSX ops), separate
 * from the selection apply path.
 */
export async function applyModalSize(
  input: {
    workspacePath?: string;
    screenId?: string;
    filePath: string;
    patch: { width?: string; height?: string; longContent?: 'scroll' | 'grow' };
    baseline?: { hash: string };
  },
  signal?: AbortSignal,
): Promise<{
  ok: true;
  changedFiles: string[];
  diff: { path: string; before: string; after: string };
  baseline: { filePath: string; hash: string };
}> {
  const res = await fetch(
    `${API_URL}/api/design/modal-size`,
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
    changedFiles: string[];
    diff: { path: string; before: string; after: string };
    baseline: { filePath: string; hash: string };
  };
}

export async function fetchModalSizeBaseline(
  input: { workspacePath?: string; filePath: string },
  signal?: AbortSignal,
): Promise<{ filePath: string; hash: string }> {
  const res = await fetch(
    `${API_URL}/api/design/modal-size/read`,
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
  return (await res.json()) as { filePath: string; hash: string };
}
