import { z } from 'zod';
import { Project, Node, SyntaxKind, type Node as TsMorphNode } from 'ts-morph';
import { resolveInside } from '@sber-designer/ast-bridge';
import {
  DESIGN_INDEX_PATHS,
  type IndexedComponentRecord,
  type ProjectProfileFile,
  type ScreenIndexRecord,
  type TokenRecord,
} from '@sber-designer/design-indexer';
import type { DesignModeDiagnostic, DesignProjectSupportLevel } from '@sber-designer/shared-types';

import { readWorkspaceFile } from './safe-fs';
import { validateWorkspaceRelativeImports } from './agent/workspace-import-validation';

export const DesignCompatibilityScreenSchema = z
  .object({
    screenId: z.string().min(1).optional(),
    filePath: z.string().min(1).optional(),
    implementationFilePath: z.string().min(1).optional(),
    storyPath: z.string().min(1).optional(),
    routePath: z.string().min(1).optional(),
  })
  .strict();

export const DesignCompatibilityInputSchema = z
  .object({
    workspacePath: z.string().optional(),
    screen: DesignCompatibilityScreenSchema,
  })
  .strict();

export type DesignCompatibilityScreenInput = z.infer<typeof DesignCompatibilityScreenSchema>;
export type DesignCompatibilityStatus = 'compatible' | 'needs-review' | 'missing';

export interface DesignCompatibilityResult {
  status: DesignCompatibilityStatus;
  projectSupport: DesignProjectSupportLevel;
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
    screenId?: string;
    storyPath?: string;
    routePath?: string;
  };
  summary: {
    jsxElements: number;
    inspectableElements: number;
    textNodes: number;
    editableProps: number;
    complexProps: number;
    indexedComponentsUsed: string[];
    indexedTokensUsed: string[];
  };
  diagnostics: DesignModeDiagnostic[];
  recommendations: string[];
  index: {
    matchedScreenId?: string;
    componentRecords: number;
    tokenRecords: number;
    sourceRoots: string[];
  };
}

interface ProjectIndexFacts {
  screens: ScreenIndexRecord[];
  components: IndexedComponentRecord[];
  tokens: TokenRecord[];
  profile: ProjectProfileFile | null;
}

interface ResolvedCompatibilityTarget {
  filePath: string | null;
  sourceScope: DesignCompatibilityResult['target']['sourceScope'];
  resolvedFrom: DesignCompatibilityResult['target']['resolvedFrom'];
  screen: ScreenIndexRecord | null;
}

export async function validateDesignScreenCompatibility(input: {
  workspaceRoot: string;
  screen: DesignCompatibilityScreenInput;
}): Promise<DesignCompatibilityResult> {
  const index = await loadProjectIndexFacts(input.workspaceRoot);
  const target = resolveCompatibilityTarget(input.screen, index.screens);
  const diagnostics: DesignModeDiagnostic[] = [];
  const recommendations: string[] = [];

  if (!target.filePath) {
    diagnostics.push({
      level: 'error',
      code: 'design.source-reference-missing',
      message:
        'No screen source reference was provided and the project index could not resolve one.',
    });
    recommendations.push('Select or register a screen with an implementation file before editing.');
    return buildResult({ target, index, diagnostics, recommendations, summary: emptySummary() });
  }

  let contents = '';
  try {
    contents = await readWorkspaceFile(input.workspaceRoot, target.filePath);
  } catch {
    diagnostics.push({
      level: 'error',
      code: 'design.source-missing',
      message: `Screen source file does not exist: ${target.filePath}.`,
      path: target.filePath,
    });
    recommendations.push('Regenerate the project index or repair the screen implementation path.');
    return buildResult({ target, index, diagnostics, recommendations, summary: emptySummary() });
  }

  const sourceFile = new Project({
    useInMemoryFileSystem: false,
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    skipLoadingLibFiles: true,
  }).addSourceFileAtPath(resolveInside(input.workspaceRoot, target.filePath));
  const summary = inspectSourceFile(sourceFile, index);

  try {
    await validateWorkspaceRelativeImports(input.workspaceRoot, target.filePath, contents);
  } catch (err) {
    diagnostics.push({
      level: 'error',
      code: 'design.workspace-imports',
      message: err instanceof Error ? err.message : String(err),
      path: target.filePath,
    });
    recommendations.push(
      'Use the public exported component names from the resolved project barrels.',
    );
  }

  if (!hasReadableRenderTarget(sourceFile)) {
    diagnostics.push({
      level: 'error',
      code: 'design.render-target-unreadable',
      message: 'No exported JSX render target was found in the screen source file.',
      path: target.filePath,
    });
    recommendations.push('Export a React component that returns JSX from the screen file.');
  }

  if (summary.jsxElements === 0) {
    diagnostics.push({
      level: 'error',
      code: 'design.jsx-missing',
      message: 'No JSX elements were found in the screen source file.',
      path: target.filePath,
    });
  }

  const rawHtml = findRawHtmlIssues(sourceFile);
  if (rawHtml.length > 0) {
    diagnostics.push({
      level: 'error',
      code: 'design.raw-html',
      message:
        'The screen hides editable UI in raw HTML or dangerouslySetInnerHTML, so Design mode cannot map key elements to JSX.',
      path: target.filePath,
    });
    recommendations.push(
      'Move visible UI out of raw HTML strings and into JSX elements or project components.',
    );
  }

  if (summary.complexClassNames > 0) {
    diagnostics.push({
      level: 'warning',
      code: 'design.complex-className',
      message:
        'Some className values are computed expressions. Design mode can inspect the screen, but class token controls may need assistant fallback.',
      path: target.filePath,
    });
  }

  if (summary.complexStyles > 0) {
    diagnostics.push({
      level: 'warning',
      code: 'design.complex-style',
      message:
        'Some style values are complex expressions. Prefer object literals or token classes for deterministic Design mode controls.',
      path: target.filePath,
    });
  }

  if (summary.inspectableElements === 0 && summary.jsxElements > 0) {
    diagnostics.push({
      level: 'warning',
      code: 'design.inspectable-subset-missing',
      message:
        'JSX exists, but no element has a useful subset of editable text, props, className, or style.',
      path: target.filePath,
    });
  }

  if (target.sourceScope === 'storybook-wrapper') {
    diagnostics.push({
      level: 'warning',
      code: 'design.storybook-wrapper',
      message:
        'The resolved file is a Storybook wrapper. Durable editable UI should live in the screen implementation file.',
      path: target.filePath,
    });
  }

  if (summary.indexedComponentsUsed.length === 0 && index.components.length > 0) {
    recommendations.push(
      'Use indexed project components where possible before introducing custom markup.',
    );
  }

  return buildResult({ target, index, diagnostics, recommendations, summary });
}

function buildResult(input: {
  target: ResolvedCompatibilityTarget;
  index: ProjectIndexFacts;
  diagnostics: DesignModeDiagnostic[];
  recommendations: string[];
  summary: CompatibilitySummary;
}): DesignCompatibilityResult {
  const hasMissingSource = input.diagnostics.some((item) => item.code === 'design.source-missing');
  const hasError = input.diagnostics.some((item) => item.level === 'error');
  const hasWarning = input.diagnostics.some((item) => item.level === 'warning');
  const status: DesignCompatibilityStatus = hasMissingSource
    ? 'missing'
    : hasError || hasWarning
      ? 'needs-review'
      : 'compatible';
  const projectSupport: DesignProjectSupportLevel =
    status === 'compatible' || (!hasError && input.summary.inspectableElements > 0)
      ? 'design-readable'
      : 'baseline-selection';

  return {
    status,
    projectSupport,
    target: {
      filePath: input.target.filePath,
      sourceScope: input.target.sourceScope,
      resolvedFrom: input.target.resolvedFrom,
      ...(input.target.screen?.id ? { screenId: input.target.screen.id } : {}),
      ...(input.target.screen?.storyPath ? { storyPath: input.target.screen.storyPath } : {}),
      ...(input.target.screen?.routePath ? { routePath: input.target.screen.routePath } : {}),
    },
    summary: {
      jsxElements: input.summary.jsxElements,
      inspectableElements: input.summary.inspectableElements,
      textNodes: input.summary.textNodes,
      editableProps: input.summary.editableProps,
      complexProps: input.summary.complexProps,
      indexedComponentsUsed: input.summary.indexedComponentsUsed,
      indexedTokensUsed: input.summary.indexedTokensUsed,
    },
    diagnostics: input.diagnostics,
    recommendations: input.recommendations,
    index: {
      ...(input.target.screen?.id ? { matchedScreenId: input.target.screen.id } : {}),
      componentRecords: input.index.components.length,
      tokenRecords: input.index.tokens.length,
      sourceRoots: input.index.profile?.sourceRoots ?? [],
    },
  };
}

interface CompatibilitySummary {
  jsxElements: number;
  inspectableElements: number;
  textNodes: number;
  editableProps: number;
  complexProps: number;
  complexClassNames: number;
  complexStyles: number;
  indexedComponentsUsed: string[];
  indexedTokensUsed: string[];
}

function inspectSourceFile(
  sourceFile: ReturnType<Project['addSourceFileAtPath']>,
  index: ProjectIndexFacts,
): CompatibilitySummary {
  const openings = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ];
  const componentNames = new Set(index.components.map((component) => component.shortName));
  const tokenNames = new Set(index.tokens.map((token) => token.name));
  const indexedComponentsUsed = new Set<string>();
  const indexedTokensUsed = new Set<string>();

  let textNodes = 0;
  let editableProps = 0;
  let complexProps = 0;
  let complexClassNames = 0;
  let complexStyles = 0;
  let inspectableElements = 0;

  for (const opening of openings) {
    const tagName = getTagName(opening);
    if (componentNames.has(tagName)) indexedComponentsUsed.add(tagName);
    let hasInspectablePart = false;
    const attrs = getAttributes(opening);
    for (const attr of attrs) {
      if (attr.getKind() === SyntaxKind.JsxSpreadAttribute) {
        complexProps += 1;
        continue;
      }
      const jsxAttr = attr.asKindOrThrow(SyntaxKind.JsxAttribute);
      const attrName = jsxAttr.getNameNode().getText();
      const initializer = jsxAttr.getInitializer();
      const propKind = classifyAttributeInitializer(initializer);
      if (propKind === 'simple') {
        editableProps += 1;
        hasInspectablePart = true;
        if (attrName === 'className') {
          for (const tokenName of tokenNames) {
            if (initializer?.getText().includes(tokenName)) indexedTokensUsed.add(tokenName);
          }
        }
        continue;
      }
      complexProps += 1;
      if (attrName === 'className') complexClassNames += 1;
      if (attrName === 'style') complexStyles += 1;
    }

    const parent = opening.getParentIfKind(SyntaxKind.JsxElement);
    if (parent && hasPlainTextChild(parent)) {
      textNodes += 1;
      hasInspectablePart = true;
    }
    if (hasInspectablePart || attrs.length === 0) inspectableElements += 1;
  }

  return {
    jsxElements: openings.length,
    inspectableElements,
    textNodes,
    editableProps,
    complexProps,
    complexClassNames,
    complexStyles,
    indexedComponentsUsed: Array.from(indexedComponentsUsed).sort(),
    indexedTokensUsed: Array.from(indexedTokensUsed).sort(),
  };
}

function resolveCompatibilityTarget(
  input: DesignCompatibilityScreenInput,
  screens: ScreenIndexRecord[],
): ResolvedCompatibilityTarget {
  if (input.implementationFilePath) {
    const screen = findScreenByImplementation(screens, input.implementationFilePath);
    return {
      filePath: normalizePath(input.implementationFilePath),
      sourceScope: 'screen-instance',
      resolvedFrom: 'implementationFilePath',
      screen,
    };
  }
  if (input.screenId) {
    const screen = screens.find(
      (item) =>
        item.id === input.screenId ||
        item.name.toLowerCase() === input.screenId?.toLowerCase() ||
        item.routePath === input.screenId,
    );
    if (screen) {
      return {
        filePath: normalizePath(screen.implementationPath),
        sourceScope: 'screen-instance',
        resolvedFrom: 'screenId',
        screen,
      };
    }
  }
  if (input.routePath) {
    const screen = screens.find((item) => item.routePath === input.routePath);
    if (screen) {
      return {
        filePath: normalizePath(screen.implementationPath),
        sourceScope: 'screen-instance',
        resolvedFrom: 'routePath',
        screen,
      };
    }
  }
  if (input.filePath) {
    const normalized = normalizePath(input.filePath);
    const storyScreen = screens.find(
      (item) => item.storyPath && normalizePath(item.storyPath) === normalized,
    );
    if (storyScreen) {
      return {
        filePath: normalizePath(storyScreen.implementationPath),
        sourceScope: 'screen-instance',
        resolvedFrom: 'indexed-story',
        screen: storyScreen,
      };
    }
    return {
      filePath: normalized,
      sourceScope: isStoryFile(normalized) ? 'storybook-wrapper' : 'screen-instance',
      resolvedFrom: 'filePath',
      screen: findScreenByImplementation(screens, normalized),
    };
  }
  if (input.storyPath) {
    const normalized = normalizePath(input.storyPath);
    const screen = screens.find(
      (item) => item.storyPath && normalizePath(item.storyPath) === normalized,
    );
    return {
      filePath: screen ? normalizePath(screen.implementationPath) : normalized,
      sourceScope: screen ? 'screen-instance' : 'storybook-wrapper',
      resolvedFrom: 'storyPath',
      screen: screen ?? null,
    };
  }
  return {
    filePath: null,
    sourceScope: 'unknown',
    resolvedFrom: 'unresolved',
    screen: null,
  };
}

function findScreenByImplementation(
  screens: ScreenIndexRecord[],
  filePath: string,
): ScreenIndexRecord | null {
  const normalized = normalizePath(filePath);
  return screens.find((item) => normalizePath(item.implementationPath) === normalized) ?? null;
}

function hasReadableRenderTarget(sourceFile: ReturnType<Project['addSourceFileAtPath']>): boolean {
  if (
    sourceFile
      .getFunctions()
      .some((fn) => (fn.isExported() || fn.isDefaultExport()) && fnContainsJsx(fn))
  ) {
    return true;
  }
  if (
    sourceFile.getVariableStatements().some((statement) => {
      if (!statement.isExported()) return false;
      return statement.getDeclarations().some((declaration) => fnContainsJsx(declaration));
    })
  ) {
    return true;
  }
  return sourceFile.getExportAssignments().some((assignment) => fnContainsJsx(assignment));
}

function fnContainsJsx(node: TsMorphNode): boolean {
  return Boolean(
    node.getFirstDescendant(
      (child) =>
        child.getKind() === SyntaxKind.JsxElement ||
        child.getKind() === SyntaxKind.JsxSelfClosingElement ||
        child.getKind() === SyntaxKind.JsxFragment,
    ),
  );
}

function findRawHtmlIssues(sourceFile: ReturnType<Project['addSourceFileAtPath']>): TsMorphNode[] {
  return sourceFile.getDescendants().filter((node) => {
    if (node.getKind() === SyntaxKind.JsxAttribute) {
      const attr = node.asKindOrThrow(SyntaxKind.JsxAttribute);
      return attr.getNameNode().getText() === 'dangerouslySetInnerHTML';
    }
    if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
      return /<[a-z][\w-]*(\s|>)/i.test(node.getLiteralText());
    }
    return false;
  });
}

function getTagName(node: TsMorphNode): string {
  if (node.getKind() === SyntaxKind.JsxOpeningElement) {
    return node.asKindOrThrow(SyntaxKind.JsxOpeningElement).getTagNameNode().getText();
  }
  return node.asKindOrThrow(SyntaxKind.JsxSelfClosingElement).getTagNameNode().getText();
}

function getAttributes(node: TsMorphNode) {
  if (node.getKind() === SyntaxKind.JsxOpeningElement) {
    return node.asKindOrThrow(SyntaxKind.JsxOpeningElement).getAttributes();
  }
  return node.asKindOrThrow(SyntaxKind.JsxSelfClosingElement).getAttributes();
}

function classifyAttributeInitializer(initializer: TsMorphNode | undefined): 'simple' | 'complex' {
  if (!initializer) return 'simple';
  if (Node.isStringLiteral(initializer)) return 'simple';
  if (initializer.getKind() !== SyntaxKind.JsxExpression) return 'complex';
  const expression = initializer.asKindOrThrow(SyntaxKind.JsxExpression).getExpression();
  if (!expression) return 'complex';
  if (
    Node.isStringLiteral(expression) ||
    Node.isNoSubstitutionTemplateLiteral(expression) ||
    Node.isNumericLiteral(expression) ||
    expression.getKind() === SyntaxKind.TrueKeyword ||
    expression.getKind() === SyntaxKind.FalseKeyword ||
    Node.isObjectLiteralExpression(expression)
  ) {
    return 'simple';
  }
  return 'complex';
}

function hasPlainTextChild(node: TsMorphNode): boolean {
  if (!Node.isJsxElement(node)) return false;
  return node
    .getJsxChildren()
    .some((child) => child.getKind() === SyntaxKind.JsxText && child.getText().trim().length > 0);
}

async function loadProjectIndexFacts(workspaceRoot: string): Promise<ProjectIndexFacts> {
  const [screens, components, tokensFile, profile] = await Promise.all([
    readJsonl<ScreenIndexRecord>(workspaceRoot, DESIGN_INDEX_PATHS.screens),
    readJsonl<IndexedComponentRecord>(workspaceRoot, DESIGN_INDEX_PATHS.components),
    readJson<{ tokens?: TokenRecord[] }>(workspaceRoot, DESIGN_INDEX_PATHS.tokens, { tokens: [] }),
    readJson<ProjectProfileFile | null>(workspaceRoot, DESIGN_INDEX_PATHS.projectProfile, null),
  ]);
  return {
    screens,
    components,
    tokens: tokensFile?.tokens ?? [],
    profile,
  };
}

async function readJsonl<T>(workspaceRoot: string, filePath: string): Promise<T[]> {
  let contents = '';
  try {
    contents = await readWorkspaceFile(workspaceRoot, filePath);
  } catch {
    return [];
  }
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as T];
      } catch {
        return [];
      }
    });
}

async function readJson<T>(workspaceRoot: string, filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readWorkspaceFile(workspaceRoot, filePath)) as T;
  } catch {
    return fallback;
  }
}

function emptySummary(): CompatibilitySummary {
  return {
    jsxElements: 0,
    inspectableElements: 0,
    textNodes: 0,
    editableProps: 0,
    complexProps: 0,
    complexClassNames: 0,
    complexStyles: 0,
    indexedComponentsUsed: [],
    indexedTokensUsed: [],
  };
}

function isStoryFile(filePath: string): boolean {
  return /\.(stories|story)\.[tj]sx?$/.test(filePath);
}

function normalizePath(path: string): string {
  return path.split('\\').join('/').replace(/^\.\//, '');
}
