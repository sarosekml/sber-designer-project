import { readFile } from 'node:fs/promises';
import { resolveInside } from '@sber-designer/ast-bridge';
import { ts } from 'ts-morph';

export interface SourceHealthFinding {
  severity: 'error' | 'warning';
  ruleId:
    | 'parse-error'
    | 'unknown-jsx-component'
    | 'unresolved-jsx-shorthand'
    | 'ts-suppression-comment'
    | 'invalid-project-icon-prop';
  message: string;
  filePath: string;
  line?: number;
  column?: number;
}

export async function validateGeneratedSourceHealth(input: {
  workspaceRoot: string;
  filePaths: string[];
}): Promise<{ ok: boolean; findings: SourceHealthFinding[] }> {
  const findings: SourceHealthFinding[] = [];
  const iconPropContracts = await loadProjectIconPropContracts(input.workspaceRoot);
  for (const filePath of Array.from(new Set(input.filePaths)).filter((path) =>
    /\.[cm]?[jt]sx$/u.test(path),
  )) {
    const abs = resolveInside(input.workspaceRoot, filePath);
    const contents = await readFile(abs, 'utf8').catch(() => null);
    if (contents === null) continue;
    findings.push(...validateOne(filePath, contents, iconPropContracts));
  }
  return { ok: findings.filter((finding) => finding.severity === 'error').length === 0, findings };
}

interface IconPropContract {
  componentName: string;
  propName: string;
  names: Set<string>;
}

function validateOne(
  filePath: string,
  contents: string,
  iconPropContracts: IconPropContract[],
): SourceHealthFinding[] {
  const source = ts.createSourceFile(
    filePath,
    contents,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  // `parseDiagnostics` is internal to the compiler: real, but not on the
  // public SourceFile type. Name the shape instead of casting to any.
  const parsed = source as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] };
  const findings: SourceHealthFinding[] = (parsed.parseDiagnostics ?? []).map((diagnostic) => ({
    severity: 'error',
    ruleId: 'parse-error',
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    filePath,
    ...positionFor(source, diagnostic.start ?? 0),
  }));
  if (findings.length > 0) return findings;
  findings.push(...findTsSuppressionComments(filePath, source, contents));

  const knownComponents = collectKnownTopLevelComponents(source);
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = jsxRootName(node.tagName);
      if (isComponentName(name) && !knownComponents.has(name)) {
        findings.push({
          severity: 'error',
          ruleId: 'unknown-jsx-component',
          message: `Unknown JSX component "${name}". Add an import or local declaration before using it.`,
          filePath,
          ...positionFor(source, node.getStart(source)),
        });
      }
      for (const attr of node.attributes.properties) {
        if (ts.isJsxAttribute(attr)) {
          collectInvalidIconPropFindings({
            filePath,
            source,
            componentName: name,
            attribute: attr,
            contracts: iconPropContracts,
            findings,
          });
        }
        if (ts.isJsxAttribute(attr) && attr.initializer && ts.isJsxExpression(attr.initializer)) {
          collectUnresolvedShorthandFindings({
            filePath,
            source,
            expression: attr.initializer.expression,
            scope: collectScopeNames(attr),
            findings,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return findings;
}

async function loadProjectIconPropContracts(workspaceRoot: string): Promise<IconPropContract[]> {
  const path = resolveInside(workspaceRoot, '.sber-designer/design-index/icon-candidates.jsonl');
  const contents = await readFile(path, 'utf8').catch(() => '');
  const byKey = new Map<string, IconPropContract>();
  for (const line of contents
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)) {
    let parsed: {
      name?: unknown;
      source?: unknown;
      componentName?: unknown;
      propName?: unknown;
    };
    try {
      parsed = JSON.parse(line) as typeof parsed;
    } catch {
      continue;
    }
    if (
      parsed.source !== 'project-icon-prop' ||
      typeof parsed.name !== 'string' ||
      typeof parsed.componentName !== 'string'
    ) {
      continue;
    }
    const propName = typeof parsed.propName === 'string' ? parsed.propName : 'iconName';
    const key = `${parsed.componentName}:${propName}`;
    const contract =
      byKey.get(key) ??
      ({
        componentName: parsed.componentName,
        propName,
        names: new Set<string>(),
      } satisfies IconPropContract);
    contract.names.add(parsed.name);
    byKey.set(key, contract);
  }
  return Array.from(byKey.values());
}

function findTsSuppressionComments(
  filePath: string,
  source: ts.SourceFile,
  contents: string,
): SourceHealthFinding[] {
  const findings: SourceHealthFinding[] = [];
  for (const match of contents.matchAll(/@ts-(?:ignore|expect-error)\b/gu)) {
    findings.push({
      severity: 'warning',
      ruleId: 'ts-suppression-comment',
      message: `Generated source suppresses TypeScript checking with ${match[0]}. Prefer fixing imports, props, or component API usage instead.`,
      filePath,
      ...positionFor(source, match.index ?? 0),
    });
  }
  return findings.slice(0, 8);
}

function collectKnownTopLevelComponents(source: ts.SourceFile): Set<string> {
  const names = new Set(['Fragment']);
  const visit = (node: ts.Node): void => {
    if (ts.isImportClause(node)) {
      if (node.name) names.add(node.name.text);
      const named = node.namedBindings;
      if (named && ts.isNamedImports(named)) {
        for (const spec of named.elements) names.add(spec.name.text);
      }
    } else if (
      ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node)
    ) {
      if (node.name) names.add(node.name.text);
    } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      names.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
}

function collectScopeNames(node: ts.Node): Set<string> {
  const names = new Set<string>();
  let current: ts.Node | undefined = node;
  while (current) {
    if (
      ts.isArrowFunction(current) ||
      ts.isFunctionDeclaration(current) ||
      ts.isFunctionExpression(current)
    ) {
      for (const param of current.parameters) collectBindingNames(param.name, names);
    }
    if (ts.isBlock(current) || ts.isSourceFile(current)) {
      for (const statement of current.statements) {
        if (ts.isVariableStatement(statement)) {
          for (const declaration of statement.declarationList.declarations) {
            collectBindingNames(declaration.name, names);
          }
        }
      }
    }
    current = current.parent;
  }
  return names;
}

function collectUnresolvedShorthandFindings(input: {
  filePath: string;
  source: ts.SourceFile;
  expression: ts.Expression | undefined;
  scope: Set<string>;
  findings: SourceHealthFinding[];
}): void {
  if (!input.expression || !ts.isObjectLiteralExpression(input.expression)) return;
  for (const property of input.expression.properties) {
    if (!ts.isShorthandPropertyAssignment(property)) continue;
    const name = property.name.text;
    if (input.scope.has(name)) continue;
    input.findings.push({
      severity: 'error',
      ruleId: 'unresolved-jsx-shorthand',
      message: `JSX prop expression uses unresolved shorthand "${name}". Did you mean ${name}={${name}} instead of ${name}={{${name}}}?`,
      filePath: input.filePath,
      ...positionFor(input.source, property.getStart(input.source)),
    });
  }
}

function collectInvalidIconPropFindings(input: {
  filePath: string;
  source: ts.SourceFile;
  componentName: string;
  attribute: ts.JsxAttribute;
  contracts: IconPropContract[];
  findings: SourceHealthFinding[];
}): void {
  const attrName = input.attribute.name.getText(input.source);
  const contract = input.contracts.find(
    (item) => item.componentName === input.componentName && item.propName === attrName,
  );
  if (!contract || !input.attribute.initializer) return;
  const value = jsxStringAttributeValue(input.attribute.initializer);
  if (value === null || contract.names.has(value)) return;
  input.findings.push({
    severity: 'error',
    ruleId: 'invalid-project-icon-prop',
    message: `Icon value "${value}" is not valid for <${contract.componentName} ${contract.propName}=...>. Use get_indexed_icon and choose one of the project-icon-prop candidates before using this project Icon prop.`,
    filePath: input.filePath,
    ...positionFor(input.source, input.attribute.getStart(input.source)),
  });
}

function jsxStringAttributeValue(initializer: ts.JsxAttributeValue): string | null {
  if (ts.isStringLiteral(initializer)) return initializer.text;
  if (
    ts.isJsxExpression(initializer) &&
    initializer.expression &&
    ts.isStringLiteral(initializer.expression)
  ) {
    return initializer.expression.text;
  }
  return null;
}

function collectBindingNames(name: ts.BindingName, out: Set<string>): void {
  if (ts.isIdentifier(name)) {
    out.add(name.text);
    return;
  }
  for (const element of name.elements) {
    if (ts.isBindingElement(element)) collectBindingNames(element.name, out);
  }
}

function jsxRootName(name: ts.JsxTagNameExpression): string {
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isPropertyAccessExpression(name)) {
    return jsxRootName(name.expression as ts.JsxTagNameExpression);
  }
  return name.getText();
}

function isComponentName(name: string): boolean {
  return /^[A-Z]/u.test(name);
}

function positionFor(source: ts.SourceFile, pos: number): { line: number; column: number } {
  const lc = source.getLineAndCharacterOfPosition(pos);
  return { line: lc.line + 1, column: lc.character + 1 };
}
