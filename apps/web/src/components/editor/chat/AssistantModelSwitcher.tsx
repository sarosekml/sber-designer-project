import { useMemo } from 'react';
import { Check, ChevronDown, RefreshCw, Settings } from 'lucide-react';
import type { AgentCapabilityBadge } from '@/lib/agent-model-target';
import type { AgentRuntimeKind, AgentRuntimeStatus } from '@/lib/api/agent-runs';
import {
  CLAUDE_CODE_RUNTIME_PROVIDER_ID,
  CODEX_RUNTIME_PROVIDER_ID,
  GIGACODE_RUNTIME_PROVIDER_ID,
  KIMI_RUNTIME_PROVIDER_ID,
  OPENCODE_RUNTIME_PROVIDER_ID,
} from '@/lib/api/agent-runs';
import { DEFAULT_CLI_MODEL, modelOptionLabel } from '@/lib/agent-provider-labels';
import { openSettings } from '@/lib/settings-events';
import type { ModelSelectOption } from '@/lib/model-select-options';
import type { ProviderStatusTone } from '@/lib/provider-status';
import { cn } from '@/lib/utils';
import { AgentProviderIcon } from '../AgentProviderIcon';
import { ModelSelect } from '../ModelSelect';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface AssistantApiModel {
  provider: string;
  model: string;
  label: string;
}

export interface AssistantApiProviderMetadata {
  providerId: string;
  label: string;
  statusLabel?: string;
  statusTone?: ProviderStatusTone;
}

export interface AssistantActiveModel {
  provider: string;
  model: string;
}

interface CliProviderDef {
  providerId: string;
  runtimeKind: AgentRuntimeKind;
  label: string;
}

export interface AssistantCliProviderState extends CliProviderDef {
  runtime: AgentRuntimeStatus | null;
  installed: boolean;
  connected: boolean;
  active: boolean;
  version: string | null;
  command: string | null;
  selectedModel: string;
  modelOptions: ModelSelectOption[];
  blocked: boolean;
  diagnostic: string | null;
}

export interface AssistantApiProviderState {
  providerId: string;
  label: string;
  active: boolean;
  models: AssistantApiModel[];
  statusLabel: string | null;
  statusTone: ProviderStatusTone;
}

export interface AssistantModelSwitcherState {
  mode: 'api' | 'cli' | 'none';
  triggerIntentLabel: string;
  triggerLabel: string;
  triggerTitle: string;
  triggerProviderId: string;
  cliProviders: AssistantCliProviderState[];
  apiProviders: AssistantApiProviderState[];
  modelOptions: ModelSelectOption[];
}

const CLI_PROVIDER_DEFS: CliProviderDef[] = [
  {
    providerId: OPENCODE_RUNTIME_PROVIDER_ID,
    runtimeKind: 'opencode',
    label: 'OpenCode',
  },
  {
    providerId: CLAUDE_CODE_RUNTIME_PROVIDER_ID,
    runtimeKind: 'claude-code',
    label: 'Claude Code',
  },
  {
    providerId: CODEX_RUNTIME_PROVIDER_ID,
    runtimeKind: 'codex',
    label: 'Codex CLI',
  },
  {
    providerId: KIMI_RUNTIME_PROVIDER_ID,
    runtimeKind: 'kimi',
    label: 'Kimi Code CLI',
  },
  {
    providerId: GIGACODE_RUNTIME_PROVIDER_ID,
    runtimeKind: 'gigacode',
    label: 'GigaCode',
  },
];

export function runtimeProviderLabel(provider: string): string {
  return CLI_PROVIDER_DEFS.find((item) => item.providerId === provider)?.label ?? 'Local CLI';
}

export function buildAssistantModelSwitcherState(input: {
  active: AssistantActiveModel | null;
  apiModels: readonly AssistantApiModel[];
  apiProviders?: readonly AssistantApiProviderMetadata[];
  runtimeStatuses: readonly AgentRuntimeStatus[];
  enabledRuntimeKinds?: readonly AgentRuntimeKind[];
}): AssistantModelSwitcherState {
  const apiProviders = buildApiProviders(input.apiModels, input.active, input.apiProviders ?? []);
  const enabledRuntimeKinds =
    input.enabledRuntimeKinds ?? CLI_PROVIDER_DEFS.map((def) => def.runtimeKind);
  const cliProviders = CLI_PROVIDER_DEFS.filter((def) =>
    enabledRuntimeKinds.includes(def.runtimeKind),
  )
    .map((def) => {
      const runtime =
        input.runtimeStatuses.find((candidate) => candidate.kind === def.runtimeKind) ?? null;
      const active = input.active?.provider === def.providerId;
      const selectedModel =
        (active ? input.active?.model : undefined) ??
        runtime?.selectedModel ??
        runtime?.models[0]?.id ??
        DEFAULT_CLI_MODEL;
      const errorDiagnostic = runtime?.diagnostics.find(
        (diagnostic) => diagnostic.severity === 'error',
      );
      return {
        ...def,
        runtime,
        installed: runtime?.installed ?? false,
        connected: runtime?.connected ?? false,
        active,
        version: runtime?.version ?? null,
        command: runtime?.command ?? null,
        selectedModel,
        modelOptions: runtimeModelOptions(runtime, def.label),
        blocked: Boolean(errorDiagnostic),
        diagnostic: errorDiagnostic?.message ?? null,
      };
    })
    .filter((provider) => provider.connected);

  const activeCli = cliProviders.find((provider) => provider.active);
  const activeApi = apiProviders.find((provider) => provider.active);
  const mode = activeCli ? 'cli' : activeApi ? 'api' : 'none';
  const triggerProviderId =
    input.active?.provider ?? activeCli?.providerId ?? activeApi?.providerId ?? 'provider';
  const triggerLabel =
    activeCli && input.active
      ? modelLabelForCli(activeCli, input.active.model)
      : activeApi && input.active
        ? modelLabelForApi(activeApi, input.active.model)
        : 'No provider';
  const triggerTitle =
    activeCli && input.active
      ? `Next run model: ${activeCli.label} · ${triggerLabel}`
      : activeApi && input.active
        ? `Next run model: ${activeApi.label} · ${triggerLabel}`
        : `Next run model: ${triggerLabel}`;

  return {
    mode,
    triggerIntentLabel: 'Next run model',
    triggerLabel,
    triggerTitle,
    triggerProviderId,
    cliProviders,
    apiProviders,
    modelOptions:
      activeCli?.modelOptions ??
      activeApi?.models.map((model) => ({
        value: model.model,
        label: stripProviderPrefix(model.label, activeApi.label),
      })) ??
      [],
  };
}

export function AssistantModelSwitcher({
  active,
  apiModels,
  apiProviders = [],
  runtimeStatuses,
  enabledRuntimeKinds,
  capabilityBadges,
  disabled = false,
  onSelectProvider,
  onSelectModel,
  onRefreshRuntimes,
}: {
  active: AssistantActiveModel | null;
  apiModels: readonly AssistantApiModel[];
  apiProviders?: readonly AssistantApiProviderMetadata[];
  runtimeStatuses: readonly AgentRuntimeStatus[];
  enabledRuntimeKinds?: readonly AgentRuntimeKind[];
  capabilityBadges: readonly AgentCapabilityBadge[];
  disabled?: boolean;
  onSelectProvider: (provider: string, model: string) => void;
  onSelectModel: (provider: string, model: string) => void;
  onRefreshRuntimes: () => void;
}) {
  const state = useMemo(
    () =>
      buildAssistantModelSwitcherState({
        active,
        apiModels,
        apiProviders,
        runtimeStatuses,
        ...(enabledRuntimeKinds ? { enabledRuntimeKinds } : {}),
      }),
    [active, apiModels, apiProviders, runtimeStatuses, enabledRuntimeKinds],
  );
  const currentProvider =
    state.cliProviders.find((provider) => provider.active) ??
    state.apiProviders.find((provider) => provider.active);
  const currentModel = active?.model ?? '';

  const selectCli = (provider: AssistantCliProviderState) => {
    onSelectProvider(provider.providerId, provider.selectedModel);
  };

  const selectApi = (provider: AssistantApiProviderState) => {
    const model = provider.models[0]?.model;
    if (model) onSelectProvider(provider.providerId, model);
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-7 max-w-full min-w-0 gap-1.5 rounded-md px-2"
          title={state.triggerTitle}
        >
          <AgentProviderIcon
            providerId={state.triggerProviderId}
            label={state.triggerLabel}
            size={16}
          />
          <span className="shrink-0 text-[10px] font-medium uppercase text-muted-foreground">
            Next
          </span>
          <span className="min-w-0 truncate">{state.triggerLabel}</span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(25rem,calc(100vw-2rem))] p-2"
        onInteractOutside={(event) => {
          const target = event.target;
          if (target instanceof HTMLElement && target.closest('[data-model-select-content]')) {
            event.preventDefault();
          }
        }}
      >
        <div className="grid gap-1">
          <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Code agent
          </div>
          {state.cliProviders.map((provider) => (
            <DropdownMenuItem
              key={provider.providerId}
              data-provider-id={provider.providerId}
              className={cn(
                'grid min-w-0 grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground',
                provider.active && 'bg-accent text-accent-foreground',
              )}
              onSelect={(event) => {
                event.preventDefault();
                selectCli(provider);
              }}
            >
              <AgentProviderIcon
                providerId={provider.providerId}
                label={provider.label}
                size={18}
              />
              <span className="min-w-0">
                <span className="block truncate">{provider.label}</span>
                {provider.diagnostic ? (
                  <span className="block truncate text-xs text-destructive">
                    {provider.diagnostic}
                  </span>
                ) : (
                  <span className="block truncate text-xs text-muted-foreground">
                    {provider.connected
                      ? provider.version || provider.command || 'connected'
                      : provider.installed
                        ? 'installed'
                        : 'not installed'}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {provider.blocked ? 'blocked' : provider.active ? 'selected' : ''}
                {provider.active && <Check className="size-4 text-primary" />}
              </span>
            </DropdownMenuItem>
          ))}
        </div>

        {state.apiProviders.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="grid gap-1">
              <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                API providers
              </div>
              {state.apiProviders.map((provider) => (
                <DropdownMenuItem
                  key={provider.providerId}
                  data-provider-id={provider.providerId}
                  className={cn(
                    'grid min-w-0 grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground',
                    provider.active && 'bg-accent text-accent-foreground',
                  )}
                  onSelect={(event) => {
                    event.preventDefault();
                    selectApi(provider);
                  }}
                >
                  <AgentProviderIcon
                    providerId={provider.providerId}
                    label={provider.label}
                    size={18}
                  />
                  <span className="min-w-0">
                    <span className="block truncate">{provider.label}</span>
                    {provider.statusLabel && (
                      <span
                        className={cn(
                          'block truncate text-xs',
                          provider.statusTone === 'ok' ? 'text-success' : 'text-muted-foreground',
                          provider.statusTone === 'warn' && 'text-warning',
                        )}
                      >
                        {provider.statusLabel}
                      </span>
                    )}
                  </span>
                  {provider.active && <Check className="size-4 text-primary" />}
                </DropdownMenuItem>
              ))}
            </div>
          </>
        )}

        {currentProvider && (
          <>
            <DropdownMenuSeparator />
            <div className="grid gap-1 px-2 py-1">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {state.triggerIntentLabel}
              </div>
              <ModelSelect
                value={currentModel}
                options={state.modelOptions}
                includeDefault={
                  state.mode === 'cli' &&
                  state.modelOptions.some((option) => option.value === DEFAULT_CLI_MODEL)
                }
                onChange={(model) => {
                  if (active?.provider) onSelectModel(active.provider, model);
                }}
                align="end"
                className="w-full"
              />
            </div>
            {capabilityBadges.length > 0 && (
              <div className="px-2 pb-1 text-xs text-muted-foreground">
                {capabilityBadges.map((badge) => `${badge.label}: ${badge.title}`).join(' · ')}
              </div>
            )}
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            onRefreshRuntimes();
          }}
        >
          <RefreshCw className="size-4" />
          Refresh CLI runtimes
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openSettings('llm')}>
          <Settings className="size-4" />
          Open settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function buildApiProviders(
  apiModels: readonly AssistantApiModel[],
  active: AssistantActiveModel | null,
  metadata: readonly AssistantApiProviderMetadata[],
): AssistantApiProviderState[] {
  const byProvider = new Map<string, AssistantApiModel[]>();
  for (const model of apiModels) {
    const list = byProvider.get(model.provider) ?? [];
    list.push(model);
    byProvider.set(model.provider, list);
  }
  if (
    active &&
    !isCliProviderId(active.provider) &&
    (byProvider.has(active.provider) ||
      metadata.some((provider) => provider.providerId === active.provider))
  ) {
    const list = byProvider.get(active.provider) ?? [];
    if (!list.some((model) => model.model === active.model)) {
      byProvider.set(active.provider, [
        { provider: active.provider, model: active.model, label: active.model },
        ...list,
      ]);
    }
  }

  const orderedProviderIds = unique([
    ...metadata.map((provider) => provider.providerId),
    ...byProvider.keys(),
  ]);

  return orderedProviderIds.map((providerId) => {
    const models = byProvider.get(providerId) ?? [];
    const meta = metadata.find((provider) => provider.providerId === providerId);
    return {
      providerId,
      label: meta?.label ?? providerLabelFromModels(providerId, models),
      active: active?.provider === providerId,
      models,
      statusLabel: meta?.statusLabel ?? null,
      statusTone: meta?.statusTone ?? 'muted',
    };
  });
}

function providerLabelFromModels(providerId: string, models: readonly AssistantApiModel[]): string {
  const label = models[0]?.label;
  if (!label) return providerId;
  return label.split(' · ')[0]?.trim() || providerId;
}

function stripProviderPrefix(label: string, providerLabel: string): string {
  const prefix = `${providerLabel} · `;
  return label.startsWith(prefix) ? label.slice(prefix.length) : label;
}

function modelLabelForApi(provider: AssistantApiProviderState, modelId: string): string {
  const model = provider.models.find((candidate) => candidate.model === modelId);
  if (!model) return modelOptionLabel(modelId);
  return stripProviderPrefix(model.label, provider.label);
}

function modelLabelForCli(provider: AssistantCliProviderState, modelId: string): string {
  const model = provider.modelOptions.find((candidate) => candidate.value === modelId);
  return model?.label ?? modelOptionLabel(modelId);
}

function isCliProviderId(providerId: string): boolean {
  return CLI_PROVIDER_DEFS.some((provider) => provider.providerId === providerId);
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function runtimeModelOptions(
  runtime: AgentRuntimeStatus | null,
  labelPrefix: string,
): ModelSelectOption[] {
  const options: ModelSelectOption[] = (runtime?.models ?? []).map((model) => {
    const description = runtimeModelDescription(model);
    return {
      value: model.id,
      label:
        model.id === DEFAULT_CLI_MODEL
          ? modelOptionLabel(model.id)
          : stripProviderPrefix(model.label || model.id, labelPrefix),
      ...(description ? { description } : {}),
    };
  });
  const selected = runtime?.selectedModel?.trim();
  if (selected && !options.some((option) => option.value === selected)) {
    return [{ value: selected, label: modelOptionLabel(selected) }, ...options];
  }
  return options;
}

function runtimeModelDescription(model: AgentRuntimeStatus['models'][number]): string | undefined {
  const context = model.contextWindowSize
    ? `${Math.round(model.contextWindowSize / 1000)}k context`
    : '';
  return [model.description, context].filter(Boolean).join(' · ') || undefined;
}
