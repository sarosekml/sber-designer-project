import {
  stripExternalDesignSourceDirective,
  type AssistantSessionMode,
} from '@sber-designer/shared-types';

import { parseLeadingAgentMention, type MentionableAgent } from '@/lib/agent-mentions';
import { isSupportedPromptAttachment, type AttachmentFileLike } from '@/lib/chat-attachments';
import type { ChatAttachment } from '@/stores/chat-store';

export interface AttachmentCompatibilityNotice {
  severity: 'warning' | 'error';
  detail: string;
}

export interface ChatComposerSendPayload {
  content: string;
  attachments: ChatAttachment[];
  displayContent?: string;
  agentName?: string;
  primaryAgentName?: string;
}

export function remainingAttachmentSlots(currentCount: number, maxCount: number): number {
  return Math.max(maxCount - currentCount, 0);
}

export function selectSupportedAttachmentFiles<TFile extends AttachmentFileLike>(
  files: readonly TFile[],
  input: { currentCount: number; maxCount: number },
): TFile[] {
  const remaining = remainingAttachmentSlots(input.currentCount, input.maxCount);
  return files.filter(isSupportedPromptAttachment).slice(0, remaining);
}

export function resolveSendBlockReason(input: {
  sessionMode: AssistantSessionMode;
  draft: string;
  attachmentCount: number;
  pending: boolean;
  providerUnavailable: boolean;
  autoRunning: boolean;
  attachmentCompatibility: AttachmentCompatibilityNotice | null | undefined;
}): string | null {
  if (input.providerUnavailable) return 'Choose an LLM provider in Settings';
  if (input.pending) return 'Assistant is already running.';
  if (input.autoRunning) return 'Auto mode is already running.';
  if (!input.draft.trim() && input.attachmentCount === 0) {
    return 'Enter a message or attach a file.';
  }
  if (input.attachmentCompatibility?.severity === 'error') {
    return input.attachmentCompatibility.detail;
  }
  return null;
}

export function buildChatComposerSendPayload(input: {
  sessionMode: AssistantSessionMode;
  draft: string;
  attachments: readonly ChatAttachment[];
  knownAgents: readonly MentionableAgent[];
  sessionAgentName?: string | null;
  activePrimaryAgentName?: string | null;
  designSourceDirective?: string | null;
}): ChatComposerSendPayload | null {
  const trimmedDraft = input.draft.trim();
  if (!trimmedDraft && input.attachments.length === 0) return null;

  const mention = parseLeadingAgentMention(trimmedDraft);
  const mentionedAgent = mention
    ? input.knownAgents.find((agent) => agent.name === mention.agent)
    : null;
  const promptText = mention ? mention.content.trim() : trimmedDraft;
  const content = appendDesignSourceDirectiveOnce(promptText, input.designSourceDirective);
  const displayContent = input.designSourceDirective
    ? stripExternalDesignSourceDirective(trimmedDraft).trim()
    : undefined;
  const agentName =
    mentionedAgent && mentionedAgent.mode !== 'primary'
      ? mentionedAgent.name
      : !mention && input.sessionAgentName
        ? input.sessionAgentName
        : undefined;
  const primaryAgentName =
    mentionedAgent?.mode === 'primary'
      ? mentionedAgent.name
      : (input.activePrimaryAgentName ?? undefined);

  return {
    content,
    attachments: [...input.attachments],
    ...(displayContent ? { displayContent } : {}),
    ...(agentName ? { agentName } : {}),
    ...(primaryAgentName ? { primaryAgentName } : {}),
  };
}

export function composerKeyIntent(input: {
  key: string;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}): 'send' | 'newline' | 'ignore' {
  if (input.key !== 'Enter') return 'ignore';
  if (input.shiftKey) return 'newline';
  return 'send';
}

function appendDesignSourceDirectiveOnce(text: string, directive: string | null | undefined) {
  if (!directive) return text;
  const stripped = stripExternalDesignSourceDirective(text).trim();
  return [stripped, directive].filter(Boolean).join('\n\n');
}
