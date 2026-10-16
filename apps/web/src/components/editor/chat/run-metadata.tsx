/** External-runtime run metadata: context rows, metric formatters. */
import { AlertTriangle } from 'lucide-react';
import {
  normalizeAssistantTokenUsage,
  type AssistantRunMetrics,
  type AssistantTokenUsage,
} from '@sber-designer/shared-types';
import { type ChatMessage } from '@/stores/chat-store';

interface ExternalRuntimeContextMetadata {
  runtime: string;
  agent: string;
  skillInventoryCount: number;
  contextBundlePath?: string;
  omittedSections: { section: string; reason: string }[];
  runtimeWarnings: string[];
  stableContextDigest?: string;
  stableContextBytes?: number;
  stableContextReuse?: 'full' | 'reference';
  previousStableContextBundlePath?: string;
}

export function externalRuntimeContextFor(
  message: ChatMessage,
): ExternalRuntimeContextMetadata | null {
  const value = message.metadata?.externalRuntimeContext;
  if (!value || typeof value !== 'object') return null;
  const event = value as {
    runtime?: unknown;
    agent?: unknown;
    skillInventoryCount?: unknown;
    contextBundlePath?: unknown;
    omittedSections?: unknown;
    runtimeWarnings?: unknown;
    stableContextDigest?: unknown;
    stableContextBytes?: unknown;
    stableContextReuse?: unknown;
    previousStableContextBundlePath?: unknown;
  };
  if (
    typeof event.runtime !== 'string' ||
    typeof event.agent !== 'string' ||
    typeof event.skillInventoryCount !== 'number'
  ) {
    return null;
  }
  return {
    runtime: event.runtime,
    agent: event.agent,
    skillInventoryCount: event.skillInventoryCount,
    ...(typeof event.contextBundlePath === 'string'
      ? { contextBundlePath: event.contextBundlePath }
      : {}),
    ...(typeof event.stableContextDigest === 'string'
      ? { stableContextDigest: event.stableContextDigest }
      : {}),
    ...(typeof event.stableContextBytes === 'number'
      ? { stableContextBytes: event.stableContextBytes }
      : {}),
    ...(event.stableContextReuse === 'full' || event.stableContextReuse === 'reference'
      ? { stableContextReuse: event.stableContextReuse }
      : {}),
    ...(typeof event.previousStableContextBundlePath === 'string'
      ? { previousStableContextBundlePath: event.previousStableContextBundlePath }
      : {}),
    omittedSections: Array.isArray(event.omittedSections)
      ? event.omittedSections.filter(
          (item): item is { section: string; reason: string } =>
            Boolean(item) &&
            typeof item === 'object' &&
            typeof (item as { section?: unknown }).section === 'string' &&
            typeof (item as { reason?: unknown }).reason === 'string',
        )
      : [],
    runtimeWarnings: Array.isArray(event.runtimeWarnings)
      ? event.runtimeWarnings.filter((warning): warning is string => typeof warning === 'string')
      : [],
  };
}

export function ExternalRuntimeContextRow({
  event,
  content,
}: {
  event: ExternalRuntimeContextMetadata;
  content: string;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <div className="font-medium text-foreground">{content}</div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        <span>Skills listed: {event.skillInventoryCount}</span>
        {event.stableContextReuse && <span>Stable context: {event.stableContextReuse}</span>}
        {event.stableContextDigest && <span>{shortDigest(event.stableContextDigest)}</span>}
        {event.omittedSections.length > 0 && (
          <span>Omitted sections: {event.omittedSections.length}</span>
        )}
      </div>
      {event.contextBundlePath && (
        <div className="mt-1 break-all font-mono text-[11px]">{event.contextBundlePath}</div>
      )}
      {event.previousStableContextBundlePath && (
        <div className="mt-1 break-all font-mono text-[11px]">
          previous: {event.previousStableContextBundlePath}
        </div>
      )}
      {event.runtimeWarnings.length > 0 && (
        <div className="mt-2 grid gap-1 text-warning">
          {event.runtimeWarnings.map((warning) => (
            <div key={warning} className="flex gap-1.5">
              <AlertTriangle className="mt-0.5 size-3 shrink-0" />
              <span className="min-w-0 break-words">{warning}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function shortDigest(value: string): string {
  const normalized = value.replace(/^sha256:/u, '');
  return normalized.length > 12 ? `sha256:${normalized.slice(0, 12)}` : value;
}

export function formatRunMetrics(metrics: AssistantRunMetrics | null): string | null {
  return formatTokenUsage(metrics);
}

export function formatTokenUsage(usage: AssistantTokenUsage | null | undefined): string | null {
  if (!usage) return null;
  const normalized = normalizeAssistantTokenUsage(usage) ?? {};
  return [
    `Total ${formatTokenCount(normalized.totalTokens)}`,
    `Input ${formatTokenCount(normalized.inputTokens)}`,
    `Output ${formatTokenCount(normalized.outputTokens)}`,
  ].join(' · ');
}

export function TokenUsageFooter({ usage }: { usage: AssistantTokenUsage | null | undefined }) {
  const text = formatTokenUsage(usage);
  if (!text) return null;
  return (
    <div
      className="mt-2 border-t border-border/60 pt-1.5 font-mono text-[10px] text-muted-foreground"
      data-testid="assistant-token-usage"
    >
      {text}
    </div>
  );
}

function formatTokenCount(value: number | undefined): string {
  return value === undefined ? '—' : value.toLocaleString();
}

export function extractAgentRunId(path: string | null): string | null {
  if (!path) return null;
  return path.match(/(?:^|\/)(run-[A-Za-z0-9._-]+)(?:\/|$)/u)?.[1] ?? null;
}
