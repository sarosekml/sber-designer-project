import { isAbsolute, relative } from 'node:path';
import { Project, Node, type SourceFile, SyntaxKind } from 'ts-morph';
import { resolveInside } from '@sber-designer/ast-bridge';
import {
  DESIGN_INDEX_PATHS,
  type ProjectProfileFile,
  type ScreenIndexRecord,
} from '@sber-designer/design-indexer';
import type {
  DesignInspectResult,
  DesignPropInfo,
  DesignSelection,
  DesignTarget,
} from '@sber-designer/shared-types';

import { readWorkspaceFile } from './safe-fs';

export interface InspectorProjectIndex {
  screens: ScreenIndexRecord[];
  profile: ProjectProfileFile | null;
}

interface SourceSelectionCandidate {
  selection: DesignSelection;
  score: number;
  evidenceCount: number;
}

export function inferSourceScope(
  target: DesignTarget,
  activeScreen?: {
    filePath?: string | undefined;
    implementationFilePath?: string | undefined;
  },
  projectIndex?: InspectorProjectIndex,
): DesignInspectResult['sourceScope'] {
  if (!target.filePath) return 'unknown';
  if (activeScreen?.implementationFilePath === target.filePath) return 'screen-instance';
  if (activeScreen?.filePath === target.filePath) return 'storybook-wrapper';
  const indexedScope = inferIndexedSourceScope(target.filePath, projectIndex);
  if (indexedScope) return indexedScope;
  if (!activeScreen) return 'screen-instance';
  return 'component-definition';
}

export async function loadInspectorProjectIndex(
  workspaceRoot: string,
): Promise<InspectorProjectIndex> {
  const [screens, profile] = await Promise.all([
    readJsonl<ScreenIndexRecord>(workspaceRoot, DESIGN_INDEX_PATHS.screens),
    readJson<ProjectProfileFile>(workspaceRoot, DESIGN_INDEX_PATHS.projectProfile),
  ]);
  return { screens, profile };
}

export function resolveTarget(workspaceRoot: string, selection: DesignSelection): DesignTarget {
  const sourceKind =
    selection.sourceKind ??
    (selection.loc.startsWith('dom://') ? 'dom-fallback' : ('react-source' as const));
  const parsed = sourceKind === 'dom-fallback' ? null : parseLoc(selection.loc);
  const filePath = parsed?.file ? toWorkspaceRelativePath(workspaceRoot, parsed.file) : null;
  return {
    id: [selection.loc, selection.tagName, selection.selector ?? '', selection.text ?? ''].join(
      '|',
    ),
    loc: selection.loc,
    filePath,
    line: parsed?.line ?? null,
    column: parsed?.column ?? null,
    tagName: selection.tagName,
    rect: selection.rect,
    sourceKind,
    ...(selection.componentName ? { componentName: selection.componentName } : {}),
    ...(selection.componentLoc ? { componentLoc: selection.componentLoc } : {}),
    ...(selection.selector ? { selector: selection.selector } : {}),
    ...(selection.text ? { text: selection.text } : {}),
    ...(selection.attributes ? { attributes: selection.attributes } : {}),
    ...(selection.domPath ? { domPath: selection.domPath } : {}),
    ...(selection.componentPath ? { componentPath: selection.componentPath } : {}),
    ...(selection.selectionNotice ? { selectionNotice: selection.selectionNotice } : {}),
    ...(selection.inspectId ? { inspectId: selection.inspectId } : {}),
    ...(selection.computedStyles ? { computedStyles: selection.computedStyles } : {}),
  };
}

/**
 * Recover a source-backed target for generated screens when the preview cannot
 * expose React Fiber debug locations or data-sd-loc. Resolution is deliberately
 * scoped to the active implementation file and requires one uniquely strongest
 * JSX match, so a weak DOM selection never guesses between sibling controls.
 */
export function recoverActiveScreenSourceSelection(input: {
  workspaceRoot: string;
  selection: DesignSelection;
  activeScreen?: { implementationFilePath?: string | undefined };
}): DesignSelection | null {
  if (!isDomFallbackSelection(input.selection)) return null;
  const filePath = input.activeScreen?.implementationFilePath;
  if (!filePath) return null;

  let sourceFile: SourceFile;
  try {
    sourceFile = loadSourceFile(input.workspaceRoot, filePath);
  } catch {
    return null;
  }

  const candidates = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ]
    .map((opening) => scoreSourceSelectionCandidate(sourceFile, filePath, opening, input.selection))
    .filter((candidate): candidate is SourceSelectionCandidate => Boolean(candidate))
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best || best.evidenceCount < 2) return null;
  if (candidates[1]?.score === best.score) return null;
  return best.selection;
}

export function parseLoc(loc: string): { file: string; line: number; column: number } | null {
  if (loc.startsWith('dom://')) return null;
  const match = /^(.+):(\d+):(\d+)$/.exec(loc);
  if (!match) return null;
  return {
    file: match[1]!,
    line: Number(match[2]),
    column: Number(match[3]),
  };
}

export function toWorkspaceRelativePath(workspaceRoot: string, rawPath: string): string {
  const decoded = decodePath(rawPath.replace(/^file:\/\//, ''));
  const normalized = decoded.split('\\').join('/');
  if (isAbsolute(normalized)) {
    const rel = relative(workspaceRoot, normalized).split('\\').join('/');
    if (!rel || rel.startsWith('../') || rel === '..' || isAbsolute(rel)) {
      throw new Error(`Source path is outside the workspace: ${rawPath}`);
    }
    resolveInside(workspaceRoot, rel);
    return rel;
  }
  const rel = normalized.replace(/^\.\//, '');
  resolveInside(workspaceRoot, rel);
  return rel;
}

export function loadSourceFile(workspaceRoot: string, relPath: string): SourceFile {
  const project = new Project({
    useInMemoryFileSystem: false,
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    skipLoadingLibFiles: true,
  });
  return project.addSourceFileAtPath(resolveInside(workspaceRoot, relPath));
}

export function getJsxAttributes(node: Node) {
  if (node.getKind() === SyntaxKind.JsxOpeningElement) {
    return node.asKindOrThrow(SyntaxKind.JsxOpeningElement).getAttributes();
  }
  return node.asKindOrThrow(SyntaxKind.JsxSelfClosingElement).getAttributes();
}

/** Props a single JSX opening element actually passes, with edit safety. */
export function extractProps(node: Node): DesignPropInfo[] {
  return getJsxAttributes(node).map((attr): DesignPropInfo => {
    if (attr.getKind() === SyntaxKind.JsxSpreadAttribute) {
      return {
        name: '{...spread}',
        value: null,
        kind: 'spread',
        editable: false,
        reason: 'Spread props are read-only in Visual Design MVP.',
      };
    }
    const jsxAttr = attr.asKindOrThrow(SyntaxKind.JsxAttribute);
    const name = jsxAttr.getNameNode().getText();
    const initializer = jsxAttr.getInitializer();
    if (!initializer) {
      return { name, value: 'true', kind: 'boolean', editable: true };
    }
    if (Node.isStringLiteral(initializer)) {
      return {
        name,
        value: initializer.getLiteralText(),
        kind: 'string',
        editable: true,
      };
    }
    if (initializer.getKind() !== SyntaxKind.JsxExpression) {
      return { name, value: initializer.getText(), kind: 'unknown', editable: false };
    }
    const expression = initializer.asKindOrThrow(SyntaxKind.JsxExpression).getExpression();
    if (!expression) {
      return { name, value: null, kind: 'unknown', editable: false };
    }
    if (Node.isStringLiteral(expression) || Node.isNoSubstitutionTemplateLiteral(expression)) {
      return {
        name,
        value: expression.getLiteralText(),
        kind: 'string',
        editable: true,
      };
    }
    if (Node.isNumericLiteral(expression)) {
      return { name, value: expression.getText(), kind: 'number', editable: true };
    }
    if (
      expression.getKind() === SyntaxKind.TrueKeyword ||
      expression.getKind() === SyntaxKind.FalseKeyword
    ) {
      return { name, value: expression.getText(), kind: 'boolean', editable: true };
    }
    return {
      name,
      value: expression.getText(),
      kind: 'expression',
      editable: false,
      reason: 'Expression props are read-only in Visual Design MVP.',
    };
  });
}

export function findJsxOpeningAt(
  sourceFile: SourceFile,
  loc: { line: number; column: number },
): Node {
  const pos = sourceFile.compilerNode.getPositionOfLineAndCharacter(
    Math.max(0, loc.line - 1),
    Math.max(0, loc.column - 1),
  );
  const at = sourceFile.getDescendantAtPos(pos);
  const direct =
    at?.getKind() === SyntaxKind.JsxOpeningElement ||
    at?.getKind() === SyntaxKind.JsxSelfClosingElement
      ? at
      : at?.getFirstAncestor(
          (node) =>
            node.getKind() === SyntaxKind.JsxOpeningElement ||
            node.getKind() === SyntaxKind.JsxSelfClosingElement,
        );
  if (direct) return direct;

  const candidates = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ];
  const nearest = candidates
    .map((candidate) => ({
      candidate,
      start: sourceFile.getLineAndColumnAtPos(candidate.getStart()),
    }))
    .filter(({ start }) => Math.abs(start.line - loc.line) <= 2)
    .sort(
      (a, b) =>
        Math.abs(a.start.line - loc.line) +
        Math.abs(a.start.column - loc.column) -
        (Math.abs(b.start.line - loc.line) + Math.abs(b.start.column - loc.column)),
    )[0]?.candidate;
  if (nearest) return nearest;

  throw new Error(`No JSX opening element at ${loc.line}:${loc.column}.`);
}

export function getTagName(node: Node): string {
  if (node.getKind() === SyntaxKind.JsxOpeningElement) {
    return node.asKindOrThrow(SyntaxKind.JsxOpeningElement).getTagNameNode().getText();
  }
  return node.asKindOrThrow(SyntaxKind.JsxSelfClosingElement).getTagNameNode().getText();
}

function scoreSourceSelectionCandidate(
  sourceFile: SourceFile,
  filePath: string,
  opening: Node,
  selection: DesignSelection,
): SourceSelectionCandidate | null {
  const sourceTag = getTagName(opening);
  const sourceTagKey = sourceTag.toLowerCase();
  const componentHints = new Set(
    [selection.componentName, ...(selection.componentPath ?? [])]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase()),
  );
  const tagMatches =
    sourceTagKey === selection.tagName.toLowerCase() || componentHints.has(sourceTagKey);
  const sourceText = staticJsxText(opening);
  const selectedText = normalizeComparableText(selection.text);
  const textMatches = Boolean(
    sourceText &&
    selectedText &&
    (sourceText === selectedText ||
      sourceText.includes(selectedText) ||
      selectedText.includes(sourceText)),
  );
  const attributeMatches = matchingStaticAttributes(opening, selection.attributes);

  let score = 0;
  let evidenceCount = 0;
  if (tagMatches) {
    score += componentHints.has(sourceTagKey) ? 5 : 4;
    evidenceCount += 1;
  }
  if (textMatches) {
    score += sourceText === selectedText ? 8 : 5;
    evidenceCount += 1;
  }
  if (attributeMatches > 0) {
    score += 6 + Math.min(attributeMatches - 1, 2);
    evidenceCount += 1;
  }
  if (evidenceCount < 2) return null;

  const start = sourceFile.getLineAndColumnAtPos(opening.getStart());
  return {
    selection: recoveredSelection(selection, {
      filePath,
      line: start.line,
      column: start.column,
      tagName: sourceTag,
    }),
    score,
    evidenceCount,
  };
}

function staticJsxText(opening: Node): string | null {
  if (opening.getKind() !== SyntaxKind.JsxOpeningElement) return null;
  const element = opening.getParentIfKind(SyntaxKind.JsxElement);
  if (!element) return null;
  const text = element
    .getJsxChildren()
    .filter((child) => child.getKind() === SyntaxKind.JsxText)
    .map((child) => child.getText())
    .join(' ');
  return normalizeComparableText(text);
}

function matchingStaticAttributes(
  opening: Node,
  selectedAttributes: Record<string, string> | undefined,
): number {
  if (!selectedAttributes) return 0;
  const expected = Object.entries(selectedAttributes).filter(
    ([name, value]) => name !== 'data-testid' || isUsableTestId(value),
  );
  if (expected.length === 0) return 0;

  const actual = new Map<string, string>();
  const attributes =
    opening.getKind() === SyntaxKind.JsxOpeningElement
      ? opening.asKindOrThrow(SyntaxKind.JsxOpeningElement).getAttributes()
      : opening.asKindOrThrow(SyntaxKind.JsxSelfClosingElement).getAttributes();
  for (const attribute of attributes) {
    if (!Node.isJsxAttribute(attribute)) continue;
    const initializer = attribute.getInitializer();
    const name = attribute.getNameNode().getText();
    if (!initializer) {
      actual.set(name, 'true');
    } else if (Node.isStringLiteral(initializer)) {
      actual.set(name, initializer.getLiteralText());
    }
  }
  return expected.filter(([name, value]) => actual.get(name) === value).length;
}

function recoveredSelection(
  selection: DesignSelection,
  source: { filePath: string; line: number; column: number; tagName: string },
): DesignSelection {
  const { attributes, selector, ...rest } = selection;
  const safeAttributes = attributes
    ? Object.fromEntries(
        Object.entries(attributes).filter(
          ([name, value]) => name !== 'data-testid' || isUsableTestId(value),
        ),
      )
    : undefined;
  const invalidTestId = attributes?.['data-testid'];
  const safeSelector =
    invalidTestId && !isUsableTestId(invalidTestId) && selector?.includes('data-testid')
      ? undefined
      : selector;
  return {
    ...rest,
    loc: `${source.filePath}:${source.line}:${source.column}`,
    sourceKind: 'react-source',
    tagName: source.tagName,
    ...(safeSelector ? { selector: safeSelector } : {}),
    ...(safeAttributes && Object.keys(safeAttributes).length > 0
      ? { attributes: safeAttributes }
      : {}),
    selectionNotice:
      'Recovered the unique JSX source target from the active generated screen implementation.',
  };
}

function isDomFallbackSelection(selection: DesignSelection): boolean {
  return selection.sourceKind === 'dom-fallback' || selection.loc.startsWith('dom://');
}

function normalizeComparableText(value: string | undefined): string | null {
  const normalized = value?.replace(/\s+/g, ' ').trim().toLowerCase();
  return normalized || null;
}

function isUsableTestId(value: string): boolean {
  const normalized = value.trim();
  return Boolean(
    normalized &&
    !/^(?:undefined|null|nan)(?:[_-]|$)/i.test(normalized) &&
    !/\[object\s+object\]/i.test(normalized),
  );
}

function inferIndexedSourceScope(
  filePath: string,
  projectIndex?: InspectorProjectIndex,
): DesignInspectResult['sourceScope'] | null {
  if (!projectIndex) return null;
  const normalized = normalizeWorkspacePath(filePath);
  for (const screen of projectIndex.screens) {
    if (normalizeWorkspacePath(screen.implementationPath) === normalized) return 'screen-instance';
    if (screen.storyPath && normalizeWorkspacePath(screen.storyPath) === normalized) {
      return 'storybook-wrapper';
    }
  }
  if (isStoryFile(normalized)) return 'storybook-wrapper';
  if (isLikelyReusableComponentPath(normalized, projectIndex.profile)) {
    return 'component-definition';
  }
  return null;
}

function isStoryFile(filePath: string): boolean {
  return /\.(stories|story)\.[tj]sx?$/.test(filePath);
}

function isLikelyReusableComponentPath(
  filePath: string,
  profile: ProjectProfileFile | null,
): boolean {
  if (profile?.sourceRoots.length) {
    const insideSourceRoot = profile.sourceRoots.some((root) => {
      const normalizedRoot = normalizeWorkspacePath(root).replace(/\/$/, '');
      return filePath === normalizedRoot || filePath.startsWith(`${normalizedRoot}/`);
    });
    if (!insideSourceRoot) return false;
  }
  return /(^|\/)(components|component|ui|shared|widgets)\//.test(filePath);
}

async function readJson<T>(workspaceRoot: string, filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readWorkspaceFile(workspaceRoot, filePath)) as T;
  } catch {
    return null;
  }
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

function normalizeWorkspacePath(path: string): string {
  return path.split('\\').join('/').replace(/^\.\//, '');
}

function decodePath(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}
