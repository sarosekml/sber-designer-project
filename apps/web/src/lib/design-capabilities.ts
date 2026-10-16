import type { DesignInspectResult } from './design-types';

export type DesignCapabilityKey = keyof DesignInspectResult['capabilities'];

export function hasDesignSourceTarget(info: DesignInspectResult): boolean {
  return Boolean(info.target.filePath && typeof info.target.line === 'number');
}

export function designCapabilityAllows(
  info: DesignInspectResult,
  capability: DesignCapabilityKey,
  operation: string,
): boolean {
  const targetCapability = info.capabilities[capability];
  return targetCapability.status === 'editable' && targetCapability.operations.includes(operation);
}

export function designCapabilityReason(
  info: DesignInspectResult,
  capabilities: DesignCapabilityKey[],
  fallback: string,
): string {
  if (!hasDesignSourceTarget(info)) {
    return info.reason ?? 'This selection is not mapped to a source-backed Design target.';
  }

  for (const capability of capabilities) {
    const reason = info.capabilities[capability].reason;
    if (reason) return reason;
  }

  return info.reason ?? fallback;
}
