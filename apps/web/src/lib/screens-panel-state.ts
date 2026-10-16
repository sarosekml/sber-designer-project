import {
  isHtmlDesignSystemPath,
  isHtmlDesignSystemCanonical,
  isHtmlDesignSystemMissing,
  type AssistantActiveRun,
  type ProjectScreensPanelSettings,
  type ProjectScreen,
  type SberDesignerProjectKind,
  type HtmlDesignSystemStatus,
} from '@sber-designer/shared-types';

import { groupProjectScreens, normalizeScreenFolder } from './screen-folders';

export interface NormalizedScreensPanelSettings {
  collapsedFolderNames: string[];
  htmlDesignSystemDistillNudgeDismissedKey?: string;
}

export interface HtmlDesignSystemDistillationNudgeModel {
  visible: boolean;
  dismissKey: string;
  pageCount: number;
  pages: string[];
  title: string;
  message: string;
  primaryLabel: string;
  dismissLabel: string;
}

export function normalizeScreensPanelSettings(
  settings: ProjectScreensPanelSettings | null | undefined,
): NormalizedScreensPanelSettings {
  const dismissedKey = normalizeOptionalString(settings?.htmlDesignSystemDistillNudgeDismissedKey);
  return {
    collapsedFolderNames: uniqueNormalizedFolders(settings?.collapsedFolderNames),
    ...(dismissedKey ? { htmlDesignSystemDistillNudgeDismissedKey: dismissedKey } : {}),
  };
}

export function toggleCollapsedScreenFolder(
  settings: ProjectScreensPanelSettings | null | undefined,
  folderName: string,
): NormalizedScreensPanelSettings {
  const normalized = normalizeScreensPanelSettings(settings);
  const folder = normalizeScreenFolder(folderName);
  return normalized.collapsedFolderNames.includes(folder)
    ? {
        ...normalized,
        collapsedFolderNames: normalized.collapsedFolderNames.filter((item) => item !== folder),
      }
    : { ...normalized, collapsedFolderNames: [...normalized.collapsedFolderNames, folder] };
}

export function migrateCollapsedScreenFolder(
  settings: ProjectScreensPanelSettings | null | undefined,
  fromFolderName: string,
  toFolderName: string,
): NormalizedScreensPanelSettings {
  const from = normalizeScreenFolder(fromFolderName);
  const to = normalizeScreenFolder(toFolderName);
  if (from === to) return normalizeScreensPanelSettings(settings);
  const normalized = normalizeScreensPanelSettings(settings);
  return {
    ...normalized,
    collapsedFolderNames: uniqueNormalizedFolders(
      normalized.collapsedFolderNames.map((folder) => (folder === from ? to : folder)),
    ),
  };
}

export function pruneCollapsedScreenFolders(
  settings: ProjectScreensPanelSettings | null | undefined,
  screens: readonly ProjectScreen[],
): NormalizedScreensPanelSettings {
  const existingFolders = new Set(groupProjectScreens(screens).map((group) => group.name));
  const normalized = normalizeScreensPanelSettings(settings);
  return {
    ...normalized,
    collapsedFolderNames: normalized.collapsedFolderNames.filter((folder) =>
      existingFolders.has(folder),
    ),
  };
}

export function assistantRunsProposalRefreshKey(
  runs: readonly Pick<AssistantActiveRun, 'clientRunId' | 'status' | 'updatedAt'>[],
): string {
  return runs
    .map((run) => `${run.clientRunId}:${run.status}:${run.updatedAt}`)
    .sort()
    .join('|');
}

export function shouldShowDesignSystemReferenceAction(
  projectKind: SberDesignerProjectKind | null | undefined,
): boolean {
  return projectKind === 'html-first' || projectKind === 'react-vite';
}

export function shouldShowHtmlDesignSystemDistillAction(
  projectKind: SberDesignerProjectKind | null | undefined,
  screens: readonly ProjectScreen[],
  htmlDesignSystemStatus?: HtmlDesignSystemStatus | null | undefined,
): boolean {
  return (
    projectKind === 'html-first' &&
    !isHtmlDesignSystemCanonical(htmlDesignSystemStatus) &&
    distillableHtmlPagePaths(screens).length > 0
  );
}

export function shouldShowHtmlDesignSystemApplyAction(
  projectKind: SberDesignerProjectKind | null | undefined,
  screens: readonly ProjectScreen[],
  htmlDesignSystemStatus: HtmlDesignSystemStatus | null | undefined,
): boolean {
  return (
    projectKind === 'html-first' &&
    isHtmlDesignSystemCanonical(htmlDesignSystemStatus) &&
    distillableHtmlPagePaths(screens).length > 0
  );
}

export function buildHtmlDesignSystemDistillationNudge(input: {
  projectKind: SberDesignerProjectKind | null | undefined;
  screens: readonly ProjectScreen[];
  htmlDesignSystemStatus: HtmlDesignSystemStatus | null | undefined;
  proposalCount?: number | null | undefined;
  proposalLoading?: boolean | undefined;
  dismissedKey?: string | null | undefined;
}): HtmlDesignSystemDistillationNudgeModel {
  const pages = distillableHtmlPagePaths(input.screens);
  const dismissKey = `html-ds-distill:${pages.join(',')}`;
  const visible =
    input.projectKind === 'html-first' &&
    isHtmlDesignSystemMissing(input.htmlDesignSystemStatus) &&
    pages.length >= 2 &&
    !input.proposalLoading &&
    (input.proposalCount ?? 0) === 0 &&
    input.dismissedKey !== dismissKey;
  return {
    visible,
    dismissKey,
    pageCount: pages.length,
    pages,
    title: 'Distill design system',
    message: `${pages.length} HTML pages exist without an active design system. Create a reviewable Design.md proposal from the repeated tokens, classes, and patterns.`,
    primaryLabel: 'Distill design system',
    dismissLabel: 'Dismiss',
  };
}

export function distillableHtmlPagePaths(screens: readonly ProjectScreen[]): string[] {
  return Array.from(
    new Set(
      screens
        .flatMap((screen) => {
          const filePath = screen.implementationFilePath ?? screen.filePath ?? '';
          return isDistillableHtmlPage(screen, filePath) ? [normalizePath(filePath)] : [];
        })
        .sort(),
    ),
  );
}

function isDistillableHtmlPage(screen: ProjectScreen, filePath: string): boolean {
  if (screen.kind !== 'page') return false;
  const normalized = normalizePath(filePath);
  if (!/\.html?$/iu.test(normalized)) return false;
  if (isHtmlDesignSystemPath(normalized)) return false;
  const basename = normalized.split('/').at(-1) ?? normalized;
  const lowerBasename = basename.toLowerCase();
  return lowerBasename !== 'index.html' && lowerBasename !== 'design-system.html';
}

function uniqueNormalizedFolders(values: readonly string[] | null | undefined): string[] {
  return Array.from(new Set((values ?? []).map(normalizeScreenFolder)));
}

function normalizePath(value: string): string {
  return value
    .trim()
    .replace(/\\/gu, '/')
    .replace(/^\.\/+/u, '');
}

function normalizeOptionalString(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}
