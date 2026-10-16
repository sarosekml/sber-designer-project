/** Product-owned MCP servers: status, connect/disconnect, tool toggles. */
import { API_URL, ApiError, authHeaders, safeJson, withSignal } from './http';

export type ProductMcpTransport = 'stdio' | 'streamable-http';
export type ProductMcpTransportStatus =
  | 'disabled'
  | 'not_connected'
  | 'connecting'
  | 'connected'
  | 'failed';
export type ProductMcpUpstreamStatus =
  | 'n/a'
  | 'needs_channel'
  | 'plugin_offline'
  | 'plugin_unreachable'
  | 'ready';

export interface ProductMcpDiagnostic {
  level: 'info' | 'warning' | 'error';
  code: string;
  message: string;
}

export interface ProductMcpToolSummary {
  name: string;
  displayName?: string;
  description?: string;
  enabled: boolean;
  configuredDisabled?: boolean;
  runtimeDisabled?: boolean;
  hiddenByLimit?: boolean;
  blockedBySelectionLimit?: boolean;
  blockedBySelectionMinimum?: boolean;
  canToggle?: boolean;
  canonicalName?: string;
  inputSchema?: Record<string, unknown>;
}

export interface ProductMcpServerSummary {
  key: string;
  namespace: string;
  transport: ProductMcpTransport;
  enabled: boolean;
  configEnabled: boolean;
  runtimeEnabled: boolean;
  remote: boolean;
  description?: string;
  serverInfo?: {
    name?: string;
    version?: string;
    instructions?: string;
  };
  configHash: string;
  status: {
    transport: ProductMcpTransportStatus;
    upstream: ProductMcpUpstreamStatus;
    toolsReady: boolean;
    lastConnectedAt?: string;
    lastError?: string;
  };
  toolCount: number;
  selectionMode: 'auto' | 'explicit';
  selectionLimit: number;
  selectedToolCount: number;
  discoveredToolCount: number;
  tools: ProductMcpToolSummary[];
  config: Record<string, unknown>;
  diagnostics: ProductMcpDiagnostic[];
}

export interface ProductMcpStatusResponse {
  servers: ProductMcpServerSummary[];
  diagnostics: ProductMcpDiagnostic[];
}

export async function fetchProductMcpStatus(
  signal?: AbortSignal,
): Promise<ProductMcpStatusResponse> {
  const res = await fetch(
    `${API_URL}/api/mcp/status`,
    withSignal({ headers: authHeaders() }, signal),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as ProductMcpStatusResponse;
}

export async function reloadProductMcpStatus(
  signal?: AbortSignal,
): Promise<ProductMcpStatusResponse & { ok: true }> {
  const res = await fetch(
    `${API_URL}/api/mcp/reload`,
    withSignal({ method: 'POST', headers: authHeaders() }, signal),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as ProductMcpStatusResponse & { ok: true };
}

export async function connectProductMcpServer(
  key: string,
  signal?: AbortSignal,
): Promise<ProductMcpStatusResponse> {
  return productMcpAction(`${encodeURIComponent(key)}/connect`, 'POST', undefined, signal);
}

export async function disconnectProductMcpServer(
  key: string,
  signal?: AbortSignal,
): Promise<ProductMcpStatusResponse> {
  return productMcpAction(`${encodeURIComponent(key)}/disconnect`, 'POST', undefined, signal);
}

export async function restartProductMcpServer(
  key: string,
  signal?: AbortSignal,
): Promise<ProductMcpStatusResponse> {
  return productMcpAction(`${encodeURIComponent(key)}/restart`, 'POST', undefined, signal);
}

export async function setProductMcpServerEnabled(
  key: string,
  enabled: boolean,
  signal?: AbortSignal,
): Promise<ProductMcpStatusResponse> {
  return productMcpAction(`${encodeURIComponent(key)}/enabled`, 'PATCH', { enabled }, signal);
}

export async function setProductMcpToolEnabled(
  key: string,
  toolName: string,
  enabled: boolean,
  signal?: AbortSignal,
): Promise<ProductMcpStatusResponse> {
  return productMcpAction(
    `${encodeURIComponent(key)}/tools/${encodeURIComponent(toolName)}/enabled`,
    'PATCH',
    { enabled },
    signal,
  );
}

export async function resetProductMcpToolOverrides(
  key: string,
  signal?: AbortSignal,
): Promise<ProductMcpStatusResponse> {
  return productMcpAction(
    `${encodeURIComponent(key)}/tools/overrides`,
    'DELETE',
    undefined,
    signal,
  );
}

export async function fetchProductMcpServerTools(
  key: string,
  signal?: AbortSignal,
): Promise<{ key: string; tools: ProductMcpToolSummary[] }> {
  const res = await fetch(
    `${API_URL}/api/mcp/${encodeURIComponent(key)}/tools`,
    withSignal({ headers: authHeaders() }, signal),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as { key: string; tools: ProductMcpToolSummary[] };
}

async function productMcpAction(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
  signal?: AbortSignal,
): Promise<ProductMcpStatusResponse> {
  const res = await fetch(
    `${API_URL}/api/mcp/${path}`,
    withSignal(
      {
        method,
        headers: {
          ...authHeaders(),
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const errorBody = await safeJson(res);
    throw new ApiError(errorBody?.detail ?? `HTTP ${res.status}`, res.status, errorBody?.error);
  }
  return (await res.json()) as ProductMcpStatusResponse;
}
