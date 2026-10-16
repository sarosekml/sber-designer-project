/** LLM providers section: model selection, provider tabs and toggles (0138 B). */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SberDesignerConfig } from '@sber-designer/llm-gateway';
import { listVisibleModels, promptAttachmentLimitsFromConfig } from '@sber-designer/llm-gateway';
import { AlertTriangle, LoaderCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  selectAgentRuntimeModel,
  CLAUDE_CODE_RUNTIME_PROVIDER_ID,
  CODEX_RUNTIME_PROVIDER_ID,
  GIGACODE_RUNTIME_PROVIDER_ID,
  KIMI_RUNTIME_PROVIDER_ID,
  OPENCODE_RUNTIME_PROVIDER_ID,
  type AgentRuntimeKind,
  type AgentRuntimeStatus,
} from '@/lib/api-client';
import {
  testProviderConnection,
  type ProviderConnectionTestResult,
} from '@/lib/api/provider-diagnostics';
import { formatBytes } from '@/lib/chat-attachments';
import { useAgentRuntimeInventory } from '@/stores/agent-runtime-store';
import { useEditorStore } from '@/stores/editor-store';
import {
  isRuntimeProviderId,
  parseActiveModelSelectValue,
  runtimeKindForProvider,
} from '@/lib/settings-logic';
import { providerStatusInfo } from '@/lib/provider-status';
import { fullAgentLabel } from '@/lib/agent-provider-labels';
import { Badge, ProviderSwitch } from './shared';
import { CliRuntimeProviderRow, runtimeOptions, runtimeProviderLabel } from './cli-runtimes';
import { AgentProviderIcon } from '../AgentProviderIcon';
import { ModelSelect } from '../ModelSelect';

const NO_ACTIVE_MODEL_VALUE = '__no-active-model__';

export type ProvidersTabValue = 'api' | 'cli';

/** 0138 B2: the first opened Settings tab follows the active model type. */
export function initialProvidersTabForActive(
  active: { provider: string } | null,
): ProvidersTabValue {
  return active && isRuntimeProviderId(active.provider) ? 'cli' : 'api';
}

export interface CliRuntimeRowDef {
  kind: AgentRuntimeKind;
  providerId: string;
  displayName: string;
  labelPrefix: string;
  description: string;
}

/** Local CLI agent rows, ordered; each kind belongs only to the CLI tab. */
export const CLI_RUNTIME_ROW_DEFS: readonly CliRuntimeRowDef[] = [
  {
    kind: 'opencode',
    providerId: OPENCODE_RUNTIME_PROVIDER_ID,
    displayName: 'OpenCode',
    labelPrefix: 'OpenCode',
    description: 'Uses the installed OpenCode account, models, and MCP configuration.',
  },
  {
    kind: 'claude-code',
    providerId: CLAUDE_CODE_RUNTIME_PROVIDER_ID,
    displayName: 'Claude Code',
    labelPrefix: 'Claude Code',
    description: 'Uses the installed Claude Code login, model flag, and MCP configuration.',
  },
  {
    kind: 'codex',
    providerId: CODEX_RUNTIME_PROVIDER_ID,
    displayName: 'Codex CLI',
    labelPrefix: 'Codex CLI',
    description: 'Uses the installed Codex login, sandbox, and MCP configuration.',
  },
  {
    kind: 'kimi',
    providerId: KIMI_RUNTIME_PROVIDER_ID,
    displayName: 'Kimi Code CLI',
    labelPrefix: 'Kimi Code CLI',
    description: 'Uses the installed Kimi Code login and Kimi Platform models.',
  },
  {
    kind: 'gigacode',
    providerId: GIGACODE_RUNTIME_PROVIDER_ID,
    displayName: 'GigaCode',
    labelPrefix: 'GigaCode',
    description: 'Uses the installed GigaCode login and its current backend model catalogue.',
  },
] as const;

export function cliRuntimeRowDefs(enabledKinds: readonly AgentRuntimeKind[]): CliRuntimeRowDef[] {
  return CLI_RUNTIME_ROW_DEFS.filter((def) => enabledKinds.includes(def.kind));
}

export function LlmProvidersSettingsPanel({
  configError,
  active,
  setActive,
  models,
  enabledProviderIds,
  onProviderEnabledChange,
}: {
  configError: string | null;
  active: { provider: string; model: string } | null;
  setActive: (value: { provider: string; model: string } | null) => void;
  models: ReturnType<typeof listVisibleModels>;
  enabledProviderIds: string[];
  onProviderEnabledChange: (providerId: string, enabled: boolean) => void;
}) {
  const config = useEditorStore((s) => s.config);
  const attachmentLimits = useMemo(() => promptAttachmentLimitsFromConfig(config), [config]);
  // Shared runtime inventory (0138 D4): the Assistant and Annotate read the
  // same snapshot, so tabs and capability preflight never disagree.
  const runtimeStatuses = useAgentRuntimeInventory((s) => s.statuses);
  const enabledRuntimeKinds = useAgentRuntimeInventory((s) => s.enabledKinds);
  const runtimesLoaded = useAgentRuntimeInventory((s) => s.loaded);
  const runtimeError = useAgentRuntimeInventory((s) => s.error);
  const runtimeBusy = useAgentRuntimeInventory((s) => s.refreshing);
  const ensureRuntimesLoaded = useAgentRuntimeInventory((s) => s.ensureLoaded);
  const refreshConnectedRuntimes = useAgentRuntimeInventory((s) => s.refreshConnectedRuntimes);
  const updateRuntime = useAgentRuntimeInventory((s) => s.updateRuntime);
  const setRuntimeError = useAgentRuntimeInventory((s) => s.setError);

  // Initial sync happens once per mount; a manual tab switch must survive
  // later Active model changes (0138 B2).
  const [tab, setTab] = useState<ProvidersTabValue>(() => initialProvidersTabForActive(active));

  useEffect(() => {
    void ensureRuntimesLoaded();
  }, [ensureRuntimesLoaded]);

  const runtimeByKind = useMemo(() => {
    const map = new Map<AgentRuntimeKind, (typeof runtimeStatuses)[number]>();
    for (const runtime of runtimeStatuses) map.set(runtime.kind, runtime);
    return map;
  }, [runtimeStatuses]);

  const runtimeModelOptions = useMemo(
    () =>
      CLI_RUNTIME_ROW_DEFS.flatMap((def) =>
        runtimeOptions(runtimeByKind.get(def.kind) ?? null, def.providerId, def.labelPrefix),
      ),
    [runtimeByKind],
  );

  const selectableModels = useMemo(() => {
    const options = [...models, ...runtimeModelOptions];
    if (
      active &&
      isRuntimeProviderId(active.provider) &&
      enabledRuntimeKinds.includes(runtimeKindForProvider(active.provider)!) &&
      !options.some(
        (option) => option.provider === active.provider && option.model === active.model,
      )
    ) {
      options.unshift({
        provider: active.provider,
        model: active.model,
        label: fullAgentLabel({
          kind: 'cli',
          providerLabel: runtimeProviderLabel(active.provider),
          model: active.model,
        }),
      });
    }
    return options;
  }, [active, enabledRuntimeKinds, models, runtimeModelOptions]);

  const persistRuntimeModel = async (provider: string, model: string) => {
    const kind = runtimeKindForProvider(provider);
    if (!kind) return;
    setRuntimeError(null);
    try {
      const response = await selectAgentRuntimeModel(kind, model);
      updateRuntime(response.runtime);
    } catch (err) {
      setRuntimeError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleActiveModelChange = (value: string) => {
    if (!value || value === NO_ACTIVE_MODEL_VALUE) {
      setActive(null);
      return;
    }
    const selection = parseActiveModelSelectValue(value);
    if (!selection) return;
    setActive(selection);
    if (isRuntimeProviderId(selection.provider)) {
      void persistRuntimeModel(selection.provider, selection.model);
    }
  };

  const apiProviderCount = Object.keys(config?.provider ?? {}).length;
  const cliRuntimeCount = cliRuntimeRowDefs(enabledRuntimeKinds).length;

  return (
    <div className="grid min-w-0 gap-4">
      <p className="text-sm text-muted-foreground">
        Choose the active model source. API provider secrets stay server-side; local CLI agents use
        their own installed auth, models, and MCP configuration.
      </p>

      {configError && (
        <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
          <AlertTriangle className="size-4 shrink-0" />
          <div>
            <div className="font-medium">Failed to load sber-designer.json</div>
            <div className="text-xs opacity-80">{configError}</div>
          </div>
        </div>
      )}

      <div className="min-w-0">
        <label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
          Active model
        </label>
        <ModelSelect
          value={active ? `${active.provider}::${active.model}` : NO_ACTIVE_MODEL_VALUE}
          options={[
            {
              value: NO_ACTIVE_MODEL_VALUE,
              label: selectableModels.length === 0 ? 'No models available' : 'No active provider',
            },
            ...selectableModels.map((model) => ({
              value: `${model.provider}::${model.model}`,
              provider: model.provider,
              label: model.label,
              ...('description' in model && typeof model.description === 'string'
                ? { description: model.description }
                : {}),
            })),
          ]}
          onChange={handleActiveModelChange}
          className="h-10 w-full"
          align="start"
        />
      </div>

      <ActiveModelInfoBlock svgMaxBytes={attachmentLimits.svgMaxBytes} />

      <ConnectionTestBlock active={active} config={config} />

      {config?.agent.restrict?.enabled && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Admin restriction is active — only allow-listed providers / models are shown.
        </div>
      )}

      <Separator />

      <Tabs value={tab} onValueChange={(value) => setTab(value as ProvidersTabValue)}>
        <TabsList aria-label="Model provider types" className="w-full">
          <TabsTrigger value="api" className="flex-1">
            API providers{apiProviderCount > 0 ? ` · ${apiProviderCount}` : ''}
          </TabsTrigger>
          <TabsTrigger value="cli" className="flex-1">
            Local CLI agents{cliRuntimeCount > 0 ? ` · ${cliRuntimeCount}` : ''}
          </TabsTrigger>
        </TabsList>
        <ApiProvidersList
          enabledProviderIds={enabledProviderIds}
          onProviderEnabledChange={onProviderEnabledChange}
        />
        <CliAgentsList
          active={active}
          setActive={setActive}
          fallbackModel={models[0] ?? null}
          enabledRuntimeKinds={enabledRuntimeKinds}
          runtimesLoaded={runtimesLoaded}
          runtimeByKind={runtimeByKind}
          runtimeError={runtimeError}
          runtimeBusy={runtimeBusy}
          onReloadRuntimes={() => void refreshConnectedRuntimes()}
          onRuntimeChange={updateRuntime}
        />
      </Tabs>
    </div>
  );
}

/** SVG limit + settings-file paths, visible on both tabs (0138 B3). */
export function ActiveModelInfoBlock({ svgMaxBytes }: { svgMaxBytes: number }) {
  return (
    <div className="grid gap-1 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
      <div>
        SVG prompt references up to {formatBytes(svgMaxBytes)} are accepted. To change the limit,
        edit <code>agent.attachments.svgMaxBytes</code> in <code>./sber-designer.json</code>.
      </div>
      <div>
        Settings file: <code>./sber-designer.json</code> (relative to the sber-designer root). Local
        machine overrides: <code>./sber-designer.local.json</code>.
      </div>
    </div>
  );
}

/**
 * The active selection can be connection-tested only when it is a configured
 * API provider speaking chat (0139 C): CLI runtimes use their own auth, and
 * mock/bridge provider types have nothing to verify.
 */
export function connectionTestTargetForActive(
  active: { provider: string; model: string } | null,
  config: SberDesignerConfig | null | undefined,
): { provider: string; model: string } | null {
  if (!active || !config) return null;
  if (isRuntimeProviderId(active.provider)) return null;
  const entry = config.provider[active.provider];
  if (!entry) return null;
  if (entry.type !== 'openai-compatible' && entry.type !== 'anthropic') return null;
  return { provider: active.provider, model: active.model };
}

interface ConnectionTestRecord {
  provider: string;
  model: string;
  /** Server config revision the test ran against (review R4). */
  revision?: string;
  /** Wall-clock time of the completed test, separate from elapsedMs. */
  checkedAt: number;
}

/** Identity a connection-test result stays valid for (review R4). */
export interface ConnectionTestScope {
  provider: string;
  model: string;
  revision?: string;
}

/**
 * A stored result is current only for the exact provider/model *and* the
 * server config revision it was produced with. Switching the selection
 * (A → B → A) or any effective endpoint/auth change on the server invalidates
 * it — the old badge must not come back without a new click.
 */
export function connectionRecordIsCurrent(
  record: ConnectionTestRecord | null,
  scope: ConnectionTestScope | null,
): boolean {
  if (!record || !scope) return false;
  return (
    record.provider === scope.provider &&
    record.model === scope.model &&
    record.revision === scope.revision
  );
}

/**
 * Explicit "Test connection" action (0139 C): one short server-side request
 * for the selected API provider/model. Never runs on mount, on model select,
 * or on config refresh — only on click. Stored results are dropped whenever
 * the target or the server config revision changes, and a response that
 * lands after such a change is discarded instead of displayed (review R4).
 */
export function ConnectionTestBlock({
  active,
  config,
}: {
  active: { provider: string; model: string } | null;
  config: SberDesignerConfig | null;
}) {
  const target = connectionTestTargetForActive(active, config);
  // The editor store types config as SberDesignerConfig, but the live object
  // from GET /api/config is a FrontendConfig carrying configRevision.
  const revision = (config as { configRevision?: string } | null)?.configRevision;
  const scope: ConnectionTestScope | null = target
    ? { provider: target.provider, model: target.model, ...(revision ? { revision } : {}) }
    : null;
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<
    (ConnectionTestRecord & ProviderConnectionTestResult) | null
  >(null);
  const [requestError, setRequestError] = useState<
    (ConnectionTestRecord & { message: string }) | null
  >(null);
  // Bumped on every scope change and on every new run: a response whose
  // token no longer matches is stale and must not reach the state.
  const runTokenRef = useRef(0);
  const scopeKey = scope ? `${scope.provider}::${scope.model}::${scope.revision ?? ''}` : '';

  useEffect(() => {
    runTokenRef.current += 1;
    setResult(null);
    setRequestError(null);
  }, [scopeKey]);

  const runTest = async () => {
    if (!target || !scope || running) return;
    const token = ++runTokenRef.current;
    setRunning(true);
    setResult(null);
    setRequestError(null);
    try {
      const value = await testProviderConnection(target);
      if (runTokenRef.current !== token) return;
      setResult({ ...scope, checkedAt: Date.now(), ...value });
    } catch (err) {
      if (runTokenRef.current !== token) return;
      setRequestError({
        ...scope,
        checkedAt: Date.now(),
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      if (runTokenRef.current === token) setRunning(false);
    }
  };

  const formatCheckedAt = (checkedAt: number): string =>
    new Date(checkedAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  const resultCurrent = connectionRecordIsCurrent(result, scope) ? result : null;
  const errorCurrent = connectionRecordIsCurrent(requestError, scope) ? requestError : null;

  return (
    <div className="grid gap-1.5 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="uppercase tracking-wide text-muted-foreground">Connection test</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={!target || running}
          title={
            target
              ? 'Send one short request to the selected provider and model'
              : 'Select an API provider model to test its connection'
          }
          onClick={() => void runTest()}
        >
          {running ? (
            <LoaderCircle className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          {running ? 'Testing…' : 'Test connection'}
        </Button>
      </div>
      {resultCurrent && resultCurrent.ok && (
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <Badge tone="ok">connection verified</Badge>
          <span>
            {resultCurrent.responseModel
              ? `Responded as ${resultCurrent.responseModel}`
              : 'Provider did not report which model answered'}{' '}
            in {resultCurrent.elapsedMs} ms · last checked{' '}
            {formatCheckedAt(resultCurrent.checkedAt)}
            {resultCurrent.textPreview ? ` · “${resultCurrent.textPreview.slice(0, 80)}”` : ''}
          </span>
        </div>
      )}
      {resultCurrent && !resultCurrent.ok && resultCurrent.error && (
        <div className="grid gap-1 break-words">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="danger">connection failed</Badge>
            <span className="text-muted-foreground">
              {resultCurrent.elapsedMs} ms · last checked {formatCheckedAt(resultCurrent.checkedAt)}
              {resultCurrent.error.status !== undefined
                ? ` · HTTP ${resultCurrent.error.status}`
                : ''}
              {resultCurrent.error.providerCode
                ? ` · code ${resultCurrent.error.providerCode}`
                : ''}
            </span>
          </div>
          <div className="text-destructive">{resultCurrent.error.message}</div>
          {resultCurrent.error.hint && (
            <div className="text-muted-foreground">{resultCurrent.error.hint}</div>
          )}
        </div>
      )}
      {errorCurrent && (
        <div className="grid gap-1 break-words">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="danger">connection failed</Badge>
            <span className="text-muted-foreground">
              last checked {formatCheckedAt(errorCurrent.checkedAt)}
            </span>
          </div>
          <div className="text-destructive">{errorCurrent.message}</div>
          <div className="text-muted-foreground">
            The test request did not reach the provider — this is not a provider-side verdict.
          </div>
        </div>
      )}
      {!target && (
        <div className="text-muted-foreground">
          Select an API provider model above, then test its endpoint and key with one short request.
        </div>
      )}
    </div>
  );
}

function ApiProvidersList({
  enabledProviderIds,
  onProviderEnabledChange,
}: {
  enabledProviderIds: string[];
  onProviderEnabledChange: (providerId: string, enabled: boolean) => void;
}) {
  const config = useEditorStore((s) => s.config);
  const entries = Object.entries(config?.provider ?? {});
  return (
    <TabsContent value="api" className="mt-3">
      {entries.length === 0 ? (
        <EmptyTabState text="No API providers are configured in ./sber-designer.json yet." />
      ) : (
        <ul className="grid gap-1.5">
          {entries.map(([key, p]) => {
            const enabled = enabledProviderIds.includes(key);
            return (
              <li
                key={key}
                className={
                  'grid grid-cols-[16px_minmax(0,1fr)_auto] items-start gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm transition-opacity ' +
                  (enabled ? '' : 'opacity-60')
                }
              >
                <AgentProviderIcon
                  providerId={key}
                  label={p.name}
                  size={16}
                  className="mt-0.5 text-primary"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">{p.name}</span>
                    <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                      {p.type}
                    </span>
                    <ProviderStatus provider={p} />
                  </div>
                  {p.description && (
                    <div className="text-xs text-muted-foreground">{p.description}</div>
                  )}
                </div>
                <ProviderSwitch
                  enabled={enabled}
                  disabled={false}
                  onChange={(next) => onProviderEnabledChange(key, next)}
                  title={`${enabled ? 'Disable' : 'Enable'} ${p.name}`}
                />
              </li>
            );
          })}
        </ul>
      )}
    </TabsContent>
  );
}

function CliAgentsList({
  active,
  setActive,
  fallbackModel,
  enabledRuntimeKinds,
  runtimesLoaded,
  runtimeByKind,
  runtimeError,
  runtimeBusy,
  onReloadRuntimes,
  onRuntimeChange,
}: {
  active: { provider: string; model: string } | null;
  setActive: (value: { provider: string; model: string } | null) => void;
  fallbackModel: { provider: string; model: string; label: string } | null;
  enabledRuntimeKinds: AgentRuntimeKind[];
  runtimesLoaded: boolean;
  runtimeByKind: Map<AgentRuntimeKind, AgentRuntimeStatus | undefined>;
  runtimeError: string | null;
  runtimeBusy: boolean;
  onReloadRuntimes: () => void;
  onRuntimeChange: (runtime: AgentRuntimeStatus) => void;
}) {
  const defs = cliRuntimeRowDefs(enabledRuntimeKinds);
  return (
    <TabsContent value="cli" className="mt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Local CLI agents
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={runtimeBusy || defs.length === 0}
          onClick={onReloadRuntimes}
          className="h-7 px-2 text-xs"
        >
          <RefreshCw className={runtimeBusy ? 'size-3.5 animate-spin' : 'size-3.5'} />
          Refresh connected runtimes
        </Button>
      </div>
      {!runtimesLoaded && defs.length === 0 && <EmptyTabState text="Checking local CLI agents…" />}
      {runtimesLoaded && defs.length === 0 && (
        <EmptyTabState text="Local CLI agents are not enabled on this server or none were detected." />
      )}
      {runtimeError && (
        <div className="mb-2 break-words rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
          {runtimeError}
        </div>
      )}
      <ul className="grid gap-1.5">
        {defs.map((def) => (
          <CliRuntimeProviderRow
            key={def.kind}
            active={active}
            setActive={setActive}
            fallbackModel={fallbackModel}
            runtimeKind={def.kind}
            providerId={def.providerId}
            displayName={def.displayName}
            labelPrefix={def.labelPrefix}
            description={def.description}
            runtime={runtimeByKind.get(def.kind) ?? null}
            runtimeError={null}
            onRuntimeChange={onRuntimeChange}
          />
        ))}
      </ul>
    </TabsContent>
  );
}

function EmptyTabState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/10 px-3 py-4 text-xs text-muted-foreground">
      {text}
    </div>
  );
}

function ProviderStatus({
  provider,
}: {
  provider: { type: string; options?: { apiKey?: string | undefined } | undefined };
}) {
  const status = providerStatusInfo(provider);
  if (!status) return null;
  return <Badge tone={status.tone}>{status.label}</Badge>;
}
