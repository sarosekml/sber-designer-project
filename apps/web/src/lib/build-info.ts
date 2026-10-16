/**
 * Pure formatting for the build marker shown in Settings → About, the editor
 * status bar and the Home footer. Kept apart from the store so it can be
 * tested without React or the network.
 */
import type { BuildInfo } from '@/lib/api/version';

export const DEFAULT_PRODUCT_NAME = 'sber-designer';

export function shortGitSha(sha: string): string {
  return sha.trim().slice(0, 7);
}

/** `1.0.0-beta` → `v1.0.0-beta`; a git tag that already starts with `v` is kept. */
export function displayVersion(version: string): string {
  const trimmed = version.trim();
  return /^v\d/i.test(trimmed) ? trimmed : `v${trimmed}`;
}

export function productNameOf(info: BuildInfo): string {
  return info.productName?.trim() || DEFAULT_PRODUCT_NAME;
}

export function formatBuildTime(buildTime: string): string {
  const parsed = new Date(buildTime);
  if (Number.isNaN(parsed.getTime())) return buildTime;
  return `${parsed.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/** One-line summary used as the tooltip of the compact version labels. */
export function buildInfoSummary(info: BuildInfo): string {
  const parts = [
    `${productNameOf(info)} ${displayVersion(info.version)}`,
    `commit ${shortGitSha(info.gitSha)}`,
    `built ${formatBuildTime(info.buildTime)}`,
  ];
  if (info.author) parts.push(`by ${info.author}`);
  return parts.join(' · ');
}
