import type { AssistantTokenUsage } from './assistant-history';

export type DesignJuryPolicy = 'required' | 'opt-in' | 'opt-out';

export type DesignJuryRole =
  | 'layout_hierarchy'
  | 'brief_fit'
  | 'tokens_consistency'
  | 'accessibility'
  | 'copy_language';

export interface DesignJuryRoleScore {
  role: DesignJuryRole;
  score: number;
  summary: string;
  mustFix: string[];
  evidence: string[];
}

export interface DesignJuryRound {
  round: number;
  roles: DesignJuryRoleScore[];
  composite: number;
  threshold: number;
  passed: boolean;
  usage?: AssistantTokenUsage;
}

export interface DesignJuryResult {
  status: 'passed' | 'needs_review';
  rounds: DesignJuryRound[];
  juryComposite: number;
  revisionAttempted: boolean;
  usage?: AssistantTokenUsage;
}
