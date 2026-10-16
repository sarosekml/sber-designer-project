/** Project-owned generation history presented for one screen (0129). */
import type { AssistantSessionMode } from './assistant-history';

export interface DatedValue {
  value: number;
  source: 'recorded' | 'estimated';
}

export interface ScreenRunAttachmentMeta {
  kind: 'image' | 'text';
  name: string;
  documentKind?: 'html' | 'css' | 'markdown' | 'json' | 'yaml' | 'plain';
  mimeType: string;
  size: number;
  sha256: string;
}

export interface ScreenGenerationRunEntry {
  runId: string;
  startedAt: string;
  completedAt: string;
  status: 'complete' | 'failed' | 'needs_review' | 'cancelled';
  route: 'chat' | 'chat-stream' | 'manual';
  sessionMode: AssistantSessionMode;
  provider: string | null;
  model: string | null;
  runtimeKind: 'api' | 'cli' | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costUsd?: number;
  attribution: 'active-screen' | 'receipt' | 'changed-files';
  logs: {
    runDir: string;
    attemptLog?: string;
    debugLog?: string;
    available: boolean;
  };
  attachments: ScreenRunAttachmentMeta[];
}

export interface ScreenGenerationInfo {
  screen: {
    id: string;
    name: string;
    folder?: string;
    kind: 'story' | 'page';
    /** Screen surface (0132). Absent reads as `page`; explicit so this route's own projection carries it. */
    surface?: 'page' | 'modal';
    filePath?: string;
    implementationFilePath?: string;
    createdAt: DatedValue | null;
    updatedAt: DatedValue | null;
  };
  totals: {
    runs: number;
    /** Null when no attributed run recorded this counter; never coerce missing usage to zero. */
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
    costUsd?: number;
    runsWithoutTokenData: number;
  };
  runs: ScreenGenerationRunEntry[];
  activeRun?: {
    runId: string;
    startedAt: number;
    provider: string;
    model: string;
    sessionMode: AssistantSessionMode;
  };
}
