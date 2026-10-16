export interface RuntimeUsageSummary {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costUsd?: number;
}

export function addRuntimeUsage(
  current: RuntimeUsageSummary,
  next: RuntimeUsageSummary | null | undefined,
): RuntimeUsageSummary {
  if (!next) return current;
  const inputTokens = addOptionalNumber(current.inputTokens, next.inputTokens);
  const outputTokens = addOptionalNumber(current.outputTokens, next.outputTokens);
  const totalTokens = addOptionalNumber(current.totalTokens, next.totalTokens);
  const costUsd = addOptionalNumber(current.costUsd, next.costUsd);
  return compactRuntimeUsage({
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
    ...(totalTokens !== undefined ? { totalTokens } : {}),
    ...(costUsd !== undefined ? { costUsd } : {}),
  });
}

export function compactRuntimeUsage(usage: RuntimeUsageSummary): RuntimeUsageSummary {
  const compacted: RuntimeUsageSummary = {};
  if (usage.inputTokens !== undefined) compacted.inputTokens = usage.inputTokens;
  if (usage.outputTokens !== undefined) compacted.outputTokens = usage.outputTokens;
  if (usage.totalTokens !== undefined) compacted.totalTokens = usage.totalTokens;
  if (usage.costUsd !== undefined) compacted.costUsd = usage.costUsd;
  return compacted;
}

export function hasRuntimeUsage(usage: RuntimeUsageSummary): boolean {
  return (
    usage.inputTokens !== undefined ||
    usage.outputTokens !== undefined ||
    usage.totalTokens !== undefined ||
    usage.costUsd !== undefined
  );
}

function addOptionalNumber(
  current: number | undefined,
  next: number | undefined,
): number | undefined {
  if (next === undefined) return current;
  return (current ?? 0) + next;
}
