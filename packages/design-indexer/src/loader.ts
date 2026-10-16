import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import { fingerprintDesignIndex } from './fingerprint';
import { buildProjectSystemOverview } from './project-system-overview';
import {
  CANONICAL_DESIGN_INDEX_PATHS,
  DESIGN_INDEX_PATHS,
  type DesignIndexArtifact,
  type DesignIndexContext,
  type DesignIndexDiagnostic,
  type DesignIndexFingerprintState,
  type DesignIndexManifest,
  type ComponentDescriptionMapEntry,
  type ComponentSelectionMap,
} from './types';

export async function loadDesignIndex(workspaceRoot: string): Promise<DesignIndexContext> {
  const fingerprint = await fingerprintDesignIndex(workspaceRoot);
  const artifacts = await Promise.all(
    Object.values(CANONICAL_DESIGN_INDEX_PATHS).map((filePath) =>
      readArtifact(workspaceRoot, filePath),
    ),
  );
  const canonicalManifest = await readJson<DesignIndexManifest>(
    workspaceRoot,
    DESIGN_INDEX_PATHS.manifest,
  );
  const legacyManifest = canonicalManifest
    ? null
    : await readJson<DesignIndexManifest>(workspaceRoot, DESIGN_INDEX_PATHS.legacyManifest);
  const manifest = canonicalManifest ?? legacyManifest;
  const savedFingerprint = await readJson<DesignIndexFingerprintState>(
    workspaceRoot,
    DESIGN_INDEX_PATHS.fingerprints,
  );
  const diagnosticsFile = await readJson<{ diagnostics?: DesignIndexDiagnostic[] }>(
    workspaceRoot,
    DESIGN_INDEX_PATHS.diagnostics,
  );
  const descriptionMapFile = await readJson<{ entries?: ComponentDescriptionMapEntry[] }>(
    workspaceRoot,
    DESIGN_INDEX_PATHS.descriptionMap,
  );
  const componentSelectionMap = await readJson<ComponentSelectionMap>(
    workspaceRoot,
    DESIGN_INDEX_PATHS.componentSelectionMap,
  );
  const promptSummary = await readText(workspaceRoot, DESIGN_INDEX_PATHS.promptSummary);
  const diagnostics = diagnosticsFile?.diagnostics ?? [];
  const missing = artifacts.filter((artifact) => !artifact.exists);
  const stale = Boolean(savedFingerprint && savedFingerprint.fingerprint !== fingerprint.value);

  if (legacyManifest && !canonicalManifest) {
    diagnostics.push({
      level: 'warning',
      filePath: DESIGN_INDEX_PATHS.legacyManifest,
      message:
        'Using legacy index.json manifest; regenerate the project index to write manifest.json.',
    });
  }

  if (stale) {
    diagnostics.push({
      level: 'warning',
      filePath: DESIGN_INDEX_PATHS.fingerprints,
      message: 'Tracked design-system files changed since the last index generation.',
    });
  }
  if (missing.length > 0) {
    diagnostics.push({
      level: 'warning',
      filePath: DESIGN_INDEX_PATHS.manifest,
      message: `${missing.length} design-index artifact${missing.length === 1 ? '' : 's'} missing.`,
    });
  }

  const status = !manifest
    ? 'missing'
    : diagnostics.some((item) => item.level === 'error')
      ? 'error'
      : stale
        ? 'stale'
        : diagnostics.some((item) => item.level === 'warning')
          ? 'warning'
          : 'valid';

  const context: DesignIndexContext = {
    status,
    stale,
    manifest,
    artifacts,
    diagnostics,
    fingerprint: fingerprint.value,
    trackedFiles: fingerprint.trackedFiles,
    ...(savedFingerprint?.checkedAt ? { checkedAt: savedFingerprint.checkedAt } : {}),
    promptSummary,
    ...(descriptionMapFile?.entries?.length ? { descriptionMap: descriptionMapFile.entries } : {}),
    ...(componentSelectionMap?.entries?.length ? { componentSelectionMap } : {}),
  };
  return {
    ...context,
    projectSystem: buildProjectSystemOverview(context),
  };
}

async function readArtifact(workspaceRoot: string, filePath: string): Promise<DesignIndexArtifact> {
  try {
    const entry = await stat(resolve(workspaceRoot, filePath));
    return { filePath, exists: true, sizeBytes: entry.size };
  } catch {
    return { filePath, exists: false };
  }
}

async function readJson<T>(workspaceRoot: string, filePath: string): Promise<T | null> {
  const contents = await readText(workspaceRoot, filePath);
  if (!contents) return null;
  try {
    return JSON.parse(contents) as T;
  } catch {
    return null;
  }
}

async function readText(workspaceRoot: string, filePath: string): Promise<string> {
  try {
    return await readFile(resolve(workspaceRoot, filePath), 'utf8');
  } catch {
    return '';
  }
}
