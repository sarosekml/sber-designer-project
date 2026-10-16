import type { ComponentPackRunSummary } from '@sber-designer/shared-types';

import { formatComponentPackStatus } from '@/lib/chat-transcript';
import { cn } from '@/lib/utils';

export function ComponentPackStatusCard({ summary }: { summary: ComponentPackRunSummary }) {
  const warning = summary.status !== 'ready' || summary.workspaceFreshness === 'stale';
  const selections = summary.selections ?? [];
  const gaps = summary.gaps ?? [];
  const lateSelections = summary.lateSelections ?? [];
  return (
    <div
      className={cn(
        'min-w-0 rounded-md border bg-card px-3 py-2 text-xs text-foreground',
        warning ? 'border-warning/40' : 'border-border',
      )}
    >
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Project design system
      </div>
      <p className="mt-1 font-medium">{formatComponentPackStatus(summary)}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Component context: {summary.status} · Workspace index:{' '}
        {summary.workspaceFreshness ?? 'unknown'}
        {summary.diagnosticCount > 0 ? ` · ${summary.diagnosticCount} diagnostics` : ''}
      </p>
      {(selections.length > 0 || gaps.length > 0 || lateSelections.length > 0) && (
        <details className="mt-2 rounded border border-border/60 bg-muted/20">
          <summary className="cursor-pointer px-2 py-1.5 text-[11px] font-medium">
            Selection &amp; hydration details
          </summary>
          <div className="space-y-2 border-t border-border/60 px-2 py-2">
            {selections.map((selection) => (
              <div key={`${selection.role}:${selection.componentId}`} className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{selection.componentName}</span>
                  <code className="text-[10px] text-muted-foreground">{selection.role}</code>
                  {selection.required && (
                    <span className="rounded bg-primary/10 px-1 text-[9px] text-primary">
                      required
                    </span>
                  )}
                  <span
                    className={cn(
                      'rounded px-1 text-[9px]',
                      selection.hydrated
                        ? 'bg-success/10 text-success'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {selection.hydrated ? 'hydrated' : 'not hydrated'}
                  </span>
                </div>
                <p className="text-muted-foreground">{selection.reason}</p>
                <p className="text-[10px] text-muted-foreground">
                  Regions: {selection.regionIds.join(', ') || 'unassigned'}
                  {selection.variants.length > 0
                    ? ` · Variants: ${selection.variants.join(', ')}`
                    : ''}
                  {selection.resolutionStatus ? ` · Resolution: ${selection.resolutionStatus}` : ''}
                </p>
              </div>
            ))}
            {gaps.map((gap) => (
              <div key={`gap:${gap.role}`} className="rounded bg-warning/10 px-2 py-1">
                <span className="font-medium">Gap · {gap.role}</span>
                <p className="text-muted-foreground">{gap.reason}</p>
                <p className="text-[10px] text-muted-foreground">
                  Regions: {gap.regionIds.join(', ') || 'unassigned'}
                </p>
              </div>
            ))}
            {lateSelections.length > 0 && (
              <div className="space-y-1 border-t border-border/60 pt-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Late additions
                </p>
                {lateSelections.map((change) => (
                  <div key={change.sequence}>
                    <span className="font-medium">
                      {change.action} · {change.role} → {change.componentId}
                    </span>
                    <p className="text-muted-foreground">{change.reason}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Regions: {change.regionIds.join(', ') || 'unassigned'} · Resolution:{' '}
                      {change.resolutionStatus}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
