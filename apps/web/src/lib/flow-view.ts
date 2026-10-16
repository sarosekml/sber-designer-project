import type {
  ProjectFlowEdge,
  ProjectFlowPreviewCapture,
  ProjectFlowViewSettings,
  ProjectScreen,
} from '@sber-designer/shared-types';

import { normalizeScreenFolder } from './screen-folders';

export const DEFAULT_FLOW_PREVIEW_VIEWPORT = { width: 1280, height: 720 } as const;

export interface NormalizedFlowViewSettings {
  previewSize: 'compact' | 'frames';
  showConnections: boolean;
  showDescriptions: boolean;
  hiddenScreenIds: string[];
  hiddenFolderNames: string[];
  hiddenEdgeIds: string[];
  previewViewport: { width: number; height: number };
  previewCaptures: ProjectFlowPreviewCapture[];
}

export function normalizeFlowView(
  view: ProjectFlowViewSettings | null | undefined,
): NormalizedFlowViewSettings {
  return {
    previewSize: view?.previewSize ?? 'compact',
    showConnections: view?.showConnections ?? true,
    showDescriptions: view?.showDescriptions ?? false,
    hiddenScreenIds: uniqueStrings(view?.hiddenScreenIds),
    hiddenFolderNames: uniqueStrings(view?.hiddenFolderNames).map(normalizeScreenFolder),
    hiddenEdgeIds: uniqueStrings(view?.hiddenEdgeIds),
    previewViewport: {
      width: view?.previewViewport?.width ?? DEFAULT_FLOW_PREVIEW_VIEWPORT.width,
      height: view?.previewViewport?.height ?? DEFAULT_FLOW_PREVIEW_VIEWPORT.height,
    },
    previewCaptures: uniquePreviewCaptures(view?.previewCaptures),
  };
}

export function isScreenHiddenInFlow(
  screen: ProjectScreen,
  view: ProjectFlowViewSettings | NormalizedFlowViewSettings | null | undefined,
): boolean {
  const normalized = normalizeFlowView(view);
  return (
    normalized.hiddenScreenIds.includes(screen.id) ||
    normalized.hiddenFolderNames.includes(normalizeScreenFolder(screen.folder))
  );
}

export function visibleFlowScreens(
  screens: readonly ProjectScreen[],
  view: ProjectFlowViewSettings | NormalizedFlowViewSettings | null | undefined,
): ProjectScreen[] {
  const normalized = normalizeFlowView(view);
  return screens.filter((screen) => !isScreenHiddenInFlow(screen, normalized));
}

export function visibleFlowEdges(
  edges: readonly ProjectFlowEdge[],
  screens: readonly ProjectScreen[],
  view: ProjectFlowViewSettings | NormalizedFlowViewSettings | null | undefined,
): ProjectFlowEdge[] {
  const normalized = normalizeFlowView(view);
  if (!normalized.showConnections) return [];

  const visibleScreenIds = new Set(
    visibleFlowScreens(screens, normalized).map((screen) => screen.id),
  );
  return edges.filter(
    (edge) =>
      !normalized.hiddenEdgeIds.includes(edge.id) &&
      visibleScreenIds.has(edge.fromScreenId) &&
      visibleScreenIds.has(edge.toScreenId),
  );
}

export function toggleFlowScreenHidden(
  view: ProjectFlowViewSettings | null | undefined,
  screenId: string,
): NormalizedFlowViewSettings {
  const normalized = normalizeFlowView(view);
  return {
    ...normalized,
    hiddenScreenIds: toggleString(normalized.hiddenScreenIds, screenId),
  };
}

export function toggleFlowFolderHidden(
  view: ProjectFlowViewSettings | null | undefined,
  folderName: string,
): NormalizedFlowViewSettings {
  const normalized = normalizeFlowView(view);
  const folder = normalizeScreenFolder(folderName);
  return {
    ...normalized,
    hiddenFolderNames: toggleString(normalized.hiddenFolderNames, folder),
  };
}

export function toggleFlowEdgeHidden(
  view: ProjectFlowViewSettings | null | undefined,
  edgeId: string,
): NormalizedFlowViewSettings {
  const normalized = normalizeFlowView(view);
  return {
    ...normalized,
    hiddenEdgeIds: toggleString(normalized.hiddenEdgeIds, edgeId),
  };
}

export function migrateHiddenFlowFolder(
  view: ProjectFlowViewSettings | null | undefined,
  fromFolderName: string,
  toFolderName: string,
): NormalizedFlowViewSettings {
  const normalized = normalizeFlowView(view);
  const from = normalizeScreenFolder(fromFolderName);
  const to = normalizeScreenFolder(toFolderName);
  if (from === to) return normalized;
  return {
    ...normalized,
    hiddenFolderNames: uniqueStrings(
      normalized.hiddenFolderNames.map((folder) => (folder === from ? to : folder)),
    ),
  };
}

export function setFlowPreviewSize(
  view: ProjectFlowViewSettings | null | undefined,
  previewSize: 'compact' | 'frames',
): NormalizedFlowViewSettings {
  return { ...normalizeFlowView(view), previewSize };
}

export function setFlowConnectionsVisible(
  view: ProjectFlowViewSettings | null | undefined,
  showConnections: boolean,
): NormalizedFlowViewSettings {
  return { ...normalizeFlowView(view), showConnections };
}

export function setFlowDescriptionsVisible(
  view: ProjectFlowViewSettings | null | undefined,
  showDescriptions: boolean,
): NormalizedFlowViewSettings {
  return { ...normalizeFlowView(view), showDescriptions };
}

function toggleString(values: readonly string[], value: string): string[] {
  if (values.includes(value)) return values.filter((item) => item !== value);
  return [...values, value];
}

function uniqueStrings(values: readonly string[] | null | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)));
}

function uniquePreviewCaptures(
  captures: readonly ProjectFlowPreviewCapture[] | null | undefined,
): ProjectFlowPreviewCapture[] {
  const byScreenId = new Map<string, ProjectFlowPreviewCapture>();
  for (const capture of captures ?? []) {
    if (!capture.screenId.trim() || !capture.imagePath.trim()) continue;
    const current = byScreenId.get(capture.screenId);
    if (current && current.capturedAt > capture.capturedAt) continue;
    byScreenId.set(capture.screenId, capture);
  }
  return Array.from(byScreenId.values());
}
