import { useCallback, useEffect, type Dispatch, type SetStateAction } from 'react';
import { normalizeAssistantSessionMode } from '@sber-designer/shared-types';

import {
  resolveAgentModelTarget,
  validateAttachmentsForAgentTarget,
} from '@/lib/agent-model-target';
import { gateMarkSendForTarget } from '@/lib/mark-preflight';
import type { AgentKitInventory } from '@/lib/api-client';
import {
  CANVAS_MARK_EVENT,
  buildMarkWireContent,
  markDisplayText,
  type CanvasMarkEventDetail,
  type CanvasMarkImage,
} from '@/lib/canvas-mark';
import {
  TEXT_ATTACHMENT_MAX_BYTES,
  buildImageUrlAttachmentsFromText,
  formatBytes,
  inferImageMimeType,
  isSupportedImageAttachment,
} from '@/lib/chat-attachments';
import {
  buildChatComposerSendPayload,
  resolveSendBlockReason,
  selectSupportedAttachmentFiles,
} from '@/lib/chat-composer';
import {
  HTML_DESIGN_SYSTEM_DISTILLATION_DRAFT_EVENT,
  type HtmlDesignSystemDistillationDraftDetail,
} from '@/lib/html-design-system-distillation';
import {
  HTML_DESIGN_SYSTEM_REFERENCE_DRAFT_EVENT,
  type HtmlDesignSystemReferenceDraftDetail,
} from '@/lib/html-design-system-reference';
import {
  buildExternalDesignSourceDirective,
  detectExternalDesignSourceIntent,
} from '@sber-designer/shared-types';
import { shouldUseDesignSourceScreenComposer } from '@/lib/design-source-composer';
import { useChat } from '@/hooks/useChat';
import { useChatStore, type ChatAttachment } from '@/stores/chat-store';
import { MAX_ATTACHMENTS, inferTextMimeType, readAsDataUrl, readAsText } from './attachments';
import type { DesignSourceComposerState } from './DesignSourceMiniForm';

export function useChatPanelAttachments({
  activePrimaryAgent,
  agentInventory,
  agentTarget,
  attachmentLimits,
  attachments,
  autoRunning,
  pending,
  providerUnavailable,
  send,
  sessionAgentName,
  sessionMode,
  setAttachments,
  setDesignSourceComposer,
  setDraft,
  setError,
  setIgnoredDesignSourceIntentKey,
}: {
  activePrimaryAgent: AgentKitInventory['agents'][number] | null;
  agentInventory: AgentKitInventory | null;
  agentTarget: ReturnType<typeof resolveAgentModelTarget>;
  attachmentLimits: { imageMaxBytes: number; svgMaxBytes: number };
  attachments: ChatAttachment[];
  autoRunning: boolean;
  pending: boolean;
  providerUnavailable: boolean;
  send: ReturnType<typeof useChat>['send'];
  sessionAgentName: string | null;
  sessionMode: ReturnType<typeof normalizeAssistantSessionMode>;
  setAttachments: Dispatch<SetStateAction<ChatAttachment[]>>;
  setDesignSourceComposer: Dispatch<SetStateAction<DesignSourceComposerState | null>>;
  setDraft: Dispatch<SetStateAction<string>>;
  setError: (error: string | null) => void;
  setIgnoredDesignSourceIntentKey: Dispatch<SetStateAction<string | null>>;
}) {
  const addFiles = useCallback(
    async (files: FileList | File[]): Promise<ChatAttachment[]> => {
      const supportedFiles = selectSupportedAttachmentFiles(Array.from(files), {
        currentCount: attachments.length,
        maxCount: MAX_ATTACHMENTS,
      });
      if (supportedFiles.length === 0) return [];
      const next: ChatAttachment[] = [];
      for (const file of supportedFiles) {
        const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        if (isSupportedImageAttachment(file)) {
          const mimeType = inferImageMimeType(file.name, file.type);
          const limit =
            mimeType === 'image/svg+xml'
              ? attachmentLimits.svgMaxBytes
              : attachmentLimits.imageMaxBytes;
          if (file.size > limit) {
            setError(`${file.name} is larger than ${formatBytes(limit)}.`);
            continue;
          }
          if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(mimeType)) {
            setError(`${file.name} must be PNG, JPEG, SVG, or WebP.`);
            continue;
          }
          if (mimeType === 'image/svg+xml') {
            next.push({
              id,
              kind: 'image',
              name: file.name,
              mimeType,
              size: file.size,
              text: await readAsText(file),
            });
            continue;
          }
          next.push({
            id,
            kind: 'image',
            name: file.name,
            mimeType,
            size: file.size,
            dataUrl: await readAsDataUrl(file),
          });
          continue;
        }
        if (file.size > TEXT_ATTACHMENT_MAX_BYTES) {
          setError(`${file.name} is larger than 256KB.`);
          continue;
        }
        next.push({
          id,
          kind: 'text',
          name: file.name,
          mimeType: file.type || inferTextMimeType(file.name),
          size: file.size,
          text: await readAsText(file),
        });
      }
      if (next.length > 0) setAttachments((prev) => [...prev, ...next].slice(0, MAX_ATTACHMENTS));
      return next;
    },
    [attachmentLimits.imageMaxBytes, attachmentLimits.svgMaxBytes, attachments.length, setError],
  );

  const sendReferenceDraft = useCallback(
    async (draftText: string, addedAttachments: ChatAttachment[]) => {
      const baseAttachments = [...attachments, ...addedAttachments].slice(0, MAX_ATTACHMENTS);
      const attachmentsForSend = [
        ...baseAttachments,
        ...buildImageUrlAttachmentsFromText({
          text: draftText,
          existingAttachments: baseAttachments,
          maxCount: MAX_ATTACHMENTS,
        }),
      ];
      const compatibility = validateAttachmentsForAgentTarget({
        target: agentTarget,
        attachments: attachmentsForSend,
      });
      const blockReason = resolveSendBlockReason({
        sessionMode,
        draft: draftText,
        attachmentCount: baseAttachments.length,
        pending,
        providerUnavailable,
        autoRunning,
        attachmentCompatibility: compatibility,
      });
      if (blockReason) {
        setDraft(draftText);
        if (baseAttachments.length > 0) setAttachments(baseAttachments);
        setError(blockReason);
        return;
      }

      const intent = detectExternalDesignSourceIntent(draftText);
      const designSourceDirective =
        intent && !shouldUseDesignSourceScreenComposer(intent)
          ? buildExternalDesignSourceDirective(intent)
          : null;
      const payload = buildChatComposerSendPayload({
        sessionMode,
        draft: draftText,
        attachments: attachmentsForSend,
        knownAgents: agentInventory?.agents ?? [],
        sessionAgentName,
        activePrimaryAgentName: activePrimaryAgent?.name ?? null,
        designSourceDirective,
      });
      if (!payload) return;
      setDraft('');
      setAttachments([]);
      setDesignSourceComposer(null);
      setIgnoredDesignSourceIntentKey(null);
      await send(payload.content, payload.attachments, {
        ...(payload.displayContent ? { displayContent: payload.displayContent } : {}),
        ...(payload.agentName ? { agentName: payload.agentName } : {}),
        ...(payload.primaryAgentName ? { primaryAgentName: payload.primaryAgentName } : {}),
        ...(agentInventory ? { knownAgents: agentInventory.agents } : {}),
        sessionMode,
      });
    },
    [
      activePrimaryAgent?.name,
      agentInventory,
      sessionMode,
      agentTarget,
      attachments,
      autoRunning,
      pending,
      providerUnavailable,
      send,
      sessionAgentName,
      setError,
    ],
  );

  useEffect(() => {
    const handleDraft = (event: Event) => {
      const detail = (event as CustomEvent<HtmlDesignSystemReferenceDraftDetail>).detail;
      if (!detail || typeof detail.draft !== 'string' || !detail.draft.trim()) return;
      void (async () => {
        const files = Array.isArray(detail.files) ? detail.files : [];
        if (detail.sourceKind === 'attachment' && files.length === 0) {
          setDraft(detail.draft);
          setError('Choose a reference file before creating the proposal.');
          return;
        }
        const added = files.length > 0 ? await addFiles(files) : [];
        if (detail.sourceKind === 'attachment' && files.length > 0 && added.length === 0) {
          setDraft(detail.draft);
          setError('Attach a supported reference file before creating the proposal.');
          return;
        }
        if (detail.autoSend) {
          await sendReferenceDraft(detail.draft, added);
          return;
        }
        setDraft(detail.draft);
      })();
    };
    window.addEventListener(HTML_DESIGN_SYSTEM_REFERENCE_DRAFT_EVENT, handleDraft);
    return () => window.removeEventListener(HTML_DESIGN_SYSTEM_REFERENCE_DRAFT_EVENT, handleDraft);
  }, [addFiles, sendReferenceDraft, setError]);

  useEffect(() => {
    const handleDraft = (event: Event) => {
      const detail = (event as CustomEvent<HtmlDesignSystemDistillationDraftDetail>).detail;
      if (!detail || typeof detail.draft !== 'string' || !detail.draft.trim()) return;
      void (async () => {
        if (detail.autoSend) {
          await sendReferenceDraft(detail.draft, []);
          return;
        }
        setDraft(detail.draft);
      })();
    };
    window.addEventListener(HTML_DESIGN_SYSTEM_DISTILLATION_DRAFT_EVENT, handleDraft);
    return () =>
      window.removeEventListener(HTML_DESIGN_SYSTEM_DISTILLATION_DRAFT_EVENT, handleDraft);
  }, [sendReferenceDraft]);

  useEffect(() => {
    const handleMark = (event: Event) => {
      const detail = (event as CustomEvent<CanvasMarkEventDetail>).detail;
      if (!detail) return;
      const toChatAttachment = (image: CanvasMarkImage, index: number): ChatAttachment => ({
        id: `att-mark-${Date.now()}-${index}`,
        kind: 'image',
        name: image.name,
        mimeType: image.mimeType,
        size: image.size,
        dataUrl: image.dataUrl,
      });
      const markAttachments = [detail.screenshot, ...detail.extraImages]
        .filter((image): image is CanvasMarkImage => Boolean(image))
        .map(toChatAttachment);

      if (detail.action === 'draft') {
        setAttachments((current) => [...current, ...markAttachments].slice(0, MAX_ATTACHMENTS));
        if (detail.note) {
          setDraft((current) => (current.trim() ? `${current}\n${detail.note}` : detail.note));
        }
        detail.ack?.({ ok: true });
        return;
      }

      if (useChatStore.getState().pending) {
        detail.ack?.({
          ok: false,
          message: 'The assistant is busy with a run — use “Add to input” instead.',
        });
        return;
      }

      // Event-boundary preflight (0138 D6): the overlay's disabled Send is
      // only the first line of defence — the target may have changed between
      // render and delivery, so re-check the same validator here and ack
      // honestly. Failed preflight keeps the mark scene intact on the
      // sender side.
      const gate = gateMarkSendForTarget(
        agentTarget,
        markAttachments.map((attachment) => ({
          kind: attachment.kind,
          name: attachment.name,
          mimeType: attachment.mimeType,
        })),
      );
      if (gate.blocked) {
        detail.ack?.({ ok: false, message: gate.message });
        return;
      }

      void send(
        buildMarkWireContent({
          scene: detail.scene,
          bounds: detail.bounds,
          frameSize: detail.frameSize,
          note: detail.note,
          screen: detail.screen,
          hasScreenshot: Boolean(detail.screenshot),
        }),
        markAttachments,
        {
          displayContent: markDisplayText(detail.note, detail.scene),
          sessionMode,
          ...(sessionAgentName ? { agentName: sessionAgentName } : {}),
          ...(activePrimaryAgent ? { primaryAgentName: activePrimaryAgent.name } : {}),
          ...(agentInventory ? { knownAgents: agentInventory.agents } : {}),
        },
      );
      detail.ack?.({ ok: true });
    };
    window.addEventListener(CANVAS_MARK_EVENT, handleMark);
    return () => window.removeEventListener(CANVAS_MARK_EVENT, handleMark);
  }, [activePrimaryAgent, agentInventory, agentTarget, send, sessionAgentName, sessionMode]);

  return { addFiles };
}
