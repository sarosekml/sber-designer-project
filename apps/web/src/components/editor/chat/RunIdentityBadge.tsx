import type { AssistantActiveRun } from '@sber-designer/shared-types';
import {
  CLAUDE_CODE_RUNTIME_PROVIDER_ID,
  CODEX_RUNTIME_PROVIDER_ID,
  KIMI_RUNTIME_PROVIDER_ID,
  OPENCODE_RUNTIME_PROVIDER_ID,
} from '@/lib/api/agent-runs';
import { fullAgentLabel } from '@/lib/agent-provider-labels';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/stores/chat-store';
import { AgentProviderIcon } from '../AgentProviderIcon';

export interface AssistantRunIdentityApiProvider {
  providerId: string;
  label: string;
}

export interface AssistantRunIdentityBadgeState {
  label: string;
  title: string;
  providerId: string;
  source: 'current-run' | 'last-run';
}

const CLI_PROVIDER_LABELS: Record<string, string> = {
  [OPENCODE_RUNTIME_PROVIDER_ID]: 'OpenCode',
  [CLAUDE_CODE_RUNTIME_PROVIDER_ID]: 'Claude Code',
  [CODEX_RUNTIME_PROVIDER_ID]: 'Codex CLI',
  [KIMI_RUNTIME_PROVIDER_ID]: 'Kimi Code CLI',
};

export function buildAssistantRunIdentityBadgeState(input: {
  selectedRun?: AssistantActiveRun | null;
  messages: readonly Pick<ChatMessage, 'role' | 'meta'>[];
  apiProviders?: readonly AssistantRunIdentityApiProvider[];
}): AssistantRunIdentityBadgeState | null {
  const selected = input.selectedRun
    ? {
        provider: input.selectedRun.provider,
        model: input.selectedRun.model,
        source: 'current-run' as const,
      }
    : latestAssistantMeta(input.messages);
  if (!selected) return null;
  const cliProviderLabel = CLI_PROVIDER_LABELS[selected.provider];
  const providerLabel =
    cliProviderLabel ??
    input.apiProviders?.find((provider) => provider.providerId === selected.provider)?.label ??
    selected.provider;
  const label = fullAgentLabel({
    kind: cliProviderLabel ? 'cli' : 'api',
    providerLabel,
    model: selected.model,
  });
  const prefix = selected.source === 'current-run' ? 'Current run' : 'Last run';
  return {
    label: `${prefix} · ${label}`,
    title: `${prefix}: ${selected.provider} / ${selected.model}`,
    providerId: selected.provider,
    source: selected.source,
  };
}

export function RunIdentityBadge({
  identity,
  className,
}: {
  identity: AssistantRunIdentityBadgeState | null;
  className?: string;
}) {
  if (!identity) return null;
  return (
    <div
      className={cn(
        'flex h-7 min-w-0 max-w-[45%] items-center gap-1.5 rounded-md border border-border/70 bg-muted/35 px-2 text-[11px] text-muted-foreground',
        className,
      )}
      title={identity.title}
    >
      <AgentProviderIcon providerId={identity.providerId} label={identity.label} size={14} />
      <span className="min-w-0 truncate">{identity.label}</span>
    </div>
  );
}

function latestAssistantMeta(
  messages: readonly Pick<ChatMessage, 'role' | 'meta'>[],
): { provider: string; model: string; source: 'last-run' } | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== 'assistant' || !message.meta?.provider || !message.meta.model) {
      continue;
    }
    return {
      provider: message.meta.provider,
      model: message.meta.model,
      source: 'last-run',
    };
  }
  return null;
}
