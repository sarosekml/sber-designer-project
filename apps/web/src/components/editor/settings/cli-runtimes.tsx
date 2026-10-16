/** Local CLI runtime provider rows (OpenCode / Claude Code / Codex / Kimi). */
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import {
  connectAgentRuntime,
  disconnectAgentRuntime,
  refreshAgentRuntime,
  selectAgentRuntimeModel,
  CLAUDE_CODE_RUNTIME_PROVIDER_ID,
  CODEX_RUNTIME_PROVIDER_ID,
  KIMI_RUNTIME_PROVIDER_ID,
  OPENCODE_RUNTIME_PROVIDER_ID,
  GIGACODE_RUNTIME_PROVIDER_ID,
  type AgentRuntimeKind,
  type AgentRuntimeStatus,
} from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { fullAgentLabel, modelOptionLabel } from '@/lib/agent-provider-labels';
import type { ModelSelectOption } from '@/lib/model-select-options';
import { notifyAgentRuntimesChanged } from '@/lib/settings-events';
import { AgentProviderIcon } from '../AgentProviderIcon';
import { ModelSelect } from '../ModelSelect';
import { Badge, ProviderSwitch } from './shared';

export function runtimeOptions(
  runtime: AgentRuntimeStatus | null,
  providerId: string,
  labelPrefix: string,
): { provider: string; model: string; label: string; description?: string }[] {
  if (!runtime?.connected) return [];
  const options = runtime.models.map((model) => {
    const description = modelDescription(model);
    return {
      provider: providerId,
      model: model.id,
      label: fullAgentLabel({
        kind: 'cli',
        providerLabel: labelPrefix,
        model: model.id,
        modelDisplay: stripLabelPrefix(model.label, labelPrefix),
      }),
      ...(description ? { description } : {}),
    };
  });
  const selected = runtime.selectedModel;
  if (selected && !options.some((option) => option.model === selected)) {
    options.unshift({
      provider: providerId,
      model: selected,
      label: fullAgentLabel({ kind: 'cli', providerLabel: labelPrefix, model: selected }),
    });
  }
  return options;
}

export function runtimeProviderLabel(provider: string): string {
  if (provider === OPENCODE_RUNTIME_PROVIDER_ID) return 'OpenCode';
  if (provider === CLAUDE_CODE_RUNTIME_PROVIDER_ID) return 'Claude Code';
  if (provider === CODEX_RUNTIME_PROVIDER_ID) return 'Codex CLI';
  if (provider === KIMI_RUNTIME_PROVIDER_ID) return 'Kimi Code CLI';
  if (provider === GIGACODE_RUNTIME_PROVIDER_ID) return 'GigaCode';
  return 'Local runtime';
}

export function CliRuntimeProviderRow({
  active,
  setActive,
  fallbackModel,
  runtimeKind,
  providerId,
  displayName,
  labelPrefix,
  description,
  runtime,
  runtimeError,
  onRuntimeChange,
}: {
  active: { provider: string; model: string } | null;
  setActive: (value: { provider: string; model: string } | null) => void;
  fallbackModel: { provider: string; model: string; label: string } | null;
  runtimeKind: AgentRuntimeKind;
  providerId: string;
  displayName: string;
  labelPrefix: string;
  description: string;
  runtime: AgentRuntimeStatus | null;
  runtimeError: string | null;
  onRuntimeChange: (runtime: AgentRuntimeStatus) => void;
}) {
  const [busy, setBusy] = useState<'connect' | 'disconnect' | 'model' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signInOpen, setSignInOpen] = useState(false);
  const connected = Boolean(runtime?.connected);
  const activeRuntime = active?.provider === providerId;
  const runtimeDiagnostic =
    runtime?.diagnostics.find((diagnostic) => diagnostic.severity === 'error') ??
    runtime?.diagnostics.find((diagnostic) => diagnostic.severity === 'warning') ??
    null;
  const runtimeBlocked = runtimeDiagnostic?.severity === 'error';
  const selectedModel =
    runtime?.selectedModel ??
    runtime?.models[0]?.id ??
    (activeRuntime ? active?.model : undefined) ??
    (runtimeKind === 'gigacode' ? '' : 'default');
  const modelOptions: ModelSelectOption[] = (runtime?.models ?? []).map((model) => {
    const description = modelDescription(model);
    return {
      value: model.id,
      label:
        model.id === 'default'
          ? modelOptionLabel(model.id)
          : stripLabelPrefix(model.label, labelPrefix),
      ...(description ? { description } : {}),
    };
  });

  const applyRuntimeChange = (nextRuntime: AgentRuntimeStatus) => {
    onRuntimeChange(nextRuntime);
    notifyAgentRuntimesChanged();
  };

  const connect = async () => {
    setBusy('connect');
    setError(null);
    try {
      let detectedRuntime = runtime;
      if (runtimeKind === 'gigacode') {
        const refreshed = await refreshAgentRuntime(runtimeKind);
        detectedRuntime = refreshed.runtime;
        applyRuntimeChange(refreshed.runtime);
        if (!refreshed.runtime.installed) {
          setError('GigaCode was not found on this computer.');
          return;
        }
        if (refreshed.runtime.auth.status !== 'ready') {
          setSignInOpen(true);
          return;
        }
        if (refreshed.runtime.models.length === 0) {
          setError('GigaCode did not expose any usable chat models.');
          return;
        }
      }
      const modelForConnect =
        detectedRuntime?.selectedModel &&
        detectedRuntime.models.some((model) => model.id === detectedRuntime.selectedModel)
          ? detectedRuntime.selectedModel
          : undefined;
      const response = await connectAgentRuntime(runtimeKind, modelForConnect);
      applyRuntimeChange(response.runtime);
      const model = response.runtime.selectedModel ?? response.runtime.models[0]?.id;
      if (model) setActive({ provider: providerId, model });
      setSignInOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy('disconnect');
    setError(null);
    try {
      const response = await disconnectAgentRuntime(runtimeKind);
      applyRuntimeChange(response.runtime);
      if (activeRuntime) {
        setActive(
          fallbackModel ? { provider: fallbackModel.provider, model: fallbackModel.model } : null,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const changeModel = async (model: string) => {
    setBusy('model');
    setError(null);
    setActive({ provider: providerId, model });
    try {
      const response = await selectAgentRuntimeModel(runtimeKind, model);
      applyRuntimeChange(response.runtime);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <li
      className={
        'grid grid-cols-[16px_minmax(0,1fr)_auto] items-start gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm transition-opacity ' +
        (connected ? '' : 'opacity-80')
      }
    >
      <AgentProviderIcon providerId={providerId} label={displayName} size={16} className="mt-0.5" />
      <div className="grid min-w-0 gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-baseline gap-2">
            <span className="font-medium">{displayName}</span>
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              local-cli
            </span>
            <Badge tone={runtimeBlocked ? 'danger' : connected ? 'ok' : 'warn'}>
              {runtimeBlocked ? 'blocked' : connected ? 'connected' : 'off'}
            </Badge>
            {activeRuntime && <Badge tone="ok">active</Badge>}
          </div>
          <div className="text-xs text-muted-foreground">{description}</div>
          {connected && (
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {runtime?.version && <span className="font-mono">{runtime.version}</span>}
              {runtime?.command && <span className="truncate font-mono">{runtime.command}</span>}
              {runtime?.auth.providers.length ? (
                <span>{runtime.auth.providers.join(', ')}</span>
              ) : null}
            </div>
          )}
        </div>

        {connected && (
          <div className="grid max-w-xl min-w-0 gap-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Model</div>
            <ModelSelect
              value={selectedModel}
              options={modelOptions}
              includeDefault={modelOptions.some((option) => option.value === 'default')}
              disabled={busy !== null}
              onChange={(model) => void changeModel(model)}
              align="start"
              className="w-full"
            />
          </div>
        )}

        {runtimeDiagnostic && (
          <div
            className={
              'min-w-0 break-words rounded-md border px-2 py-1.5 text-xs ' +
              (runtimeDiagnostic.severity === 'error'
                ? 'border-destructive/40 bg-destructive/10 text-destructive-foreground'
                : 'border-warning/30 bg-warning/10 text-warning')
            }
          >
            {runtimeDiagnostic.message}
          </div>
        )}

        {(error || runtimeError) && (
          <div className="min-w-0 break-words rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive-foreground">
            {error ?? runtimeError}
          </div>
        )}
      </div>
      <ProviderSwitch
        enabled={connected}
        disabled={busy !== null}
        onChange={(next) => void (next ? connect() : disconnect())}
        title={connected ? `Disconnect ${displayName}` : `Connect ${displayName}`}
      />
      {runtimeKind === 'gigacode' ? (
        <GigaCodeSignInDialog
          open={signInOpen}
          busy={busy === 'connect'}
          error={error}
          onOpenChange={setSignInOpen}
          onCheckAgain={() => void connect()}
        />
      ) : null}
    </li>
  );
}

function GigaCodeSignInDialog({
  open,
  busy,
  error,
  onOpenChange,
  onCheckAgain,
}: {
  open: boolean;
  busy: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onCheckAgain: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copyCommand = async () => {
    await navigator.clipboard?.writeText('gigacode auth').catch(() => undefined);
    setCopied(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in to GigaCode</DialogTitle>
          <DialogDescription>
            Run the command in your terminal and complete the GigaCode sign-in flow. Then check the
            connection again.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
          <code className="font-mono text-sm">gigacode auth</code>
          <Button type="button" variant="outline" size="sm" onClick={() => void copyCommand()}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? 'Copied' : 'Copy command'}
          </Button>
        </div>
        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
            {error}
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={busy} onClick={onCheckAgain}>
            {busy ? 'Checking…' : 'Check again'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function stripLabelPrefix(label: string, prefix: string): string {
  const normalizedPrefix = `${prefix} · `;
  if (label === `${prefix} · default`) return modelOptionLabel('default');
  return label.startsWith(normalizedPrefix) ? label.slice(normalizedPrefix.length) : label;
}

function modelDescription(model: AgentRuntimeStatus['models'][number]): string | undefined {
  const context = model.contextWindowSize
    ? `${Math.round(model.contextWindowSize / 1000)}k context`
    : '';
  return [model.description, context].filter(Boolean).join(' · ') || undefined;
}

/**
 * services/api replaces secret values with frontend-safe sentinels when
 * shipping the config to the browser (ADR-0009). We surface that here so
 * the user knows whether a provider is actually usable.
 */
