import { readFile } from 'node:fs/promises';
import { resolveInside } from '@sber-designer/ast-bridge';
import type { ChatContentPart, ChatMessage } from '@sber-designer/llm-gateway';
import {
  isPromptRasterImageMimeType,
  type PromptAttachmentEvidence,
  type PromptImageAttachmentEvidence,
} from '@sber-designer/shared-types';

export type ProviderImageTransportErrorCode =
  | 'provider_image_transport_unsupported'
  | 'model_cannot_read_images';

export type ProviderImageTransport =
  | {
      kind: 'openai-image-url';
      acceptsDataUrl: boolean;
      acceptsRemoteUrl: boolean;
    }
  | {
      kind: 'unsupported';
      code: ProviderImageTransportErrorCode;
      detail: string;
    };

export class ProviderImageTransportError extends Error {
  readonly code: ProviderImageTransportErrorCode;

  constructor(input: { code: ProviderImageTransportErrorCode; detail: string }) {
    super(input.detail);
    this.name = 'ProviderImageTransportError';
    this.code = input.code;
  }
}

export function providerImageTransportForAgentTarget(input: {
  imageInputMode: string;
  capabilities: { rasterImageInput: boolean };
  label: string;
  imageInputFailureDetail?: string;
}): ProviderImageTransport {
  if (input.imageInputMode === 'inline' && input.capabilities.rasterImageInput) {
    return {
      kind: 'openai-image-url',
      acceptsDataUrl: true,
      acceptsRemoteUrl: true,
    };
  }
  return {
    kind: 'unsupported',
    code: 'model_cannot_read_images',
    detail: input.imageInputFailureDetail
      ? `Model "${input.label}" cannot read raster image attachments through the selected provider transport. ${input.imageInputFailureDetail}`
      : `Model "${input.label}" cannot read raster image attachments through the selected provider transport.`,
  };
}

export async function buildProviderMultimodalMessages(input: {
  workspacePath: string;
  messages: ChatMessage[];
  attachments: PromptAttachmentEvidence[];
  acceptsDataUrl?: boolean;
  acceptsRemoteUrl?: boolean;
  imageTransport?: ProviderImageTransport;
}): Promise<ChatMessage[]> {
  const sanitized: ChatMessage[] = input.messages.map((message) => ({
    ...message,
    content: contentToTrustedText(message.content),
  }));
  const rasterAttachments = input.attachments.filter(isRasterImageEvidence);
  if (rasterAttachments.length === 0) return sanitized;

  const latestUserIndex = latestUserMessageIndex(sanitized);
  if (latestUserIndex < 0) return sanitized;

  const imageParts: ChatContentPart[] = [];
  const imageTransport =
    input.imageTransport ??
    ({
      kind: 'openai-image-url',
      acceptsDataUrl: Boolean(input.acceptsDataUrl),
      acceptsRemoteUrl: Boolean(input.acceptsRemoteUrl),
    } satisfies ProviderImageTransport);
  for (const attachment of rasterAttachments) {
    const url = await providerImageUrlForAttachment({
      workspacePath: input.workspacePath,
      attachment,
      imageTransport,
    });
    imageParts.push({ type: 'image_url', image_url: { url, detail: 'auto' } });
  }

  const latest = sanitized[latestUserIndex]!;
  const text = contentToTrustedText(latest.content) || 'Use the attached image as context.';
  const next = [...sanitized];
  next[latestUserIndex] = {
    ...latest,
    content: [{ type: 'text', text }, ...imageParts],
  };
  return next;
}

function isRasterImageEvidence(
  attachment: PromptAttachmentEvidence,
): attachment is PromptImageAttachmentEvidence {
  return attachment.kind !== 'text' && isPromptRasterImageMimeType(attachment.mimeType);
}

function latestUserMessageIndex(messages: ChatMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') return index;
  }
  return -1;
}

function contentToTrustedText(content: ChatMessage['content']): string {
  if (typeof content === 'string') return content;
  return content
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n\n')
    .trim();
}

async function providerImageUrlForAttachment(input: {
  workspacePath: string;
  attachment: PromptImageAttachmentEvidence;
  imageTransport: ProviderImageTransport;
}): Promise<string> {
  if (input.imageTransport.kind === 'unsupported') {
    throw new ProviderImageTransportError({
      code: input.imageTransport.code,
      detail: input.imageTransport.detail,
    });
  }
  if (input.imageTransport.acceptsRemoteUrl && input.attachment.providerImageUrl) {
    return input.attachment.providerImageUrl;
  }
  if (input.imageTransport.acceptsDataUrl) {
    const bytes = await readFile(resolveInside(input.workspacePath, input.attachment.runPath));
    return `data:${input.attachment.mimeType};base64,${bytes.toString('base64')}`;
  }
  throw new ProviderImageTransportError({
    code: 'provider_image_transport_unsupported',
    detail: `No supported provider image transport is available for attachment "${input.attachment.name}".`,
  });
}
