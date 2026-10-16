import type { SystemSettings } from './types';

export const CLI_RUNTIME_KINDS = ['claude-code', 'codex', 'opencode', 'kimi', 'gigacode'] as const;
export type CliRuntimeKind = (typeof CLI_RUNTIME_KINDS)[number];

export function enabledCliRuntimeKinds(settings: SystemSettings): CliRuntimeKind[] {
  const enabled = new Set(settings.agents.enabledCliRuntimes);
  return CLI_RUNTIME_KINDS.filter((kind) => enabled.has(kind));
}

export function cliRuntimeIsEnabled(settings: SystemSettings, kind: CliRuntimeKind): boolean {
  return settings.agents.enabledCliRuntimes.includes(kind);
}
