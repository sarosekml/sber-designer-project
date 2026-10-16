/** Indexing status blocks: design index, project system, design context. */
import { Boxes, CheckCircle2, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  fetchProjectDesignIndexJob,
  type ProjectDesignContext,
  type ProjectDesignIndexContext,
  type ProjectSystemOverview,
  type ProjectIndexJob,
} from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Badge } from './shared';

export async function pollDesignIndexJob(
  id: string,
  onUpdate: (job: ProjectIndexJob) => void,
): Promise<ProjectIndexJob> {
  for (let attempt = 0; attempt < 120; attempt++) {
    const { job } = await fetchProjectDesignIndexJob(id);
    onUpdate(job);
    if (job.status === 'complete' || job.status === 'failed') return job;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Timed out waiting for project index job.');
}

export function DesignIndexStatus({
  context,
  job,
  loading,
  error,
  message,
  action,
  onRefresh,
  onGenerate,
}: {
  context: ProjectDesignIndexContext | null;
  job: ProjectIndexJob | null;
  loading: boolean;
  error: string | null;
  message: string | null;
  action: 'generate' | null;
  onRefresh: () => void;
  onGenerate: () => void;
}) {
  const status = context?.status ?? 'missing';
  const tone = status === 'valid' ? 'ok' : status === 'error' ? 'danger' : 'warn';
  const generatedAt = context?.manifest?.generatedAt
    ? new Date(context.manifest.generatedAt).toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'not generated yet';
  const artifacts = context?.artifacts ?? [];
  const diagnostics = context?.diagnostics ?? [];
  const jobIsRunning = job?.status === 'queued' || job?.status === 'running';
  const latestProgress = job?.progress.at(-1);

  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Boxes className="size-4 text-primary" />
            Project design-system index
          </div>
          <p className="text-xs text-muted-foreground">
            Generates <code>DESIGN.md</code> and committed agent index files in{' '}
            <code>.sber-designer/design-index/</code>.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading || Boolean(action) || jobIsRunning}
          >
            {loading ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCw className="size-3" />
            )}
            Refresh
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onGenerate}
            disabled={loading || Boolean(action) || jobIsRunning}
          >
            {action === 'generate' || jobIsRunning ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Sparkles className="size-3" />
            )}
            {status === 'missing' ? 'Index project' : 'Re-index project'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
          {message}
        </div>
      )}
      {job && (
        <div className="grid gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-muted-foreground">
            <span>Index job</span>
            <Badge
              tone={job.status === 'failed' ? 'danger' : job.status === 'complete' ? 'ok' : 'warn'}
            >
              {job.stage}
            </Badge>
            <span>{job.changedFiles.length} changed files</span>
          </div>
          {latestProgress && (
            <div className="min-w-0 break-words text-muted-foreground">
              {latestProgress.message}
            </div>
          )}
        </div>
      )}

      {context?.projectSystem && <ProjectSystemOverviewPanel overview={context.projectSystem} />}

      <div className="grid gap-3 rounded-md border border-border bg-background p-3 text-xs">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-muted-foreground">
          <span>Index status</span>
          <Badge tone={tone}>{status}</Badge>
          <span>{context?.trackedFiles ?? 0} tracked files</span>
          <span>generated {generatedAt}</span>
        </div>
        {context?.manifest && (
          <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="Components" value={context.manifest.counts.components} />
            <Metric label="Tokens" value={context.manifest.counts.tokens} />
            <Metric label="Icons" value={context.manifest.counts.icons} />
            <Metric label="Assets" value={context.manifest.counts.assets ?? 0} />
            <Metric label="Illustrations" value={context.manifest.counts.illustrations ?? 0} />
          </div>
        )}
        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          {artifacts.map((artifact) => (
            <ArtifactStatus
              key={artifact.filePath}
              label={artifact.filePath}
              exists={artifact.exists}
            />
          ))}
        </div>
        {diagnostics.length > 0 && (
          <div className="grid min-w-0 gap-1 rounded-md border border-border bg-card px-3 py-2">
            {diagnostics.slice(0, 5).map((item) => (
              <div
                key={`${item.filePath}:${item.message}`}
                className="min-w-0 break-words text-muted-foreground"
              >
                <span
                  className={cn(
                    'font-medium',
                    item.level === 'error' ? 'text-destructive-foreground' : 'text-warning',
                  )}
                >
                  {item.level}
                </span>{' '}
                · {item.filePath} · {item.message}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectSystemOverviewPanel({ overview }: { overview: ProjectSystemOverview }) {
  const freshnessTone =
    overview.freshness === 'ready' ? 'ok' : overview.freshness === 'error' ? 'danger' : 'warn';
  const nextActionLabel =
    overview.nextAction === 'index-project'
      ? 'Index project'
      : overview.nextAction === 'reindex-project'
        ? 'Re-index project'
        : overview.nextAction === 'review-diagnostics'
          ? 'Review diagnostics'
          : 'Ready';

  return (
    <div className="grid min-w-0 gap-3 rounded-md border border-border bg-background p-3 text-xs">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="mr-auto min-w-0">
          <div className="font-medium text-foreground">Project System</div>
          <p className="mt-1 max-w-3xl text-muted-foreground">{overview.summary}</p>
        </div>
        <Badge tone={freshnessTone}>{overview.freshness}</Badge>
        <span className="text-muted-foreground">{nextActionLabel}</span>
      </div>

      <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Metric
          label="Quality"
          value={Math.round((overview.quality?.score ?? 0) * 100)}
          suffix="%"
        />
        <Metric label="Components" value={overview.counts.components} />
        <Metric label="Tokens" value={overview.counts.tokens} />
        <Metric label="Assets" value={overview.counts.assets ?? 0} />
        <Metric label="Screens" value={overview.counts.screens ?? 0} />
      </div>

      {overview.quality && overview.quality.violations.length > 0 && (
        <div className="grid min-w-0 gap-1 rounded-md border border-border bg-card px-3 py-2">
          {overview.quality.violations.slice(0, 3).map((violation) => (
            <div
              key={violation.id}
              className="min-w-0 break-words text-muted-foreground"
              title={violation.recommendation}
            >
              <span
                className={cn(
                  'font-medium',
                  violation.severity === 'error' ? 'text-destructive-foreground' : 'text-warning',
                )}
              >
                {violation.severity}
              </span>{' '}
              · {violation.message}
            </div>
          ))}
        </div>
      )}

      <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {overview.contextItems.map((item) => (
          <div key={item.id} className="rounded-md border border-border bg-card px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 truncate font-medium text-foreground">{item.label}</span>
              <Badge tone={contextItemTone(item.status)}>{item.status}</Badge>
              <span className="ml-auto text-muted-foreground">
                {(item.count ?? 0).toLocaleString()}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-muted-foreground">{item.description}</p>
            <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
              {item.artifactPath}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function contextItemTone(status: ProjectSystemOverview['contextItems'][number]['status']) {
  if (status === 'ready') return 'ok';
  if (status === 'warning' || status === 'missing') return 'warn';
  return 'muted';
}

function Metric({
  label,
  value,
  suffix = '',
}: {
  label: string;
  value: number | null | undefined;
  suffix?: string;
}) {
  const safeValue = value ?? 0;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">
        {safeValue.toLocaleString()}
        {suffix}
      </div>
    </div>
  );
}

export function DesignContextStatus({
  context,
  loading,
}: {
  context: ProjectDesignContext | null;
  loading: boolean;
}) {
  if (!context && loading) {
    return (
      <div className="rounded-md border border-border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
        Loading design context...
      </div>
    );
  }
  if (!context) return null;

  const diagnostics = context.diagnostics.filter((item) => item.level !== 'info');
  const validationTone =
    context.validation.status === 'valid'
      ? 'ok'
      : context.validation.status === 'error'
        ? 'danger'
        : 'warn';
  const checkedAt = context.validation.checkedAt
    ? new Date(context.validation.checkedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'not validated yet';
  return (
    <div className="grid min-w-0 gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
        <span>Local validator</span>
        <Badge tone={validationTone}>{context.validation.status}</Badge>
        <span>design.md {context.validation.designMdSpecVersion}</span>
        <span>{context.validation.trackedFiles} tracked files</span>
        <span>checked {checkedAt}</span>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-2">
        <ArtifactStatus label="DESIGN.md" exists={context.design.exists} />
      </div>
      {diagnostics.length > 0 && (
        <div className="grid min-w-0 gap-1 rounded-md border border-border bg-background px-3 py-2 text-xs">
          {diagnostics.slice(0, 4).map((item) => (
            <div
              key={`${item.filePath}:${item.message}`}
              className="min-w-0 break-words text-muted-foreground"
            >
              <span className="font-medium text-warning">{item.level}</span> · {item.filePath} ·{' '}
              {item.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ArtifactStatus({ label, exists }: { label: string; exists: boolean }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs">
      <span className="truncate font-mono">{label}</span>
      <Badge tone={exists ? 'ok' : 'warn'}>{exists ? 'found' : 'missing'}</Badge>
    </div>
  );
}

export function ScreenTemplateBadge({
  status,
  loading,
}: {
  status: 'idle' | 'found' | 'missing' | 'error';
  loading: boolean;
}) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        checking
      </span>
    );
  }
  if (status === 'found') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-success">
        <CheckCircle2 className="size-3" />
        loaded
      </span>
    );
  }
  if (status === 'missing' || status === 'error') {
    return <Badge tone="warn">missing</Badge>;
  }
  return <Badge tone="warn">not set</Badge>;
}
