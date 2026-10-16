import type { ExternalDesignSourceIntent } from '@sber-designer/shared-types';

export function designSourceIntentKeyFor(intent: ExternalDesignSourceIntent | null): string {
  if (!intent) return '';
  return [
    intent.source.kind,
    intent.source.input,
    intent.source.url ?? '',
    intent.source.nodeId ?? '',
  ].join('|');
}

export function shouldAutoOpenDesignSourceComposer(input: {
  intentKey: string;
  ignoredIntentKey: string | null;
  currentComposerKey: string | null;
}): boolean {
  if (!input.intentKey) return false;
  if (input.ignoredIntentKey === input.intentKey) return false;
  return input.currentComposerKey !== input.intentKey;
}

export function shouldUseDesignSourceScreenComposer(
  intent: ExternalDesignSourceIntent | null,
): boolean {
  return Boolean(intent && intent.target.mode !== 'design-system');
}
