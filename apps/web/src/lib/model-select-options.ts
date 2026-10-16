import { DEFAULT_CLI_MODEL, modelOptionLabel } from './agent-provider-labels';

export interface ModelSelectOption {
  value: string;
  /** Stable provider identity when the option contains a provider/model pair. */
  provider?: string;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export interface NormalizedModelSelectOption {
  value: string;
  provider?: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface ModelSelectGroup {
  provider: string;
  options: NormalizedModelSelectOption[];
}

export function normalizeModelSelectOptions(input: {
  models: readonly ModelSelectOption[];
  value?: string | null;
  includeDefault?: boolean;
}): NormalizedModelSelectOption[] {
  const byValue = new Map<string, NormalizedModelSelectOption>();

  const add = (option: ModelSelectOption) => {
    const value = option.value.trim();
    if (!value || byValue.has(value)) return;
    const normalized: NormalizedModelSelectOption = {
      value,
      label:
        value === DEFAULT_CLI_MODEL
          ? modelOptionLabel(value)
          : (option.label ?? modelOptionLabel(value)),
    };
    if (option.provider?.trim()) normalized.provider = option.provider.trim();
    if (option.description !== undefined) normalized.description = option.description;
    if (option.disabled !== undefined) normalized.disabled = option.disabled;
    byValue.set(value, normalized);
  };

  if (input.includeDefault) add({ value: DEFAULT_CLI_MODEL });

  const value = input.value?.trim();
  if (value && !byValue.has(value)) {
    const selectedOption = input.models.find((option) => option.value.trim() === value);
    add(selectedOption ?? { value });
  }

  for (const option of input.models) add(option);

  return Array.from(byValue.values());
}

export function groupModelSelectOptions(
  options: readonly NormalizedModelSelectOption[],
): ModelSelectGroup[] {
  const groups = new Map<string, NormalizedModelSelectOption[]>();
  for (const option of options) {
    const provider = option.provider ?? providerFromModelValue(option.value);
    const list = groups.get(provider) ?? [];
    list.push(option);
    groups.set(provider, list);
  }
  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([provider, groupOptions]) => ({ provider, options: groupOptions }));
}

function providerFromModelValue(value: string): string {
  const separator = value.indexOf('::');
  if (separator > 0) return value.slice(0, separator);
  const slash = value.indexOf('/');
  return slash > 0 ? value.slice(0, slash) : '';
}

/** Returns the model portion for diagnostics without using the display label as identity. */
export function modelIdFromModelSelectValue(value: string, provider?: string): string {
  const normalizedValue = value.trim();
  const separator = normalizedValue.indexOf('::');
  if (separator > 0) return normalizedValue.slice(separator + 2);
  const normalizedProvider = provider?.trim();
  if (normalizedProvider && normalizedValue.startsWith(`${normalizedProvider}/`)) {
    return normalizedValue.slice(normalizedProvider.length + 1);
  }
  return normalizedValue;
}

export function filterModelSelectGroups(
  groups: readonly ModelSelectGroup[],
  query: string,
): ModelSelectGroup[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [...groups];

  const filtered: ModelSelectGroup[] = [];
  for (const group of groups) {
    const providerMatches = group.provider.toLowerCase().includes(normalizedQuery);
    const options = providerMatches
      ? group.options
      : group.options.filter((option) => matchesOption(option, group.provider, normalizedQuery));
    if (options.length > 0) filtered.push({ provider: group.provider, options });
  }
  return filtered;
}

function matchesOption(
  option: NormalizedModelSelectOption,
  provider: string,
  query: string,
): boolean {
  const haystack = [option.value, option.label, option.description ?? '', provider]
    .join('\n')
    .toLowerCase();
  return haystack.includes(query);
}
