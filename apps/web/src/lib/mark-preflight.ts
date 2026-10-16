/**
 * Annotate capability preflight (0138 D5/D6).
 *
 * One resolveAgentModelTarget + validateAttachmentsForAgentTarget pass shared
 * by the Mark overlay UI (upfront notice, disabled Send) and the
 * CANVAS_MARK_EVENT boundary in useChatPanelAttachments, so the UI can never
 * diverge from what the send path enforces. Backend /api/chat validation
 * remains the final fail-closed barrier.
 */
import {
  validateAttachmentsForAgentTarget,
  type AgentAttachmentValidation,
  type AgentModelTarget,
  type AgentTargetAttachment,
} from './agent-model-target';

export interface MarkCapabilityNotice {
  level: 'blocked' | 'warning';
  message: string;
}

/** An Annotate submission always carries a PNG screenshot when capture works. */
const EXPECTED_SCREENSHOT: AgentTargetAttachment = {
  kind: 'image',
  name: 'canvas-mark.png',
  mimeType: 'image/png',
};

export function markCapabilityNotice(target: AgentModelTarget | null): MarkCapabilityNotice | null {
  if (!target) {
    return {
      level: 'blocked',
      message: 'Choose an active model before sending a canvas annotation.',
    };
  }
  const validation = validateAttachmentsForAgentTarget({
    target,
    attachments: [EXPECTED_SCREENSHOT],
  });
  if (!validation) return null;
  if (validation.severity === 'warning') {
    return { level: 'warning', message: validation.detail };
  }
  return {
    level: 'blocked',
    message: `${target.label} cannot read canvas screenshots. Choose a model marked “Vision” before sending this annotation. You can still use “Add to input”.`,
  };
}

/**
 * Event-boundary gate for CANVAS_MARK_EVENT. `blocked` must ack false and
 * skip send; `warning` follows the existing severity policy (send allowed).
 */
export function gateMarkSendForTarget(
  target: AgentModelTarget | null,
  attachments: readonly AgentTargetAttachment[],
):
  | { blocked: false; validation: AgentAttachmentValidation | null }
  | { blocked: true; message: string } {
  const validation = validateAttachmentsForAgentTarget({ target, attachments: [...attachments] });
  if (validation?.severity === 'error') {
    return {
      blocked: true,
      message: validation.detail,
    };
  }
  return { blocked: false, validation };
}
