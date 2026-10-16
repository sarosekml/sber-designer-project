/** Read-only share links: create and resolve snapshots. */
import { API_URL, ApiError, authHeaders, safeJson, withSignal } from './http';

export interface ShareSnapshot {
  token: string;
  createdAt: number;
  expiresAt: number;
  project: import('@sber-designer/shared-types').SberDesignerProject;
  previewUrl: string | null;
  /** Phase 6.3 — true if this share has a password gate. */
  passwordRequired?: boolean;
}

/** Returned when the viewer asks for a locked share without the right password. */
export interface ShareLockedStub {
  token: string;
  createdAt: number;
  expiresAt: number;
  passwordRequired: true;
  locked: true;
}

export interface CreateShareInput {
  ttlMs?: number;
  /** Optional password gate. If set, viewers must provide it. */
  password?: string;
}

export async function createShare(
  input: CreateShareInput = {},
  signal?: AbortSignal,
): Promise<ShareSnapshot> {
  const body: Record<string, unknown> = {};
  if (input.ttlMs !== undefined) body.ttlMs = input.ttlMs;
  if (input.password) body.password = input.password;
  const res = await fetch(
    `${API_URL}/api/share`,
    withSignal(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const errBody = await safeJson(res);
    throw new ApiError(errBody?.detail ?? `HTTP ${res.status}`, res.status, errBody?.error);
  }
  return (await res.json()) as ShareSnapshot;
}

export async function fetchShare(
  token: string,
  password?: string,
  signal?: AbortSignal,
): Promise<ShareSnapshot | ShareLockedStub> {
  // Public — no x-sber-designer-user header.
  const headers: HeadersInit = password ? { 'x-share-password': password } : {};
  const res = await fetch(
    `${API_URL}/api/share/${encodeURIComponent(token)}`,
    withSignal({ headers }, signal),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as ShareSnapshot | ShareLockedStub;
}

// ---------- /api/scaffold (Phase 5.4) ----------
