import { z } from 'zod';

import { regenerateHtmlDesignSystemPreview } from '../../html-design-system-preview';
import { requireWorkspace } from './shared';
import type { ServerTool } from '../types';

const RebuildDesignSystemPreviewInput = z
  .object({
    keepDescriptions: z
      .boolean()
      .optional()
      .describe(
        'Restore Description for AI sections from sidecars after rebuild. Defaults to true.',
      ),
  })
  .strict();

export const rebuildDesignSystemPreviewTool: ServerTool<
  z.infer<typeof RebuildDesignSystemPreviewInput>,
  unknown
> = {
  name: 'rebuild_design_system_preview',
  description:
    'Regenerate the managed html-first design-system/index.html preview from design-system/Design.md, design-system/tokens.css, and design-system/components.css. By default restores Description for AI sections from canonical sidecars; pass keepDescriptions=false for a clean preview. Never hand-edit the managed preview.',
  inputSchema: RebuildDesignSystemPreviewInput,
  safety: 'disk-write',
  handler: async (input, ctx) => {
    const workspacePath = requireWorkspace(ctx);
    const result = await regenerateHtmlDesignSystemPreview(
      workspacePath,
      ctx.projectName || 'Untitled project',
      {
        keepDescriptions: input.keepDescriptions ?? true,
      },
    );
    return {
      changedFiles: uniqueFiles([result.changedFile, ...result.descriptionSections.changedFiles]),
      changedFile: result.changedFile,
      tokenCount: result.tokenCount,
      componentClassCount: result.componentClassCount,
      descriptionSections: result.descriptionSections,
      summary:
        result.descriptionSections.keepDescriptions && result.descriptionSections.restored > 0
          ? `Rebuilt design-system/index.html and restored ${result.descriptionSections.restored} Description for AI section(s).`
          : 'Rebuilt design-system/index.html.',
    };
  },
};

function uniqueFiles(files: string[]): string[] {
  return Array.from(new Set(files)).sort();
}
