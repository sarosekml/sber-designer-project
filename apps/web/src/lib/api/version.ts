/**
 * Client for the public GET /api/version endpoint: the build marker the API
 * process snapshotted from BUILD_INFO.json at startup. A 503 means the
 * marker was never written (`bun run build:info`), which the UI reports
 * instead of hiding.
 */
import { API_URL, safeJson } from './http';

export interface BuildInfo {
  version: string;
  gitSha: string;
  buildTime: string;
  productName?: string;
  author?: string;
}

export type BuildInfoResult =
  | { state: 'ready'; info: BuildInfo }
  | { state: 'unavailable'; detail: string };

export const BUILD_INFO_UNAVAILABLE_DETAIL =
  'Build metadata unavailable — run `bun run build:info` and restart the API.';

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Validate the JSON body; anything malformed is treated as "unavailable". */
export function parseBuildInfoResponse(value: unknown): BuildInfo | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const version = optionalText(record.version);
  const gitSha = optionalText(record.gitSha);
  const buildTime = optionalText(record.buildTime);
  if (!version || !gitSha || !buildTime) return null;
  const info: BuildInfo = { version, gitSha, buildTime };
  const productName = optionalText(record.productName);
  const author = optionalText(record.author);
  if (productName) info.productName = productName;
  if (author) info.author = author;
  return info;
}

export async function fetchBuildInfo(signal?: AbortSignal): Promise<BuildInfoResult> {
  const res = await fetch(`${API_URL}/api/version`, signal ? { signal } : {});
  if (res.status === 503) {
    await safeJson(res, { redirectUnauthorized: false });
    return { state: 'unavailable', detail: BUILD_INFO_UNAVAILABLE_DETAIL };
  }
  if (!res.ok) {
    const body = await safeJson(res, { redirectUnauthorized: false });
    throw new Error(body?.detail ?? `HTTP ${res.status}`);
  }
  const info = parseBuildInfoResponse(await res.json().catch(() => null));
  return info
    ? { state: 'ready', info }
    : { state: 'unavailable', detail: BUILD_INFO_UNAVAILABLE_DETAIL };
}
