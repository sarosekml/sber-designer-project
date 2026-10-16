import { Node, Project, SyntaxKind, type ReturnStatement, type SourceFile } from 'ts-morph';

import { readWorkspaceFile, writeWorkspaceFile } from '../safe-fs';

const SCREEN_ROOT_MARKER = 'data-sd-screen-root';
const REACT_SCREEN_EXT = /\.(tsx|jsx)$/iu;

export type RuntimeScreenRootMarkerRepairStatus =
  | 'not_needed'
  | 'repaired'
  | 'missing_unrepaired'
  | 'unavailable';

export interface RuntimeScreenRootMarkerRepair {
  status: RuntimeScreenRootMarkerRepairStatus;
  reason: string;
  filePath?: string;
}

export async function repairRuntimeScreenRootMarker(input: {
  workspacePath: string;
  changedFiles: string[];
  activeScreen?: {
    implementationFilePath?: string | null;
    filePath?: string | null;
  } | null;
}): Promise<RuntimeScreenRootMarkerRepair> {
  const filePath = selectActiveImplementationPath(input.activeScreen);
  if (!filePath) {
    return {
      status: 'unavailable',
      reason: 'No active implementation file was available for screen root marker repair.',
    };
  }
  if (!input.changedFiles.map(normalizeWorkspacePath).includes(filePath)) {
    return {
      status: 'not_needed',
      filePath,
      reason: 'Active implementation file was not changed by this run.',
    };
  }
  if (!REACT_SCREEN_EXT.test(filePath)) {
    return {
      status: 'not_needed',
      filePath,
      reason: 'Active implementation file is not a TSX/JSX screen.',
    };
  }

  const source = await readWorkspaceFile(input.workspacePath, filePath).catch(() => null);
  if (source === null) {
    return {
      status: 'unavailable',
      filePath,
      reason: 'Active implementation file could not be read.',
    };
  }
  if (source.includes(SCREEN_ROOT_MARKER)) {
    return {
      status: 'not_needed',
      filePath,
      reason: 'Active implementation file already contains data-sd-screen-root.',
    };
  }

  const repaired = addScreenRootWrapper(source, filePath);
  if (!repaired) {
    return {
      status: 'missing_unrepaired',
      filePath,
      reason:
        'Active implementation file lost data-sd-screen-root, and no top-level JSX screen return could be repaired automatically.',
    };
  }

  await writeWorkspaceFile(input.workspacePath, filePath, repaired);
  return {
    status: 'repaired',
    filePath,
    reason: `Restored data-sd-screen-root on ${filePath}.`,
  };
}

function addScreenRootWrapper(source: string, filePath: string): string | null {
  const project = new Project({
    useInMemoryFileSystem: true,
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    skipLoadingLibFiles: true,
  });
  const sourceFile = project.createSourceFile(filePath, source, { overwrite: true });
  const returnStatement = findTopLevelJsxReturn(sourceFile);
  const expression = returnStatement?.getExpression();
  if (!returnStatement || !expression) return null;

  const jsxRoot = unwrapParenthesizedExpression(expression);
  if (!isJsxRoot(jsxRoot)) return null;

  expression.replaceWithText(
    [
      '(',
      '  <main data-sd-screen-root="true">',
      indentJsxChild(jsxRoot.getText()),
      '  </main>',
      ')',
    ].join('\n'),
  );
  return sourceFile.getFullText();
}

function findTopLevelJsxReturn(sourceFile: SourceFile): ReturnStatement | null {
  for (const statement of sourceFile.getDescendantsOfKind(SyntaxKind.ReturnStatement)) {
    const expression = statement.getExpression();
    if (!expression || !isJsxRoot(unwrapParenthesizedExpression(expression))) continue;
    if (isScreenComponentReturn(statement, sourceFile)) return statement;
  }
  return null;
}

function isScreenComponentReturn(statement: ReturnStatement, sourceFile: SourceFile): boolean {
  const owner = statement.getFirstAncestor(
    (node) =>
      Node.isFunctionDeclaration(node) ||
      Node.isArrowFunction(node) ||
      Node.isFunctionExpression(node),
  );
  if (!owner) return true;
  if (Node.isFunctionDeclaration(owner)) {
    const name = owner.getName();
    return isComponentName(name) || owner.isDefaultExport();
  }
  const variable = owner.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  const name = variable?.getName();
  if (isComponentName(name)) return true;

  const jsxReturns = sourceFile
    .getDescendantsOfKind(SyntaxKind.ReturnStatement)
    .filter((candidate) => {
      const expression = candidate.getExpression();
      return expression ? isJsxRoot(unwrapParenthesizedExpression(expression)) : false;
    });
  return jsxReturns.length === 1;
}

function unwrapParenthesizedExpression(node: Node): Node {
  let current = node;
  while (Node.isParenthesizedExpression(current)) {
    current = current.getExpression();
  }
  return current;
}

function isJsxRoot(node: Node): boolean {
  return (
    Node.isJsxElement(node) ||
    Node.isJsxSelfClosingElement(node) ||
    node.getKind() === SyntaxKind.JsxFragment
  );
}

function indentJsxChild(text: string): string {
  return text
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');
}

function selectActiveImplementationPath(
  activeScreen:
    | {
        implementationFilePath?: string | null;
        filePath?: string | null;
      }
    | null
    | undefined,
): string | null {
  const candidate = activeScreen?.implementationFilePath ?? activeScreen?.filePath ?? null;
  return candidate ? normalizeWorkspacePath(candidate) : null;
}

function normalizeWorkspacePath(path: string): string {
  return path.replace(/\\/gu, '/').replace(/^\.\//u, '');
}

function isComponentName(name: string | null | undefined): boolean {
  return Boolean(name && /^[A-Z]/u.test(name));
}
