/** Workspace file read/write/delete endpoints. */
import { API_URL, ApiError, authHeaders, safeJson, withSignal } from './http';

export interface FileContents {
  path: string;
  contents: string;
}

export async function fetchFile(path: string, signal?: AbortSignal): Promise<FileContents> {
  const url = new URL(`${API_URL}/api/files`);
  url.searchParams.set('path', path);
  const res = await fetch(url, withSignal({ headers: authHeaders() }, signal));
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as FileContents;
}

export async function writeFile(
  path: string,
  contents: string,
  signal?: AbortSignal,
): Promise<{ ok: true; path: string }> {
  const res = await fetch(
    `${API_URL}/api/files`,
    withSignal(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ path, contents }),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as { ok: true; path: string };
}

export async function deleteFile(
  path: string,
  signal?: AbortSignal,
): Promise<{ ok: true; path: string }> {
  const url = new URL(`${API_URL}/api/files`);
  url.searchParams.set('path', path);
  const res = await fetch(
    url,
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
  return (await res.json()) as { ok: true; path: string };
}

export async function moveFile(
  input: { fromPath: string; toPath: string },
  signal?: AbortSignal,
): Promise<{ ok: true; fromPath: string; toPath: string }> {
  const res = await fetch(
    `${API_URL}/api/files/move`,
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
  return (await res.json()) as { ok: true; fromPath: string; toPath: string };
}
