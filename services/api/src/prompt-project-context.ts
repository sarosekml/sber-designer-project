import {
  HTML_DESIGN_SYSTEM_PATHS,
  isHtmlDesignSystemCanonical,
  type ScreenStructurePlan,
} from '@sber-designer/shared-types';
import {
  CANONICAL_DESIGN_INDEX_PATHS,
  type ProjectSystemContextItem,
  type ProjectSystemOverview,
} from '@sber-designer/design-indexer';

import { loadProjectDesignContext } from './design-context';
import { loadProjectDesignIndex } from './design-index';
import {
  buildTaskRelevantComponentPack,
  renderComponentSelectionMap,
  renderTaskRelevantComponentPack,
  type TaskRelevantComponentPack,
} from './component-intelligence/component-pack';
import {
  renderTaskRelevantDescriptionMap,
  renderTaskRelevantProjectIndexSummary,
  type ProjectIndexPromptContextInput,
} from './project-index/prompt-context';
import type { GenerationOptions } from './generation-mode';
import { renderScreenStructurePlan } from './screen-planning/screen-structure-plan';
import { compactLine } from './prompt-blocks';

export async function resolveProjectIndexBlock(
  workspacePath: string | null | undefined,
  promptContext: ProjectIndexPromptContextInput = {},
): Promise<string> {
  if (!workspacePath) {
    return '## Project index\n\n_No workspace connected — project index is empty._';
  }
  const lines: string[] = ['## Project index'];
  let hasUnifiedIndex = false;
  try {
    const index = await loadProjectDesignIndex(workspacePath);
    if (index.manifest) {
      hasUnifiedIndex = true;
      const indexPromptContext = {
        ...promptContext,
        promptSummary: index.promptSummary,
        descriptionMap: index.descriptionMap,
      };
      const promptSummary = renderTaskRelevantProjectIndexSummary(indexPromptContext);
      const descriptionMap = renderTaskRelevantDescriptionMap(indexPromptContext);
      lines.push(
        '',
        promptSummary || '_Project index prompt summary is empty._',
        ...(descriptionMap ? ['', descriptionMap] : []),
        ...projectSystemPromptLines(index.projectSystem),
        '',
        `Status: \`${index.status}\`${index.stale ? ' (stale — ask the user to re-index if component choice is ambiguous)' : ''}`,
        `Artifacts: ${projectIndexArtifactList()}.`,
      );
    } else {
      lines.push(
        '',
        '_Not generated yet. Use the legacy DESIGN.md fallback below and the Catalog, or ask the user to run Settings > Indexing project > Index project when component choice is ambiguous._',
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    lines.push('', `_Project index unavailable: ${compactLine(message, 360)}_`);
  }
  if (hasUnifiedIndex) return lines.join('\n');
  try {
    const context = await loadProjectDesignContext(workspacePath);
    const legacySummary = stripLegacyDesignContextHeading(context.promptSummary).trim();
    if (legacySummary) lines.push('', '### Legacy DESIGN.md compatibility', '', legacySummary);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    lines.push('', `_Legacy design context unavailable: ${compactLine(message, 360)}_`);
  }
  return lines.join('\n');
}

export async function resolveTaskRelevantComponentPackBlock(
  workspacePath: string | null | undefined,
  taskKind: TaskRelevantComponentPack['taskKind'],
  userRequest: string | undefined,
  componentPack: TaskRelevantComponentPack | null | undefined,
  designBrief: GenerationOptions['designBrief'] | undefined,
  screenStructurePlan: ScreenStructurePlan | null | undefined,
): Promise<string> {
  const structurePlan = renderScreenStructurePlan(screenStructurePlan);
  if (!workspacePath) return structurePlan;
  try {
    const pack =
      componentPack ??
      (await buildTaskRelevantComponentPack({
        workspaceRoot: workspacePath,
        taskKind,
        ...(userRequest !== undefined ? { userRequest } : {}),
        ...(designBrief ? { designBrief } : {}),
        ...(screenStructurePlan ? { screenStructurePlan } : {}),
      }));
    const selectionMap = renderComponentSelectionMap(pack.selectionMap);
    const componentPackBlock =
      pack.status === 'missing' &&
      pack.candidates.length === 0 &&
      (pack.selectionPlan?.gaps.length ?? 0) === 0
        ? ''
        : renderTaskRelevantComponentPack(pack);
    return [selectionMap, structurePlan, componentPackBlock].filter(Boolean).join('\n\n');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `## Task-Relevant Component Pack\n\n_Component pack unavailable: ${compactLine(message, 360)}_`;
  }
}

function projectSystemPromptLines(overview: ProjectSystemOverview | undefined): string[] {
  if (!overview) return [];
  const lines = [
    '### Project System',
    '',
    `- projectSystemFreshness: \`${overview.freshness}\``,
    `- projectSystemNextAction: \`${overview.nextAction}\``,
  ];
  if (overview.warnings.length > 0) {
    lines.push('- projectSystemWarnings:');
    for (const warning of overview.warnings.slice(0, 4)) {
      lines.push(
        `  - ${warning.level}: ${warning.filePath} — ${compactLine(warning.message, 220)}`,
      );
    }
  }
  if (overview.htmlDesignSystem) {
    lines.push(`- designContext: \`${overview.htmlDesignSystem.status}\``);
    if (overview.htmlDesignSystem.missingRequired.length > 0) {
      lines.push(
        `- missingDesignSystemSources: ${overview.htmlDesignSystem.missingRequired.join(', ')}`,
        '- bootstrapDesignSystemRule: put reusable values in tokens.css and reusable classes in components.css; avoid one-off inline styles.',
      );
    }
    if (isHtmlDesignSystemCanonical(overview.htmlDesignSystem.status)) {
      lines.push(
        `- connectedDesignSystemRule: do not invent a palette; reuse only ${HTML_DESIGN_SYSTEM_PATHS.tokensCss} color values and \`var(--font-*)\` typography tokens. Raw hex colors, default utility palettes, and raw font-family literals are blocking craft findings that send the run to needs_review.`,
      );
    }
  }
  lines.push('- contextShelf:');
  for (const item of overview.contextItems) {
    lines.push(`  - ${projectSystemContextItemLine(item)}`);
  }
  return lines;
}

function projectSystemContextItemLine(item: ProjectSystemContextItem): string {
  return `${item.label}: ${item.status} (${item.count}) — ${item.artifactPath}`;
}

function projectIndexArtifactList(): string {
  return [
    CANONICAL_DESIGN_INDEX_PATHS.components,
    CANONICAL_DESIGN_INDEX_PATHS.componentGroups,
    CANONICAL_DESIGN_INDEX_PATHS.tokens,
    CANONICAL_DESIGN_INDEX_PATHS.icons,
    CANONICAL_DESIGN_INDEX_PATHS.screens,
    CANONICAL_DESIGN_INDEX_PATHS.projectProfile,
    CANONICAL_DESIGN_INDEX_PATHS.usageExamples,
    CANONICAL_DESIGN_INDEX_PATHS.agentNotes,
  ]
    .map((path) => `\`${path}\``)
    .join(', ');
}

function stripLegacyDesignContextHeading(summary: string): string {
  return summary.replace(/^## Design system context\s*/u, '').trim();
}
