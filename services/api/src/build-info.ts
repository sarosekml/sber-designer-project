import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface BuildInfo {
  version: string;
  gitSha: string;
  buildTime: string;
  /** Optional so BUILD_INFO.json files written before these fields still load. */
  productName?: string;
  author?: string;
}

export const DEFAULT_BUILD_INFO_PATH = fileURLToPath(
  new URL('../../../BUILD_INFO.json', import.meta.url),
);

type RequiredBuildInfoKey = 'version' | 'gitSha' | 'buildTime';
type OptionalBuildInfoKey = 'productName' | 'author';

function requiredString(
  record: Record<string, unknown>,
  key: RequiredBuildInfoKey,
  source: string,
): string {
  const value = record[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${source}: ${key} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(
  record: Record<string, unknown>,
  key: OptionalBuildInfoKey,
  source: string,
): string | undefined {
  const value = record[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new Error(`${source}: ${key} must be a string when present`);
  }
  return value.trim() || undefined;
}

export function parseBuildInfo(value: unknown, source = 'BUILD_INFO.json'): BuildInfo {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${source}: expected a JSON object`);
  }

  const record = value as Record<string, unknown>;
  const buildInfo: BuildInfo = {
    version: requiredString(record, 'version', source),
    gitSha: requiredString(record, 'gitSha', source),
    buildTime: requiredString(record, 'buildTime', source),
  };
  const productName = optionalString(record, 'productName', source);
  const author = optionalString(record, 'author', source);
  if (productName) buildInfo.productName = productName;
  if (author) buildInfo.author = author;

  if (Number.isNaN(Date.parse(buildInfo.buildTime))) {
    throw new Error(`${source}: buildTime must be an ISO-8601 timestamp`);
  }

  return buildInfo;
}

export function loadBuildInfo(path = DEFAULT_BUILD_INFO_PATH): BuildInfo {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot read build info at ${path}: ${message}`);
  }
  return parseBuildInfo(parsed, path);
}
