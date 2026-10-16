import { resolveScreenReadinessProfile } from '@sber-designer/shared-types';
import { definedJson } from './defined-json';
/**
 * `.sdproj` schema (0136 R12 — extracted from project-store.ts).
 *
 * The shape of a stored project, and nothing else: no I/O, no in-memory
 * state, no mutations. Keeping it separate means a migration or a new
 * project field is a change to one file, and that persistence can validate
 * without pulling the store in.
 *
 * Every schema here is `.strict()`: an unknown key in a `.sdproj` is a load
 * failure, which project-persistence reports as "corrupt" rather than
 * silently dropping data.
 */
import { z } from 'zod';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function sanitizeAssistantSessionMetadata(
  value: unknown,
): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  const metadata: Record<string, unknown> = { ...value };

  for (const key of NON_EMPTY_STRING_RUN_METADATA_KEYS) {
    sanitizeRunMetadataString(metadata, key, { requireNonEmpty: true });
  }
  for (const key of STRING_OR_NULL_RUN_METADATA_KEYS) {
    sanitizeRunMetadataString(metadata, key, { requireNonEmpty: false });
  }

  if (Object.prototype.hasOwnProperty.call(metadata, 'lastRunStatus')) {
    const status = metadata.lastRunStatus;
    if (
      status !== null &&
      (typeof status !== 'string' || !ASSISTANT_RUN_STATUS_VALUES.has(status))
    ) {
      delete metadata.lastRunStatus;
    }
  }

  return metadata;
}

export function sanitizeRunMetadataString(
  metadata: Record<string, unknown>,
  key: string,
  options: { requireNonEmpty: boolean },
): void {
  if (!Object.prototype.hasOwnProperty.call(metadata, key)) return;
  const value = metadata[key];
  if (value === null) return;
  if (typeof value === 'string' && (!options.requireNonEmpty || value.trim().length > 0)) {
    return;
  }
  delete metadata[key];
}

export const ScreenHealthSchema = z
  .object({
    status: z.enum(['ok', 'broken', 'needs-review']),
    reason: z.string().min(1),
    source: z.enum(['sync', 'failed-run', 'validation', 'fallback', 'manual']).optional(),
    updatedAt: z.number().int().nonnegative().optional(),
  })
  .strict();

export const ScreenSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    createdAt: z.number().int().nonnegative().optional(),
    updatedAt: z.number().int().nonnegative().optional(),
    kind: z.enum(['story', 'page']),
    surface: z.enum(['page', 'modal']).optional(),
    storyId: z.string().optional(),
    filePath: z.string().optional(),
    implementationFilePath: z.string().optional(),
    thumbnail: z.string().optional(),
    description: z.string().optional(),
    health: ScreenHealthSchema.optional(),
    folder: z.string().optional(),
    template: z
      .object({ id: z.string().min(1), source: z.enum(['built-in', 'project']) })
      .strict()
      .optional(),
    position: z.object({ x: z.number(), y: z.number() }).strict().optional(),
  })
  .strict()
  .transform(definedJson);

const FlowEdgeSchema = z
  .object({
    id: z.string().min(1),
    fromScreenId: z.string().min(1),
    toScreenId: z.string().min(1),
    presentation: z.enum(['navigate', 'overlay']).optional(),
    trigger: z.discriminatedUnion('kind', [
      z
        .object({
          kind: z.literal('click'),
          selector: z.string().optional(),
          label: z.string().optional(),
        })
        .strict(),
      z.object({ kind: z.literal('link'), href: z.string() }).strict(),
      z.object({ kind: z.literal('on-mount') }).strict(),
      z.object({ kind: z.literal('manual'), label: z.string().optional() }).strict(),
    ]),
    label: z.string().optional(),
  })
  .strict();

const FlowViewSchema = z
  .object({
    previewSize: z.enum(['compact', 'frames']).optional(),
    showConnections: z.boolean().optional(),
    showDescriptions: z.boolean().optional(),
    hiddenScreenIds: z.array(z.string()).optional(),
    hiddenFolderNames: z.array(z.string()).optional(),
    hiddenEdgeIds: z.array(z.string()).optional(),
    previewViewport: z.object({ width: z.number(), height: z.number() }).strict().optional(),
    previewCaptures: z
      .array(
        z
          .object({
            screenId: z.string().min(1),
            imagePath: z.string().min(1),
            viewport: z.object({ width: z.number(), height: z.number() }).strict(),
            capturedAt: z.number().int().nonnegative(),
            sourceFingerprint: z.string().min(1),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

const CommentMessageSchema = z
  .object({
    id: z.string().min(1),
    authorName: z.string().min(1),
    body: z.string(),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative().optional(),
  })
  .strict();

const CommentThreadSchema = z
  .object({
    id: z.string().min(1),
    screenId: z.string().min(1),
    anchor: z.object({ x: z.number(), y: z.number() }).strict(),
    selector: z.string().optional(),
    elementText: z.string().optional(),
    status: z.enum(['open', 'resolved']),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    messages: z.array(CommentMessageSchema),
  })
  .strict();

const PersistedAssistantMessageSchema = z
  .object({
    id: z.string().min(1),
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.string(),
    createdAt: z.string().min(1),
    attachments: z
      .array(
        z
          .object({
            id: z.string().min(1),
            name: z.string().min(1),
            mimeType: z.string(),
            size: z.number().int().nonnegative(),
            kind: z.enum(['image', 'text']),
          })
          .strict(),
      )
      .optional(),
    toolCalls: z
      .array(
        z
          .object({
            id: z.string().min(1),
            name: z.string().min(1),
            arguments: z.string(),
          })
          .strict(),
      )
      .optional(),
    meta: z
      .object({
        provider: z.string().min(1).optional(),
        model: z.string().min(1).optional(),
        sessionMode: z.enum(['ask', 'plan', 'design']).optional(),
      })
      .strict()
      .optional(),
    contextEligible: z.boolean().optional(),
    external: z.boolean().optional(),
    runManifestId: z.string().optional(),
    tokenUsage: z
      .object({
        totalTokens: z.number().int().nonnegative().optional(),
        inputTokens: z.number().int().nonnegative().optional(),
        outputTokens: z.number().int().nonnegative().optional(),
      })
      .strict()
      .optional(),
    toolName: z.string().optional(),
    toolCallId: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict();

const ASSISTANT_RUN_STATUS_VALUES = new Set([
  'running',
  'complete',
  'failed',
  'needs_review',
  'cancelled',
  'preflight_rejected',
]);

const NON_EMPTY_STRING_RUN_METADATA_KEYS = [
  'lastAttemptId',
  'lastDebugLogPath',
  'lastRunManifestPath',
  'lastContinuationContextPath',
  'runtimeSessionId',
  'runtimeSessionRuntime',
  'runtimeSessionWorkspacePath',
  'runtimeSessionUpdatedAt',
] as const;

const STRING_OR_NULL_RUN_METADATA_KEYS = [
  'lastRunSummary',
  'lastRunErrorCode',
  'runtimeSessionModel',
] as const;

const AssistantSessionMetadataSchema = z.preprocess(
  sanitizeAssistantSessionMetadata,
  z.record(z.unknown()).optional(),
);

const AssistantSessionSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    titleSource: z.enum(['user', 'llm', 'fallback']).optional(),
    primaryScreenId: z.string().min(1),
    linkedScreenIds: z.array(z.string().min(1)).optional(),
    status: z.enum(['active', 'archived']),
    sessionMode: z.enum(['ask', 'plan', 'design']).optional(),
    contextMode: z.enum(['clean', 'current-task', 'full-thread']).optional(),
    summary: z.string().optional(),
    summaryUpdatedAt: z.string().min(1).optional(),
    lastSummarizedMessageId: z.string().optional(),
    contextCutoffMessageId: z.string().optional(),
    linkedRunManifestIds: z.array(z.string().min(1)).optional(),
    // Additive run-provenance metadata must never hard-block a project save:
    // it is written by the web store and is server-opaque provenance. Keep
    // known fields safe for backend readers, but tolerate nullable/unknown data.
    metadata: AssistantSessionMetadataSchema,
    messages: z.array(PersistedAssistantMessageSchema),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
    archivedAt: z.string().min(1).optional(),
  })
  .strict();

const AssistantStateSchema = z
  .object({
    storageVersion: z.number().int().positive().optional(),
    activeSessionByScreenId: z.record(z.string().min(1)).optional(),
    sessions: z.array(AssistantSessionSchema).default([]),
  })
  .strict();

const ScreenDesignExportTemplateSchema = z
  .object({
    path: z.string().min(1),
    fileName: z.string().min(1),
    uploadedAt: z.number().int().nonnegative(),
  })
  .strict();

const ProjectMcpToolOverrideSchema = z
  .object({
    enabled: z.boolean(),
    updatedAt: z.number().int().nonnegative(),
  })
  .strict();

const ProjectMcpToolSelectionSchema = z
  .object({
    mode: z.literal('explicit'),
    selectedTools: z.array(z.string().min(1)).min(1).max(64),
    updatedAt: z.number().int().nonnegative(),
  })
  .strict();

const ProjectMcpServerOverrideSchema = z
  .object({
    enabled: z.boolean(),
    configHash: z.string().min(1),
    updatedAt: z.number().int().nonnegative(),
    toolOverrides: z.record(ProjectMcpToolOverrideSchema).optional(),
    toolSelection: ProjectMcpToolSelectionSchema.optional(),
  })
  .strict();

const ProjectMcpSettingsSchema = z
  .object({
    serverOverrides: z.record(ProjectMcpServerOverrideSchema).optional(),
  })
  .strict();

const ProjectAssetPackSettingsSchema = z
  .object({
    localSourcePath: z.string().min(1).optional(),
    kinds: z
      .array(z.enum(['icons', 'illustrations']))
      .min(1)
      .optional(),
    updatedAt: z.number().int().nonnegative().optional(),
  })
  .strict();

const ProjectIconSourceSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    kind: z.literal('local-folder'),
    families: z
      .array(z.enum(['icons', 'illustrations']))
      .min(1)
      .optional(),
    mode: z.enum(['workspace', 'external']).optional(),
    localPath: z.string().min(1).optional(),
    workspacePath: z.string().min(1).optional(),
    updatedAt: z.number().int().nonnegative().optional(),
  })
  .strict();

const ProjectExternalAssetSourcesSchema = z
  .object({
    icons: z.array(ProjectIconSourceSchema).optional(),
  })
  .strict();

const VisualEditingPolicySchema = z
  .object({
    tokenMode: z.enum(['prefer-tokens', 'strict-tokens', 'allow-raw']).optional(),
    allowInlineStyles: z.boolean().optional(),
    allowClassNameEdits: z.boolean().optional(),
    allowComponentSwaps: z.boolean().optional(),
  })
  .strict();

const TaskTrackerConfigSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('linear'),
      projectUrl: z.string().min(1),
      labelFilter: z.string().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('jira'),
      projectUrl: z.string().min(1),
      projectKey: z.string().optional(),
    })
    .strict(),
]);

const ProjectGitSessionSchema = z
  .object({
    provider: z.enum(['github', 'gitlab', 'bitbucket', 'unknown']),
    remote: z.string().min(1),
    remoteUrl: z.string(),
    baseBranch: z.string().min(1),
    workingBranch: z.string().min(1),
    status: z.enum(['branch', 'review-open', 'merged', 'closed', 'stale']).optional(),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    prUrl: z.string().optional(),
    compareUrl: z.string().optional(),
    prNumber: z.string().optional(),
    commitSha: z.string().optional(),
    pushedAt: z.number().int().nonnegative().optional(),
    autoPush: z.boolean().optional(),
  })
  .strict();

const ScreenCreationSettingsSchema = z
  .object({
    lastFolder: z.string().min(1).optional(),
  })
  .strict();

const ScreensPanelSettingsSchema = z
  .object({
    collapsedFolderNames: z.array(z.string().min(1)).optional(),
    htmlDesignSystemDistillNudgeDismissedKey: z.string().min(1).optional(),
  })
  .strict();

const ScreenReadinessCategorySelectionSchema = z
  .object({
    sourceIntegrity: z.boolean().optional(),
    renderHealth: z.boolean().optional(),
    designSystemFit: z.boolean().optional(),
    dataHonesty: z.boolean().optional(),
    operationalUxStates: z.boolean().optional(),
    accessibilityBasics: z.boolean().optional(),
    responsiveVisualSanity: z.boolean().optional(),
    designModeCompatibility: z.boolean().optional(),
  })
  .strict();

const ScreenReadinessProfileSchema = z
  .object({
    enabled: z.boolean(),
    profile: z.enum(['standard', 'strict', 'custom']),
    categories: ScreenReadinessCategorySelectionSchema,
  })
  .strict()
  .transform((profile) => resolveScreenReadinessProfile(definedJson(profile)));

const ProjectPostCheckSettingsSchema = z
  .object({
    screenReadiness: ScreenReadinessProfileSchema.optional(),
  })
  .strict();

const ProjectGenerationDefaultsSchema = z
  .object({
    directionPicker: z.boolean().optional(),
    wireframe: z.boolean().optional(),
    designJury: z.boolean().optional(),
  })
  .strict();

const ProjectAgentMemorySettingsSchema = z
  .object({
    styleMemoryEnabled: z.boolean().optional(),
  })
  .strict();

export const ProjectSchema = z
  .object({
    version: z.literal(1),
    name: z.string().min(1),
    workspacePath: z.string().min(1),
    projectKind: z.enum(['react-vite', 'html-first']).optional(),
    screens: z.array(ScreenSchema).default([]),
    screenCreation: ScreenCreationSettingsSchema.optional(),
    screensPanel: ScreensPanelSettingsSchema.optional(),
    postChecks: ProjectPostCheckSettingsSchema.optional(),
    generationDefaults: ProjectGenerationDefaultsSchema.optional(),
    flow: z.array(FlowEdgeSchema).default([]),
    flowView: FlowViewSchema.optional(),
    comments: z.array(CommentThreadSchema).optional(),
    assistant: AssistantStateSchema.optional(),
    projectInstructions: z.string().optional(),
    agentMemory: ProjectAgentMemorySettingsSchema.optional(),
    // Deprecated legacy field. Accepted so old .sdproj files still load, but ignored by UI/API.
    agentDefault: z
      .object({ provider: z.string().min(1), model: z.string().min(1) })
      .strict()
      .optional(),
    taskTracker: TaskTrackerConfigSchema.optional(),
    agentAutoPr: z.boolean().optional(),
    gitSession: ProjectGitSessionSchema.optional(),
    screenDesignExportTemplate: ScreenDesignExportTemplateSchema.optional(),
    assetPacks: ProjectAssetPackSettingsSchema.optional(),
    externalAssetSources: ProjectExternalAssetSourcesSchema.optional(),
    visualEditing: VisualEditingPolicySchema.optional(),
    mcpSettings: ProjectMcpSettingsSchema.optional(),
    description: z.string().optional(),
    savedAt: z.number().int().nonnegative().optional(),
  })
  .strict()
  .transform(definedJson);
