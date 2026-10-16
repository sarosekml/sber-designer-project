import type {
  HostAppId,
  HostAppsResponse,
  OpenInHostAppResponse,
} from '@sber-designer/shared-types';

import { API_URL, ApiError, authHeaders, safeJson, withSignal } from './http';

export async function fetchHostApps(signal?: AbortSignal): Promise<HostAppsResponse> {
  const response = await fetch(
    `${API_URL}/api/host/apps`,
    withSignal({ headers: authHeaders() }, signal),
  );
  if (!response.ok) {
    const body = await safeJson(response);
    throw new ApiError(body?.detail ?? `HTTP ${response.status}`, response.status, body?.error);
  }
  return (await response.json()) as HostAppsResponse;
}

export async function openProjectInHostApp(
  appId: HostAppId,
  signal?: AbortSignal,
): Promise<OpenInHostAppResponse> {
  const response = await fetch(
    `${API_URL}/api/host/open-in`,
    withSignal(
      {
        method: 'POST',
        headers: { ...authHeaders(), 'content-type': 'application/json' },
        body: JSON.stringify({ appId }),
      },
      signal,
    ),
  );
  if (!response.ok) {
    const body = await safeJson(response);
    throw new ApiError(body?.detail ?? `HTTP ${response.status}`, response.status, body?.error);
  }
  return (await response.json()) as OpenInHostAppResponse;
}
