/** Resolve durable run-to-screen attribution from every existing evidence source. */
import { isAbsolute, relative, resolve } from 'node:path';
import type { ProjectScreen } from '@sber-designer/shared-types';

import { getProject, isProjectLoaded, loadProjectForWorkspace } from '../../project-store';
import type { AgentRunManifest, AgentToolReceipt } from './types';

export type ScreenAttributionSource = 'active-screen' | 'receipt' | 'changed-files';

export interface RunScreenAttribution {
  screenIds: string[];
  sources: Record<string, ScreenAttributionSource>;
}

export async function resolveRunScreenAttribution(
  workspacePath: string,
  manifest: AgentRunManifest,
  receipts: readonly AgentToolReceipt[],
): Promise<RunScreenAttribution> {
  const sources: Record<string, ScreenAttributionSource> = {};
  if (manifest.activeScreen?.id) sources[manifest.activeScreen.id] = 'active-screen';

  for (const receipt of receipts) {
    const screenId = stringValue(receipt.metadata.screenId);
    if (screenId && !sources[screenId]) sources[screenId] = 'receipt';
  }

  const project = isProjectLoaded(workspacePath)
    ? getProject(workspacePath)
    : await loadProjectForWorkspace(workspacePath);
  const changedPaths = new Set(
    receipts
      .flatMap((receipt) => receipt.changedFiles)
      .map((path) => normalizePath(workspacePath, path)),
  );
  for (const screen of project.screens) {
    if (sources[screen.id]) continue;
    if (screenPaths(screen).some((path) => changedPaths.has(normalizePath(workspacePath, path)))) {
      sources[screen.id] = 'changed-files';
    }
  }

  return { screenIds: Object.keys(sources).sort((a, b) => a.localeCompare(b)), sources };
}

function screenPaths(screen: ProjectScreen): string[] {
  return [screen.filePath, screen.implementationFilePath].filter((path): path is string =>
    Boolean(path),
  );
}

function normalizePath(workspacePath: string, path: string): string {
  const workspaceRelative = isAbsolute(path)
    ? relative(resolve(workspacePath), resolve(path))
    : path;
  return workspaceRelative.replace(/\\/gu, '/').replace(/^\.\//u, '');
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
