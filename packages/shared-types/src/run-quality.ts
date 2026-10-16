import type { ScreenReadinessCategoryId, ScreenReadinessCategoryStatus } from './screen-readiness';

export type RunQualityTerminalStatus = 'complete' | 'needs_review' | 'failed' | 'cancelled';

export interface RunQualitySummary {
  version: 1;
  terminalStatus: RunQualityTerminalStatus;
  repair: {
    attempted: boolean;
    attempts: number;
    succeeded: boolean | null;
  };
  remainingFindings: {
    blocking: number;
    shouldFix: number;
    advisory: number;
  };
  skippedChecks: string[];
  craft: {
    status: 'passed' | 'findings' | 'blocked' | 'missing';
    categories: Array<{
      id: ScreenReadinessCategoryId;
      status: ScreenReadinessCategoryStatus;
    }>;
  };
  designMode: {
    status: 'compatible' | 'needs-review' | 'missing' | 'unavailable';
  };
  render: {
    status: 'confirmed' | 'pending' | 'failed' | 'unavailable';
    reason?: string;
  };
  jury: {
    status: 'passed' | 'needs_review' | 'unavailable' | 'not_run';
    rounds: number;
    revisionAttempted: boolean;
  };
  redesignFidelity?: RunRedesignFidelitySummary;
}

export interface RunRedesignFidelitySummary {
  status: 'passed' | 'failed' | 'unavailable';
  changedComposition: boolean;
  missingSections: string[];
  missingFacts: string[];
  missingActions: string[];
  missingStates: string[];
  missingRoutes: string[];
}

export interface AgentRunReviewAnnotation {
  version: 1;
  runId: string;
  reviewer: string;
  reviewedAt: string;
}
