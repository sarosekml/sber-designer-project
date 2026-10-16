import { randomUUID } from 'node:crypto';

import type {
  ProjectIndexJob,
  ProjectIndexJobInput,
  ProjectIndexJobProgressEvent,
  ProjectIndexJobStage,
  ProjectIndexJobStatus,
} from './job-types';

const jobs = new Map<string, ProjectIndexJob>();

export function createProjectIndexJob(input: ProjectIndexJobInput): ProjectIndexJob {
  const now = Date.now();
  const job: ProjectIndexJob = {
    id: `idxjob-${randomUUID()}`,
    workspaceRoot: input.workspaceRoot,
    projectName: input.projectName,
    status: 'queued',
    stage: 'queued',
    enrich: input.enrich ?? false,
    createdAt: now,
    updatedAt: now,
    progress: [progressEvent('queued', 'Project indexing job queued.', now)],
    changedFiles: [],
    context: null,
    error: null,
  };
  jobs.set(job.id, job);
  return job;
}

export function getProjectIndexJob(id: string): ProjectIndexJob | null {
  return jobs.get(id) ?? null;
}

export function findActiveProjectIndexJob(workspaceRoot: string): ProjectIndexJob | null {
  return (
    Array.from(jobs.values())
      .filter(
        (job) =>
          job.workspaceRoot === workspaceRoot &&
          (job.status === 'queued' || job.status === 'running'),
      )
      .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null
  );
}

export function listProjectIndexJobs(): ProjectIndexJob[] {
  return Array.from(jobs.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export function clearProjectIndexJobs(): void {
  jobs.clear();
}

export function advanceProjectIndexJob(
  id: string,
  stage: ProjectIndexJobStage,
  message: string,
): ProjectIndexJob {
  const job = requireJob(id);
  const now = Date.now();
  const status: ProjectIndexJobStatus =
    stage === 'complete' ? 'complete' : stage === 'failed' ? 'failed' : 'running';
  const updated: ProjectIndexJob = {
    ...job,
    stage,
    status,
    updatedAt: now,
    progress: [...job.progress, progressEvent(stage, message, now)],
  };
  jobs.set(id, updated);
  return updated;
}

export function updateProjectIndexJob(
  id: string,
  patch: Partial<Pick<ProjectIndexJob, 'changedFiles' | 'context' | 'error'>>,
): ProjectIndexJob {
  const job = requireJob(id);
  const updated: ProjectIndexJob = {
    ...job,
    ...patch,
    updatedAt: Date.now(),
  };
  jobs.set(id, updated);
  return updated;
}

function requireJob(id: string): ProjectIndexJob {
  const job = jobs.get(id);
  if (!job) throw new Error(`Project index job ${id} not found.`);
  return job;
}

function progressEvent(
  stage: ProjectIndexJobStage,
  message: string,
  createdAt: number,
): ProjectIndexJobProgressEvent {
  return { stage, message, createdAt };
}
