import { ArrowRight, CheckCircle2, Gauge, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const HARNESS_ROLLOUT_STATUS = {
  episode: '0114 · Final live closure',
  coreMatrix: 'Live verified',
  coreEvidence: 'T5/T6 · T8 · T14–T17',
  runtimeMcp: '3 / 3 verified',
  mcpEvidence: 'Claude · Codex · OpenCode',
  regressionGate: '1839 green',
  regressionEvidence: '0 fail · 1 intentional skip',
  providerEval: 'Direct DeepSeek verified',
  evalEvidence: '2 / 2 profiles · baseline active',
} as const;

const STATUS_ITEMS = [
  {
    label: 'Core live matrix',
    value: HARNESS_ROLLOUT_STATUS.coreMatrix,
    detail: HARNESS_ROLLOUT_STATUS.coreEvidence,
    icon: CheckCircle2,
  },
  {
    label: 'CLI project MCP',
    value: HARNESS_ROLLOUT_STATUS.runtimeMcp,
    detail: HARNESS_ROLLOUT_STATUS.mcpEvidence,
    icon: CheckCircle2,
  },
  {
    label: 'Regression suite',
    value: HARNESS_ROLLOUT_STATUS.regressionGate,
    detail: HARNESS_ROLLOUT_STATUS.regressionEvidence,
    icon: Gauge,
  },
  {
    label: 'Paid-provider eval',
    value: HARNESS_ROLLOUT_STATUS.providerEval,
    detail: HARNESS_ROLLOUT_STATUS.evalEvidence,
    icon: CheckCircle2,
  },
] as const;

export function HarnessStatusPanel() {
  return (
    <section
      aria-labelledby="agent-quality-rollout-title"
      className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
    >
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="agent-quality-rollout-title" className="text-sm font-semibold">
                  Agent quality rollout
                </h2>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {HARNESS_ROLLOUT_STATUS.episode}
                </Badge>
              </div>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                The 0114 harness is live-verified across React/Storybook and HTML/CSS generation,
                Design Jury, style-contract acceptance, project style memory, run feedback, and the
                active eval release gate. The final API matrix used direct DeepSeek.
              </p>
            </div>
          </div>

          <a
            href="/how-it-works/agent-quality-harness#0114-core-closure-live-acceptance"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'shrink-0')}
            aria-label="Read agent quality harness documentation"
          >
            Read details
            <ArrowRight aria-hidden="true" />
          </a>
        </div>

        <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {STATUS_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="min-w-0 bg-background px-3 py-3">
                <dt className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                  <Icon className="size-3.5 text-primary" aria-hidden="true" />
                  {item.label}
                </dt>
                <dd className="mt-1">
                  <span className="block text-sm font-semibold">{item.value}</span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                    {item.detail}
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}
