/**
 * Pure settings logic: provider enablement persistence/normalization,
 * CLI-runtime provider ids, and asset-pack source resolution. No React.
 */
import type {
  ProjectAssetPackSettings,
  ProjectExternalAssetSources,
  ProjectIconSourceFamily,
  ProjectIconSourceMode,
} from '@sber-designer/shared-types';
import {
  CLAUDE_CODE_RUNTIME_PROVIDER_ID,
  CODEX_RUNTIME_PROVIDER_ID,
  GIGACODE_RUNTIME_PROVIDER_ID,
  KIMI_RUNTIME_PROVIDER_ID,
  OPENCODE_RUNTIME_PROVIDER_ID,
  type AssetPackKind,
  type AgentRuntimeKind,
} from '@/lib/api-client';

export const ENABLED_PROVIDERS_STORAGE_KEY = 'sber-designer.enabledProviders';
export const ENABLED_PROVIDERS_CHANGED_EVENT = 'sber-designer:enabled-providers-changed';

export const DEFAULT_ASSET_PACK_NAME = 'Imported assets';

export const ASSET_PACK_SOURCE_HINT =
  'Workspace folders are indexed in place and can be imported; external folders are indexed as references and copied only when an asset is used.';

export const ASSET_PACK_OUTSIDE_WORKSPACE_WARNING =
  'Import copies files into src/assets and is available only for folders inside the connected project. External folders can still be saved and indexed as portable references.';

export const DEFAULT_ICON_SOURCE_NAME = 'Indexed icon source';

export const ICON_SOURCE_HINT = ASSET_PACK_SOURCE_HINT;

const DEFAULT_ASSET_PACK_KINDS: AssetPackKind[] = ['icons', 'illustrations'];

type ActiveModelSelection = { provider: string; model: string };

type ModelOption = ActiveModelSelection & { label: string };

export const SETTINGS_SECTION_IDS = [
  'general',
  'indexing',
  'agent',
  'generation',
  'llm',
  'mcp',
  'git',
  'tasks',
  'project',
  'about',
] as const;

export type SettingsSection = (typeof SETTINGS_SECTION_IDS)[number];

export const SYSTEM_SETTINGS_SECTION_IDS = [
  'general',
  'llm',
  'agent',
  'generation',
  'mcp',
  'about',
] as const satisfies readonly SettingsSection[];

export function runtimeKindForProvider(provider: string): AgentRuntimeKind | null {
  if (provider === OPENCODE_RUNTIME_PROVIDER_ID) return 'opencode';
  if (provider === CLAUDE_CODE_RUNTIME_PROVIDER_ID) return 'claude-code';
  if (provider === CODEX_RUNTIME_PROVIDER_ID) return 'codex';
  if (provider === KIMI_RUNTIME_PROVIDER_ID) return 'kimi';
  if (provider === GIGACODE_RUNTIME_PROVIDER_ID) return 'gigacode';
  return null;
}

export function isRuntimeProviderId(provider: string): boolean {
  return runtimeKindForProvider(provider) !== null;
}

export function readEnabledProviderIds(providerKeys: string[]): string[] {
  if (providerKeys.length === 0) return [];
  if (typeof window === 'undefined') return providerKeys;
  try {
    const raw = window.localStorage.getItem(ENABLED_PROVIDERS_STORAGE_KEY);
    if (!raw) return providerKeys;
    const parsed = JSON.parse(raw) as unknown;
    return normalizeEnabledProviderIds(Array.isArray(parsed) ? parsed : providerKeys, providerKeys);
  } catch {
    return providerKeys;
  }
}

export function resolveActiveAfterProviderEnablement(input: {
  active: ActiveModelSelection | null;
  configLoaded: boolean;
  enabledProviderIds: string[];
  enabledProvidersReady: boolean;
  models: ModelOption[];
}): ActiveModelSelection | null | undefined {
  if (!input.configLoaded) return undefined;
  if (!input.enabledProvidersReady) return undefined;
  if (!input.active) return undefined;
  if (isRuntimeProviderId(input.active.provider)) return undefined;
  if (input.enabledProviderIds.includes(input.active.provider)) return undefined;
  const fallback = input.models[0];
  return fallback ? { provider: fallback.provider, model: fallback.model } : null;
}

export function parseActiveModelSelectValue(value: string): ActiveModelSelection | null {
  const separator = '::';
  const index = value.indexOf(separator);
  if (index <= 0) return null;
  const provider = value.slice(0, index).trim();
  const model = value.slice(index + separator.length).trim();
  if (!provider || !model) return null;
  return { provider, model };
}

export function writeEnabledProviderIds(providerIds: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ENABLED_PROVIDERS_STORAGE_KEY, JSON.stringify(providerIds));
  } catch {
    // Ignore private-mode / quota failures; the current session still updates.
  }
  queueMicrotask(() => {
    window.dispatchEvent(new CustomEvent(ENABLED_PROVIDERS_CHANGED_EVENT));
  });
}

export function normalizeEnabledProviderIds(
  providerIds: unknown[],
  providerKeys: string[],
): string[] {
  const known = new Set(providerKeys);
  const normalized = providerIds.filter(
    (id): id is string => typeof id === 'string' && known.has(id),
  );
  return Array.from(new Set(normalized));
}

export function resolveAssetFolderPickerInitialPath(
  sourcePath: string,
  workspacePath: string | undefined,
): string | undefined {
  const trimmedSourcePath = sourcePath.trim();
  if (trimmedSourcePath.startsWith('/')) return trimmedSourcePath;
  return workspacePath?.trim() || undefined;
}

export function resolveAssetPackSourceWarning(
  sourcePath: string,
  workspacePath: string | undefined,
): string | null {
  const source = normalizeLocalPathPrefix(sourcePath);
  const workspace = normalizeLocalPathPrefix(workspacePath ?? '');
  if (!source || !workspace || !source.startsWith('/') || !workspace.startsWith('/')) return null;
  return isLocalPathInsideOrEqual(source, workspace) ? null : ASSET_PACK_OUTSIDE_WORKSPACE_WARNING;
}

function isLocalPathInsideOrEqual(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`);
}

function normalizeLocalPathPrefix(path: string): string {
  const normalized = path.trim().replace(/\\/g, '/').replace(/\/+$/g, '');
  return normalized || path.trim();
}

export function normalizeAssetPackKinds(kinds: readonly unknown[] | undefined): AssetPackKind[] {
  const allowed = new Set<AssetPackKind>(DEFAULT_ASSET_PACK_KINDS);
  const normalized = (kinds ?? []).filter(
    (kind): kind is AssetPackKind => typeof kind === 'string' && allowed.has(kind as AssetPackKind),
  );
  const unique = Array.from(new Set(normalized));
  return unique.length > 0 ? unique : [...DEFAULT_ASSET_PACK_KINDS];
}

export function resolveNextAssetPackSettings(input: {
  previous: ProjectAssetPackSettings | null | undefined;
  sourcePath: string;
  workspacePath: string | undefined;
  kinds: readonly unknown[] | undefined;
  now?: number;
}): ProjectAssetPackSettings | undefined {
  const normalizedKinds = normalizeAssetPackKinds(input.kinds);
  const hasCustomKinds =
    normalizedKinds.length !== DEFAULT_ASSET_PACK_KINDS.length ||
    normalizedKinds.some((kind, index) => kind !== DEFAULT_ASSET_PACK_KINDS[index]);
  const trimmedSourcePath = input.sourcePath.trim();
  const sourceIsBlocked = Boolean(
    trimmedSourcePath && resolveAssetPackSourceWarning(trimmedSourcePath, input.workspacePath),
  );
  const localSourcePath = trimmedSourcePath
    ? sourceIsBlocked
      ? input.previous?.localSourcePath
      : trimmedSourcePath
    : undefined;
  if (!localSourcePath && !hasCustomKinds) return undefined;
  const { localSourcePath: _previousLocalSourcePath, ...previousWithoutSource } =
    input.previous ?? {};
  return {
    ...previousWithoutSource,
    ...(localSourcePath ? { localSourcePath } : {}),
    kinds: normalizedKinds,
    updatedAt: input.now ?? Date.now(),
  };
}

export function resolveInitialAssetPackState(
  assetPacks: ProjectAssetPackSettings | null | undefined,
): { sourcePath: string; kinds: AssetPackKind[] } {
  return {
    sourcePath: assetPacks?.localSourcePath ?? '',
    kinds: normalizeAssetPackKinds(assetPacks?.kinds),
  };
}

export function resolveIconSourceMode(
  sourcePath: string,
  workspacePath: string | undefined,
): ProjectIconSourceMode | null {
  const source = normalizeLocalPathPrefix(sourcePath);
  const workspace = normalizeLocalPathPrefix(workspacePath ?? '');
  if (!source || !source.startsWith('/')) return null;
  if (!workspace || !workspace.startsWith('/')) return 'external';
  return isLocalPathInsideOrEqual(source, workspace) ? 'workspace' : 'external';
}

export function resolveInitialIconSourceState(
  sources: ProjectExternalAssetSources | null | undefined,
): {
  sourcePath: string;
  name: string;
  mode: ProjectIconSourceMode | null;
  kinds: AssetPackKind[];
} {
  const source = sources?.icons?.[0];
  return {
    sourcePath: source?.localPath ?? source?.workspacePath ?? '',
    name: source?.name ?? DEFAULT_ICON_SOURCE_NAME,
    mode: source?.mode ?? null,
    kinds: normalizeAssetPackKinds(source?.families),
  };
}

export function resolveInitialAssetsPathState(input: {
  assetPacks: ProjectAssetPackSettings | null | undefined;
  externalAssetSources: ProjectExternalAssetSources | null | undefined;
}): { sourcePath: string; kinds: AssetPackKind[]; mode: ProjectIconSourceMode | null } {
  const iconSource = resolveInitialIconSourceState(input.externalAssetSources);
  const assetPack = resolveInitialAssetPackState(input.assetPacks);
  return {
    sourcePath: iconSource.sourcePath || assetPack.sourcePath,
    kinds: iconSource.sourcePath ? iconSource.kinds : assetPack.kinds,
    mode: iconSource.mode,
  };
}

export function resolveNextExternalAssetSources(input: {
  previous: ProjectExternalAssetSources | null | undefined;
  sourcePath: string;
  workspacePath: string | undefined;
  name?: string;
  families?: readonly unknown[] | undefined;
  now?: number;
}): ProjectExternalAssetSources | undefined {
  const trimmedSourcePath = input.sourcePath.trim();
  const previous = input.previous ?? {};
  const previousIcons = previous.icons ?? [];
  if (!trimmedSourcePath) {
    const { icons: _icons, ...withoutIcons } = previous;
    return Object.keys(withoutIcons).length > 0 ? withoutIcons : undefined;
  }
  const mode = resolveIconSourceMode(trimmedSourcePath, input.workspacePath) ?? 'external';
  const workspacePath =
    mode === 'workspace'
      ? workspaceRelativePath(trimmedSourcePath, input.workspacePath ?? '')
      : undefined;
  const id = previousIcons[0]?.id ?? 'source-icons-settings';
  const previousName = previousIcons[0]?.name;
  const name =
    input.name?.trim() ||
    (previousName && previousName !== DEFAULT_ICON_SOURCE_NAME ? previousName : undefined) ||
    deriveAssetSourceName(trimmedSourcePath) ||
    DEFAULT_ICON_SOURCE_NAME;
  return {
    ...previous,
    icons: [
      {
        id,
        name,
        kind: 'local-folder',
        mode,
        families: normalizeIconSourceFamilies(input.families),
        localPath: trimmedSourcePath,
        ...(workspacePath ? { workspacePath } : {}),
        updatedAt: input.now ?? Date.now(),
      },
      ...previousIcons.slice(1),
    ],
  };
}

function normalizeIconSourceFamilies(
  families: readonly unknown[] | undefined,
): ProjectIconSourceFamily[] {
  const normalized = normalizeAssetPackKinds(families);
  return normalized.filter(
    (family): family is ProjectIconSourceFamily => family === 'icons' || family === 'illustrations',
  );
}

function deriveAssetSourceName(sourcePath: string): string | null {
  const base = normalizeLocalPathPrefix(sourcePath).split('/').filter(Boolean).at(-1);
  if (!base) return null;
  const words = base
    .split(/[^A-Za-z0-9]+/)
    .flatMap((part) => part.split(/(?=[A-Z])/))
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  if (words.length === 0) return null;
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function workspaceRelativePath(sourcePath: string, workspacePath: string): string | undefined {
  const source = normalizeLocalPathPrefix(sourcePath);
  const workspace = normalizeLocalPathPrefix(workspacePath);
  if (!source || !workspace || !isLocalPathInsideOrEqual(source, workspace)) return undefined;
  if (source === workspace) return '.';
  return source.slice(workspace.length + 1);
}
