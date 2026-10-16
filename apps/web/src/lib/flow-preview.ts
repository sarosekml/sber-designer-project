import type { ProjectFlowPreviewCapture, ProjectScreen } from '@sber-designer/shared-types';

import { apiBaseUrl } from './api-client';
import type { NormalizedFlowViewSettings } from './flow-view';

const FLOW_CAPTURE_PREFIX = '.sber-designer/previews/screens/';

export interface CurrentFlowPreviewCapture {
  capture: ProjectFlowPreviewCapture | null;
  stale: boolean;
}

export function flowScreenPreviewFingerprint(screen: ProjectScreen): string {
  return stableStringify({
    kind: screen.kind,
    // 0132: page↔modal conversion changes what the preview should show (scrim +
    // dialog vs full page), so a stale capture must invalidate.
    surface: screen.surface ?? 'page',
    storyId: screen.storyId ?? null,
    filePath: screen.filePath ?? null,
    implementationFilePath: screen.implementationFilePath ?? null,
    thumbnail: screen.thumbnail ?? null,
  });
}

export function currentFlowPreviewCapture(
  view: NormalizedFlowViewSettings,
  screen: ProjectScreen,
): CurrentFlowPreviewCapture {
  const capture = view.previewCaptures.find((item) => item.screenId === screen.id) ?? null;
  if (!capture) return { capture: null, stale: false };
  return {
    capture,
    stale: capture.sourceFingerprint !== flowScreenPreviewFingerprint(screen),
  };
}

export function mergeFlowPreviewCaptures(
  current: readonly ProjectFlowPreviewCapture[],
  next: readonly ProjectFlowPreviewCapture[],
): ProjectFlowPreviewCapture[] {
  const byScreenId = new Map<string, ProjectFlowPreviewCapture>();
  for (const capture of current) byScreenId.set(capture.screenId, capture);
  for (const capture of next) byScreenId.set(capture.screenId, capture);
  return Array.from(byScreenId.values());
}

export function flowPreviewImageSrc(path: string, version?: number): string {
  if (isAbsoluteBrowserUrl(path)) return path;
  if (path.startsWith('/api/')) return `${apiBaseUrl}${path}${versionSuffix(path, version)}`;
  if (path.startsWith('/')) return `${path}${versionSuffix(path, version)}`;
  if (path.startsWith(FLOW_CAPTURE_PREFIX)) {
    const fileName = path.slice(FLOW_CAPTURE_PREFIX.length);
    const screenId = fileName.replace(/\.png$/i, '');
    return `${apiBaseUrl}/api/flow/previews/screens/${encodeURIComponent(screenId)}.png${versionSuffix(
      '',
      version,
    )}`;
  }
  return path;
}

export function absoluteFlowPreviewUrl(url: string, origin?: string): string {
  try {
    return new URL(url).toString();
  } catch {
    const base =
      origin ?? (typeof window === 'undefined' ? 'http://localhost:5173' : window.location.origin);
    return new URL(url, base).toString();
  }
}

function isAbsoluteBrowserUrl(path: string): boolean {
  return (
    path.startsWith('data:') ||
    path.startsWith('blob:') ||
    path.startsWith('http://') ||
    path.startsWith('https://')
  );
}

function versionSuffix(path: string, version: number | undefined): string {
  if (!version) return '';
  return `${path.includes('?') ? '&' : '?'}v=${version}`;
}

function stableStringify(value: Record<string, unknown>): string {
  return JSON.stringify(
    Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = value[key];
        return acc;
      }, {}),
  );
}
