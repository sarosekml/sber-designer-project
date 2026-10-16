import { useEffect, useState } from 'react';
import { Bot, Check, Code2, Cpu, Loader2, MonitorCog } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  getAdminSettings,
  updateAdminSettings,
  type AdminCliRuntime,
  type AdminSystemSettings,
} from '@/lib/api/admin';
import { cn } from '@/lib/utils';

const CLI_RUNTIMES: Array<{
  kind: AdminCliRuntime;
  label: string;
  description: string;
  icon: typeof Bot;
}> = [
  {
    kind: 'claude-code',
    label: 'Claude Code',
    description: 'Anthropic CLI account and project MCP handoff.',
    icon: Bot,
  },
  {
    kind: 'codex',
    label: 'Codex',
    description: 'OpenAI Codex CLI account and native image input.',
    icon: Code2,
  },
  {
    kind: 'opencode',
    label: 'OpenCode',
    description: 'OpenCode providers, models, and MCP configuration.',
    icon: Cpu,
  },
  {
    kind: 'kimi',
    label: 'Kimi Code',
    description: 'Moonshot AI Kimi Code CLI account and Kimi K3 model.',
    icon: Bot,
  },
  {
    kind: 'gigacode',
    label: 'GigaCode',
    description: 'Sber GigaCode CLI account and its on-premise model set.',
    icon: Cpu,
  },
];

export function toggleCliRuntime(
  enabled: AdminCliRuntime[],
  kind: AdminCliRuntime,
): AdminCliRuntime[] {
  return enabled.includes(kind)
    ? enabled.filter((candidate) => candidate !== kind)
    : [...enabled, kind];
}

export function SystemPage() {
  const [settings, setSettings] = useState<AdminSystemSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getAdminSettings(controller.signal)
      .then(setSettings)
      .catch((reason) => {
        if (!controller.signal.aborted) setError(errorMessage(reason));
      });
    return () => controller.abort();
  }, []);

  const persist = async (next: AdminSystemSettings) => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const updated = await updateAdminSettings({
        registration: next.registration,
        dsBrowser: next.dsBrowser,
        agents: next.agents,
      });
      setSettings(updated);
      setSaved(true);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-full bg-background">
      <header className="flex min-h-12 items-center justify-between gap-4 border-b border-border bg-card px-5 py-2">
        <div>
          <h1 className="text-sm font-semibold">Administration</h1>
          <p className="text-xs text-muted-foreground">
            System-wide settings — apply to all users.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {saving ? (
            'Saving…'
          ) : saved ? (
            <>
              <Check className="size-3.5 text-success" /> Saved
            </>
          ) : null}
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-4xl gap-6 px-6 py-8">
        {error ? (
          <p
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {!settings ? (
          <div className="rounded-lg border border-border bg-card px-5 py-12 text-center text-sm text-muted-foreground">
            Loading system settings…
          </div>
        ) : (
          <>
            <SettingsSection
              title="Registration"
              description="Control whether new people can create accounts from the sign-in screen."
            >
              <div className="flex w-fit rounded-md border border-border bg-muted/20 p-1">
                {(['open', 'closed'] as const).map((mode) => (
                  <Button
                    key={mode}
                    type="button"
                    size="sm"
                    variant={settings.registration === mode ? 'secondary' : 'ghost'}
                    aria-pressed={settings.registration === mode}
                    disabled={saving}
                    onClick={() => void persist({ ...settings, registration: mode })}
                    className="min-w-24 capitalize"
                  >
                    {mode}
                  </Button>
                ))}
              </div>
            </SettingsSection>

            <SettingsSection
              title="Design System Browser"
              description="Set the initial DS Browser visibility for users without a personal browser override."
            >
              <Button
                type="button"
                variant="outline"
                aria-pressed={settings.dsBrowser.defaultEnabled}
                disabled={saving}
                onClick={() =>
                  void persist({
                    ...settings,
                    dsBrowser: { defaultEnabled: !settings.dsBrowser.defaultEnabled },
                  })
                }
                className="w-fit"
              >
                <MonitorCog />
                {settings.dsBrowser.defaultEnabled ? 'Enabled by default' : 'Disabled by default'}
              </Button>
              <p className="text-xs text-muted-foreground">
                A user’s toggle in Settings → General remains stronger than this default.
              </p>
            </SettingsSection>

            <SettingsSection
              title="Available CLI agents"
              description="Disabled runtimes disappear from model pickers and cannot start new runs."
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {CLI_RUNTIMES.map((runtime) => {
                  const enabled = settings.agents.enabledCliRuntimes.includes(runtime.kind);
                  const Icon = runtime.icon;
                  return (
                    <Button
                      key={runtime.kind}
                      type="button"
                      variant={enabled ? 'secondary' : 'outline'}
                      aria-pressed={enabled}
                      disabled={saving}
                      onClick={() =>
                        void persist({
                          ...settings,
                          agents: {
                            enabledCliRuntimes: toggleCliRuntime(
                              settings.agents.enabledCliRuntimes,
                              runtime.kind,
                            ),
                          },
                        })
                      }
                      className={cn(
                        'grid h-auto min-h-32 whitespace-normal rounded-lg p-4 text-left',
                        enabled
                          ? 'border border-primary/50 bg-primary/5 hover:bg-primary/10'
                          : 'bg-card hover:bg-muted/35',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <Icon className="size-5 text-primary" />
                        <Badge variant={enabled ? 'default' : 'outline'}>
                          {enabled ? 'Available' : 'Disabled'}
                        </Badge>
                      </div>
                      <div>
                        <div className="text-sm font-medium">{runtime.label}</div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {runtime.description}
                        </p>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </SettingsSection>
          </>
        )}
      </div>
    </main>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-5 rounded-lg border border-border bg-card p-5">
      <header className="grid gap-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>
      {children}
    </section>
  );
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
