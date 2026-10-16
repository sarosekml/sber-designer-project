import { API_URL, ApiError, authHeaders, safeJson, withSignal } from './http';

export type AdminUserRole = 'admin' | 'member';
export type AdminUserStatus = 'active' | 'disabled';
export type AdminCliRuntime = 'claude-code' | 'codex' | 'opencode' | 'kimi' | 'gigacode';

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface AdminSystemSettings {
  version: 1;
  registration: 'open' | 'closed';
  dsBrowser: { defaultEnabled: boolean };
  agents: { enabledCliRuntimes: AdminCliRuntime[] };
}

export interface AdminTrashProject {
  id: string;
  name: string;
  folder: string;
  originalWorkspacePath: string;
  sizeBytes: number;
  hasRemote: boolean;
  uncommitted: boolean;
  unpushedCommits: number;
  notPushedAnywhere: boolean;
}

export interface AdminTrashPreview {
  projects: AdminTrashProject[];
  totalBytes: number;
  riskyProjects: number;
}

export interface AdminTrashEntry extends AdminTrashPreview {
  version: 1;
  entryId: string;
  user: { id: string; email: string; displayName: string };
  deletedAt: string;
  deletedBy: string;
  userDataMoved: boolean;
}

export async function listAdminUsers(signal?: AbortSignal): Promise<AdminUser[]> {
  return (await adminRequest<{ users: AdminUser[] }>('/api/admin/users', {}, signal)).users;
}

export async function updateAdminUser(
  id: string,
  patch: { role?: AdminUserRole; status?: AdminUserStatus },
  signal?: AbortSignal,
): Promise<AdminUser> {
  const result = await adminRequest<{ user: AdminUser }>(
    `/api/admin/users/${encodeURIComponent(id)}`,
    jsonAdminRequest('PATCH', patch),
    signal,
  );
  return result.user;
}

export async function resetAdminUserPassword(
  id: string,
  signal?: AbortSignal,
): Promise<{ user: AdminUser; temporaryPassword: string }> {
  return adminRequest(
    `/api/admin/users/${encodeURIComponent(id)}/reset-password`,
    { method: 'POST', headers: authHeaders() },
    signal,
  );
}

export async function deleteAdminUser(
  id: string,
  confirm: string,
  signal?: AbortSignal,
): Promise<{
  user: AdminUser;
  workspaceDisposition: 'trash';
  trashEntry: AdminTrashEntry;
}> {
  return adminRequest(
    `/api/admin/users/${encodeURIComponent(id)}`,
    jsonAdminRequest('DELETE', { confirm }),
    signal,
  );
}

export async function getAdminUserStorage(
  id: string,
  signal?: AbortSignal,
): Promise<AdminTrashPreview> {
  return (
    await adminRequest<{ preview: AdminTrashPreview }>(
      `/api/admin/users/${encodeURIComponent(id)}/storage`,
      {},
      signal,
    )
  ).preview;
}

export async function listAdminTrash(signal?: AbortSignal): Promise<AdminTrashEntry[]> {
  return (await adminRequest<{ entries: AdminTrashEntry[] }>('/api/admin/trash', {}, signal))
    .entries;
}

export async function restoreAdminTrashProject(
  entryId: string,
  folder: string,
  targetUserId: string,
  signal?: AbortSignal,
): Promise<{ manifest: AdminTrashEntry; project: { id: string; name: string } }> {
  return adminRequest(
    `/api/admin/trash/${encodeURIComponent(entryId)}/restore`,
    jsonAdminRequest('POST', { folder, targetUserId }),
    signal,
  );
}

export async function purgeAdminTrash(
  entryId: string,
  folder?: string,
  signal?: AbortSignal,
): Promise<{ purgedEntry: boolean; manifest: AdminTrashEntry | null }> {
  const suffix = folder ? `?${new URLSearchParams({ folder }).toString()}` : '';
  return adminRequest(
    `/api/admin/trash/${encodeURIComponent(entryId)}${suffix}`,
    { method: 'DELETE', headers: authHeaders() },
    signal,
  );
}

export async function getAdminSettings(signal?: AbortSignal): Promise<AdminSystemSettings> {
  return (await adminRequest<{ settings: AdminSystemSettings }>('/api/admin/settings', {}, signal))
    .settings;
}

export async function updateAdminSettings(
  settings: Omit<AdminSystemSettings, 'version'>,
  signal?: AbortSignal,
): Promise<AdminSystemSettings> {
  return (
    await adminRequest<{ settings: AdminSystemSettings }>(
      '/api/admin/settings',
      jsonAdminRequest('PATCH', settings),
      signal,
    )
  ).settings;
}

function jsonAdminRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { ...authHeaders(), 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

async function adminRequest<T>(path: string, init: RequestInit, signal?: AbortSignal): Promise<T> {
  const response = await fetch(
    `${API_URL}${path}`,
    withSignal({ headers: authHeaders(), ...init }, signal),
  );
  if (!response.ok) {
    const body = await safeJson(response);
    throw new ApiError(body?.detail ?? `HTTP ${response.status}`, response.status, body?.error);
  }
  return (await response.json()) as T;
}
