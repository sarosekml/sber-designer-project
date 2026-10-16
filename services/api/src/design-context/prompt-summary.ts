/** Builds the compact DESIGN.md prompt summary for agent context. */
import {
  COMPONENT_SELECTION_MAP_PATH,
  DESIGN_MD_PATH,
  type DesignContextArtifact,
  type DesignContextDiagnostic,
  MAX_PROMPT_SUMMARY_CHARS,
} from './contract';
import { truncateMarkdown } from './markdown';

export function buildDesignPromptSummary(
  design: DesignContextArtifact,
  componentSelectionMap: DesignContextArtifact,
  diagnostics: readonly DesignContextDiagnostic[] = [],
): string {
  const lines: string[] = ['## Design system context'];
  if (design.exists) {
    lines.push(
      '',
      `### ${design.filePath}`,
      '',
      design.excerpt || '_No promptable content found._',
    );
  } else {
    lines.push('', `_${DESIGN_MD_PATH} not found._`);
  }

  if (componentSelectionMap.exists) {
    lines.push(
      '',
      `### ${componentSelectionMap.filePath}`,
      '',
      componentSelectionMap.excerpt || '_No promptable content found._',
    );
  } else {
    lines.push(
      '',
      `_${COMPONENT_SELECTION_MAP_PATH} not found. Use Catalog and component descriptions directly._`,
    );
  }

  const relevantDiagnostics = diagnostics.filter((item) => item.level !== 'info').slice(0, 5);
  if (relevantDiagnostics.length > 0) {
    lines.push('', '### Diagnostics');
    for (const diagnostic of relevantDiagnostics) {
      lines.push(`- ${diagnostic.level}: ${diagnostic.filePath} — ${diagnostic.message}`);
    }
  }

  return truncateMarkdown(lines.join('\n'), MAX_PROMPT_SUMMARY_CHARS);
}
