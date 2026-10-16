import { CheckCircle2, FileText, GitCompare, Loader2, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { HtmlDesignSystemProposal } from '@/lib/api/project-index';

export interface DesignSystemProposalCardProps {
  proposals: HtmlDesignSystemProposal[];
  loading: boolean;
  error: string | null;
  busyProposalId?: string | null | undefined;
  onAccept: (proposal: HtmlDesignSystemProposal) => void;
  onReject: (proposal: HtmlDesignSystemProposal) => void;
}

export interface DesignSystemProposalCardModel {
  visible: boolean;
  title: string;
  primaryProposal: HtmlDesignSystemProposal | null;
  acceptDisabled: boolean;
  rejectDisabled: boolean;
  fileLabels: string[];
  message: string;
}

export function DesignSystemProposalCard({
  proposals,
  loading,
  error,
  busyProposalId,
  onAccept,
  onReject,
}: DesignSystemProposalCardProps) {
  const model = buildDesignSystemProposalCardModel({
    proposals,
    loading,
    error,
    busyProposalId,
  });
  if (!model.visible) return null;
  const proposal = model.primaryProposal;
  const busy = Boolean(proposal && busyProposalId === proposal.id);

  return (
    <section className="mb-2 rounded-md border border-border bg-card px-2.5 py-2.5 text-xs">
      <div className="mb-1.5 flex min-w-0 items-center gap-2 font-medium text-foreground">
        <GitCompare className="size-3.5 text-primary" />
        <span className="min-w-0 flex-1 truncate">{model.title}</span>
      </div>
      <p className="leading-relaxed text-muted-foreground">{model.message}</p>

      {proposal && (
        <>
          <div className="mt-2 flex min-w-0 items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
            <FileText className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate font-medium text-foreground">
              {proposal.filePath}
            </span>
            {proposal.ready && <CheckCircle2 className="size-3.5 shrink-0 text-success" />}
          </div>
          {proposal.styleContract?.required ? (
            <div className="mt-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-[10px] text-muted-foreground">
              <span className="font-medium text-foreground">Style contract: </span>
              {proposal.styleContract.presentSections}/{proposal.styleContract.totalSections}{' '}
              sections
              {proposal.styleContract.complete ? ' · ready' : ' · needs revision'}
              {!proposal.styleContract.complete && proposal.styleContract.diagnostics[0] ? (
                <p className="mt-1 leading-relaxed text-warning">
                  {proposal.styleContract.diagnostics[0]}
                </p>
              ) : null}
            </div>
          ) : null}
          <details className="mt-2 rounded-md border border-border bg-background px-2 py-1.5">
            <summary className="cursor-pointer text-[11px] font-medium text-foreground">
              Review files
            </summary>
            <div className="mt-2 grid gap-1.5">
              {proposal.files
                .filter((file) => file.exists)
                .map((file) => (
                  <div key={file.path} className="min-w-0">
                    <div className="mb-1 flex items-center justify-between gap-2 text-[10px]">
                      <span className="font-medium text-foreground">{file.label}</span>
                      <span className="truncate text-muted-foreground">{file.path}</span>
                    </div>
                    {file.excerpt && (
                      <pre className="max-h-24 overflow-auto whitespace-pre-wrap rounded border border-border bg-muted/45 p-1.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
                        {file.excerpt}
                      </pre>
                    )}
                  </div>
                ))}
              {proposal.reportExcerpt && (
                <pre className="max-h-24 overflow-auto whitespace-pre-wrap rounded border border-border bg-muted/45 p-1.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
                  {proposal.reportExcerpt}
                </pre>
              )}
            </div>
          </details>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Button
              size="sm"
              className="h-7 px-2"
              disabled={model.acceptDisabled}
              onClick={() => onAccept(proposal)}
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3.5" />
              )}
              Accept
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              disabled={model.rejectDisabled}
              onClick={() => onReject(proposal)}
            >
              <Trash2 className="size-3.5" />
              Reject
            </Button>
          </div>
        </>
      )}
      {error && <p className="mt-2 break-words text-[10px] text-destructive">{error}</p>}
    </section>
  );
}

export function buildDesignSystemProposalCardModel(input: {
  proposals: HtmlDesignSystemProposal[];
  loading: boolean;
  error: string | null;
  busyProposalId?: string | null | undefined;
}): DesignSystemProposalCardModel {
  const primaryProposal = input.proposals[0] ?? null;
  const busy = Boolean(input.busyProposalId);
  return {
    visible: Boolean(primaryProposal || input.loading || input.error),
    title:
      primaryProposal?.styleContract?.required && !primaryProposal.styleContract.complete
        ? 'Style contract proposal needs revision'
        : 'Design system proposal ready',
    primaryProposal,
    acceptDisabled: input.loading || busy || !primaryProposal?.ready,
    rejectDisabled: input.loading || busy || !primaryProposal,
    fileLabels:
      primaryProposal?.files.filter((file) => file.exists).map((file) => file.label) ?? [],
    message: input.loading
      ? 'Checking project proposal files.'
      : primaryProposal
        ? primaryProposal.styleContract?.required && !primaryProposal.styleContract.complete
          ? 'Review the draft and complete all nine style-contract sections before accepting it.'
          : 'Review the project files, then accept them as the active project design system or reject the draft.'
        : 'Proposal state could not be loaded.',
  };
}
