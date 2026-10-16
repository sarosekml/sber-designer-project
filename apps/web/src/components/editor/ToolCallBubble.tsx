import { useState } from 'react';
import { ChevronDown, ChevronRight, Wrench } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/stores/chat-store';
import { TokenUsageFooter } from './chat/run-metadata';

/**
 * Renders an assistant message that asked for tools, optionally with the
 * collapsed list of calls. Pure presentation — pairing with results is
 * done in <Transcript /> via toolCallId lookup.
 *
 * Layout idea borrowed from assistant-ui/tool-ui (MIT, see THIRD_PARTY_NOTICES);
 * we re-implement it here using shadcn primitives instead of pulling the
 * dependency until we need more of its surface.
 */

interface ToolCallSummary {
  id: string;
  name: string;
  /** Pretty-printed arguments JSON; null if parse fails. */
  prettyArgs: string | null;
  /** Result message linked by toolCallId, if we have one. */
  result?: ChatMessage | undefined;
}

export function AssistantWithTools({
  message,
  results,
}: {
  message: ChatMessage;
  results: Map<string, ChatMessage>;
}) {
  const calls: ToolCallSummary[] =
    message.toolCalls?.map((tc) => ({
      id: tc.id,
      name: tc.name,
      prettyArgs: tryPrettyJson(tc.arguments),
      result: results.get(tc.id),
    })) ?? [];

  return (
    <div className="min-w-0 rounded-md border border-border bg-card px-3 py-2 text-sm">
      <Header label={message.meta?.model ?? 'assistant'} />
      {message.content && <div className="whitespace-pre-wrap break-words">{message.content}</div>}
      {calls.length > 0 && (
        <ul className="mt-2 grid gap-1.5">
          {calls.map((c) => (
            <ToolCallRow key={c.id} call={c} />
          ))}
        </ul>
      )}
      <TokenUsageFooter usage={message.tokenUsage} />
    </div>
  );
}

function ToolCallRow({ call }: { call: ToolCallSummary }) {
  const [open, setOpen] = useState(false);
  const result = call.result;
  const summary = result ? summariseResult(result.content) : null;
  const isError = summary?.kind === 'error';
  const isCancelled = summary?.kind === 'cancelled';
  const timingSummary = result ? formatToolTiming(result.metadata) : null;

  return (
    <li className="min-w-0 rounded border border-border/60 bg-background/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full min-w-0 items-center gap-2 px-2 py-1.5 text-[11px]',
          isError && 'text-destructive-foreground',
          isCancelled && 'text-muted-foreground',
        )}
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        <Wrench className="size-3 text-primary" />
        <span className="min-w-0 shrink-0 font-mono">{call.name}</span>
        <span className="ml-auto truncate text-[10px] text-muted-foreground">
          {result
            ? [
                isError ? 'failed' : isCancelled ? 'cancelled' : (summary?.label ?? 'done'),
                timingSummary,
              ]
                .filter(Boolean)
                .join(' · ')
            : 'pending…'}
        </span>
      </button>
      {open && (
        <div className="grid gap-2 border-t border-border/60 px-2 py-1.5">
          <Field label="Arguments">
            <pre className="max-h-40 max-w-full overflow-auto whitespace-pre-wrap break-words rounded bg-background p-2 text-[10px] leading-snug">
              {call.prettyArgs ?? '(unparseable)'}
            </pre>
          </Field>
          {result && (
            <Field label="Result">
              {timingSummary && (
                <div className="mb-1 text-[10px] text-muted-foreground">{timingSummary}</div>
              )}
              <pre
                className={cn(
                  'max-h-40 max-w-full overflow-auto whitespace-pre-wrap break-words rounded p-2 text-[10px] leading-snug',
                  isError ? 'bg-destructive/10' : 'bg-background',
                )}
              >
                {summary?.body ?? result.content}
              </pre>
            </Field>
          )}
        </div>
      )}
    </li>
  );
}

function Header({ label }: { label: string }) {
  return (
    <div className="mb-1 flex items-baseline justify-between gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
      <span>Assistant</span>
      <span className="truncate font-mono normal-case">{label}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function tryPrettyJson(raw: string): string | null {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return null;
  }
}

interface ResultSummary {
  kind: 'ok' | 'error' | 'cancelled';
  label: string;
  body: string;
}

function summariseResult(raw: string): ResultSummary {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object' && typeof parsed.error === 'string') {
      const detail = typeof parsed.detail === 'string' ? parsed.detail : '';
      return {
        kind: 'error',
        label: parsed.error,
        body: detail || JSON.stringify(parsed, null, 2),
      };
    }
    if (parsed && typeof parsed === 'object' && parsed.status === 'cancelled') {
      const detail = typeof parsed.detail === 'string' ? parsed.detail : '';
      return {
        kind: 'cancelled',
        label: 'cancelled',
        body: detail || JSON.stringify(parsed, null, 2),
      };
    }
    if (
      parsed &&
      typeof parsed === 'object' &&
      (parsed as { status?: unknown }).status === 'permission_required'
    ) {
      const detail = typeof parsed.detail === 'string' ? parsed.detail : '';
      return {
        kind: 'ok',
        label: 'permission required',
        body: detail || JSON.stringify(parsed, null, 2),
      };
    }
    if (parsed && typeof parsed === 'object') {
      const oneLine = oneLineSummary(parsed);
      return {
        kind: 'ok',
        label: oneLine,
        body: JSON.stringify(parsed, null, 2),
      };
    }
    return { kind: 'ok', label: 'done', body: raw };
  } catch {
    return { kind: 'ok', label: 'done', body: raw };
  }
}

function oneLineSummary(o: Record<string, unknown>): string {
  // Domain-aware shortcuts for the most common tool results.
  if (Array.isArray(o.components)) return `${(o.components as unknown[]).length} components`;
  if (Array.isArray(o.changedFiles)) return `${(o.changedFiles as unknown[]).length} files changed`;
  if (typeof o.path === 'string' && typeof o.contents === 'string') {
    return `${o.path} (${(o.contents as string).length} chars)`;
  }
  if (o.selection && typeof o.selection === 'object') {
    const sel = o.selection as { tagName?: string; loc?: string };
    return sel.loc ? `${sel.tagName ?? '?'} @ ${sel.loc}` : 'selection';
  }
  if (o.ok === true) return 'ok';
  return 'done';
}

export function formatToolTiming(metadata: Record<string, unknown> | undefined): string | null {
  const timing = metadata?.toolTiming;
  if (!timing || typeof timing !== 'object') return null;
  const values = timing as Record<string, unknown>;
  const parts: string[] = [];
  const permissionWaitMs = numberValue(values.permissionWaitMs);
  const handlerDurationMs = numberValue(values.handlerDurationMs);
  const totalDurationMs = numberValue(values.totalDurationMs);
  if (permissionWaitMs !== null && permissionWaitMs >= 1000) {
    parts.push(`waited ${formatDuration(permissionWaitMs)} for approval`);
  }
  if (handlerDurationMs !== null && handlerDurationMs >= 1000) {
    parts.push(`ran ${formatDuration(handlerDurationMs)}`);
  }
  if (parts.length === 0 && totalDurationMs !== null && totalDurationMs >= 1000) {
    parts.push(`took ${formatDuration(totalDurationMs)}`);
  }
  return parts.length > 0 ? parts.join(', ') : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60)
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}
