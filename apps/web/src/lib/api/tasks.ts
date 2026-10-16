/** Project task tracker: tasks list, env status, connection test. */
import type { ProjectTask, TaskTrackerConfig, TaskTrackerType } from '@sber-designer/shared-types';

import { API_URL, ApiError, authHeaders, safeJson, withSignal } from './http';

export interface TrackerEnvStatus {
  type: TaskTrackerType;
  ok: boolean;
  missingEnvVars: string[];
}

export interface TrackerConnectionResult {
  ok: boolean;
  message: string;
  taskCount?: number;
}

export async function fetchTasks(signal?: AbortSignal): Promise<ProjectTask[]> {
  const res = await fetch(`${API_URL}/api/tasks`, withSignal({ headers: authHeaders() }, signal));
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  const data = (await res.json()) as { tasks: ProjectTask[] };
  return data.tasks;
}

export async function checkTrackerEnv(
  type: TaskTrackerType,
  signal?: AbortSignal,
): Promise<TrackerEnvStatus> {
  const url = new URL(`${API_URL}/api/tasks/check-env`);
  url.searchParams.set('type', type);
  const res = await fetch(url, withSignal({ headers: authHeaders() }, signal));
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as TrackerEnvStatus;
}

export async function testTrackerConnection(
  config: TaskTrackerConfig,
  signal?: AbortSignal,
): Promise<TrackerConnectionResult> {
  const res = await fetch(
    `${API_URL}/api/tasks/test-connection`,
    withSignal(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify(config),
      },
      signal,
    ),
  );
  const body = (await res.json().catch(() => null)) as TrackerConnectionResult & {
    error?: string;
    detail?: string;
  };
  if (!res.ok) {
    if (body?.message) return { ok: false, message: body.message };
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return body;
}
