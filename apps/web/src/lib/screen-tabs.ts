export function appendScreenTab(ids: readonly string[], screenId: string): string[] {
  if (!screenId || ids.includes(screenId)) return [...ids];
  return [...ids, screenId];
}

export function pruneScreenTabIds(
  ids: readonly string[],
  availableScreenIds: readonly string[],
): string[] {
  const available = new Set(availableScreenIds);
  return ids.filter((id, index) => available.has(id) && ids.indexOf(id) === index);
}

export function nextActiveScreenTabId(
  ids: readonly string[],
  closingScreenId: string,
): string | null {
  const index = ids.indexOf(closingScreenId);
  if (index < 0) return null;
  return ids[index + 1] ?? ids[index - 1] ?? null;
}

export function removeScreenTab(ids: readonly string[], screenId: string): string[] {
  if (ids.length <= 1 || !ids.includes(screenId)) return [...ids];
  return ids.filter((id) => id !== screenId);
}
