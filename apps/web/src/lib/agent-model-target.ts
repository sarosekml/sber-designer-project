import type { SberDesignerConfig } from '@sber-designer/llm-gateway';
import {
  isPromptRasterImageMimeType,
  normalizePromptImageMimeType,
} from '@sber-designer/shared-types';

import { fullAgentLabel } from './agent-provider-labels';

import {
  CLAUDE_CODE_RUNTIME_PROVIDER_ID,
  CODEX_RUNTIME_PROVIDER_ID,
  GIGACODE_RUNTIME_PROVIDER_ID,
  KIMI_RUNTIME_PROVIDER_ID,
  OPENCODE_RUNTIME_PROVIDER_ID,
  type AgentRuntimeStatus,
} from './api-client';

export type AgentRuntimeKind = 'api' | 'codex' | 'opencode' | 'claude-code' | 'kimi' | 'gigacode';
export type AgentImageInputMode = 'inline' | 'cli-native' | 'cli-files-warning' | 'none';
export type AgentImageDeliveryMode =
  | 'inline'
  | 'none'
  | 'prompt_path'
  | 'cli_native_arg'
  | 'cli_native_file'
  | 'mcp_resource';

export interface AgentModelTarget {
  kind: 'api' | 'cli';
  runtimeKind: AgentRuntimeKind;
  provider: string;
  model: string;
  label: string;
  imageInputMode: AgentImageInputMode;
  imageInputFailureDetail?: string;
  capabilities: {
    rasterImageInput: boolean;
    imageDeliveryMode: AgentImageDeliveryMode;
    svgSourceInput: boolean;
    nativeFileInput: boolean;
    toolCalls: boolean;
    streaming: boolean;
    projectMcpTools: boolean;
    ownMcpConfig: boolean;
  };
}

export interface AgentAttachmentValidation {
  severity: 'warning' | 'error';
  code:
    | 'model_cannot_read_images'
    | 'cli_image_input_unverified'
    | 'cli_image_input_prompt_path_only';
  detail: string;
}

export interface AgentCapabilityBadge {
  label: 'Vision' | 'Text only' | 'CLI' | 'Own MCP' | 'Product MCP';
  title: string;
  tone: 'default' | 'muted' | 'warning';
}

const RASTER_IMAGE_UNSUPPORTED_COPY =
  'This model cannot read PNG/JPG/WebP attachments. SVG files can still be used as source/context, but raster image understanding requires a verified vision model/runtime such as Codex CLI or another image-capable API target.';

export interface AgentTargetAttachment {
  kind: 'image' | 'text';
  name: string;
  mimeType: string;
}

export function resolveAgentModelTarget(input: {
  config: SberDesignerConfig | null;
  active: { provider: string; model: string } | null;
  runtimeStatuses?: readonly AgentRuntimeStatus[] | null;
}): AgentModelTarget | null {
  if (!input.active) return null;
  const runtimeKind = cliRuntimeKindForProvider(input.active.provider);
  if (runtimeKind) {
    return resolveCliTarget(
      input.active,
      runtimeKind,
      runtimeStatusForKind(input.runtimeStatuses, runtimeKind),
    );
  }

  const provider = input.config?.provider[input.active.provider];
  const model = provider?.models?.[input.active.model];
  const label = model?.name ? `${model.name} (${input.active.model})` : input.active.model;
  const imageInputFailureDetail = modelImageInputFailureDetail(model?.imageInput);
  const vision = model?.vision === true && !imageInputFailureDetail;
  return {
    kind: 'api',
    runtimeKind: 'api',
    provider: input.active.provider,
    model: input.active.model,
    label,
    imageInputMode: vision ? 'inline' : 'none',
    ...(imageInputFailureDetail ? { imageInputFailureDetail } : {}),
    capabilities: {
      rasterImageInput: vision,
      imageDeliveryMode: vision ? 'inline' : 'none',
      svgSourceInput: true,
      nativeFileInput: false,
      toolCalls: true,
      streaming: true,
      projectMcpTools: true,
      ownMcpConfig: false,
    },
  };
}

export function validateAttachmentsForAgentTarget(input: {
  target: AgentModelTarget | null;
  attachments: AgentTargetAttachment[];
}): AgentAttachmentValidation | null {
  if (!input.target || !hasRasterImageAttachment(input.attachments)) return null;
  if (input.target.imageInputMode === 'inline' || input.target.imageInputMode === 'cli-native') {
    return null;
  }
  if (input.target.imageInputMode === 'cli-files-warning') {
    if (input.target.capabilities.imageDeliveryMode === 'prompt_path') {
      return {
        severity: 'warning',
        code: 'cli_image_input_prompt_path_only',
        detail: `${input.target.label} receives attached images as saved workspace file paths, not through a --image style native flag. Visual reading depends on the CLI reading those paths during the run.`,
      };
    }
    return {
      severity: 'warning',
      code: 'cli_image_input_unverified',
      detail: `${input.target.label} receives attached images as workspace file paths. Use a verified image-capable runtime or a vision-capable API model when exact visual reading is required.`,
    };
  }
  return {
    severity: 'error',
    code: 'model_cannot_read_images',
    detail: input.target.imageInputFailureDetail
      ? `${input.target.label} cannot read raster image attachments through the selected provider transport. ${RASTER_IMAGE_UNSUPPORTED_COPY} ${input.target.imageInputFailureDetail}`
      : `${input.target.label} cannot read raster image attachments. ${RASTER_IMAGE_UNSUPPORTED_COPY}`,
  };
}

export function capabilityBadgesForAgentTarget(
  target: AgentModelTarget | null,
): AgentCapabilityBadge[] {
  if (!target) return [];
  const badges: AgentCapabilityBadge[] = [];
  if (target.capabilities.rasterImageInput) {
    badges.push({
      label: 'Vision',
      title: 'Can receive raster image input.',
      tone: 'default',
    });
  } else if (target.kind === 'api') {
    badges.push({
      label: 'Text only',
      title: 'Raster images are blocked unless the selected model is marked vision-capable.',
      tone: 'warning',
    });
  }
  if (target.kind === 'cli') {
    badges.push({
      label: 'CLI',
      title: 'Runs through a local CLI runtime.',
      tone: 'muted',
    });
  }
  if (target.capabilities.ownMcpConfig) {
    badges.push({
      label: 'Own MCP',
      title: 'Uses the runtime own MCP configuration.',
      tone: 'muted',
    });
  } else if (target.capabilities.projectMcpTools) {
    badges.push({
      label: 'Product MCP',
      title: 'Uses sber-designer project MCP tools.',
      tone: 'muted',
    });
  }
  return badges;
}

function resolveCliTarget(
  active: { provider: string; model: string },
  runtimeKind: Exclude<AgentRuntimeKind, 'api'>,
  runtimeStatus: AgentRuntimeStatus | null,
): AgentModelTarget {
  const runtimeLabel = cliRuntimeLabel(runtimeKind);
  const fallbackCapabilities = fallbackCliAttachmentCapabilities(runtimeKind);
  const attachmentCapabilities = runtimeStatus?.capabilities ?? fallbackCapabilities;
  return {
    kind: 'cli',
    runtimeKind,
    provider: active.provider,
    model: active.model,
    label: fullAgentLabel({ kind: 'cli', providerLabel: runtimeLabel, model: active.model }),
    imageInputMode: attachmentCapabilities.imageInputMode,
    capabilities: {
      rasterImageInput: attachmentCapabilities.rasterImageInput,
      imageDeliveryMode: attachmentCapabilities.imageDeliveryMode ?? 'none',
      svgSourceInput: attachmentCapabilities.svgSourceInput,
      nativeFileInput: attachmentCapabilities.nativeFileInput,
      toolCalls: false,
      streaming: true,
      projectMcpTools: false,
      ownMcpConfig: attachmentCapabilities.usesOwnMcpConfig,
    },
  };
}

function runtimeStatusForKind(
  runtimeStatuses: readonly AgentRuntimeStatus[] | null | undefined,
  runtimeKind: Exclude<AgentRuntimeKind, 'api'>,
): AgentRuntimeStatus | null {
  return runtimeStatuses?.find((status) => status.kind === runtimeKind) ?? null;
}

function fallbackCliAttachmentCapabilities(
  runtimeKind: Exclude<AgentRuntimeKind, 'api'>,
): Pick<
  AgentRuntimeStatus['capabilities'],
  | 'imageInputMode'
  | 'imageDeliveryMode'
  | 'rasterImageInput'
  | 'svgSourceInput'
  | 'nativeFileInput'
  | 'usesOwnMcpConfig'
> {
  if (runtimeKind === 'codex') {
    return {
      imageInputMode: 'cli-native',
      imageDeliveryMode: 'cli_native_arg',
      rasterImageInput: true,
      svgSourceInput: true,
      nativeFileInput: true,
      usesOwnMcpConfig: true,
    };
  }
  return {
    imageInputMode: 'cli-files-warning',
    imageDeliveryMode:
      runtimeKind === 'claude-code' || runtimeKind === 'kimi' || runtimeKind === 'gigacode'
        ? 'prompt_path'
        : 'none',
    rasterImageInput: false,
    svgSourceInput: true,
    nativeFileInput: false,
    usesOwnMcpConfig: true,
  };
}

function cliRuntimeKindForProvider(provider: string): Exclude<AgentRuntimeKind, 'api'> | null {
  if (provider === CODEX_RUNTIME_PROVIDER_ID) return 'codex';
  if (provider === OPENCODE_RUNTIME_PROVIDER_ID) return 'opencode';
  if (provider === CLAUDE_CODE_RUNTIME_PROVIDER_ID) return 'claude-code';
  if (provider === KIMI_RUNTIME_PROVIDER_ID) return 'kimi';
  if (provider === GIGACODE_RUNTIME_PROVIDER_ID) return 'gigacode';
  return null;
}

function cliRuntimeLabel(runtimeKind: Exclude<AgentRuntimeKind, 'api'>): string {
  if (runtimeKind === 'codex') return 'Codex CLI';
  if (runtimeKind === 'opencode') return 'OpenCode';
  if (runtimeKind === 'kimi') return 'Kimi Code CLI';
  if (runtimeKind === 'gigacode') return 'GigaCode CLI';
  return 'Claude Code CLI';
}

function modelImageInputFailureDetail(
  imageInput:
    | NonNullable<
        NonNullable<SberDesignerConfig['provider'][string]['models']>[string]['imageInput']
      >
    | undefined,
): string | null {
  if (!imageInput) return null;
  const transportBlocksNativeVision =
    imageInput.transport === 'text-only-with-ocr' || imageInput.transport === 'none';
  const verificationFailed = imageInput.verification?.startsWith('failed-') === true;
  if (!transportBlocksNativeVision && !verificationFailed) return null;
  const failure = imageInput.lastFailureMessage?.trim();
  return failure
    ? failure
    : 'The selected model has no verified native raster image transport in this provider adapter.';
}

function hasRasterImageAttachment(attachments: AgentTargetAttachment[]): boolean {
  return attachments.some((attachment) => {
    if (attachment.kind !== 'image') return false;
    const mime = normalizePromptImageMimeType(attachment.mimeType, attachment.name);
    return Boolean(mime && isPromptRasterImageMimeType(mime));
  });
}
