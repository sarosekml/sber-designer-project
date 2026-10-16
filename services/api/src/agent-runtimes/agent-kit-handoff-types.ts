/**
 * Shapes and limits shared by the handoff modules (0136 R12 — extracted from
 * agent-kit-handoff.ts).
 *
 * The input the caller assembles, the result the runtime receives, and the
 * byte/character ceilings the budget enforces. No behaviour, so every part of
 * the handoff can depend on this without depending on each other.
 */
import type { ComponentDescriptionMapEntry } from '@sber-designer/design-indexer';
import {
  type AgentKitSource,
  type HtmlDesignSystemSources,
  type PromptAttachmentEvidence,
  type ScreenStructurePlan,
} from '@sber-designer/shared-types';
import { type GenerationOptions } from '../generation-mode';
import type { LoadedAgentKit } from '../agent-kit/loader';
import { type TaskRelevantComponentPack } from '../component-intelligence/component-pack';
import type { EditorState } from '../state-store';

export type ExternalRuntimeKind = 'opencode' | 'codex' | 'claude-code' | 'kimi' | 'gigacode';

export interface ExternalRuntimeProjectIndexContext {
  status: 'missing' | 'valid' | 'stale' | 'warning' | 'error';
  stale: boolean;
  promptSummary: string;
  freshness?: string;
  nextAction?: string;
  counts?: Record<string, number | undefined>;
  descriptionMap?: ComponentDescriptionMapEntry[];
  htmlDesignSystem?: HtmlDesignSystemSources;
  artifacts?: string[];
  warnings?: string[];
}

export interface BuildAgentKitHandoffInput {
  runtime: ExternalRuntimeKind;
  runtimeLabel: string;
  model: string | null;
  messages: { role: string; content: unknown }[];
  taskHistorySummary?: string | null;
  state: EditorState;
  kit: LoadedAgentKit;
  primaryAgentName?: string | undefined;
  requestedAgentName?: string | undefined;
  agentRunId: string | null;
  maxPromptBytes?: number;
  projectIndex?: ExternalRuntimeProjectIndexContext | null;
  componentPack?: TaskRelevantComponentPack | null;
  promptAttachments?: PromptAttachmentEvidence[];
  runtimeWarnings?: string[];
  generation?: GenerationOptions | null;
  previousStableContext?: AgentKitPreviousStableContext | null;
  runtimeSession?: AgentKitRuntimeSessionContext | null;
  projectStyleMemory?: string | null;
  screenStructurePlan?: ScreenStructurePlan | null;
}

export interface AgentKitPreviousStableContext {
  digest: string;
  contextBundlePath?: string | null;
  runManifestPath?: string | null;
  source?: 'metadata' | 'message_scan';
}

export interface AgentKitRuntimeSessionContext {
  mode: 'new' | 'resume';
  runtime: ExternalRuntimeKind;
  sessionId?: string | null;
  model?: string | null;
  workspacePath?: string | null;
}

export interface AgentKitHandoffInventoryItem {
  name: string;
  description: string;
  whenToUse: string;
  path: string;
  source: AgentKitSource;
}

export interface AgentKitHandoffKnowledgeItem {
  id: string;
  description: string;
  path: string;
  source: AgentKitSource;
}

export interface AgentKitHandoffResult {
  prompt: string;
  agentName: string;
  skillInventory: AgentKitHandoffInventoryItem[];
  knowledgeInventory: AgentKitHandoffKnowledgeItem[];
  includedKnowledge: string[];
  includedTaskHistorySummary: boolean;
  omittedSections: { section: string; reason: string }[];
  estimatedBytes: number;
  runtimeWarnings: string[];
  stableContextDigest: string;
  stableContextBytes: number;
  kitStableDigest: string;
  kitStableBytes: number;
  taskBytes: number;
  stableContextReuse: 'full' | 'reference';
  resumeUsed: boolean;
  deltaBytes?: number;
  runtimeSessionId?: string;
  resumeFallbackPrompt?: string;
  previousStableContextDigest?: string;
  previousStableContextBundlePath?: string;
  previousStableContextSource?: AgentKitPreviousStableContext['source'];
  componentPack?: TaskRelevantComponentPack;
  screenStructurePlan?: ScreenStructurePlan;
}

export const TASK_SUMMARY_PREFIX = 'Active assistant task summary:';
export const DEFAULT_MAX_PROMPT_BYTES = 80_000;
export const MAX_TASK_SUMMARY_CHARS = 1_200;
export const MAX_SECTION_CHARS = 20_000;
export const PROMPT_SECTION_DELIMITER = '\n\n---\n\n';

export const PROTECTED_PROMPT_SECTION_LABELS = new Set([
  'priority contract',
  'write checkpoint for active screens',
  'runtime identity',
  'runtime contract',
  'delta contract',
  'runtime session resume',
  'generation mode',
  'design brief',
  'editor context',
  'active target delta',
  'selected target (hard contract)',
  'html design-system apply context',
  'user request',
  'output contract',
]);
