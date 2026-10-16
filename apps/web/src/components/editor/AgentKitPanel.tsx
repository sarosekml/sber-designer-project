import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  ScrollText,
  Sparkles,
  Terminal,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  bootstrapAgentKit,
  fetchAgentKit,
  fetchFile,
  reloadAgentKit,
  type AgentKitBootstrapResult,
  type AgentKitInventory,
} from '@/lib/api-client';
import { cn } from '@/lib/utils';

export function AgentKitPanel() {
  const [inventory, setInventory] = useState<AgentKitInventory | null>(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<'reload' | 'bootstrap' | 'readme' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [bootstrapResult, setBootstrapResult] = useState<AgentKitBootstrapResult | null>(null);
  const [readme, setReadme] = useState<{ path: string; contents: string } | null>(null);

  const loadInventory = async (clearCache = false) => {
    setLoading(true);
    setError(null);
    try {
      if (clearCache) await reloadAgentKit();
      setInventory(await fetchAgentKit());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInventory();
  }, []);

  const handleReload = async () => {
    setAction('reload');
    setMessage(null);
    try {
      await loadInventory(true);
      setMessage('Agent kit inventory reloaded.');
    } finally {
      setAction(null);
    }
  };

  const handleBootstrap = async () => {
    setAction('bootstrap');
    setError(null);
    setMessage(null);
    setBootstrapResult(null);
    try {
      const result = await bootstrapAgentKit();
      setBootstrapResult(result);
      setMessage(
        `Created workspace .agents with ${result.createdPaths.length} file${result.createdPaths.length === 1 ? '' : 's'}.`,
      );
      await loadInventory(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAction(null);
    }
  };

  const handleOpenReadme = async () => {
    setAction('readme');
    setError(null);
    setMessage(null);
    try {
      const file = await fetchFile('.agents/README.md');
      setReadme(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAction(null);
    }
  };

  const workspaceKitMissing = Boolean(inventory?.workspaceRoot && !inventory.workspaceKitExists);
  const diagnostics = inventory?.diagnostics ?? [];
  const warnings = diagnostics.filter((item) => item.level !== 'info');
  const agents = useMemo(() => {
    const rank = { primary: 0, all: 1, subagent: 2 } as const;
    return [...(inventory?.agents ?? [])].sort(
      (a, b) =>
        rank[a.mode] - rank[b.mode] ||
        Number(a.hidden) - Number(b.hidden) ||
        a.name.localeCompare(b.name),
    );
  }, [inventory?.agents]);

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="size-4 text-primary" />
            Built-in agent kit
          </div>
          <p className="text-xs text-muted-foreground">
            Default kit plus optional project-local <code>.agents</code> overrides.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenReadme}
            disabled={loading || action !== null || !inventory?.workspaceKitExists}
            title={
              inventory?.workspaceKitExists
                ? 'Open workspace .agents README'
                : 'Create workspace .agents before opening its README'
            }
          >
            {action === 'readme' ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <BookOpen className="size-3" />
            )}
            Open README
          </Button>
          {workspaceKitMissing && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleBootstrap}
              disabled={loading || action !== null}
            >
              {action === 'bootstrap' ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Plus className="size-3" />
              )}
              Create .agents
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReload}
            disabled={loading || action !== null}
          >
            {loading || action === 'reload' ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCw className="size-3" />
            )}
            Reload
          </Button>
        </div>
      </div>

      {error && (
        <Notice tone="danger" icon={AlertTriangle}>
          {error}
        </Notice>
      )}
      {message && (
        <Notice tone="ok" icon={CheckCircle2}>
          {message}
        </Notice>
      )}
      {bootstrapResult?.warning && (
        <Notice tone="warn" icon={AlertTriangle}>
          {bootstrapResult.warning}
        </Notice>
      )}

      <AgentSummary inventory={inventory} loading={loading} />

      <AgentKitSection title="Agents" icon={Sparkles} count={agents.length}>
        <ResourceList
          empty="No agents discovered."
          items={agents.map((agent) => ({
            key: `${agent.source}:${agent.name}`,
            title: agent.name,
            detail: agentDetail(agent),
            badges: [
              agent.source,
              agent.mode,
              ...(agent.name === inventory?.defaultAgent.name ? ['default'] : []),
              ...(agent.hidden ? ['hidden'] : []),
            ],
          }))}
        />
      </AgentKitSection>

      <div className="grid min-w-0 gap-3 xl:grid-cols-2">
        <AgentKitSection
          title="Instructions"
          icon={FileText}
          count={inventory?.instructions.length}
        >
          <ResourceList
            empty="No instruction files discovered."
            items={(inventory?.instructions ?? []).map((item) => ({
              key: `${item.source}:${item.path}`,
              title: item.path,
              detail: formatBytes(item.sizeBytes),
              badges: [item.source],
            }))}
          />
        </AgentKitSection>

        <AgentKitSection title="Skills" icon={Sparkles} count={inventory?.skills.length}>
          <ResourceList
            empty="No skills discovered."
            items={(inventory?.skills ?? []).map((item) => ({
              key: `${item.source}:${item.name}`,
              title: item.name,
              detail: item.description,
              badges: [item.source, 'allowed'],
            }))}
          />
        </AgentKitSection>

        <AgentKitSection title="Knowledge" icon={ScrollText} count={inventory?.knowledge.length}>
          <ResourceList
            empty="No knowledge docs discovered."
            items={(inventory?.knowledge ?? []).map((item) => ({
              key: `${item.source}:${item.id}`,
              title: item.id,
              detail: `${item.path} · ${formatBytes(item.sizeBytes)} · ${item.description}`,
              badges: [item.source],
            }))}
          />
        </AgentKitSection>

        <AgentKitSection title="Scripts" icon={Terminal} count={inventory?.scripts.length}>
          <ResourceList
            empty="No script manifests discovered."
            items={(inventory?.scripts ?? []).map((item) => ({
              key: `${item.source}:${item.name}`,
              title: item.name,
              detail: `${scriptPreview(item.command, item.args)} · last run: not tracked`,
              badges: [item.source, item.permission],
            }))}
          />
        </AgentKitSection>
      </div>

      {warnings.length > 0 && (
        <AgentKitSection title="Diagnostics" icon={AlertTriangle} count={warnings.length}>
          <div className="grid gap-2">
            {warnings.slice(0, 12).map((item) => (
              <div
                key={`${item.level}:${item.code}:${item.path ?? ''}`}
                className="grid gap-1 rounded-md border border-border bg-background px-3 py-2 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <MiniBadge tone={item.level === 'error' ? 'danger' : 'warn'}>
                    {item.level}
                  </MiniBadge>
                  <span className="min-w-0 truncate font-mono">{item.code}</span>
                </div>
                <div className="break-words text-muted-foreground">{item.message}</div>
                {item.path && (
                  <div className="truncate font-mono text-muted-foreground">{item.path}</div>
                )}
              </div>
            ))}
          </div>
        </AgentKitSection>
      )}

      {readme && (
        <AgentKitSection title="README" icon={BookOpen} count={1}>
          <div className="grid gap-2">
            <div className="truncate font-mono text-xs text-muted-foreground">{readme.path}</div>
            <pre className="max-h-72 overflow-auto rounded-md border border-border bg-background p-3 text-xs leading-relaxed text-muted-foreground">
              {readme.contents}
            </pre>
          </div>
        </AgentKitSection>
      )}
    </div>
  );
}

function AgentSummary({
  inventory,
  loading,
}: {
  inventory: AgentKitInventory | null;
  loading: boolean;
}) {
  const active = inventory?.defaultAgent;
  const workspaceLabel = inventory?.workspaceKitExists ? 'active' : 'not created';
  return (
    <div className="grid min-w-0 gap-3 rounded-md border border-border bg-background px-3 py-3 text-xs">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="font-medium">Active agent</span>
        <MiniBadge tone={active ? 'ok' : 'warn'}>
          {active?.name ?? (loading ? 'loading' : 'missing')}
        </MiniBadge>
        {active?.source && <MiniBadge tone="ok">{active.source}</MiniBadge>}
        {active?.maxIterations && (
          <MiniBadge tone="neutral">{active.maxIterations} iterations</MiniBadge>
        )}
        {active?.temperature !== undefined && (
          <MiniBadge tone="neutral">temp {active.temperature}</MiniBadge>
        )}
      </div>
      <div className="grid min-w-0 gap-1 text-muted-foreground">
        <PathRow label="Agent prompt" value={active?.path ?? 'No agent prompt loaded yet'} />
        <PathRow label="Default kit" value={inventory?.defaultRoot ?? 'loading'} />
        <PathRow
          label="Workspace kit"
          value={inventory?.workspaceRoot ?? 'not connected'}
          badge={workspaceLabel}
        />
      </div>
    </div>
  );
}

function PathRow({ label, value, badge }: { label: string; value: string; badge?: string }) {
  return (
    <div className="grid min-w-0 gap-2 sm:grid-cols-[120px_minmax(0,1fr)_auto]">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate font-mono text-foreground/80" title={value}>
        {value}
      </span>
      {badge && <MiniBadge tone={badge === 'active' ? 'ok' : 'warn'}>{badge}</MiniBadge>}
    </div>
  );
}

function AgentKitSection({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: typeof Sparkles;
  count?: number | undefined;
  children: React.ReactNode;
}) {
  return (
    <section className="grid min-w-0 content-start gap-3 rounded-md border border-border bg-muted/20 px-3 py-3">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <Icon className="size-4 shrink-0 text-primary" />
          <span className="truncate">{title}</span>
        </div>
        {count !== undefined && <MiniBadge tone={count > 0 ? 'ok' : 'warn'}>{count}</MiniBadge>}
      </div>
      {children}
    </section>
  );
}

function ResourceList({
  empty,
  items,
}: {
  empty: string;
  items: { key: string; title: string; detail: string; badges: string[] }[];
}) {
  if (items.length === 0) {
    return <div className="text-xs text-muted-foreground">{empty}</div>;
  }
  return (
    <div className="grid min-w-0 gap-2">
      {items.slice(0, 16).map((item) => (
        <div
          key={item.key}
          className="grid min-w-0 gap-1 rounded-md border border-border bg-background px-3 py-2 text-xs"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate font-mono" title={item.title}>
              {item.title}
            </span>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {item.badges.map((badge, index) => (
                <MiniBadge key={`${badge}:${index}`} tone={badgeTone(badge)}>
                  {badge}
                </MiniBadge>
              ))}
            </div>
          </div>
          <div className="min-w-0 truncate text-muted-foreground" title={item.detail}>
            {item.detail}
          </div>
        </div>
      ))}
      {items.length > 16 && (
        <div className="text-xs text-muted-foreground">
          {items.length - 16} more item(s) hidden.
        </div>
      )}
    </div>
  );
}

function Notice({
  tone,
  icon: Icon,
  children,
}: {
  tone: 'ok' | 'warn' | 'danger';
  icon: typeof AlertTriangle;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 gap-2 rounded-md border px-3 py-2 text-xs',
        tone === 'ok' && 'border-success/30 bg-success/10 text-success',
        tone === 'warn' && 'border-warning/30 bg-warning/10 text-warning',
        tone === 'danger' && 'border-destructive/40 bg-destructive/10 text-destructive-foreground',
      )}
    >
      <Icon className="mt-0.5 size-3.5 shrink-0" />
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

function MiniBadge({
  tone,
  children,
}: {
  tone: 'ok' | 'warn' | 'danger' | 'neutral';
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 max-w-[9rem] items-center rounded px-1.5 text-[10px] font-medium uppercase tracking-wide',
        tone === 'ok' && 'bg-success/10 text-success',
        tone === 'warn' && 'bg-warning/10 text-warning',
        tone === 'danger' && 'bg-destructive/10 text-destructive-foreground',
        tone === 'neutral' && 'bg-muted text-muted-foreground',
      )}
      title={typeof children === 'string' ? children : undefined}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function badgeTone(value: string): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (
    value === 'allow' ||
    value === 'allowed' ||
    value === 'workspace' ||
    value === 'primary' ||
    value === 'all' ||
    value === 'default'
  ) {
    return 'ok';
  }
  if (value === 'deny' || value === 'hidden') return 'danger';
  if (value === 'ask' || value === 'subagent') return 'warn';
  return 'neutral';
}

function agentDetail(agent: AgentKitInventory['agents'][number]): string {
  const meta = [
    agent.mode,
    agent.maxIterations ? `${agent.maxIterations} iterations` : null,
    agent.temperature !== undefined ? `temp ${agent.temperature}` : null,
  ].filter(Boolean);
  return `${agent.description}${meta.length > 0 ? ` · ${meta.join(' · ')}` : ''}`;
}

function scriptPreview(command: string, args: string[]): string {
  return [command, ...args].join(' ').trim();
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
