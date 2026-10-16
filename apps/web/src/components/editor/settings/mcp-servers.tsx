/** Product-owned MCP servers panel and per-server rows. */
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Link2,
  Loader2,
  Plug,
  RefreshCw,
  RotateCcw,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  connectProductMcpServer,
  disconnectProductMcpServer,
  fetchProductMcpStatus,
  reloadProductMcpStatus,
  resetProductMcpToolOverrides,
  restartProductMcpServer,
  setProductMcpServerEnabled,
  setProductMcpToolEnabled,
  type ProductMcpServerSummary,
  type ProductMcpStatusResponse,
} from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Badge, ProviderSwitch } from './shared';

export function McpServersSettingsPanel() {
  const [status, setStatus] = useState<ProductMcpStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetchProductMcpStatus(controller.signal)
      .then((response) => setStatus(response))
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => controller.abort();
  }, []);

  const reload = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await reloadProductMcpStatus();
      setStatus(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (action: () => Promise<ProductMcpStatusResponse>) => {
    setBusy(true);
    setError(null);
    try {
      const response = await action();
      setStatus(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ProductMcpServersPanel
      status={status}
      error={error}
      busy={busy}
      onReload={() => void reload()}
      onConnect={(key) => void runAction(() => connectProductMcpServer(key))}
      onDisconnect={(key) => void runAction(() => disconnectProductMcpServer(key))}
      onRestart={(key) => void runAction(() => restartProductMcpServer(key))}
      onEnabledChange={(key, enabled) =>
        void runAction(() => setProductMcpServerEnabled(key, enabled))
      }
      onToolEnabledChange={(key, toolName, enabled) =>
        void runAction(() => setProductMcpToolEnabled(key, toolName, enabled))
      }
      onResetToolSelection={(key) => void runAction(() => resetProductMcpToolOverrides(key))}
    />
  );
}

export function ProductMcpServersPanel({
  status,
  error,
  busy,
  onReload,
  onConnect,
  onDisconnect,
  onRestart,
  onEnabledChange,
  onToolEnabledChange,
  onResetToolSelection,
}: {
  status: ProductMcpStatusResponse | null;
  error: string | null;
  busy: boolean;
  onReload: () => void;
  onConnect: (key: string) => void;
  onDisconnect: (key: string) => void;
  onRestart: (key: string) => void;
  onEnabledChange: (key: string, enabled: boolean) => void;
  onToolEnabledChange: (key: string, toolName: string, enabled: boolean) => void;
  onResetToolSelection: (key: string) => void;
}) {
  const servers = status?.servers ?? [];
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Link2 className="size-4 text-primary" />
            API MCP servers
          </div>
          <p className="text-xs text-muted-foreground">
            API providers use project-owned MCP servers from <code>sber-designer.json</code>. Local
            CLI providers keep their own MCP configuration.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onReload}>
          {busy ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          Reload
        </Button>
      </div>

      {error && (
        <div className="mt-3 flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!error && !status && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Loading MCP status
        </div>
      )}

      {status && servers.length === 0 && (
        <div className="mt-3 rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          No API MCP servers configured.
        </div>
      )}

      {servers.length > 0 && (
        <ul className="mt-3 grid gap-1.5">
          {servers.map((server) => (
            <ProductMcpServerRow
              key={server.key}
              server={server}
              busy={busy}
              onConnect={onConnect}
              onDisconnect={onDisconnect}
              onRestart={onRestart}
              onEnabledChange={onEnabledChange}
              onToolEnabledChange={onToolEnabledChange}
              onResetToolSelection={onResetToolSelection}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ProductMcpServerRow({
  server,
  busy,
  onConnect,
  onDisconnect,
  onRestart,
  onEnabledChange,
  onToolEnabledChange,
  onResetToolSelection,
}: {
  server: ProductMcpServerSummary;
  busy: boolean;
  onConnect: (key: string) => void;
  onDisconnect: (key: string) => void;
  onRestart: (key: string) => void;
  onEnabledChange: (key: string, enabled: boolean) => void;
  onToolEnabledChange: (key: string, toolName: string, enabled: boolean) => void;
  onResetToolSelection: (key: string) => void;
}) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const [toolQuery, setToolQuery] = useState('');
  const endpoint = productMcpEndpoint(server);
  const status = server.status.transport;
  const canConnect = server.enabled && (status === 'not_connected' || status === 'failed');
  const canRestart = server.enabled && status === 'failed';
  const canDisconnect = server.enabled && status === 'connected';
  const normalizedToolQuery = toolQuery.trim().toLocaleLowerCase();
  const visibleTools = useMemo(() => {
    if (!normalizedToolQuery) return server.tools;
    return server.tools.filter((tool) =>
      [tool.name, tool.displayName, tool.canonicalName, tool.description]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLocaleLowerCase().includes(normalizedToolQuery)),
    );
  }, [normalizedToolQuery, server.tools]);
  const toolCountLabel =
    server.discoveredToolCount > 0
      ? `${server.selectedToolCount}/${server.discoveredToolCount}`
      : `${server.toolCount}/${server.tools.length}`;
  const selectionSummary =
    server.discoveredToolCount > 0
      ? `${server.selectedToolCount} selected / ${server.discoveredToolCount} discovered`
      : `${server.toolCount} exposed`;
  return (
    <li className="rounded-md border border-border bg-background px-3 py-2 text-sm">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="font-medium">{server.key}</span>
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              {server.transport}
            </span>
            <Badge tone={productMcpStatusTone(status)}>{productMcpStatusLabel(status)}</Badge>
            {server.status.upstream !== 'n/a' && (
              <Badge tone="muted">{server.status.upstream}</Badge>
            )}
          </div>
          <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="font-mono">namespace:{server.namespace}</span>
            {endpoint && <span className="min-w-0 truncate font-mono">{endpoint}</span>}
          </div>
          {server.description && (
            <p className="text-xs text-muted-foreground">{server.description}</p>
          )}
        </div>
        <ProviderSwitch
          enabled={server.enabled}
          disabled={busy || !server.configEnabled}
          title={
            server.configEnabled
              ? 'Enable this MCP server for API-mode runs'
              : 'Enable this server in sber-designer.json first.'
          }
          onChange={(enabled) => onEnabledChange(server.key, enabled)}
        />
      </div>

      {!server.configEnabled && (
        <div className="mt-2 text-xs text-muted-foreground">
          Enable this server in sber-designer.json first.
        </div>
      )}

      {server.remote && (
        <div className="mt-2 flex gap-2 rounded-md border border-warning/20 bg-warning/10 px-2 py-1.5 text-xs text-warning">
          <AlertTriangle className="size-3.5 shrink-0" />
          <span>
            <span className="font-medium">Remote MCP server.</span> Tool calls and selected context
            may be sent to this endpoint.
          </span>
        </div>
      )}

      {server.diagnostics.length > 0 && (
        <div className="mt-2 grid gap-1">
          {server.diagnostics.map((diagnostic) => (
            <div
              key={`${diagnostic.code}:${diagnostic.message}`}
              className={cn(
                'text-xs',
                diagnostic.level === 'error'
                  ? 'text-destructive-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {diagnostic.message}
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
        {canRestart ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onRestart(server.key)}
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-3" />}
            Restart
          </Button>
        ) : canConnect ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onConnect(server.key)}
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : <Plug className="size-3" />}
            Connect
          </Button>
        ) : null}
        {canDisconnect && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onDisconnect(server.key)}
          >
            Disconnect
          </Button>
        )}
        <button
          type="button"
          onClick={() => setToolsOpen((open) => !open)}
          className="inline-flex min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        >
          {toolsOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          Tools
          <span className="text-[10px]">({toolCountLabel})</span>
        </button>
        {server.selectionMode === 'explicit' && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => onResetToolSelection(server.key)}
          >
            Reset tool selection
          </Button>
        )}
      </div>

      {toolsOpen && (
        <div className="mt-2 rounded-md border border-border bg-muted/20 p-2">
          {server.tools.length === 0 ? (
            <div className="text-xs text-muted-foreground">No tools discovered yet.</div>
          ) : (
            <div className="grid gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <label className="relative min-w-[180px] flex-1">
                  <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={toolQuery}
                    onChange={(event) => setToolQuery(event.currentTarget.value)}
                    placeholder="Search tools"
                    className="h-8 w-full rounded-md border border-border bg-background pl-7 pr-2 text-xs outline-none focus:border-primary"
                  />
                </label>
                <span className="text-[10px] text-muted-foreground">
                  {normalizedToolQuery ? `${visibleTools.length} matches` : selectionSummary}
                </span>
              </div>
              {visibleTools.length === 0 ? (
                <div className="rounded-md border border-dashed border-border px-2 py-3 text-xs text-muted-foreground">
                  No tools match this search.
                </div>
              ) : (
                <ul className="grid gap-1.5">
                  {visibleTools.map((tool) => (
                    <li
                      key={tool.name}
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-md bg-background/70 px-2 py-1.5"
                    >
                      <div className="grid min-w-0 gap-0.5">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="min-w-0 truncate font-mono text-xs">
                            {tool.displayName ?? tool.name}
                          </span>
                          <Badge tone={tool.enabled ? 'ok' : 'muted'}>
                            {productMcpToolBadgeLabel(tool)}
                          </Badge>
                        </div>
                        {tool.canonicalName && (
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {tool.canonicalName}
                          </div>
                        )}
                        {tool.displayName && tool.displayName !== tool.name && (
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {tool.name}
                          </div>
                        )}
                        {tool.description && (
                          <div className="text-xs text-muted-foreground">{tool.description}</div>
                        )}
                        {productMcpToolHint(tool) && (
                          <div className="text-[10px] text-muted-foreground">
                            {productMcpToolHint(tool)}
                          </div>
                        )}
                      </div>
                      <ProviderSwitch
                        enabled={tool.enabled}
                        disabled={busy || tool.canToggle === false}
                        title={productMcpToolSwitchTitle(tool)}
                        onChange={(enabled) => onToolEnabledChange(server.key, tool.name, enabled)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function productMcpToolBadgeLabel(tool: ProductMcpServerSummary['tools'][number]): string {
  if (tool.enabled) return 'enabled';
  if (tool.configuredDisabled) return 'disabled in config';
  if (tool.blockedBySelectionLimit) return 'limit reached';
  if (tool.runtimeDisabled) return 'disabled';
  if (tool.hiddenByLimit) return 'hidden by limit';
  return 'available';
}

function productMcpToolHint(tool: ProductMcpServerSummary['tools'][number]): string | null {
  if (tool.blockedBySelectionLimit) return 'Disable another tool before enabling this one.';
  if (tool.blockedBySelectionMinimum) return 'At least one MCP tool must stay enabled.';
  if (tool.hiddenByLimit) return 'Only the first 64 MCP tools are active by default.';
  if (tool.runtimeDisabled) return 'Enable this tool to add it to the selected MCP set.';
  return null;
}

function productMcpToolSwitchTitle(tool: ProductMcpServerSummary['tools'][number]): string {
  if (tool.configuredDisabled) return 'Disabled in sber-designer.json.';
  if (tool.blockedBySelectionLimit) return 'Disable another tool before enabling this one.';
  if (tool.blockedBySelectionMinimum) return 'At least one MCP tool must stay enabled.';
  return tool.enabled ? 'Disable this MCP tool' : 'Enable this MCP tool';
}

function productMcpEndpoint(server: ProductMcpServerSummary): string | null {
  const url = server.config.url;
  if (typeof url === 'string') return url;
  const command = server.config.command;
  if (typeof command !== 'string') return null;
  const args = Array.isArray(server.config.args)
    ? server.config.args.filter((arg): arg is string => typeof arg === 'string')
    : [];
  return [command, ...args].join(' ');
}

function productMcpStatusTone(
  status: ProductMcpServerSummary['status']['transport'],
): 'ok' | 'warn' | 'danger' | 'muted' {
  if (status === 'connected') return 'ok';
  if (status === 'failed') return 'danger';
  if (status === 'disabled' || status === 'not_connected') return 'muted';
  return 'warn';
}

function productMcpStatusLabel(status: ProductMcpServerSummary['status']['transport']): string {
  if (status === 'connected') return 'Connected';
  if (status === 'connecting') return 'Connecting';
  if (status === 'not_connected') return 'Not connected';
  if (status === 'disabled') return 'Disabled';
  return 'Failed';
}
