import { Project, Node, SyntaxKind } from 'ts-morph';
import { z } from 'zod';
import { DESIGN_INDEX_PATHS, type TokenRecord } from '@sber-designer/design-indexer';
import { resolveInside } from '@sber-designer/ast-bridge';
import {
  applyScreenReadinessProfile,
  isHtmlDesignSystemCanonical,
  type ProjectScreenSurface,
  type ScreenReadinessCategoryId,
  type ScreenReadinessCategoryResult,
  type ScreenReadinessProfile,
  type ScreenReadinessProfileInput,
} from '@sber-designer/shared-types';

import {
  DesignCompatibilityScreenSchema,
  validateDesignScreenCompatibility,
  type DesignCompatibilityScreenInput,
} from './design-compatibility';
import type { ScreenCraftProfile } from './generation-mode';
import { readWorkspaceFile } from './safe-fs';
import { findScreenTypeErrors } from './screen-typecheck';
import type { TaskRelevantComponentPack } from './component-intelligence/component-pack';
import { analyzeComponentReuse, analyzeHtmlComponentReuse } from './screen-craft-reuse';
import { findModalContractIssues, findPageModalMismatch } from './screen-craft-modal';

export type ScreenCraftSeverity = 'blocking' | 'should-fix' | 'advisory';
export type ScreenCraftStatus = 'passed' | 'findings' | 'blocked' | 'missing';

export const SCREEN_CRAFT_RULE_IDS = [
  'craft.card-soup',
  'craft.component-family.missing-data-table',
  'craft.component-reuse.design-system-gap',
  'craft.component-reuse.missing-breadcrumb',
  'craft.component-reuse.missing-page-header',
  'craft.component-reuse.missing-section-header',
  'craft.component-reuse.missing-tile',
  'craft.component-reuse.optional-candidate-unused',
  'craft.component-reuse.required-component-missing',
  'craft.data-table.numeric-alignment',
  'craft.default-palette',
  'craft.emoji-icon',
  'craft.fake-metric',
  'craft.form.missing-error-state',
  'craft.icon-button-label',
  'craft.marketing-hero',
  'craft.missing-state',
  'craft.modal.accessibility',
  'craft.modal.ambiguous-window',
  'craft.modal.backdrop-root',
  'craft.modal.content-mode',
  'craft.modal.grow-contract',
  'craft.modal.missing-body-region',
  'craft.modal.missing-window',
  'craft.modal.non-forwarding-window',
  'craft.modal.opaque-host',
  'craft.modal.page-surface-mismatch',
  'craft.modal.region-contract',
  'craft.modal.scroll-contract',
  'craft.modal.size-not-in-contract',
  'craft.placeholder-asset',
  'craft.raw-font-family',
  'craft.raw-hex',
  'craft.react-hook-outside-component',
  'craft.source-missing',
] as const;

export interface ScreenCraftFinding {
  severity: ScreenCraftSeverity;
  ruleId: string;
  category?: ScreenReadinessCategoryId;
  message: string;
  filePath?: string;
  fixHint?: string;
  componentRole?: string;
  repairStage?: 'retrieve-hydrate-repair';
}

export interface ScreenCraftComponentReuseSummary {
  expected: string[];
  used: string[];
  missing: string[];
  exact: string[];
  substituted: {
    role: string;
    expected: string;
    componentId: string;
    used: string[];
  }[];
  skipped: {
    role: string;
    expected: string;
    componentId: string;
  }[];
  requiredRoles?: string[];
  usedComponentIds?: string[];
  missingRequiredRoles?: string[];
  designSystemGaps?: string[];
  optionalSkipped?: {
    role: string;
    expected: string;
    componentId: string;
  }[];
  score: {
    earned: number;
    total: number;
    label: string;
  };
}

export interface ScreenCraftResult {
  profile: ScreenCraftProfile;
  status: ScreenCraftStatus;
  target: {
    filePath: string | null;
    sourceScope: 'screen-instance' | 'storybook-wrapper' | 'unknown';
    resolvedFrom:
      | 'implementationFilePath'
      | 'filePath'
      | 'storyPath'
      | 'screenId'
      | 'routePath'
      | 'indexed-story'
      | 'unresolved';
  };
  summary: {
    checkedFiles: string[];
    findings: {
      blocking: number;
      shouldFix: number;
      advisory: number;
    };
  };
  findings: ScreenCraftFinding[];
  componentReuse?: ScreenCraftComponentReuseSummary;
  readiness?: {
    profile: ScreenReadinessProfile;
    categoryResults: Record<ScreenReadinessCategoryId, ScreenReadinessCategoryResult>;
    summary: {
      blocking: number;
      shouldFix: number;
      advisory: number;
      total: number;
    };
  };
}

export const ScreenCraftInputSchema = z
  .object({
    workspacePath: z.string().optional(),
    screen: DesignCompatibilityScreenSchema,
    profile: z.enum(['standard', 'wireframe']).optional(),
    surface: z.enum(['page', 'modal']).optional(),
  })
  .strict();

export async function validateScreenCraft(input: {
  workspaceRoot: string;
  screen: DesignCompatibilityScreenInput;
  componentPack?: TaskRelevantComponentPack | null | undefined;
  screenReadiness?: ScreenReadinessProfileInput | ScreenReadinessProfile | null | undefined;
  profile?: ScreenCraftProfile | undefined;
  surface?: ProjectScreenSurface | undefined;
}): Promise<ScreenCraftResult> {
  const profile = input.profile ?? 'standard';
  const isModal = input.surface === 'modal';
  const compatibility = await validateDesignScreenCompatibility(input);
  const filePath = compatibility.target.filePath;
  const target = {
    filePath,
    sourceScope: compatibility.target.sourceScope,
    resolvedFrom: compatibility.target.resolvedFrom,
  };

  if (!filePath) {
    return buildResult({
      target,
      profile,
      checkedFiles: [],
      screenReadiness: input.screenReadiness,
      findings: [
        {
          severity: 'blocking',
          ruleId: 'craft.source-missing',
          message: 'No screen source file could be resolved for craft validation.',
          fixHint: 'Register the screen with an implementation file before running craft checks.',
        },
      ],
    });
  }

  let contents = '';
  try {
    contents = await readWorkspaceFile(input.workspaceRoot, filePath);
  } catch {
    return buildResult({
      target,
      profile,
      checkedFiles: [],
      screenReadiness: input.screenReadiness,
      findings: [
        {
          severity: 'blocking',
          ruleId: 'craft.source-missing',
          filePath,
          message: `Screen source file does not exist: ${filePath}.`,
          fixHint: 'Repair the screen implementation path or regenerate the project index.',
        },
      ],
    });
  }

  const tokens = await loadTokenRecords(input.workspaceRoot);
  const isHtmlSource = /\.html?$/iu.test(filePath);
  const enforceDesignSystemPalette =
    isHtmlSource && (await loadConnectedHtmlDesignSystem(input.workspaceRoot));
  const sourceFile = isHtmlSource
    ? null
    : new Project({
        useInMemoryFileSystem: false,
        skipAddingFilesFromTsConfig: true,
        skipFileDependencyResolution: true,
        skipLoadingLibFiles: true,
      }).addSourceFileAtPath(resolveInside(input.workspaceRoot, filePath));

  const componentReuse = sourceFile
    ? analyzeComponentReuse(contents, sourceFile, filePath, input.componentPack)
    : analyzeHtmlComponentReuse(contents, filePath, input.componentPack);

  // G3: run the project's own TypeScript types over the generated file. Catches
  // the contract class (wrong prop name/shape, invalid union token, wrong import
  // module) deterministically, before the screen is handed back as done.
  const typeFindings = isHtmlSource
    ? []
    : await findScreenTypeErrors({
        workspaceRoot: input.workspaceRoot,
        filePath,
      });

  return buildResult({
    target,
    profile,
    checkedFiles: [filePath],
    screenReadiness: input.screenReadiness,
    skippedCategories:
      tokens.length === 0 && (!input.componentPack || input.componentPack.candidates.length === 0)
        ? {
            designSystemFit:
              'No indexed tokens or task-relevant component pack were available for this check.',
          }
        : undefined,
    findings: [
      ...typeFindings,
      ...(sourceFile ? findReactHooksOutsideComponents(sourceFile, filePath) : []),
      ...(profile === 'wireframe' ? [] : findFakeMetrics(contents, filePath)),
      ...findRawHexValues(contents, filePath, tokens, enforceDesignSystemPalette),
      ...findRawFontFamilies(contents, filePath, tokens, enforceDesignSystemPalette),
      ...(sourceFile ? findIconOnlyButtons(sourceFile, filePath) : []),
      ...findHtmlProfileIssues(contents, filePath, enforceDesignSystemPalette),
      ...(profile === 'wireframe' ? [] : findMissingStates(contents, filePath)),
      ...(profile === 'wireframe' ? [] : findNativeTableNumericAlignment(contents, filePath)),
      ...(profile === 'wireframe' ? [] : findMissingFormErrorState(contents, filePath)),
      // A modal is one dialog, not a page: card-soup and marketing-hero
      // heuristics and page-region reuse expectations don't apply (Р-11).
      ...(isModal ? [] : findCardSoup(contents, filePath)),
      ...(isModal ? [] : findMarketingHeroLanguage(contents, filePath)),
      ...(profile === 'wireframe'
        ? []
        : isModal
          ? filterModalReuseFindings(componentReuse.findings)
          : componentReuse.findings),
      ...(isModal ? findModalContractIssues(contents, filePath) : []),
      ...(input.surface === 'page' ? findPageModalMismatch(contents, filePath) : []),
    ],
    componentReuse: componentReuse.summary,
  });
}

function buildResult(input: {
  target: ScreenCraftResult['target'];
  profile: ScreenCraftProfile;
  checkedFiles: string[];
  findings: ScreenCraftFinding[];
  componentReuse?: ScreenCraftComponentReuseSummary | undefined;
  screenReadiness?: ScreenReadinessProfileInput | ScreenReadinessProfile | null | undefined;
  skippedCategories?: Partial<Record<ScreenReadinessCategoryId, string>> | undefined;
}): ScreenCraftResult {
  const readiness = applyScreenReadinessProfile({
    profile: input.screenReadiness,
    findings: input.findings,
    skippedCategories: input.skippedCategories,
  });
  const blocking = readiness.summary.blocking;
  const shouldFix = readiness.summary.shouldFix;
  const advisory = readiness.summary.advisory;
  return {
    status:
      input.checkedFiles.length === 0
        ? 'missing'
        : blocking > 0
          ? 'blocked'
          : readiness.findings.length > 0
            ? 'findings'
            : 'passed',
    target: input.target,
    profile: input.profile,
    summary: {
      checkedFiles: input.checkedFiles,
      findings: { blocking, shouldFix, advisory },
    },
    findings: readiness.findings,
    readiness: {
      profile: readiness.profile,
      categoryResults: readiness.categoryResults,
      summary: readiness.summary,
    },
    ...(input.componentReuse ? { componentReuse: input.componentReuse } : {}),
  };
}

/** Page-region reuse expectations that a modal dialog does not owe (Р-11). */
const MODAL_IRRELEVANT_REUSE_RULES = new Set([
  'craft.component-reuse.missing-page-header',
  'craft.component-reuse.missing-breadcrumb',
  'craft.component-reuse.missing-section-header',
  'craft.component-reuse.missing-tile',
]);

function filterModalReuseFindings(findings: ScreenCraftFinding[]): ScreenCraftFinding[] {
  return findings.filter((finding) => !MODAL_IRRELEVANT_REUSE_RULES.has(finding.ruleId));
}

function findFakeMetrics(contents: string, filePath: string): ScreenCraftFinding[] {
  if (hasScreenLocalMockDataMarker(contents)) return [];
  const metricPattern =
    /(?:[$€£]\s?\d[\d,.]*(?:\.\d+)?\s?(?:k|m|b|bn|mm)?|\b\d+(?:\.\d+)?\s?%|\b\d{1,3}(?:,\d{3})+\b)/giu;
  const findings: ScreenCraftFinding[] = [];
  for (const match of contents.matchAll(metricPattern)) {
    const index = match.index ?? 0;
    const context = contents.slice(Math.max(0, index - 80), index + 120).toLowerCase();
    if (/\b(mock|sample|demo|placeholder|example|fixture|test)\b/u.test(context)) continue;
    if (/(?:ндс|\bvat\b)/u.test(context)) continue;
    if (isCssNumericContext(contents, index)) continue;
    findings.push({
      severity: 'blocking',
      ruleId: 'craft.fake-metric',
      filePath,
      message: `Screen contains an invented-looking metric (${match[0]}) without a mock/sample label.`,
      fixHint: 'Use real bound data, remove the metric, or clearly mark the data as mock/sample.',
    });
    break;
  }
  return findings;
}

function isCssNumericContext(contents: string, index: number): boolean {
  const lineStart = Math.max(0, contents.lastIndexOf('\n', index) + 1);
  const nextLine = contents.indexOf('\n', index);
  const lineEnd = nextLine === -1 ? contents.length : nextLine;
  const line = contents.slice(lineStart, lineEnd).toLowerCase();
  if (/\b(?:linear|radial|conic)-gradient\(|\b(?:calc|hsl|hsla|rgb|rgba|oklch|var)\(/u.test(line)) {
    return true;
  }
  const before = contents.slice(Math.max(0, index - 160), index).toLowerCase();
  const after = contents.slice(index, Math.min(contents.length, index + 80)).toLowerCase();
  const withinStyleObject =
    /(?:style|sx)\s*=\s*\{\{[^}]*$/u.test(before) && /^[^}]*\}\}/u.test(after);
  const cssPropertyMatch =
    /\b(?:width|height|min-width|max-width|min-height|max-height|top|left|right|bottom|padding|margin|gap|inset|opacity|transform|translate|rotate|scale|border|borderradius|radius|color|background|grid-template|font-size|line-height)\s*:\s*[^;\n]*$/u.exec(
      before,
    );
  const cssPropertyBeforeMetric = Boolean(cssPropertyMatch && !/[<>]/u.test(cssPropertyMatch[0]));
  const jsxLayoutPropertyBeforeMetric =
    /\b(?:width|height|minwidth|maxwidth|minheight|maxheight|top|left|right|bottom|padding|margin|gap|inset|opacity|transform|translate|rotate|scale|borderradius|fontsize|lineheight)\s*=\s*(?:\{[^}\n]*)?(?:["'`][^"'`\n]*)?$/u.test(
      line.slice(0, index - lineStart),
    );
  return withinStyleObject || cssPropertyBeforeMetric || jsxLayoutPropertyBeforeMetric;
}

function hasScreenLocalMockDataMarker(contents: string): boolean {
  return /\b(mock data|sample data|fixture data|demo data|brd sample|reference-backed content)\b/iu.test(
    contents,
  );
}

function findRawHexValues(
  contents: string,
  filePath: string,
  tokens: TokenRecord[],
  enforceDesignSystemPalette: boolean,
): ScreenCraftFinding[] {
  if (tokens.length === 0) return [];
  const rawHexes = Array.from(new Set(contents.match(/#[0-9a-fA-F]{3,8}\b/gu) ?? []));
  if (rawHexes.length === 0) return [];
  return [
    {
      severity: enforceDesignSystemPalette ? 'blocking' : 'should-fix',
      ruleId: 'craft.raw-hex',
      filePath,
      message: enforceDesignSystemPalette
        ? `Screen introduces raw color value${rawHexes.length === 1 ? '' : 's'} ${listCraftValues(rawHexes)} outside the connected design system. Use only tokens from tokens.css.`
        : `Screen uses raw color value${rawHexes.length === 1 ? '' : 's'} ${listCraftValues(rawHexes)} while project tokens are indexed.`,
      fixHint: 'Map visual colors to project tokens or token-backed utility classes.',
    },
  ];
}

function findRawFontFamilies(
  contents: string,
  filePath: string,
  tokens: TokenRecord[],
  enforceDesignSystemPalette: boolean,
): ScreenCraftFinding[] {
  if (!enforceDesignSystemPalette) return [];
  if (!tokens.some((token) => token.kind === 'typography')) return [];
  const rawFonts = extractRawFontFamilies(contents);
  if (rawFonts.length === 0) return [];
  return [
    {
      severity: 'blocking',
      ruleId: 'craft.raw-font-family',
      filePath,
      message: `Screen sets font-family ${listCraftValues(rawFonts)} outside the connected design system. Use var(--font-*) tokens from tokens.css.`,
      fixHint: 'Reference the project typography tokens (for example var(--font-sans)).',
    },
  ];
}

function extractRawFontFamilies(contents: string): string[] {
  const values = new Set<string>();
  const declarationRe = /font-family\s*:\s*([^;{}]+)/giu;
  let match: RegExpExecArray | null;
  while ((match = declarationRe.exec(contents))) {
    const value = (match[1] ?? '').replace(/\s+/gu, ' ').trim();
    if (!value) continue;
    if (/var\(\s*--/u.test(value)) continue;
    if (/^(?:inherit|initial|unset|revert|revert-layer)$/iu.test(value)) continue;
    values.add(value.replace(/["']/gu, ''));
  }
  return [...values];
}

function listCraftValues(values: string[]): string {
  return values.slice(0, 8).join(', ');
}

function findHtmlProfileIssues(
  contents: string,
  filePath: string,
  enforceDesignSystemPalette: boolean,
): ScreenCraftFinding[] {
  if (!/\.html?$/iu.test(filePath)) return [];
  return [
    ...findDefaultPaletteUtilities(contents, filePath, enforceDesignSystemPalette),
    ...findEmojiIconUsage(contents, filePath),
    ...findPlaceholderAssets(contents, filePath),
  ];
}

function findDefaultPaletteUtilities(
  contents: string,
  filePath: string,
  enforceDesignSystemPalette: boolean,
): ScreenCraftFinding[] {
  const match = contents.match(
    /\b(?:bg|text|border)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/iu,
  );
  if (!match) return [];
  return [
    {
      severity: enforceDesignSystemPalette ? 'blocking' : 'should-fix',
      ruleId: 'craft.default-palette',
      filePath,
      message: `HTML profile uses default utility palette class ${match[0]} instead of project CSS tokens/classes.`,
      fixHint:
        'Use indexed CSS catalog classes or token-backed custom properties such as var(--color-*).',
    },
  ];
}

function findEmojiIconUsage(contents: string, filePath: string): ScreenCraftFinding[] {
  if (!/(?:[\u{1F300}-\u{1FAFF}]|\u2699)/u.test(contents)) return [];
  return [
    {
      severity: 'should-fix',
      ruleId: 'craft.emoji-icon',
      filePath,
      message: 'HTML profile uses an emoji or symbol as a UI icon.',
      fixHint:
        'Use project icon assets, inline SVG from the icon catalog, or an accessible text label.',
    },
  ];
}

function findPlaceholderAssets(contents: string, filePath: string): ScreenCraftFinding[] {
  const assetMatch = contents.match(
    /https?:\/\/(?:placehold\.co|via\.placeholder\.com|picsum\.photos|dummyimage\.com|loremflickr\.com)\b|placeholder\.(?:png|jpe?g|svg)/iu,
  );
  const incompleteRegionMatch = contents.match(
    /<!--[\s\S]{0,120}\b(?:placeholder|todo|chart here|svg icons? here|more (?:kpi|wallet|card|item)|inline svg or css for (?:the )?chart)\b[\s\S]{0,120}?-->/iu,
  );
  const match = assetMatch ?? incompleteRegionMatch;
  if (!match) return [];
  return [
    {
      severity: 'should-fix',
      ruleId: 'craft.placeholder-asset',
      filePath,
      message: assetMatch
        ? `HTML profile references placeholder imagery (${match[0]}).`
        : 'HTML profile leaves a visible reference region as a placeholder comment.',
      fixHint: assetMatch
        ? 'Use indexed project assets, generated reviewable assets, or remove decorative placeholder media.'
        : 'Implement the visible region with real markup, inline SVG, CSS geometry, or a project asset.',
    },
  ];
}

const REACT_HOOK_NAME_PATTERN =
  /^use(?:State|Reducer|Effect|LayoutEffect|InsertionEffect|Memo|Callback|Ref|ImperativeHandle|Context|DeferredValue|Transition|Id|SyncExternalStore|ActionState|Optimistic|FormStatus|FormState|[A-Z0-9].*)$/u;

function findReactHooksOutsideComponents(
  sourceFile: import('ts-morph').SourceFile,
  filePath: string,
): ScreenCraftFinding[] {
  const findings: ScreenCraftFinding[] = [];
  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const hookName = reactHookCallName(call);
    if (!hookName) continue;
    const owner = nearestFunctionOwner(call);
    if (owner && (isPascalCaseName(owner) || isReactHookName(owner))) continue;
    findings.push({
      severity: 'blocking',
      ruleId: 'craft.react-hook-outside-component',
      filePath,
      message: `React Hook ${hookName} is called outside a function component or custom hook at line ${call.getStartLineNumber()}.`,
      fixHint:
        'Move the hook call inside a PascalCase component/custom hook, or replace static module-level derived data with a plain constant.',
    });
  }
  return findings.slice(0, 4);
}

function reactHookCallName(call: import('ts-morph').CallExpression): string | null {
  const expression = call.getExpression();
  if (Node.isIdentifier(expression)) {
    const name = expression.getText();
    return isReactHookName(name) ? name : null;
  }
  if (Node.isPropertyAccessExpression(expression)) {
    const name = expression.getName();
    return isReactHookName(name) ? name : null;
  }
  return null;
}

function isReactHookName(name: string): boolean {
  return REACT_HOOK_NAME_PATTERN.test(name);
}

function nearestFunctionOwner(node: Node): string | null {
  const fn = node.getFirstAncestor(
    (ancestor) =>
      Node.isFunctionDeclaration(ancestor) ||
      Node.isFunctionExpression(ancestor) ||
      Node.isArrowFunction(ancestor) ||
      Node.isMethodDeclaration(ancestor),
  );
  if (!fn) return null;
  if (
    Node.isFunctionDeclaration(fn) ||
    Node.isFunctionExpression(fn) ||
    Node.isMethodDeclaration(fn)
  ) {
    return fn.getName() ?? namedVariableOwner(fn);
  }
  return namedVariableOwner(fn);
}

function namedVariableOwner(node: Node): string | null {
  const variable = node.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  const variableName = variable?.getNameNode().getText();
  return variableName && /^[A-Za-z_$][\w$]*$/u.test(variableName) ? variableName : null;
}

function isPascalCaseName(name: string): boolean {
  return /^[A-Z][A-Za-z0-9]*$/u.test(name);
}

function findIconOnlyButtons(sourceFile: import('ts-morph').SourceFile, filePath: string) {
  const findings: ScreenCraftFinding[] = [];
  for (const opening of sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement)) {
    const tagName = opening.getTagNameNode().getText();
    if (!isButtonLikeTag(tagName)) continue;
    if (hasAccessibleName(opening)) continue;
    const parent = opening.getParent();
    if (!Node.isJsxElement(parent)) continue;
    const text = collectVisibleJsxText(parent);
    if (text.length > 0) continue;
    if (!/<[A-Z][A-Za-z0-9]*Icon\b|<Icon\b/u.test(parent.getText())) continue;
    findings.push({
      severity: 'blocking',
      ruleId: 'craft.icon-button-label',
      filePath,
      message: `Icon-only ${tagName} is missing an accessible label.`,
      fixHint: 'Add aria-label, aria-labelledby, title, or visible text for the control.',
    });
  }
  return findings.slice(0, 4);
}

function collectVisibleJsxText(element: import('ts-morph').JsxElement): string {
  return element
    .getDescendants()
    .filter((descendant) => descendant.getKind() === SyntaxKind.JsxText)
    .map((descendant) => descendant.getText().trim())
    .filter(Boolean)
    .join('');
}

function findMissingStates(contents: string, filePath: string): ScreenCraftFinding[] {
  const hasDataSurface = /<\w*(?:DataTable|Table|List|Grid)\b|\b(?:rows|items|data)=/u.test(
    contents,
  );
  if (!hasDataSurface) return [];
  const hasStateCopy =
    /\b(empty|loading|error|skeleton|no results|no items|isLoading|isError)\b/iu.test(contents);
  if (hasStateCopy) return [];
  return [
    {
      severity: 'should-fix',
      ruleId: 'craft.missing-state',
      filePath,
      message: 'Data-heavy UI appears to lack explicit empty, loading, or error states.',
      fixHint:
        'Add visible empty/loading/error states or route them through the project component API.',
    },
  ];
}

function findNativeTableNumericAlignment(contents: string, filePath: string): ScreenCraftFinding[] {
  const tables = contents.match(/<table\b[\s\S]*?<\/table>/giu) ?? [];
  const table = tables.find((candidate) => {
    const hasNumericColumn =
      /\b(amount|balance|price|total|count|quantity|rate|percent|percentage|сумма|баланс|цена|итого|количество|процент|ставка)\b/iu.test(
        candidate,
      ) || /[$€£₽]\s*(?:\d|\{)/u.test(candidate);
    const hasNumericAlignment =
      /\b(?:text-(?:right|end)|justify-end|tabular-nums|numeric)\b/iu.test(candidate) ||
      /\b(?:text-align\s*:\s*(?:right|end)|align\s*=\s*["'](?:right|end)["'])/iu.test(candidate) ||
      /\b(?:textAlign|align)\s*:\s*["'](?:right|end)["']/u.test(candidate);
    return hasNumericColumn && !hasNumericAlignment;
  });
  if (!table) return [];
  return [
    {
      severity: 'should-fix',
      ruleId: 'craft.data-table.numeric-alignment',
      filePath,
      message: 'Native table has a numeric column without explicit end alignment.',
      fixHint:
        'Right/end-align numeric headers and cells and use tabular numerals or the project table numeric-column API.',
    },
  ];
}

function findMissingFormErrorState(contents: string, filePath: string): ScreenCraftFinding[] {
  const hasForm = /<(?:form|[A-Z][A-Za-z0-9]*(?:Form|Field))\b/u.test(contents);
  const hasRequiredField = /\b(?:required|aria-required)\b/u.test(contents);
  if (!hasForm || !hasRequiredField) return [];
  const hasRecoverableError =
    /\b(?:aria-invalid|role\s*=\s*["']alert["']|FormMessage|FieldError|ErrorMessage|validationMessage|invalid|errors?\s*(?:\.|\[))/iu.test(
      contents,
    );
  if (hasRecoverableError) return [];
  return [
    {
      severity: 'should-fix',
      ruleId: 'craft.form.missing-error-state',
      filePath,
      message: 'Form has required fields but no explicit recoverable validation error state.',
      fixHint:
        'Render a field-level error, connect it with aria-invalid/aria-describedby, and keep correction possible after submit.',
    },
  ];
}

function findCardSoup(contents: string, filePath: string): ScreenCraftFinding[] {
  const cardCount =
    (contents.match(/<Card\b/gu)?.length ?? 0) +
    (contents.match(/className=["'][^"']*\bcard\b/giu)?.length ?? 0);
  if (cardCount < 6) return [];
  if (/<(?:table|form)\b|<\w*(?:DataTable|Table|Form|Stepper|Tabs)\b/iu.test(contents)) return [];
  return [
    {
      severity: 'advisory',
      ruleId: 'craft.card-soup',
      filePath,
      message: 'Screen is dominated by repeated cards without an obvious workflow surface.',
      fixHint: 'Prefer workflow, table, form, or comparison layouts when the task is operational.',
    },
  ];
}

function findMarketingHeroLanguage(contents: string, filePath: string): ScreenCraftFinding[] {
  if (
    !/\b(hero|unlock|transform|accelerate|start your journey|get started today)\b/iu.test(contents)
  ) {
    return [];
  }
  if (
    /\b(dashboard|queue|approvals|operations|settings|admin|case management)\b/iu.test(contents)
  ) {
    return [
      {
        severity: 'advisory',
        ruleId: 'craft.marketing-hero',
        filePath,
        message: 'Operational product UI appears to contain marketing hero language.',
        fixHint: 'Use task-focused headings and controls instead of landing-page language.',
      },
    ];
  }
  return [];
}

function isButtonLikeTag(tagName: string): boolean {
  return tagName === 'button' || /(^|\.)(Icon)?Button$/u.test(tagName);
}

function hasAccessibleName(opening: import('ts-morph').JsxOpeningElement): boolean {
  return opening.getAttributes().some((attribute) => {
    if (!Node.isJsxAttribute(attribute)) return false;
    const name = attribute.getNameNode().getText();
    return name === 'aria-label' || name === 'aria-labelledby' || name === 'title';
  });
}

async function loadTokenRecords(workspaceRoot: string): Promise<TokenRecord[]> {
  try {
    const parsed = JSON.parse(
      await readWorkspaceFile(workspaceRoot, DESIGN_INDEX_PATHS.tokens),
    ) as {
      tokens?: TokenRecord[];
    };
    return Array.isArray(parsed.tokens) ? parsed.tokens : [];
  } catch {
    return [];
  }
}

/**
 * 0108.5.3: enforce the "do not invent a palette" contract only when the
 * project ships a connected HTML design system (Design.md + tokens.css +
 * components.css). Bootstrap/react projects keep the softer should-fix rule.
 */
async function loadConnectedHtmlDesignSystem(workspaceRoot: string): Promise<boolean> {
  try {
    const manifest = JSON.parse(
      await readWorkspaceFile(workspaceRoot, DESIGN_INDEX_PATHS.manifest),
    ) as {
      projectProfile?: {
        componentModel?: string;
        htmlDesignSystem?: { status?: string };
      };
    };
    return (
      manifest.projectProfile?.componentModel === 'css-catalog' &&
      isHtmlDesignSystemCanonical(
        manifest.projectProfile?.htmlDesignSystem?.status as
          | import('@sber-designer/shared-types').HtmlDesignSystemStatus
          | undefined,
      )
    );
  } catch {
    return false;
  }
}
