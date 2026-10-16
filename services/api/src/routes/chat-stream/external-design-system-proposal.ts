/**
 * Design-system proposal validation for a finalized run (0136 R12 —
 * extracted from external-finalization.ts).
 *
 * A bootstrap run is supposed to leave a reviewable proposal bundle behind.
 * This module decides whether the run was that kind of run, where its bundle
 * should be, and whether the required files are actually populated.
 */
import {
  detectDesignSystemBootstrapIntent,
  detectExternalDesignSourceIntent,
  createExternalDesignSystemProposalTargetDefaults,
} from '@sber-designer/shared-types';
import { type RuntimeTargetChangeSummary } from '../../agent-runtimes/change-validation';
import { readWorkspaceFile } from '../../safe-fs';

export interface ExternalDesignSystemProposalValidation {
  status: 'skipped' | 'complete' | 'incomplete';
  reason: string;
  proposalRoot: string | null;
  requiredFiles: string[];
  missingFiles: string[];
  emptyFiles: string[];
}

export async function validateExternalDesignSystemProposalBundle(input: {
  workspacePath: string;
  userRequest: string | null;
  runId: string | null;
  summary: RuntimeTargetChangeSummary;
}): Promise<ExternalDesignSystemProposalValidation> {
  if (!isExternalDesignSystemBootstrapRun(input.userRequest)) {
    return {
      status: 'skipped',
      reason: 'Run is not a design-system bootstrap request.',
      proposalRoot: null,
      requiredFiles: [],
      missingFiles: [],
      emptyFiles: [],
    };
  }

  const proposalRoot = inferExternalDesignSystemProposalRoot(input.summary, input.runId);
  if (!proposalRoot) {
    return {
      status: 'incomplete',
      reason:
        'Design-system proposal incomplete: no reviewable design/proposals/<id> target was configured.',
      proposalRoot: null,
      requiredFiles: [],
      missingFiles: [],
      emptyFiles: [],
    };
  }

  const requiredFiles = [`${proposalRoot}/Design.md`, `${proposalRoot}/extraction-report.md`];
  const targetFiles = new Set(input.summary.targetFiles);
  const missingSnapshotFiles = new Set(input.summary.missingFiles);
  const missingFiles = requiredFiles.filter(
    (filePath) => !targetFiles.has(filePath) || missingSnapshotFiles.has(filePath),
  );

  if (missingFiles.length > 0) {
    return {
      status: 'incomplete',
      reason: `Design-system proposal incomplete: missing required proposal file${missingFiles.length === 1 ? '' : 's'} ${missingFiles.join(', ')}.`,
      proposalRoot,
      requiredFiles,
      missingFiles,
      emptyFiles: [],
    };
  }

  const emptyFiles = await emptyRequiredProposalFiles(input.workspacePath, requiredFiles);
  if (emptyFiles.length > 0) {
    return {
      status: 'incomplete',
      reason: `Design-system proposal incomplete: empty required proposal file${emptyFiles.length === 1 ? '' : 's'} ${emptyFiles.join(', ')}.`,
      proposalRoot,
      requiredFiles,
      missingFiles: [],
      emptyFiles,
    };
  }

  return {
    status: 'complete',
    reason: 'Design-system proposal bundle includes the required review files.',
    proposalRoot,
    requiredFiles,
    missingFiles: [],
    emptyFiles: [],
  };
}

async function emptyRequiredProposalFiles(
  workspacePath: string,
  requiredFiles: string[],
): Promise<string[]> {
  const emptyFiles: string[] = [];
  for (const filePath of requiredFiles) {
    const content = await readWorkspaceFile(workspacePath, filePath).catch(() => '');
    if (content.trim().length === 0) emptyFiles.push(filePath);
  }
  return emptyFiles;
}

function isExternalDesignSystemBootstrapRun(userRequest: string | null): boolean {
  if (!userRequest) return false;
  const designSource = detectExternalDesignSourceIntent(userRequest);
  return (
    designSource?.target.mode === 'design-system' || detectDesignSystemBootstrapIntent(userRequest)
  );
}

function inferExternalDesignSystemProposalRoot(
  summary: RuntimeTargetChangeSummary,
  runId: string | null,
): string | null {
  const explicitRoot = summary.targetFiles
    .map((filePath) => /^design\/proposals\/[^/]+(?=\/)/u.exec(filePath)?.[0] ?? null)
    .find((root): root is string => Boolean(root));
  if (explicitRoot) return explicitRoot;
  if (!runId) return null;
  return createExternalDesignSystemProposalTargetDefaults({ proposalId: runId }).proposalRoot;
}
