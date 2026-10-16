import type { ProjectTemplate } from '@sber-designer/shared-types';

import { listScreenTemplatesAsProjectTemplates } from './screen-templates';

/**
 * Compatibility alias for older prompts/tools that still ask for
 * "project templates". Product-facing screen creation now uses built-in
 * screen templates only; project-specific starting points should be Storybook
 * template stories and are discovered through the catalog.
 */
export async function listProjectTemplates(workspaceRoot?: string): Promise<ProjectTemplate[]> {
  return listScreenTemplatesAsProjectTemplates(workspaceRoot);
}
