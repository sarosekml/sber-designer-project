/**
 * Display-label helpers for agent provider/model selection (0081 Track A).
 *
 * Single source of truth for turning the active `{ provider, model }` pair —
 * API or CLI runtime — into user-facing labels. The raw CLI sentinel `default`
 * is never shown verbatim: dropdowns render `Default (CLI config)`, and the
 * compact chip drops the model entirely so the header reads `Claude Code`
 * rather than `Claude Code (default)`.
 *
 * Product UI strings are English-only.
 */

/** Sentinel CLI model meaning "let the CLI use its own configured default". */
export const DEFAULT_CLI_MODEL = 'default';

/** First-class dropdown label for the `default` CLI model. */
export const DEFAULT_CLI_MODEL_LABEL = 'Default (CLI config)';

export function isDefaultCliModel(model: string | null | undefined): boolean {
  return !model || model.trim().toLowerCase() === DEFAULT_CLI_MODEL;
}

/**
 * Dropdown option label for a model id. `default` becomes
 * `Default (CLI config)`; everything else is shown as-is (a real model id or a
 * provider/model pair).
 */
export function modelOptionLabel(model: string | null | undefined): string {
  return isDefaultCliModel(model) ? DEFAULT_CLI_MODEL_LABEL : (model as string).trim();
}

/**
 * Compact chip label for the assistant header.
 *
 * - CLI + `default` model: just the provider label (no noisy `default`).
 * - CLI + concrete model: `Provider · Model` (model id, possibly `provider/model`).
 * - API: `Provider · Model` where `model` is already a friendly model name when
 *   available, otherwise the raw model id.
 */
export function compactAgentLabel(input: {
  kind: 'api' | 'cli';
  providerLabel: string;
  model: string | null | undefined;
  /** Pre-resolved friendly model name (API providers expose one). */
  modelDisplay?: string | null;
}): string {
  const provider = input.providerLabel.trim();
  if (input.kind === 'cli' && isDefaultCliModel(input.model)) return provider;
  const model = (input.modelDisplay?.trim() || input.model?.trim()) ?? '';
  return model ? `${provider} · ${model}` : provider;
}

/**
 * Full label used in settings rows and run metadata. Like {@link compactAgentLabel}
 * but keeps `Default (CLI config)` visible for CLI defaults instead of hiding it,
 * so a settings row still communicates which model is active.
 */
export function fullAgentLabel(input: {
  kind: 'api' | 'cli';
  providerLabel: string;
  model: string | null | undefined;
  modelDisplay?: string | null;
}): string {
  const provider = input.providerLabel.trim();
  if (input.kind === 'cli' && isDefaultCliModel(input.model)) {
    return `${provider} · ${DEFAULT_CLI_MODEL_LABEL}`;
  }
  const model = (input.modelDisplay?.trim() || input.model?.trim()) ?? '';
  return model ? `${provider} · ${model}` : provider;
}

/**
 * Group a flat list of model ids by `provider/` prefix while preserving the
 * full id as each option's value. Ungrouped ids (no `/`) land under `''`.
 * Used by the searchable model select (0081 Track C).
 */
export function groupModelIdsByProvider(
  modelIds: readonly string[],
): { provider: string; models: { value: string; label: string }[] }[] {
  const byProvider = new Map<string, { value: string; label: string }[]>();
  for (const id of modelIds) {
    const slash = id.indexOf('/');
    const provider = slash > 0 ? id.slice(0, slash) : '';
    const list = byProvider.get(provider) ?? [];
    list.push({ value: id, label: modelOptionLabel(id) });
    byProvider.set(provider, list);
  }
  return Array.from(byProvider.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([provider, models]) => ({ provider, models }));
}
