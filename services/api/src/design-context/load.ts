/**
 * Loads DESIGN.md / component-selection-map artifacts, validates them and
 * assembles the ProjectDesignContext (including staleness diagnostics).
 */
import { DESIGN_INDEX_PATHS } from '@sber-designer/design-indexer';
import {
  CANONICAL_DESIGN_MD_SECTIONS,
  GOOGLE_DESIGN_MD_SOURCE_COMMIT,
  GOOGLE_DESIGN_MD_SPEC_VERSION,
  REQUIRED_PROMPT_SECTIONS,
} from '../design-md-spec';
import {
  COMPONENT_SELECTION_MAP_FALLBACK_PATH,
  COMPONENT_SELECTION_MAP_PATH,
  DESIGN_CONTEXT_STATE_PATH,
  DESIGN_MD_PATH,
  type DesignContextDiagnostic,
  type DesignContextValidation,
  MAX_DESIGN_SECTION_CHARS,
  MAX_MAP_CHARS,
  type ProjectDesignContext,
  STALE_DIAGNOSTIC_MESSAGE,
} from './contract';
import {
  extractFrontmatterMetadata,
  extractFrontmatterValue,
  extractMarkdownSection,
  extractMarkdownSections,
  splitFrontmatter,
  truncateMarkdown,
} from './markdown';
import {
  fingerprintProjectDesignContext,
  readDesignContextState,
  readFirstExistingWorkspaceFile,
  readOptionalWorkspaceFile,
} from './state';
import { buildDesignPromptSummary } from './prompt-summary';

export async function loadProjectDesignContext(
  workspaceRoot: string,
): Promise<ProjectDesignContext> {
  const diagnostics: DesignContextDiagnostic[] = [];
  const designFile = await readOptionalWorkspaceFile(workspaceRoot, DESIGN_MD_PATH);
  const mapFile = await readFirstExistingWorkspaceFile(workspaceRoot, [
    DESIGN_INDEX_PATHS.promptSummary,
    COMPONENT_SELECTION_MAP_PATH,
    COMPONENT_SELECTION_MAP_FALLBACK_PATH,
  ]);
  const fingerprint = await fingerprintProjectDesignContext(workspaceRoot);
  const savedState = await readDesignContextState(workspaceRoot);

  const design = designFile
    ? {
        filePath: DESIGN_MD_PATH,
        exists: true,
        excerpt: summarizeDesignMd(designFile.contents),
      }
    : { filePath: DESIGN_MD_PATH, exists: false, excerpt: '' };

  const componentSelectionMap = mapFile
    ? {
        filePath: mapFile.filePath,
        exists: true,
        excerpt: truncateMarkdown(mapFile.contents, MAX_MAP_CHARS),
      }
    : { filePath: COMPONENT_SELECTION_MAP_PATH, exists: false, excerpt: '' };

  diagnostics.push(...validateDesignArtifact(designFile?.contents ?? null));
  diagnostics.push(...validateComponentSelectionMapArtifact(mapFile));
  const stale = Boolean(savedState && savedState.fingerprint !== fingerprint.value);
  if (stale) {
    diagnostics.push({
      level: 'warning',
      filePath: DESIGN_CONTEXT_STATE_PATH,
      message: STALE_DIAGNOSTIC_MESSAGE,
    });
  }

  return {
    design,
    componentSelectionMap,
    diagnostics,
    validation: {
      status: resolveValidationStatus(diagnostics, stale),
      stale,
      validator: 'sber-designer/design-md-local',
      designMdSpecVersion: GOOGLE_DESIGN_MD_SPEC_VERSION,
      googleDesignMdSourceCommit: GOOGLE_DESIGN_MD_SOURCE_COMMIT,
      fingerprint: fingerprint.value,
      trackedFiles: fingerprint.trackedFiles,
      ...(savedState?.checkedAt ? { checkedAt: savedState.checkedAt } : {}),
    },
    promptSummary: buildDesignPromptSummary(design, componentSelectionMap, diagnostics),
  };
}

function summarizeDesignMd(contents: string): string {
  const parsed = splitFrontmatter(contents);
  const metadata = extractFrontmatterMetadata(parsed.frontmatter);
  const sections = extractMarkdownSections(
    parsed.body,
    REQUIRED_PROMPT_SECTIONS,
    MAX_DESIGN_SECTION_CHARS,
  );
  const parts: string[] = [];
  if (metadata.length > 0) parts.push(metadata.join('\n'));
  if (sections) parts.push(sections);
  if (parts.length === 0) {
    return truncateMarkdown(parsed.body.trim() || contents.trim(), 2_000);
  }
  return parts.join('\n\n');
}

function validateDesignArtifact(contents: string | null): DesignContextDiagnostic[] {
  if (!contents) {
    return [
      {
        level: 'warning',
        filePath: DESIGN_MD_PATH,
        message:
          'File is missing. The agent will rely on catalog, built-in screen templates, and design-index records only.',
      },
    ];
  }
  const diagnostics: DesignContextDiagnostic[] = [];
  const parsed = splitFrontmatter(contents);
  if (!contents.trim()) {
    return [
      {
        level: 'error',
        filePath: DESIGN_MD_PATH,
        message: 'File is empty.',
      },
    ];
  }
  if (!parsed.frontmatter) {
    diagnostics.push({
      level: 'warning',
      filePath: DESIGN_MD_PATH,
      message: 'Missing YAML frontmatter expected by canonical design.md.',
    });
  } else {
    const version = extractFrontmatterValue(parsed.frontmatter, 'version');
    if (version && version !== GOOGLE_DESIGN_MD_SPEC_VERSION) {
      diagnostics.push({
        level: 'warning',
        filePath: DESIGN_MD_PATH,
        message: `Expected design.md version "${GOOGLE_DESIGN_MD_SPEC_VERSION}", found "${version}".`,
      });
    }
  }
  if (!/^#\s+\S+/m.test(parsed.body)) {
    diagnostics.push({
      level: 'warning',
      filePath: DESIGN_MD_PATH,
      message: 'Missing top-level Markdown title.',
    });
  }
  for (const section of ['Overview', 'Components']) {
    if (!extractMarkdownSection(parsed.body, section)) {
      diagnostics.push({
        level: 'warning',
        filePath: DESIGN_MD_PATH,
        message: `Missing ## ${section} section.`,
      });
    }
  }
  for (const section of CANONICAL_DESIGN_MD_SECTIONS) {
    if (section === 'Overview' || section === 'Components') continue;
    if (!extractMarkdownSection(parsed.body, section)) {
      diagnostics.push({
        level: 'info',
        filePath: DESIGN_MD_PATH,
        message: `Recommended canonical section is missing: ## ${section}.`,
      });
    }
  }
  return diagnostics;
}

function validateComponentSelectionMapArtifact(
  file: { filePath: string; contents: string } | null,
): DesignContextDiagnostic[] {
  if (!file) {
    return [
      {
        level: 'warning',
        filePath: COMPONENT_SELECTION_MAP_PATH,
        message: 'File is missing. The agent has no project-specific component routing map.',
      },
    ];
  }
  const diagnostics: DesignContextDiagnostic[] = [];
  if (!/^#\s+\S+/m.test(file.contents)) {
    diagnostics.push({
      level: 'warning',
      filePath: file.filePath,
      message: 'Missing top-level Markdown title.',
    });
  }
  if (!/component|table|form|modal|button|toolbar|filter|card/i.test(file.contents)) {
    diagnostics.push({
      level: 'warning',
      filePath: file.filePath,
      message: 'No obvious component routing terms found.',
    });
  }
  return diagnostics;
}

export function resolveValidationStatus(
  diagnostics: readonly DesignContextDiagnostic[],
  stale: boolean,
): DesignContextValidation['status'] {
  if (stale) return 'stale';
  if (diagnostics.some((item) => item.level === 'error')) return 'error';
  if (diagnostics.some((item) => item.level === 'warning')) return 'warning';
  return 'valid';
}
