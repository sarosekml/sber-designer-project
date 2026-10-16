import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Clipboard, Loader2 } from 'lucide-react';

import type { HostApp, HostAppsResponse } from '@sber-designer/shared-types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  CLAUDE_CODE_RUNTIME_PROVIDER_ID,
  CODEX_RUNTIME_PROVIDER_ID,
  OPENCODE_RUNTIME_PROVIDER_ID,
  fetchAgentRuntimes,
  fetchHostApps,
  openProjectInHostApp,
  type AgentRuntimeKind,
  type AgentRuntimeStatus,
} from '@/lib/api-client';
import {
  fallbackHostApp,
  readPreferredHostApp,
  resolvePrimaryHostApp,
  splitHostApps,
  writePreferredHostApp,
} from '@/lib/handoff';
import { buildCliHandoffPrompt } from '@/lib/handoff-cli-prompt';
import { AgentProviderIcon } from './AgentProviderIcon';
import { HostAppIcon } from './HostAppIcon';

interface HandoffMenuProps {
  workspacePath: string;
  projectName?: string;
}

type HandoffTab = 'editor' | 'cli';

interface CliTarget {
  id: AgentRuntimeKind | 'any';
  label: string;
  providerId: string;
  available: boolean;
  version?: string | null;
}

const EMPTY_HOST_APPS: HostAppsResponse = { platform: 'unknown', apps: [] };
const CLI_TARGETS: ReadonlyArray<Pick<CliTarget, 'id' | 'label' | 'providerId'>> = [
  { id: 'claude-code', label: 'Claude Code', providerId: CLAUDE_CODE_RUNTIME_PROVIDER_ID },
  { id: 'codex', label: 'Codex CLI', providerId: CODEX_RUNTIME_PROVIDER_ID },
  { id: 'opencode', label: 'opencode', providerId: OPENCODE_RUNTIME_PROVIDER_ID },
];

export function HandoffMenu({ workspacePath, projectName }: HandoffMenuProps) {
  const [hostApps, setHostApps] = useState<HostAppsResponse | null>(null);
  const [runtimes, setRuntimes] = useState<AgentRuntimeStatus[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<HandoffTab>('editor');
  const [busyAppId, setBusyAppId] = useState<HostApp['id'] | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const copiedTimer = useRef<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      fetchHostApps(controller.signal),
      fetchAgentRuntimes(controller.signal).catch(() => ({ runtimes: [], enabledKinds: [] })),
    ])
      .then(([appsResponse, runtimesResponse]) => {
        setHostApps(appsResponse);
        setRuntimes(runtimesResponse.runtimes);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setHostApps(EMPTY_HOST_APPS);
        setError(errorMessage(cause));
      });
    return () => controller.abort();
  }, []);

  useEffect(
    () => () => {
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    },
    [],
  );

  const cliTargets = useMemo(() => resolveCliTargets(runtimes), [runtimes]);
  if (!hostApps) return null;

  const primary = resolvePrimaryHostApp(hostApps.apps, readPreferredHostApp());
  const fallback = fallbackHostApp(hostApps.platform);
  if (!primary) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={busyAppId !== null}
            aria-label={`Open in ${fallback.label}`}
            onClick={() => void launchApp(fallback)}
          >
            {busyAppId === fallback.id ? (
              <Loader2 className="animate-spin" />
            ) : (
              <HostAppIcon app={fallback} />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {error ?? `Open the project folder in ${fallback.label}`}
        </TooltipContent>
      </Tooltip>
    );
  }

  const groups = splitHostApps(hostApps.apps);

  async function launchApp(app: HostApp): Promise<void> {
    setBusyAppId(app.id);
    setError(null);
    try {
      await openProjectInHostApp(app.id);
      writePreferredHostApp(app.id);
      setMenuOpen(false);
    } catch (cause) {
      setError(errorMessage(cause));
      setMenuOpen(true);
      setActiveTab('editor');
    } finally {
      setBusyAppId(null);
    }
  }

  async function copyText(id: string, value: string): Promise<void> {
    setError(null);
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => {
        setCopiedId(null);
        copiedTimer.current = null;
      }, 1800);
    } catch (cause) {
      setError(`Copy failed: ${errorMessage(cause)}`);
    }
  }

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <div
        role="group"
        aria-label="Open project in host app"
        className="inline-flex rounded-md border border-border bg-background p-0.5"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-6 w-6 rounded-[5px] text-muted-foreground hover:text-accent-foreground"
              disabled={busyAppId !== null}
              aria-label={`Open in ${primary.label}`}
              onClick={() => void launchApp(primary)}
            >
              {busyAppId === primary.id ? (
                <Loader2 className="animate-spin" />
              ) : (
                <HostAppIcon app={primary} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Open in {primary.label}</TooltipContent>
        </Tooltip>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-6 w-6 rounded-[5px] text-muted-foreground hover:text-accent-foreground"
            disabled={busyAppId !== null}
            aria-label="Choose an app to open this project"
          >
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
      </div>

      <DropdownMenuContent align="end" className="w-[360px] p-2">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as HandoffTab)}>
          <TabsList variant="secondary" className="grid w-full grid-cols-2">
            <TabsTrigger value="editor">Open with editor</TabsTrigger>
            <TabsTrigger value="cli">Copy for CLI</TabsTrigger>
          </TabsList>

          <TabsContent value="editor" className="mt-2 space-y-1">
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                void copyText('path', workspacePath);
              }}
            >
              {copiedId === 'path' ? <Check /> : <Clipboard />}
              {copiedId === 'path' ? 'Copied' : 'Copy path'}
              <span className="ml-auto max-w-56 truncate text-xs text-muted-foreground">
                {workspacePath}
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <HostAppGroup
              label="Installed"
              apps={groups.installed}
              busyAppId={busyAppId}
              onLaunch={launchApp}
            />
            {groups.notInstalled.length > 0 && (
              <HostAppGroup
                label="Not installed"
                apps={groups.notInstalled}
                busyAppId={busyAppId}
                onLaunch={launchApp}
                dimmed
              />
            )}
          </TabsContent>

          <TabsContent value="cli" className="mt-2 space-y-1">
            <DropdownMenuLabel>Copy a continuation prompt</DropdownMenuLabel>
            {cliTargets.map((target) => (
              <DropdownMenuItem
                key={target.id}
                className={target.available ? undefined : 'opacity-60'}
                onSelect={(event) => {
                  event.preventDefault();
                  void copyText(
                    `cli:${target.id}`,
                    buildCliHandoffPrompt({
                      cliLabel: target.label,
                      workspacePath,
                      ...(projectName ? { projectName } : {}),
                    }),
                  );
                }}
              >
                <AgentProviderIcon providerId={target.providerId} label={target.label} size={16} />
                <span>{target.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {copiedId === `cli:${target.id}`
                    ? 'Copied'
                    : target.id === 'any'
                      ? 'Universal'
                      : target.available
                        ? (target.version ?? 'Installed')
                        : 'Not installed'}
                </span>
              </DropdownMenuItem>
            ))}
          </TabsContent>
        </Tabs>

        {error && (
          <div
            className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive"
            role="alert"
          >
            {error}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function HostAppGroup({
  label,
  apps,
  busyAppId,
  onLaunch,
  dimmed = false,
}: {
  label: string;
  apps: HostApp[];
  busyAppId: HostApp['id'] | null;
  onLaunch: (app: HostApp) => Promise<void>;
  dimmed?: boolean;
}) {
  if (apps.length === 0) return null;
  return (
    <>
      <DropdownMenuLabel className="text-xs text-muted-foreground">{label}</DropdownMenuLabel>
      {apps.map((app) => (
        <DropdownMenuItem
          key={app.id}
          className={dimmed ? 'opacity-60' : undefined}
          onSelect={(event) => {
            event.preventDefault();
            void onLaunch(app);
          }}
        >
          {busyAppId === app.id ? <Loader2 className="animate-spin" /> : <HostAppIcon app={app} />}
          <span>{app.label}</span>
          <ChevronRight className="ml-auto" />
        </DropdownMenuItem>
      ))}
    </>
  );
}

function resolveCliTargets(runtimes: readonly AgentRuntimeStatus[]): CliTarget[] {
  const byKind = new Map(runtimes.map((runtime) => [runtime.kind, runtime]));
  return [
    ...CLI_TARGETS.map((target): CliTarget => {
      const runtime = byKind.get(target.id as AgentRuntimeKind);
      return {
        ...target,
        available: runtime?.installed === true,
        ...(runtime?.version !== undefined ? { version: runtime.version } : {}),
      };
    }),
    {
      id: 'any',
      label: 'Any coding agent',
      providerId: 'custom',
      available: true,
    },
  ];
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
