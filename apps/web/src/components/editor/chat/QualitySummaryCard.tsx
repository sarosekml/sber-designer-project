import { CheckCircle2, CircleAlert, Wrench } from 'lucide-react';
import type { RunQualitySummary } from '@sber-designer/shared-types';

export function QualitySummaryCard({ summary }: { summary: RunQualitySummary }) {
  const findings = summary.remainingFindings;
  const repaired = summary.repair.attempted
    ? summary.repair.succeeded
      ? 'Automatic repair succeeded'
      : 'Automatic repair attempted'
    : 'No automatic repair needed';
  const jury =
    summary.jury.status === 'not_run'
      ? 'Jury not run'
      : `Jury ${summary.jury.status.replace('_', ' ')}${summary.jury.revisionAttempted ? ' after revision' : ''}`;
  const fidelity = summary.redesignFidelity ? ` · redesign ${summary.redesignFidelity.status}` : '';
  const Icon =
    summary.terminalStatus === 'complete' && findings.blocking === 0 ? CheckCircle2 : CircleAlert;

  return (
    <div
      className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground"
      data-testid="run-quality-summary"
    >
      <div className="flex items-center gap-1.5 font-medium text-foreground">
        <Icon className="size-3.5" /> Final quality summary
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <Wrench className="size-3" /> {repaired}
      </div>
      <p className="mt-1">
        Remaining: {findings.blocking} blocking · {findings.shouldFix} should-fix ·{' '}
        {findings.advisory} advisory
      </p>
      <p className="mt-1">
        Craft {summary.craft.status} · Design mode {summary.designMode.status} · Render{' '}
        {summary.render.status}
        {fidelity} · {jury}
      </p>
      <p className="mt-1">
        {summary.skippedChecks.length > 0
          ? `Skipped: ${summary.skippedChecks.join(', ')}`
          : 'Skipped checks: none'}
      </p>
    </div>
  );
}
