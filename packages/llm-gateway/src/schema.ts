/**
 * zod schema for sber-designer.json — the project-level config that
 * declares LLM providers, their models, the active default, and
 * (optionally) outbound MCP servers.
 *
 * Format inspired by opencode (`opencode.json`). See ADR-0005.
 */
import { z } from 'zod';

/** All provider type discriminators we natively support. */
export const PROVIDER_TYPES = ['openai-compatible', 'anthropic', 'mock', 'claude-code'] as const;

export type ProviderType = (typeof PROVIDER_TYPES)[number];

const ModelLimit = z
  .object({
    context: z.number().int().positive().optional(),
    output: z.number().int().positive().optional(),
  })
  .strict();

const ModelImageInput = z
  .object({
    transport: z
      .enum([
        'openai-image-url',
        'remote-image-url',
        'anthropic-image',
        'text-only-with-ocr',
        'none',
      ])
      .optional(),
    acceptsDataUrl: z.boolean().optional(),
    acceptsRemoteUrl: z.boolean().optional(),
    verifiedAt: z.string().optional(),
    verification: z
      .enum(['manual-smoke', 'provider-docs', 'unverified', 'failed-openai-image-url'])
      .optional(),
    lastFailureCode: z.string().min(1).optional(),
    lastFailureMessage: z.string().min(1).optional(),
  })
  .strict();

const ModelEntry = z
  .object({
    name: z.string().min(1).optional(),
    /**
     * Provider-side model id. Defaults to the key under `models`.
     * Useful when display key differs from API id.
     */
    id: z.string().optional(),
    limit: ModelLimit.optional(),
    /** Explicitly set false for text-only models so callers can reject image prompts early. */
    vision: z.boolean().optional(),
    /** Optional transport metadata for raster image inputs on vision-capable models. */
    imageInput: ModelImageInput.optional(),
  })
  .strict();

const ProviderOptions = z
  .object({
    baseURL: z.string().url().optional(),
    apiKey: z.string().optional(),
    headers: z.record(z.string(), z.string()).optional(),
  })
  .strict();

const ProviderEntry = z
  .object({
    type: z.enum(PROVIDER_TYPES),
    name: z.string().min(1),
    description: z.string().optional(),
    options: ProviderOptions.optional(),
    models: z.record(z.string(), ModelEntry).optional(),
  })
  .strict();

const ToolSafety = z.enum(['read', 'write', 'external-effect', 'disk-write']);

const McpConnectTool = z
  .object({
    tool: z.string().min(1),
    requiresChannel: z.boolean().optional(),
    channelRunParam: z.string().min(1).optional(),
  })
  .strict();

const McpCommonFields = {
  enabled: z.boolean().default(true),
  description: z.string().optional(),
  allowedTools: z.array(z.string().min(1)).optional(),
  disabledTools: z.array(z.string().min(1)).optional(),
  timeoutMs: z.number().int().positive().default(30_000),
  requiresApproval: z.boolean().optional(),
  connectTool: McpConnectTool.optional(),
  toolSafety: z.record(z.string(), ToolSafety).optional(),
  diskWriteRoot: z.string().min(1).optional(),
  healthTools: z.array(z.string().min(1)).optional(),
};

const McpStreamableHttpFields = {
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
  ...McpCommonFields,
};

const McpServerEntry = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('stdio'),
      command: z.string().min(1),
      args: z.array(z.string()).default([]),
      cwd: z.string().min(1).optional(),
      env: z.record(z.string(), z.string()).optional(),
      envFile: z.union([z.string().min(1), z.array(z.string().min(1))]).optional(),
      ...McpCommonFields,
    })
    .strict(),
  z
    .object({
      type: z.literal('http'),
      ...McpStreamableHttpFields,
    })
    .strict(),
  z
    .object({
      type: z.literal('streamable-http'),
      ...McpStreamableHttpFields,
    })
    .strict(),
  z
    .object({
      type: z.literal('streamableHttp'),
      ...McpStreamableHttpFields,
    })
    .strict(),
  z
    .object({
      type: z.literal('remote'),
      ...McpStreamableHttpFields,
    })
    .strict(),
]);

const AgentDefault = z
  .object({
    provider: z.string().min(1),
    model: z.string().min(1),
  })
  .strict();

const AgentRestrict = z
  .object({
    enabled: z.boolean().default(false),
    providers: z.array(z.string()).optional(),
    models: z.array(z.string()).optional(),
  })
  .strict();

const AgentAttachments = z
  .object({
    svgMaxBytes: z
      .number()
      .int()
      .positive()
      .max(50 * 1024 * 1024)
      .optional(),
  })
  .strict();

const AgentConcurrency = z
  .object({
    maxTotalRuns: z.number().int().positive().max(50).optional(),
    maxApiRuns: z.number().int().positive().max(50).optional(),
    maxCliRuns: z.number().int().positive().max(50).optional(),
    sameScreenPolicy: z.enum(['reject', 'queue']).optional(),
    sameFilePolicy: z.enum(['reject', 'queue']).optional(),
  })
  .strict();

const AgentContextBudget = z
  .object({
    warningTokens: z.number().int().positive().max(2_000_000).optional(),
    degradePromptBytes: z.number().int().positive().max(1_000_000).optional(),
    blockPromptBytes: z.number().int().positive().max(1_000_000).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.degradePromptBytes === undefined ||
      value.blockPromptBytes === undefined ||
      value.degradePromptBytes <= value.blockPromptBytes,
    {
      message: 'agent.contextBudget.degradePromptBytes must be <= blockPromptBytes',
      path: ['degradePromptBytes'],
    },
  );

const AgentSection = z
  .object({
    default: AgentDefault,
    directionPicker: z.enum(['off', 'screens', 'always']).optional(),
    restrict: AgentRestrict.optional(),
    attachments: AgentAttachments.optional(),
    concurrency: AgentConcurrency.optional(),
    contextBudget: AgentContextBudget.optional(),
  })
  .strict();

export const SberDesignerConfigSchema = z
  .object({
    $schema: z.string().optional(),
    /**
     * JSON has no comments and these files are hand-edited, so a top-level
     * `"//"` string is accepted and ignored (0136 R07). Additive and
     * ignorable, per the agent-kit compatibility rule in CLAUDE.md.
     */
    '//': z.string().optional(),
    agent: AgentSection,
    provider: z.record(z.string(), ProviderEntry),
    mcpServers: z.record(z.string(), McpServerEntry).default({}),
  })
  .strict();

export type SberDesignerConfig = z.infer<typeof SberDesignerConfigSchema>;
export type ProviderEntryT = z.infer<typeof ProviderEntry>;
export type McpServerEntryT = z.infer<typeof McpServerEntry>;
export type ModelEntryT = z.infer<typeof ModelEntry>;
