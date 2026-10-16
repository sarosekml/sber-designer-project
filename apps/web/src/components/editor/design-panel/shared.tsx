/**
 * Shared primitives and pure helpers for the Design panel tabs: section /
 * control / field wrappers, notices, the assistant fallback block, and
 * draft-change readers used across Inspect / Options / Style / Layers.
 */
import { AlertTriangle, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { ApiError } from '@/lib/api-client';
import {
  selectedToDesignTarget,
  type DesignInspectResult,
  type LayerNode,
  type VisualChange,
} from '@/lib/design-types';
import { cn } from '@/lib/utils';
import { useChat } from '@/hooks/useChat';
import { useChatStore } from '@/stores/chat-store';
import { useEditorStore } from '@/stores/editor-store';

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid min-w-0 gap-2">
      <div className="min-w-0 truncate text-[10px] font-medium uppercase text-muted-foreground">
        {title}
      </div>
      <div className="grid min-w-0 gap-2">{children}</div>
    </section>
  );
}

export function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function Field({
  label,
  value,
  mono,
  wrap,
}: {
  label: string;
  value: string;
  mono?: boolean;
  wrap?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div
        className={cn(
          'mt-0.5 min-w-0 text-xs',
          mono && 'font-mono',
          wrap ? 'break-all' : 'truncate',
        )}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

export function ReadOnlyRow({ label, reason }: { label: string; reason: string }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-md border border-border bg-card px-2 py-1.5 text-xs">
      <div className="truncate font-medium text-foreground">{label}</div>
      <div className="mt-0.5 break-words text-muted-foreground">{reason}</div>
    </div>
  );
}

export function InlineNotice({
  icon: Icon,
  title,
  detail,
  tone = 'default',
  spin,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  detail: string;
  tone?: 'default' | 'warning' | 'error';
  spin?: boolean;
}) {
  return (
    <div
      className={cn(
        'min-w-0 overflow-hidden rounded-md border px-3 py-2 text-xs',
        tone === 'error'
          ? 'border-destructive/40 bg-destructive/10 text-destructive-foreground'
          : tone === 'warning'
            ? 'border-warning/30 bg-warning/10 text-warning'
            : 'border-border bg-card text-muted-foreground',
      )}
    >
      <div className="mb-1 flex min-w-0 items-center gap-2 font-medium text-foreground">
        <Icon className={cn('size-3.5 shrink-0', spin && 'animate-spin')} />
        <span className="min-w-0 truncate">{title}</span>
      </div>
      <div className="break-words leading-relaxed">{detail}</div>
    </div>
  );
}

export function LockedNotice({ reason }: { reason: string }) {
  return (
    <InlineNotice
      tone="warning"
      icon={AlertTriangle}
      title="Visual controls locked"
      detail={reason}
    />
  );
}

export function AssistantFallback({ reason, prompt }: { reason: string; prompt: string }) {
  const { send } = useChat();
  const pending = useChatStore((s) => s.pending);
  return (
    <div className="grid gap-3">
      <LockedNotice reason={reason} />
      <Separator />
      <Button size="sm" variant="outline" disabled={pending} onClick={() => void send(prompt)}>
        <Sparkles className="size-3.5" />
        Ask Assistant
      </Button>
    </div>
  );
}

export function fallbackInspect(
  selected: NonNullable<ReturnType<typeof useEditorStore.getState>['selected']>,
): DesignInspectResult {
  const reason = 'Selection metadata is available, but source inspection has not completed.';
  return {
    target: selectedToDesignTarget(selected),
    editable: false,
    reason,
    projectSupport: selected.loc.startsWith('dom://') ? 'baseline-selection' : 'unknown',
    sourceScope: 'unknown',
    capabilities: {
      text: { status: 'unmapped', operations: [], reason },
      props: { status: 'unmapped', operations: [], reason },
      style: { status: 'unmapped', operations: [], reason },
      className: { status: 'unmapped', operations: [], reason },
      insert: { status: 'unmapped', operations: [], reason },
    },
    diagnostics: [],
  };
}

export function layerToSelectedNode(node: LayerNode) {
  return {
    loc: node.loc ?? `dom://${node.id}`,
    sourceKind:
      node.sourceKind ?? (node.loc?.startsWith('dom://') ? 'dom-fallback' : 'react-source'),
    ...(node.domPath ? { domPath: node.domPath } : {}),
    ...(node.componentPath ? { componentPath: node.componentPath } : {}),
    tagName: node.tagName,
    rect: node.rect,
    ...(node.text ? { text: node.text } : {}),
    ...(node.selector ? { selector: node.selector } : {}),
    ...(node.componentName ? { componentName: node.componentName } : {}),
    ...(node.attributes ? { attributes: node.attributes } : {}),
  };
}

export function targetLoc(
  target: DesignInspectResult['target'],
): { line: number; column: number } | null {
  if (!target.line) return null;
  return { line: target.line, column: target.column ?? 0 };
}

export function draftChildrenText(changes: VisualChange[], targetId: string): string | null {
  const change = changes.find(
    (item): item is Extract<VisualChange, { kind: 'set-children-text' }> =>
      item.kind === 'set-children-text' && item.targetId === targetId,
  );
  return change?.text ?? null;
}

export function draftPropValue(
  changes: VisualChange[],
  targetId: string,
  name: string,
): string | null {
  const change = changes.find(
    (item): item is Extract<VisualChange, { kind: 'set-prop' | 'remove-prop' }> =>
      item.targetId === targetId &&
      (item.kind === 'set-prop' || item.kind === 'remove-prop') &&
      item.name === name,
  );
  if (!change) return null;
  if (change.kind === 'remove-prop') return '';
  return unquoteExpression(change.value);
}

export function draftStyleValue(
  changes: VisualChange[],
  targetId: string,
  property: string,
): string | null {
  const change = changes.find(
    (item): item is Extract<VisualChange, { kind: 'set-style' | 'remove-style' }> =>
      item.targetId === targetId &&
      (item.kind === 'set-style' || item.kind === 'remove-style') &&
      item.property === property,
  );
  if (!change) return null;
  if (change.kind === 'remove-style') return '';
  return change.value;
}

export function draftClassName(changes: VisualChange[], targetId: string): string | null {
  const change = changes.find(
    (item): item is Extract<VisualChange, { kind: 'set-class-token' }> =>
      item.kind === 'set-class-token' && item.targetId === targetId,
  );
  return change?.nextClass ?? null;
}

function unquoteExpression(value: string): string {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'string' ? parsed : value;
  } catch {
    return value;
  }
}

export function changeLabelKey(change: VisualChange): string {
  if (change.kind === 'set-prop' || change.kind === 'remove-prop')
    return `${change.kind}:${change.name}`;
  if (change.kind === 'set-style' || change.kind === 'remove-style')
    return `${change.kind}:${change.property}`;
  return `${change.kind}:${change.label}`;
}

export function buildFallbackPrompt(info: DesignInspectResult, intent: string): string {
  const target = info.target;
  return [
    '[visual-design-fallback]',
    intent,
    `Selected target: ${target.componentName ?? target.tagName.toLowerCase()}`,
    `Source: ${target.filePath ? `${target.filePath}:${target.line}:${target.column}` : target.loc}`,
    target.text ? `Text: ${target.text}` : '',
    target.selector ? `Selector: ${target.selector}` : '',
    'Make the narrowest safe source edit and preserve the live-DOM/AST workflow.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatError(err: unknown): string {
  const maybeApi = err as ApiError;
  if (maybeApi?.code || maybeApi?.status) return `${maybeApi.code ?? 'error'}: ${maybeApi.message}`;
  return err instanceof Error ? err.message : String(err);
}
