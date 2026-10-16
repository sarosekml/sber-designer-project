import type React from 'react';
import {
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  ListTodo,
  Loader2,
  Paperclip,
  Send,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import type {
  AssistantSessionMode,
  ExternalDesignSourceIntent,
  ProjectScreen,
} from '@sber-designer/shared-types';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatBytes } from '@/lib/chat-attachments';
import type { AttachmentCompatibilityNotice } from '@/lib/chat-composer';
import { selectSupportedAttachmentFiles } from '@/lib/chat-composer';
import { cn } from '@/lib/utils';
import type { ChatAttachment } from '@/stores/chat-store';
import { ACCEPTED_ATTACHMENTS, MAX_ATTACHMENTS } from './attachments';
import { type DesignSourceComposerState, DesignSourceMiniForm } from './DesignSourceMiniForm';

interface ComposerAgent {
  name: string;
  mode?: string;
  description?: string;
}

export function Composer({
  providerUnavailable,
  pending,
  directionSelectionPending,
  autoRunning,
  stopAfterCurrent,
  sessionMode,
  autoRunArmed,
  canvasView,
  draft,
  attachments,
  attachmentCompatibility,
  hasHtmlAttachment,
  designSourceIntent,
  designSourceComposer,
  activeScreen,
  mentionSuggestions,
  activePrimaryAgent,
  fileInputRef,
  sendBlockReason,
  onDraftChange,
  onKeyDown,
  onAddFiles,
  onRemoveAttachment,
  onDesignSourceComposerChange,
  onApplyMentionSuggestion,
  onDismissDesignSourceComposer,
  onSend,
  onStopSelectedRun,
  onStopAutoAfterCurrent,
  onStopAutoNow,
  onAutoRunArmedChange,
}: {
  providerUnavailable: boolean;
  pending: boolean;
  directionSelectionPending: boolean;
  autoRunning: boolean;
  stopAfterCurrent: boolean;
  sessionMode: AssistantSessionMode;
  autoRunArmed: boolean;
  canvasView: 'screen' | 'storybook' | 'design-system';
  draft: string;
  attachments: ChatAttachment[];
  attachmentCompatibility: AttachmentCompatibilityNotice | null | undefined;
  hasHtmlAttachment: boolean;
  designSourceIntent: ExternalDesignSourceIntent | null;
  designSourceComposer: DesignSourceComposerState | null;
  activeScreen: ProjectScreen | null;
  mentionSuggestions: ComposerAgent[];
  activePrimaryAgent: ComposerAgent | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  sendBlockReason: string | null;
  onDraftChange: (draft: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveAttachment: (id: string) => void;
  onDesignSourceComposerChange: (composer: DesignSourceComposerState | null) => void;
  onApplyMentionSuggestion: (agentName: string) => void;
  onDismissDesignSourceComposer: () => void;
  onSend: () => void;
  onStopSelectedRun: () => void;
  onStopAutoAfterCurrent: () => void;
  onStopAutoNow: () => void;
  onAutoRunArmedChange: (armed: boolean) => void;
}) {
  const disabled = providerUnavailable || pending || autoRunning || directionSelectionPending;
  const canAddMoreAttachments = attachments.length < MAX_ATTACHMENTS;

  return (
    <div
      onDragOver={(event) => {
        if (!disabled) event.preventDefault();
      }}
      onDrop={(event) => {
        if (disabled) return;
        event.preventDefault();
        onAddFiles(event.dataTransfer.files);
      }}
    >
      {attachments.length > 0 && (
        <div className="mb-2 flex gap-2 overflow-x-auto">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className={cn(
                'group relative h-14 shrink-0 overflow-hidden rounded-md border border-border bg-card',
                attachment.kind === 'image' && attachment.dataUrl ? 'w-16' : 'w-40',
              )}
              title={attachment.name}
            >
              {attachment.kind === 'image' && attachment.dataUrl ? (
                <img
                  src={attachment.dataUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              ) : (
                <div className="flex h-full items-center gap-2 px-2 text-xs">
                  {attachment.kind === 'image' ? (
                    <ImageIcon className="size-4 shrink-0 text-primary" />
                  ) : (
                    <FileText className="size-4 shrink-0 text-primary" />
                  )}
                  <div className="min-w-0">
                    <div className="truncate font-medium">{attachment.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {attachment.sourceUrl ? 'URL' : formatBytes(attachment.size)}
                    </div>
                  </div>
                </div>
              )}
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                onClick={() => onRemoveAttachment(attachment.id)}
                className="absolute right-1 top-1 h-5 w-5 rounded bg-background/90 p-0 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                title="Remove attachment"
              >
                <X />
              </Button>
            </div>
          ))}
        </div>
      )}
      {attachmentCompatibility && (
        <div
          className={cn(
            'mb-2 flex gap-2 rounded-md border px-2.5 py-2 text-[11px]',
            attachmentCompatibility.severity === 'error'
              ? 'border-destructive/40 bg-destructive/10 text-destructive-foreground'
              : 'border-warning/40 bg-warning/10 text-warning',
          )}
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span className="min-w-0 flex-1">{attachmentCompatibility.detail}</span>
        </div>
      )}
      {hasHtmlAttachment && (
        <div className="mb-2 flex gap-2 rounded-md border border-border bg-muted/50 px-2.5 py-2 text-[11px] text-muted-foreground">
          <FileText className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            HTML is used as a reference. Generated code will be rebuilt with project components.
          </span>
        </div>
      )}
      {designSourceIntent && designSourceComposer && (
        <DesignSourceMiniForm
          intent={designSourceIntent}
          composer={designSourceComposer}
          activeScreen={activeScreen}
          disabled={disabled}
          onChange={onDesignSourceComposerChange}
          onDismiss={onDismissDesignSourceComposer}
        />
      )}
      <Textarea
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={(event) => {
          const files = Array.from(event.clipboardData.files);
          if (
            selectSupportedAttachmentFiles(files, {
              currentCount: attachments.length,
              maxCount: MAX_ATTACHMENTS,
            }).length > 0
          ) {
            event.preventDefault();
            onAddFiles(files);
          }
        }}
        disabled={disabled}
        placeholder={
          providerUnavailable
            ? 'Choose an LLM provider in Settings before sending a message.'
            : directionSelectionPending
              ? 'Choose a design direction by clicking a card above.'
              : canvasView === 'storybook'
                ? 'Ask Assistant to inspect, document, duplicate, or create a Storybook component.'
                : canvasView === 'design-system'
                  ? 'Ask Assistant to create or update reusable HTML design-system components.'
                  : autoRunArmed
                    ? 'Auto mode - review tasks, then let the assistant work through them.'
                    : sessionMode === 'ask'
                      ? 'Ask about the project without changing files.'
                      : sessionMode === 'plan'
                        ? 'Describe what you want - the assistant will draft a plan first.'
                        : 'Tell the assistant exactly what to change, then it edits the code.'
        }
        rows={3}
        className="min-h-[78px] resize-none text-sm"
      />
      {mentionSuggestions.length > 0 && !disabled && (
        <div className="mt-1 grid gap-1 rounded-md border border-border bg-popover p-1 shadow-sm">
          {mentionSuggestions.map((agent) => (
            <button
              key={agent.name}
              type="button"
              onClick={() => onApplyMentionSuggestion(agent.name)}
              className="flex h-8 min-w-0 items-center gap-2 rounded px-2 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
              title={agent.description}
            >
              <Sparkles className="size-3 shrink-0 text-primary" />
              <span className="shrink-0 font-mono">@{agent.name}</span>
              <span className="shrink-0 rounded bg-muted px-1 font-mono uppercase text-muted-foreground">
                {agent.mode}
              </span>
              {agent.name === activePrimaryAgent?.name && (
                <span className="shrink-0 rounded bg-primary/10 px-1 text-primary">active</span>
              )}
              <span className="min-w-0 truncate text-muted-foreground">{agent.description}</span>
            </button>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_ATTACHMENTS}
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.currentTarget.files) onAddFiles(event.currentTarget.files);
              event.currentTarget.value = '';
            }}
          />
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={disabled || !canAddMoreAttachments}
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
            className="h-7 w-7"
          >
            <Paperclip className="size-3.5" />
          </Button>
          {canvasView === 'screen' && (
            <Button
              type="button"
              size="sm"
              variant={autoRunArmed ? 'secondary' : 'ghost'}
              disabled={disabled}
              aria-pressed={autoRunArmed}
              onClick={() => onAutoRunArmedChange(!autoRunArmed)}
              title="Queue multiple screen tasks as Design runs"
              className="h-7 px-2 text-[11px]"
            >
              <ListTodo className="size-3.5" />
              Auto
            </Button>
          )}
        </div>
        {autoRunning ? (
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={onStopAutoAfterCurrent}
              disabled={stopAfterCurrent}
              title="Stop after the current task finishes"
            >
              <ListTodo className="size-3.5" />
              {stopAfterCurrent ? 'Finishing current' : 'Finish current'}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={onStopAutoNow}
              title="Stop the autonomous run now"
            >
              <Square />
              Stop now
            </Button>
          </div>
        ) : pending ? (
          <Button
            size="sm"
            variant="destructive"
            onClick={onStopSelectedRun}
            title="Cancel this turn"
          >
            <Square />
            Stop
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={onSend}
            disabled={
              autoRunArmed
                ? pending || providerUnavailable
                : directionSelectionPending || Boolean(sendBlockReason)
            }
            title={
              directionSelectionPending
                ? 'Choose a design direction above before sending another message.'
                : (sendBlockReason ?? undefined)
            }
          >
            {pending ? (
              <Loader2 className="animate-spin" />
            ) : autoRunArmed ? (
              <ListTodo />
            ) : (
              <Send />
            )}
            {autoRunArmed ? 'Review tasks' : 'Send'}
          </Button>
        )}
      </div>
    </div>
  );
}
