import type { ComponentCatalog } from '@sber-designer/shared-types';
import type { DesignIndexContext } from '@sber-designer/design-indexer';

export type ProjectIndexJobStage =
  | 'queued'
  | 'scanning'
  | 'enriching'
  | 'writing'
  | 'validating'
  | 'complete'
  | 'failed';

export type ProjectIndexJobStatus = 'queued' | 'running' | 'complete' | 'failed';

export interface ProjectIndexJobProgressEvent {
  stage: ProjectIndexJobStage;
  message: string;
  createdAt: number;
}

export interface ProjectIndexJob {
  id: string;
  workspaceRoot: string;
  projectName: string;
  status: ProjectIndexJobStatus;
  stage: ProjectIndexJobStage;
  enrich: boolean;
  createdAt: number;
  updatedAt: number;
  progress: ProjectIndexJobProgressEvent[];
  changedFiles: string[];
  context: DesignIndexContext | null;
  error: string | null;
}

export interface ProjectIndexJobInput {
  workspaceRoot: string;
  projectName: string;
  canvasUrl?: string | null;
  catalog?: ComponentCatalog | null;
  enrich?: boolean;
}
