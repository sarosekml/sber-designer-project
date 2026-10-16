import { useState } from 'react';
import { AlertCircle, Check, Clipboard, Clock3, FileText, Image, Loader2 } from 'lucide-react';
import type {
  DatedValue,
  ScreenGenerationInfo,
  ScreenGenerationRunEntry,
} from '@sber-designer/shared-types';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useScreenGenerationInfo } from '@/hooks/useScreenGenerationInfo';
import {
  datedValueLabel,
  formatBytes,
  formatCost,
  formatDate,
  formatRelativeDate,
  formatTokenCount,
  resolveWorkspacePath,
} from '@/lib/screen-info-format';
import { statusChipClasses } from '@/lib/status-chip';
import { cn } from '@/lib/utils';

interface ScreenInfoSheetProps {
  screenId: string;
  workspacePath: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScreenInfoSheet({
  screenId,
  workspacePath,
  open,
  onOpenChange,
}: ScreenInfoSheetProps) {
  const query = useScreenGenerationInfo(screenId, open);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[520px]">
        <SheetHeader className="border-b border-border px-5 py-4 pr-12">
          <SheetTitle>Screen info</SheetTitle>
          <SheetDescription>Generation history and persisted run evidence.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {query.isPending ? (
            <ScreenInfoLoading />
          ) : query.isError ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-6 text-center">
              <AlertCircle className="size-5 text-destructive" />
              <div>
                <p className="text-sm font-medium text-foreground">Could not load screen info</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {query.error instanceof Error ? query.error.message : 'Unknown error'}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
                Try again
              </Button>
            </div>
          ) : query.data ? (
            <ScreenInfoContent data={query.data} workspacePath={workspacePath} />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ScreenInfoContent({
  data,
  workspacePath,
}: {
  data: ScreenGenerationInfo;
  workspacePath: string | null;
}) {
  return (
    <div className="space-y-5 p-5">
      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">{data.screen.name}</h3>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{data.screen.id}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/20 p-3 text-xs">
          <DateField label="Created" value={data.screen.createdAt} />
          <DateField label="Last edited" value={data.screen.updatedAt} />
          <MetadataField label="Type" value={data.screen.kind} />
          <MetadataField label="Folder" value={data.screen.folder ?? 'Root'} />
        </div>
        {(data.screen.implementationFilePath ?? data.screen.filePath) && (
          <PathRow
            label="Source"
            path={data.screen.implementationFilePath ?? data.screen.filePath!}
            workspacePath={workspacePath}
          />
        )}
      </section>

      <Separator />

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Generation usage
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <Metric label="Runs" value={String(data.totals.runs)} />
          <Metric label="Tokens" value={formatTokenCount(data.totals.totalTokens)} />
          <Metric label="Cost" value={formatCost(data.totals.costUsd)} />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Input {formatTokenCount(data.totals.inputTokens)} · Output{' '}
          {formatTokenCount(data.totals.outputTokens)}
        </p>
        {data.totals.runsWithoutTokenData > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {data.totals.runsWithoutTokenData === data.totals.runs
              ? 'Token usage was not recorded for these runs.'
              : `${data.totals.runsWithoutTokenData} run${
                  data.totals.runsWithoutTokenData === 1 ? '' : 's'
                } without token data.`}
          </p>
        )}
        {data.activeRun && (
          <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <Loader2 className="mt-0.5 size-4 animate-spin text-primary" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground">Generation in progress</p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {data.activeRun.model} · {data.activeRun.provider} · {data.activeRun.sessionMode}
              </p>
            </div>
          </div>
        )}
      </section>

      <Separator />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Runs
          </h3>
          <span className="text-[11px] text-muted-foreground">Newest first</span>
        </div>
        {data.runs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
            <Clock3 className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium text-foreground">No generation runs yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Runs attributed to this screen will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.runs.map((run) => (
              <RunCard key={run.runId} run={run} workspacePath={workspacePath} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RunCard({
  run,
  workspacePath,
}: {
  run: ScreenGenerationRunEntry;
  workspacePath: string | null;
}) {
  return (
    <article className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">{formatDate(run.startedAt)}</p>
          <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{run.runId}</p>
        </div>
        <Badge variant="outline" className={statusClass(run.status)}>
          {run.status.replace('_', ' ')}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary">{run.sessionMode}</Badge>
        <Badge variant="outline">{run.route}</Badge>
        {run.runtimeKind && <Badge variant="outline">{run.runtimeKind}</Badge>}
        <Badge variant="outline">{run.attribution}</Badge>
      </div>

      <div className="text-xs">
        <p className="font-medium text-foreground">
          {run.model ?? 'Unknown model'} · {run.provider ?? 'Unknown provider'}
        </p>
        <p className="mt-1 text-muted-foreground">
          Input {formatTokenCount(run.inputTokens)} · Output {formatTokenCount(run.outputTokens)} ·
          Total {formatTokenCount(run.totalTokens)}
          {run.costUsd !== undefined ? ` · ${formatCost(run.costUsd)}` : ''}
        </p>
      </div>

      {run.attachments.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">Attachments</p>
          {run.attachments.map((attachment) => (
            <div
              key={`${attachment.sha256}-${attachment.name}`}
              className="flex items-center gap-2 text-xs"
            >
              {attachment.kind === 'image' ? (
                <Image className="size-3.5 text-muted-foreground" />
              ) : (
                <FileText className="size-3.5 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1 truncate text-foreground">{attachment.name}</span>
              <span
                className="shrink-0 text-[10px] text-muted-foreground"
                title={`${attachment.mimeType} · sha256 ${attachment.sha256.slice(0, 12)}`}
              >
                {attachment.mimeType} · {formatBytes(attachment.size)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5 border-t border-border pt-2">
        <PathRow label="Run logs" path={run.logs.runDir} workspacePath={workspacePath} compact />
        {run.logs.attemptLog && (
          <PathRow
            label="Attempt log"
            path={run.logs.attemptLog}
            workspacePath={workspacePath}
            compact
          />
        )}
        {run.logs.debugLog && (
          <PathRow
            label="Debug log"
            path={run.logs.debugLog}
            workspacePath={workspacePath}
            compact
          />
        )}
        {!run.logs.available && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-warning/40 bg-warning/10">
              pruned
            </Badge>
            <p className="text-[11px] text-warning-foreground">
              Logs were pruned; metadata remains available.
            </p>
          </div>
        )}
      </div>
    </article>
  );
}

function DateField({ label, value }: { label: string; value: DatedValue | null }) {
  const content = (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-0.5 flex items-center gap-1.5">
        <p className="text-foreground">{datedValueLabel(value)}</p>
        {value?.source === 'estimated' && (
          <Badge variant="outline" className="px-1 py-0 text-[9px] text-muted-foreground">
            estimated
          </Badge>
        )}
      </div>
    </div>
  );
  if (!value) return content;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent>
        {formatRelativeDate(value.value)} ·{' '}
        {value.source === 'estimated'
          ? 'Estimated from run history or file timestamps.'
          : 'Recorded in project metadata.'}
      </TooltipContent>
    </Tooltip>
  );
}

function MetadataField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate capitalize text-foreground">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function PathRow({
  label,
  path,
  workspacePath,
  compact = false,
}: {
  label: string;
  path: string;
  workspacePath: string | null;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const absolutePath = resolveWorkspacePath(workspacePath, path);
  const handleCopy = async () => {
    if (typeof navigator === 'undefined') return;
    await navigator.clipboard?.writeText(absolutePath).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  };
  return (
    <div className={cn('flex min-w-0 items-center gap-2', !compact && 'rounded-lg border p-2')}>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate font-mono text-[10px] text-foreground" title={absolutePath}>
          {path}
        </p>
      </div>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="size-7"
        title={`Copy ${label.toLowerCase()} path`}
        aria-label={`Copy ${label.toLowerCase()} path`}
        onClick={() => void handleCopy()}
      >
        {copied ? <Check /> : <Clipboard />}
      </Button>
    </div>
  );
}

function statusClass(status: ScreenGenerationRunEntry['status']): string {
  if (status === 'complete') return statusChipClasses.success;
  if (status === 'failed') return statusChipClasses.destructive;
  if (status === 'needs_review') return statusChipClasses.warning;
  return statusChipClasses.neutral;
}

function ScreenInfoLoading() {
  return (
    <div className="space-y-5 p-5" aria-label="Loading screen info">
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
      <Skeleton className="h-28 w-full" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
