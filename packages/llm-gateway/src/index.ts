/**
 * @sber-designer/llm-gateway — public surface.
 *
 * Usage:
 *   import { createGateway, parseConfig } from '@sber-designer/llm-gateway';
 *   const cfg = parseConfig(JSON.parse(await fs.readFile('sber-designer.json', 'utf8')));
 *   const gateway = createGateway(cfg);
 *   const reply = await gateway.chat({ messages: [{ role: 'user', content: 'Hi' }] });
 *
 * See ADR-0005.
 */
import type { ChatRequest, ChatResponse, LlmGateway } from './chat';
import { listVisibleModels } from './config';
import type { SberDesignerConfig } from './schema';
import { anthropicChat } from './providers/anthropic';
import { anthropicChatStream } from './providers/anthropic-stream';
import { mockChat } from './providers/mock';
import { mockChatStream } from './providers/mock-stream';
import { openAiCompatibleChat } from './providers/openai-compatible';
import { openAiCompatibleChatStream } from './providers/openai-compatible-stream';
import { claudeCodeBridgeChat } from './providers/claude-code-bridge';
import type { ChatStreamEvent } from './stream';

export type {
  ChatContent,
  ChatContentPart,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  ChatRole,
  FinishReason,
  LlmGateway,
  ToolCall,
  ToolChoice,
  ToolSpec,
} from './chat';
export type { ChatStreamEvent, ChatStreamer } from './stream';
export type {
  ModelEntryT,
  ProviderEntryT,
  ProviderType,
  SberDesignerConfig,
  McpServerEntryT,
} from './schema';
export type { ProviderErrorCategory, ProviderErrorInfo, ProviderSecrets } from './provider-error';
export {
  ProviderError,
  analyzeProviderHttpFailure,
  describeChatError,
  networkFailureInfo,
  providerHttpErrorMessage,
  providerSecretsOf,
  providerTransportError,
  redactProviderSecrets,
} from './provider-error';
export { SberDesignerConfigSchema, PROVIDER_TYPES } from './schema';
export {
  parseConfig,
  listVisibleModels,
  BUILTIN_DEFAULTS,
  DEFAULT_PROMPT_ATTACHMENT_LIMITS,
  DEFAULT_AGENT_CONCURRENCY_LIMITS,
  agentConcurrencyFromConfig,
  agentContextBudgetFromConfig,
  directionPickerModeFromConfig,
  shouldPresentDirectionPicker,
  promptAttachmentLimitsFromConfig,
} from './config';
export type {
  AgentConcurrencyLimits,
  AgentContextBudgetPolicy,
  AgentDirectionPickerMode,
  PromptAttachmentLimits,
} from './config';

export interface CreateGatewayOptions {
  /** Override the active provider/model for this instance. */
  override?: { provider: string; model: string };
  /** Inject `fetch` (e.g. for tests, proxies, instrumentation). */
  fetchImpl?: typeof fetch;
}

export function createGateway(
  config: SberDesignerConfig,
  opts: CreateGatewayOptions = {},
): LlmGateway {
  const active = opts.override ?? config.agent.default;
  const fetchImpl = opts.fetchImpl ?? fetch;

  function resolveProvider(req: ChatRequest) {
    const providerKey = active.provider;
    void req;
    const provider = config.provider[providerKey];
    if (!provider) {
      throw new Error(`Active provider "${providerKey}" not found in config.`);
    }
    return { provider, providerKey };
  }

  return {
    active,
    listVisibleModels: () => listVisibleModels(config),
    chatStream(req: ChatRequest): AsyncIterable<ChatStreamEvent> {
      const { provider, providerKey } = resolveProvider(req);
      const resolvedActive = { provider: providerKey, model: req.model ?? active.model };
      switch (provider.type) {
        case 'mock':
          return mockChatStream(req, resolvedActive);
        case 'openai-compatible':
          return openAiCompatibleChatStream(req, provider, resolvedActive, fetchImpl);
        case 'anthropic':
          return anthropicChatStream(req, provider, resolvedActive, fetchImpl);
        case 'claude-code': {
          // Bridge providers don't speak chat at all — surface the same
          // error a non-streaming call would, wrapped in a stream event.
          async function* errorStream(): AsyncIterable<ChatStreamEvent> {
            yield {
              type: 'error',
              message: `Provider "${resolvedActive.provider}" is a Claude Code bridge — chat() / chatStream() must not be called for it.`,
            };
          }
          return errorStream();
        }
        default: {
          const exhaustive: never = provider.type;
          throw new Error(`Unknown provider type: ${String(exhaustive)}`);
        }
      }
    },
    async chat(req: ChatRequest): Promise<ChatResponse> {
      const providerKey = req.model
        ? // when caller passes `model`, we still use the active provider —
          // model-only switching across providers is not supported.
          active.provider
        : active.provider;
      const provider = config.provider[providerKey];
      if (!provider) {
        throw new Error(`Active provider "${providerKey}" not found in config.`);
      }
      const resolvedActive = { provider: providerKey, model: req.model ?? active.model };
      switch (provider.type) {
        case 'mock':
          return mockChat(req, resolvedActive);
        case 'openai-compatible':
          return openAiCompatibleChat(req, provider, resolvedActive, fetchImpl);
        case 'anthropic':
          return anthropicChat(req, provider, resolvedActive, fetchImpl);
        case 'claude-code':
          return claudeCodeBridgeChat(req, resolvedActive);
        default: {
          const exhaustive: never = provider.type;
          throw new Error(`Unknown provider type: ${String(exhaustive)}`);
        }
      }
    },
  };
}
