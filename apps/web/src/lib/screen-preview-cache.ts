export const MAX_WARM_SCREEN_PREVIEWS = 2;

export interface ScreenPreviewCacheEntry {
  screenId: string;
  url: string;
  revision: number;
}

export function promoteScreenPreview(
  entries: readonly ScreenPreviewCacheEntry[],
  target: ScreenPreviewCacheEntry,
  maxWarmEntries = MAX_WARM_SCREEN_PREVIEWS,
): ScreenPreviewCacheEntry[] {
  const retained = entries.filter((entry) => entry.screenId !== target.screenId);
  return [target, ...retained].slice(0, Math.max(0, maxWarmEntries) + 1);
}

export function invalidateScreenPreview(
  entries: readonly ScreenPreviewCacheEntry[],
  screenId: string,
): ScreenPreviewCacheEntry[] {
  return entries.filter((entry) => entry.screenId !== screenId);
}

export function pruneScreenPreviewCache(
  entries: readonly ScreenPreviewCacheEntry[],
  availableScreenIds: readonly string[],
  revisions: Readonly<Record<string, number>>,
): ScreenPreviewCacheEntry[] {
  const available = new Set(availableScreenIds);
  return entries.filter(
    (entry) => available.has(entry.screenId) && entry.revision === (revisions[entry.screenId] ?? 0),
  );
}
