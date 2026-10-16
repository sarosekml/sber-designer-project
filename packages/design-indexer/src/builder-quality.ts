/**
 * Design-index quality scoring and diagnostics (0136 R12 — extracted from
 * builder.ts).
 *
 * Every check is a ratio over what the scan found, so a score says what
 * fraction of the project the index can actually describe rather than how
 * hard the indexer tried.
 */
import { isHtmlDesignSystemCanonical } from '@sber-designer/shared-types';
import {
  htmlDesignSystemSectionCoverage,
  type ParsedHtmlDesignSystemDesignMd,
} from './design-md-parser';
import {
  projectStyleContractCoverage,
  type ParsedProjectStyleContract,
} from './project-style-contract';
import {
  DESIGN_INDEX_PATHS,
  type BuildDesignIndexInput,
  type DesignIndexDiagnostic,
  type DesignIndexManifest,
  type DesignIndexQualityCheck,
  type DesignIndexQualityScore,
  type HtmlCssCatalogManifest,
  type IndexedComponentRecord,
  type ProjectAgentNote,
  type ProjectProfileContract,
  type TokenRecord,
} from './types';

export function buildDiagnostics(
  input: BuildDesignIndexInput,
  components: IndexedComponentRecord[],
  tokens: TokenRecord[],
  notes: ProjectAgentNote[],
  projectProfile: ProjectProfileContract,
  parsedDesignMd: ParsedHtmlDesignSystemDesignMd | null,
  projectStyleContract: ParsedProjectStyleContract | null,
): DesignIndexDiagnostic[] {
  const diagnostics: DesignIndexDiagnostic[] = [];
  const isHtmlCssProject = projectProfile.componentModel === 'css-catalog';
  if (!input.catalog && !isHtmlCssProject) {
    diagnostics.push({
      level: 'warning',
      filePath: 'catalog',
      message: 'Component catalog is unavailable; index contains only document-level context.',
    });
  }
  if (components.length === 0 && !isHtmlCssProject) {
    diagnostics.push({
      level: 'warning',
      filePath: DESIGN_INDEX_PATHS.components,
      message: 'No components were indexed.',
    });
  }
  if (!input.designMdContents?.trim()) {
    diagnostics.push({
      level: 'warning',
      filePath: 'DESIGN.md',
      message: 'DESIGN.md is missing; token and visual-language context is limited.',
    });
  }
  if (isHtmlCssProject && parsedDesignMd) {
    diagnostics.push(...parsedDesignMd.diagnostics);
  }
  if (projectStyleContract) {
    diagnostics.push(...projectStyleContract.diagnostics);
  }
  if (tokens.length === 0) {
    diagnostics.push({
      level: 'info',
      filePath: DESIGN_INDEX_PATHS.tokens,
      message: 'No tokens were detected in DESIGN.md frontmatter yet.',
    });
  }
  const missingNoteTargets = notes.filter(
    (note) =>
      note.targetType === 'component' &&
      note.targetId &&
      !components.some((component) => component.id === note.targetId),
  );
  for (const note of missingNoteTargets.slice(0, 5)) {
    diagnostics.push({
      level: 'warning',
      filePath: DESIGN_INDEX_PATHS.agentNotes,
      message: `Note ${note.id} references missing component ${note.targetId}.`,
    });
  }
  return diagnostics;
}

export function buildDesignIndexQuality(input: {
  manifest: DesignIndexManifest;
  components: IndexedComponentRecord[];
  usageCards: unknown[];
  descriptionMap: Array<{ componentId: string }>;
  diagnostics: DesignIndexDiagnostic[];
  htmlCssCatalogManifest: HtmlCssCatalogManifest;
  projectProfile: ProjectProfileContract;
  parsedDesignMd: ParsedHtmlDesignSystemDesignMd | null;
  projectStyleContract: ParsedProjectStyleContract | null;
}): DesignIndexQualityScore {
  const componentCount = input.manifest.counts.components;
  const isHtmlCssProject = input.projectProfile.componentModel === 'css-catalog';
  const htmlDesignSystem = input.projectProfile.htmlDesignSystem ?? null;
  const tokenCount = Math.max(
    input.manifest.counts.tokens,
    input.htmlCssCatalogManifest.counts.tokensDeclared,
  );
  const describedComponents = new Set(input.descriptionMap.map((entry) => entry.componentId)).size;
  const warnings = input.diagnostics.filter((item) => item.level === 'warning').length;
  const errors = input.diagnostics.filter((item) => item.level === 'error').length;
  const htmlDesignSystemSections = input.projectStyleContract
    ? projectStyleContractCoverage(input.projectStyleContract)
    : htmlDesignSystemSectionCoverage(input.parsedDesignMd);
  const projectStyleSections = projectStyleContractCoverage(input.projectStyleContract);
  const signals = input.htmlCssCatalogManifest.designSystemSignals;

  const checks: DesignIndexQualityCheck[] = [
    makeQualityCheck({
      id: 'prompt-summary',
      label: 'Prompt summary',
      score: input.manifest.projectName && input.manifest.artifacts.promptSummary ? 1 : 0.25,
      detail: 'Prompt summary artifact is declared in the manifest.',
      recommendation: 'Regenerate the design index so prompt-summary.md is emitted.',
    }),
    ...(input.projectStyleContract
      ? [
          makeQualityCheck({
            id: 'project-style-contract-sections',
            label: 'Project style contract',
            score: projectStyleSections.score,
            detail: `${projectStyleSections.present} of ${projectStyleSections.total} portable style-contract sections contain reusable guidance.`,
            recommendation:
              'Complete the 9-section project style contract before using it as generation guidance.',
          }),
        ]
      : []),
    ...(isHtmlCssProject
      ? [
          makeQualityCheck({
            id: 'html-design-system',
            label: 'HTML design system',
            score: isHtmlDesignSystemCanonical(htmlDesignSystem?.status) ? 1 : 0.35,
            detail: isHtmlDesignSystemCanonical(htmlDesignSystem?.status)
              ? 'design-system/Design.md, design-system/tokens.css, and design-system/components.css are the canonical HTML design-system sources.'
              : `HTML design-system sources are incomplete${htmlDesignSystem?.missingRequired.length ? `: missing ${htmlDesignSystem.missingRequired.join(', ')}` : '.'}`,
            recommendation:
              'Restructure the project or add the three canonical sources under design-system/ before relying on HTML-first generation.',
          }),
          ...(input.parsedDesignMd || input.projectStyleContract
            ? [
                makeQualityCheck({
                  id: 'html-design-system-sections',
                  label: 'HTML design-system sections',
                  score: htmlDesignSystemSections.score,
                  detail: `${htmlDesignSystemSections.present} of ${htmlDesignSystemSections.total} Design.md sections contain reusable guidance.`,
                  recommendation:
                    'Fill the canonical 9-section Design.md style contract or complete the legacy HTML-first sections.',
                }),
              ]
            : []),
          makeQualityCheck({
            id: 'html-design-system-tokens',
            label: 'Root design tokens',
            score: signals.rootTokenCount > 0 ? 1 : signals.declaredTokenCount > 0 ? 0.5 : 0.3,
            detail:
              signals.rootTokenCount > 0
                ? `${signals.rootTokenCount} design tokens are declared in a :root block.`
                : signals.declaredTokenCount > 0
                  ? `${signals.declaredTokenCount} custom properties exist, but none are declared in a :root block.`
                  : 'No CSS custom properties are declared in tokens.css.',
            recommendation:
              'Declare color, spacing, radius, and typography tokens as CSS custom properties inside a :root block in tokens.css.',
          }),
          makeQualityCheck({
            id: 'html-design-system-theme',
            label: 'Theme override',
            score: signals.themeOverride ? 1 : 0.5,
            detail: signals.themeOverride
              ? `Theme override detected: ${signals.themeOverrideSelectors.join(', ')}.`
              : 'No dark-theme override (for example [data-theme="dark"]) was found.',
            recommendation:
              'Add a [data-theme="dark"] (or prefers-color-scheme) override so tokens support light and dark themes.',
          }),
          makeQualityCheck({
            id: 'html-design-system-components',
            label: 'Component classes',
            score: signals.componentClassCount > 0 ? 1 : 0.3,
            detail:
              signals.componentClassCount > 0
                ? `${signals.componentClassCount} reusable component classes are declared${signals.hasComponentsStylesheet ? ' in components.css' : ' in project CSS'}.`
                : 'No reusable component classes were found in components.css.',
            recommendation:
              'Move reusable UI patterns into components.css classes so generated pages compose them instead of ad-hoc markup.',
          }),
          makeQualityCheck({
            id: 'html-design-system-token-usage',
            label: 'Page token discipline',
            score:
              signals.pagesTotal === 0 ? 1 : ratioScore(signals.pagesOnTokens, signals.pagesTotal),
            detail:
              signals.pagesTotal === 0
                ? 'No static pages are present yet to evaluate token usage.'
                : `${signals.pagesOnTokens} of ${signals.pagesTotal} pages use tokens or avoid raw inline color/spacing values.`,
            recommendation:
              'Replace raw inline color/spacing values on pages with var(--token) references or components.css classes.',
          }),
        ]
      : [
          makeQualityCheck({
            id: 'description-coverage',
            label: 'Description coverage',
            score: ratioScore(describedComponents, componentCount),
            detail:
              componentCount > 0
                ? `${describedComponents} of ${componentCount} indexed components have Description for AI coverage.`
                : 'No indexed components are available for description coverage.',
            recommendation:
              'Add Description for AI layers to high-traffic components or enrich the CSS catalog component docs.',
          }),
          makeQualityCheck({
            id: 'usage-cards',
            label: 'Usage cards',
            score: ratioScore(input.usageCards.length, componentCount),
            detail:
              componentCount > 0
                ? `${input.usageCards.length} usage cards are available for ${componentCount} components.`
                : 'No indexed components are available for usage-card coverage.',
            recommendation:
              'Run the usage scanner on representative source files or add focused component examples.',
          }),
        ]),
    makeQualityCheck({
      id: 'token-context',
      label: 'Token context',
      score: tokenCount > 0 ? 1 : 0.35,
      detail:
        tokenCount > 0
          ? `${tokenCount} design token records are indexed.`
          : 'No token records were detected in DESIGN.md or CSS custom properties.',
      recommendation: 'Expose project color, spacing, radius, and typography tokens to the index.',
    }),
    makeQualityCheck({
      id: 'diagnostics',
      label: 'Diagnostics',
      score: errors > 0 ? 0 : warnings > 0 ? Math.max(0.5, 1 - warnings * 0.12) : 1,
      detail:
        errors > 0 || warnings > 0
          ? `${errors} error diagnostics and ${warnings} warning diagnostics are present.`
          : 'No warning or error diagnostics are present.',
      recommendation: 'Resolve index diagnostics before relying on broad generation context.',
    }),
  ];
  const score = roundQualityScore(
    checks.reduce((sum, check) => sum + check.score, 0) / Math.max(1, checks.length),
  );
  return {
    score,
    checks,
    violations: checks
      .filter((check) => check.status !== 'passed')
      .map((check) => ({
        id: check.id,
        severity: check.status === 'failed' ? 'error' : 'warning',
        message: `${check.label}: ${check.detail}`,
        recommendation: check.recommendation ?? 'Review the design index source data.',
      })),
  };
}

function makeQualityCheck(input: {
  id: string;
  label: string;
  score: number;
  detail: string;
  recommendation?: string;
}): DesignIndexQualityCheck {
  const score = roundQualityScore(input.score);
  return {
    ...input,
    score,
    status: score >= 0.85 ? 'passed' : score >= 0.5 ? 'warning' : 'failed',
  };
}

function ratioScore(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

function roundQualityScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, Number(value.toFixed(2))));
}
