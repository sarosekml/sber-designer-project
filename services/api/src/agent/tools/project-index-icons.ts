import { z } from 'zod';

import { materializeIndexedIcon } from '../../assets/materialize-indexed-icon';
import { resolveCatalog } from '../../catalog-cache';
import { generateProjectDesignIndexFiles } from '../../design-index';
import { getProject } from '../../project-store';
import { markStorybookReloadPendingForPath } from '../../storybook-reload';
import { recordToolReceiptSafely } from '../run-recorder';
import type { ServerTool, ToolContext } from '../types';
import {
  assetSearchKeys,
  emptyProjectIndexCounts,
  findFuzzyProjectIconCandidate,
  hasProjectIconContract,
  iconCandidateMatchRank,
  iconCandidateMatches,
  iconCandidateRank,
  iconCandidateUsage,
  normalizeSearch,
  readAssets,
  readIconCandidates,
  readIcons,
} from './project-index-data';
import { requireWorkspace } from './shared';

const GetIndexedIconInput = z
  .object({
    idOrName: z
      .string()
      .min(1)
      .describe('Project icon or Lucide fallback icon id/name/importName.'),
  })
  .strict();

export const getIndexedIcon: ServerTool<z.infer<typeof GetIndexedIconInput>, unknown> = {
  name: 'get_indexed_icon',
  description:
    'Read one indexed project icon first, then Lucide fallback icon metadata when no project icon matches. If no fallback name matches either, returns any Lucide fallback icon with a warning reason.',
  inputSchema: GetIndexedIconInput,
  handler: async (input, ctx) => {
    const workspacePath = requireWorkspace(ctx);
    const needle = normalizeSearch(input.idOrName);
    const candidates = await readIconCandidates(workspacePath);
    if (candidates.length > 0) {
      const matchingCandidates = candidates.filter((icon) => iconCandidateMatches(icon, needle));
      const sortedMatches = matchingCandidates.sort(
        (a, b) =>
          iconCandidateMatchRank(a, needle) - iconCandidateMatchRank(b, needle) ||
          iconCandidateRank(a) - iconCandidateRank(b) ||
          a.name.localeCompare(b.name),
      );
      const projectMatch = sortedMatches.find((icon) => icon.source !== 'lucide-fallback');
      const projectIcon = projectMatch ?? findFuzzyProjectIconCandidate(candidates, input.idOrName);
      if (projectIcon) {
        return {
          source: projectIcon.source,
          icon: projectIcon,
          usage: iconCandidateUsage(projectIcon),
        };
      }
      const icon = sortedMatches[0];
      if (icon) {
        const isFallback = icon.source === 'lucide-fallback';
        const reason =
          isFallback && hasProjectIconContract(candidates)
            ? lucideNotProjectIconWarning(input.idOrName, icon.importName ?? icon.name)
            : null;
        if (isFallback) {
          await recordIconFallbackReceipt(ctx, {
            requested: input.idOrName,
            resolved: icon.importName ?? icon.name,
            reason,
          });
        }
        return {
          source: icon.source,
          icon,
          usage: iconCandidateUsage(icon),
          ...(reason ? { warning: true, reason } : {}),
        };
      }
      const fallback = candidates.find((icon) => icon.source === 'lucide-fallback');
      if (fallback) {
        const reason = fallbackIconWarning(input.idOrName, fallback.importName ?? fallback.name);
        await recordIconFallbackReceipt(ctx, {
          requested: input.idOrName,
          resolved: fallback.importName ?? fallback.name,
          reason,
        });
        return {
          source: fallback.source,
          icon: fallback,
          usage: iconCandidateUsage(fallback),
          warning: true,
          reason,
        };
      }
      throw new Error(`Indexed icon not found: ${input.idOrName}`);
    }

    const assetIcon = (await readAssets(workspacePath)).find(
      (asset) =>
        asset.kind === 'icon' &&
        assetSearchKeys(asset).some(
          (key) => normalizeSearch(key) === needle || normalizeSearch(key).includes(needle),
        ),
    );
    if (assetIcon) return { source: 'project-asset', icon: assetIcon };
    const icons = await readIcons(workspacePath);
    const projectIcon = icons.projectIcons.find(
      (icon) =>
        normalizeSearch(icon.id) === needle ||
        normalizeSearch(icon.name) === needle ||
        normalizeSearch(icon.importName) === needle,
    );
    if (projectIcon) return { source: 'project', icon: projectIcon };
    const fallbackIcon = icons.fallback.icons.find(
      (icon) =>
        normalizeSearch(icon.id) === needle ||
        normalizeSearch(icon.name) === needle ||
        normalizeSearch(icon.importName) === needle,
    );
    if (fallbackIcon) {
      await recordIconFallbackReceipt(ctx, {
        requested: input.idOrName,
        resolved: fallbackIcon.importName,
        reason: null,
      });
      return { source: 'lucide-fallback', icon: fallbackIcon };
    }
    const anyFallbackIcon = icons.fallback.icons[0];
    if (anyFallbackIcon) {
      const reason = fallbackIconWarning(input.idOrName, anyFallbackIcon.importName);
      await recordIconFallbackReceipt(ctx, {
        requested: input.idOrName,
        resolved: anyFallbackIcon.importName,
        reason,
      });
      return {
        source: 'lucide-fallback',
        icon: anyFallbackIcon,
        warning: true,
        reason,
      };
    }
    throw new Error(`Indexed icon not found: ${input.idOrName}`);
  },
};

const MaterializeIndexedIconInput = z
  .object({
    iconId: z
      .string()
      .min(1)
      .describe(
        'External icon id, candidate id, or exact icon name returned by get_indexed_icon/search_project_index.',
      ),
  })
  .strict();

export const materializeIndexedIconTool: ServerTool<
  z.infer<typeof MaterializeIndexedIconInput>,
  unknown
> = {
  name: 'materialize_indexed_icon',
  description:
    'Copy one external indexed icon into src/sber-designer-assets/icons, update the local asset barrel, and refresh the project index. Use only for external-icon-reference results from get_indexed_icon.',
  inputSchema: MaterializeIndexedIconInput,
  handler: async (input, ctx) => {
    const workspacePath = requireWorkspace(ctx);
    const materializeResult = await materializeIndexedIcon({
      workspaceRoot: workspacePath,
      iconId: input.iconId,
    });
    for (const filePath of materializeResult.changedFiles) {
      markStorybookReloadPendingForPath(filePath, true);
    }
    const catalogResult = await resolveCatalog({
      canvasUrl: ctx.canvasUrl,
      workspacePath,
      bypass: true,
    });
    const project = getProject();
    const indexResult = await generateProjectDesignIndexFiles(workspacePath, {
      projectName: project.name || ctx.projectName || 'Untitled project',
      catalog: 'catalog' in catalogResult ? catalogResult.catalog : null,
    });
    const changedFiles = Array.from(
      new Set([...materializeResult.changedFiles, ...indexResult.changedFiles]),
    );
    await recordToolReceiptSafely({
      workspacePath,
      runId: ctx.runId,
      tool: 'materialize_indexed_icon',
      status: 'ok',
      changedFiles,
      summary: `Materialized external icon "${materializeResult.asset.name}" and refreshed the project index.`,
      metadata: {
        asset: materializeResult.asset,
        indexChangedFiles: indexResult.changedFiles,
      },
    });
    return {
      ok: true,
      asset: materializeResult.asset,
      changedFiles,
      assetChangedFiles: materializeResult.changedFiles,
      indexChangedFiles: indexResult.changedFiles,
      projectIndex: {
        status: indexResult.context.status,
        stale: indexResult.context.stale,
        counts: indexResult.context.manifest?.counts ?? emptyProjectIndexCounts(),
      },
    };
  },
};

function fallbackIconWarning(idOrName: string, importName: string): string {
  return `No indexed icon matched "${idOrName}". Using Lucide fallback icon "${importName}" until a suitable project icon is attached.`;
}

function lucideNotProjectIconWarning(idOrName: string, importName: string): string {
  return `Icon "${idOrName}" resolved to Lucide fallback "${importName}". It is not valid for project Icon iconName; import it from lucide-react or choose a project-icon-prop candidate.`;
}

async function recordIconFallbackReceipt(
  ctx: ToolContext,
  input: { requested: string; resolved: string; reason: string | null },
): Promise<void> {
  await recordToolReceiptSafely({
    workspacePath: ctx.workspacePath,
    runId: ctx.runId,
    tool: 'get_indexed_icon',
    status: 'ok',
    changedFiles: [],
    summary: input.reason
      ? `Lucide fallback icon "${input.resolved}" used for "${input.requested}": ${input.reason}`
      : `Lucide fallback icon "${input.resolved}" used for "${input.requested}".`,
    metadata: {
      iconFallback: {
        provider: 'lucide',
        requested: input.requested,
        resolved: input.resolved,
        ...(input.reason ? { reason: input.reason } : {}),
      },
    },
  });
}
