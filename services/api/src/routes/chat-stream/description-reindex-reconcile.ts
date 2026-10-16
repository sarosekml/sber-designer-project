import { recordToolReceiptSafely, type AgentRunManifest } from '../../agent/run-recorder';
import { startProjectIndexJob } from '../../project-index/indexing-runner';
import { getProject } from '../../project-store';

export async function reconcileProjectIndexForDescriptionSidecarChanges(input: {
  workspacePath: string;
  agentRun: AgentRunManifest | null;
  changedFiles: string[];
}): Promise<void> {
  const sidecarFiles = componentDescriptionSidecarChangedFiles(input.changedFiles);
  if (sidecarFiles.length === 0) return;

  try {
    const project = getProject();
    const job = startProjectIndexJob({
      workspaceRoot: input.workspacePath,
      projectName: input.agentRun?.projectName || project.name || 'Untitled project',
    });
    await recordToolReceiptSafely({
      workspacePath: input.workspacePath,
      runId: input.agentRun?.runId,
      tool: 'project_index_reconcile',
      status: 'ok',
      changedFiles: sidecarFiles,
      summary: 'Project re-index is running after component description sidecar changes.',
      metadata: {
        reason: 'component_description_sidecar_changed',
        sidecarFiles,
        jobId: job.id,
        statusEndpoint: `/api/project/design-index/jobs/${job.id}`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordToolReceiptSafely({
      workspacePath: input.workspacePath,
      runId: input.agentRun?.runId,
      tool: 'project_index_reconcile',
      status: 'error',
      changedFiles: sidecarFiles,
      summary: `Project re-index was not started after component description sidecar changes: ${message}`,
      metadata: {
        reason: 'component_description_sidecar_changed',
        sidecarFiles,
        error: message,
      },
    });
  }
}

function componentDescriptionSidecarChangedFiles(changedFiles: string[]): string[] {
  const sidecarFiles = new Set<string>();
  for (const filePath of changedFiles) {
    const normalized = filePath.replace(/\\/gu, '/').replace(/^\.\//u, '');
    if (/^\.sber-designer\/components\/[^/]+\.md$/u.test(normalized)) {
      sidecarFiles.add(normalized);
    }
  }
  return Array.from(sidecarFiles).sort();
}
