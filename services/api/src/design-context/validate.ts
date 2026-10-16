/** One-shot validation API over the loaded project design context. */
import {
  type DesignContextValidation,
  type ProjectDesignContext,
  STALE_DIAGNOSTIC_MESSAGE,
} from './contract';
import { writeDesignContextState } from './state';
import { buildDesignPromptSummary } from './prompt-summary';
import { loadProjectDesignContext, resolveValidationStatus } from './load';

export async function validateProjectDesignContext(
  workspaceRoot: string,
): Promise<ProjectDesignContext> {
  const context = await loadProjectDesignContext(workspaceRoot);
  const checkedAt = Date.now();
  await writeDesignContextState(workspaceRoot, {
    version: 1,
    fingerprint: context.validation.fingerprint,
    trackedFiles: context.validation.trackedFiles,
    checkedAt,
  });
  const diagnostics = context.diagnostics.filter(
    (diagnostic) => diagnostic.message !== STALE_DIAGNOSTIC_MESSAGE,
  );
  const validation: DesignContextValidation = {
    ...context.validation,
    stale: false,
    checkedAt,
    status: resolveValidationStatus(diagnostics, false),
  };
  return {
    ...context,
    diagnostics,
    validation,
    promptSummary: buildDesignPromptSummary(
      context.design,
      context.componentSelectionMap,
      diagnostics,
    ),
  };
}
