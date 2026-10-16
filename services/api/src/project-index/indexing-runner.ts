import type { ComponentCatalog } from '@sber-designer/shared-types';

import { resolveCatalog } from '../catalog-cache';
import {
  generateProjectDesignIndexFiles,
  loadProjectDesignIndex,
  type GenerateProjectDesignIndexResult,
} from '../design-index';
import { enrichProjectIndex, type ProjectIndexEnrichmentResult } from './agent-enrichment';
import {
  advanceProjectIndexJob,
  createProjectIndexJob,
  findActiveProjectIndexJob,
  getProjectIndexJob,
  updateProjectIndexJob,
} from './job-store';
import type { ProjectIndexJob, ProjectIndexJobInput } from './job-types';

export interface ProjectIndexRunnerDeps {
  resolveCatalog?: typeof resolveCatalog;
  generateIndex?: typeof generateProjectDesignIndexFiles;
  loadIndex?: typeof loadProjectDesignIndex;
  enrichIndex?: typeof enrichProjectIndex;
}

export function startProjectIndexJob(
  input: ProjectIndexJobInput,
  deps: ProjectIndexRunnerDeps = {},
): ProjectIndexJob {
  const active = findActiveProjectIndexJob(input.workspaceRoot);
  if (active) return active;
  const job = createProjectIndexJob(input);
  queueMicrotask(() => {
    void runExistingProjectIndexJob(job.id, input, deps);
  });
  return job;
}

export async function runProjectIndexJobNow(
  input: ProjectIndexJobInput,
  deps: ProjectIndexRunnerDeps = {},
): Promise<ProjectIndexJob> {
  const job = createProjectIndexJob(input);
  await runExistingProjectIndexJob(job.id, input, deps);
  return getProjectIndexJob(job.id) ?? job;
}

async function runExistingProjectIndexJob(
  jobId: string,
  input: ProjectIndexJobInput,
  deps: ProjectIndexRunnerDeps,
): Promise<void> {
  const resolveCatalogFn = deps.resolveCatalog ?? resolveCatalog;
  const generateIndex = deps.generateIndex ?? generateProjectDesignIndexFiles;
  const loadIndex = deps.loadIndex ?? loadProjectDesignIndex;
  const enrichIndex = deps.enrichIndex ?? enrichProjectIndex;

  try {
    advanceProjectIndexJob(jobId, 'scanning', 'Scanning project catalog and local context.');
    const catalog = await resolveProjectCatalog(input, resolveCatalogFn);

    advanceProjectIndexJob(jobId, 'writing', 'Writing unified project index artifacts.');
    const generated = await generateIndex(input.workspaceRoot, {
      projectName: input.projectName,
      catalog,
    });

    let changedFiles = [...generated.changedFiles];
    let context = generated.context;

    if (input.enrich) {
      advanceProjectIndexJob(jobId, 'enriching', 'Running optional project-index enrichment.');
      const enrichment = await enrichIndex(input.workspaceRoot, {
        projectName: input.projectName,
      });
      changedFiles = mergeChangedFiles(changedFiles, enrichment.changedFiles);
      if (enrichment.status === 'applied') {
        context = await loadIndex(input.workspaceRoot);
      }
    }

    advanceProjectIndexJob(jobId, 'validating', 'Validating generated project index.');
    context = await loadIndex(input.workspaceRoot);

    updateProjectIndexJob(jobId, {
      changedFiles,
      context,
      error: null,
    });
    advanceProjectIndexJob(jobId, 'complete', 'Project index is ready.');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    updateProjectIndexJob(jobId, { error: message });
    advanceProjectIndexJob(jobId, 'failed', message);
  }
}

async function resolveProjectCatalog(
  input: ProjectIndexJobInput,
  resolveCatalogFn: NonNullable<ProjectIndexRunnerDeps['resolveCatalog']>,
): Promise<ComponentCatalog | null> {
  if (input.catalog !== undefined) return input.catalog;
  // The live Storybook index groups stories by title and is ideal for preview
  // navigation, but those groups are not necessarily importable components.
  // Prefer the workspace AST catalog for the durable component index so a
  // live canvas cannot replace PageHeader/Badge/etc. with broad story groups
  // such as Components/Patterns or Components/Badges.
  const staticResult = await resolveCatalogFn({
    workspacePath: input.workspaceRoot,
    bypass: true,
  });
  if ('catalog' in staticResult && staticResult.catalog.components.length > 0) {
    return staticResult.catalog;
  }
  if (input.canvasUrl) {
    const liveResult = await resolveCatalogFn({
      workspacePath: input.workspaceRoot,
      canvasUrl: input.canvasUrl,
      bypass: true,
    });
    if ('catalog' in liveResult) return liveResult.catalog;
  }
  return 'catalog' in staticResult ? staticResult.catalog : null;
}

function mergeChangedFiles(first: string[], second: string[]): string[] {
  return Array.from(new Set([...first, ...second]));
}

export type { GenerateProjectDesignIndexResult, ProjectIndexEnrichmentResult };
