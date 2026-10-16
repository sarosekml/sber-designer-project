import { createHash } from 'node:crypto';
import { Node, SyntaxKind } from 'ts-morph';
import type {
  DesignInspectResult,
  DesignPropInfo,
  DesignSelection,
} from '@sber-designer/shared-types';

import { inferCapabilities, unmappedCapabilities } from './design-inspector-capabilities';
import { resolveComponentInstance } from './design-inspector-component';
import {
  extractProps,
  getJsxAttributes,
  findJsxOpeningAt,
  getTagName,
  inferSourceScope,
  loadInspectorProjectIndex,
  loadSourceFile,
  parseLoc,
  recoverActiveScreenSourceSelection,
  resolveTarget,
  toWorkspaceRelativePath,
} from './design-inspector-source';
import { readWorkspaceFile } from './safe-fs';

export type {
  DesignInspectResult,
  DesignPropInfo,
  DesignSelection,
  DesignSourceKind,
  DesignTarget,
} from '@sber-designer/shared-types';
export { parseLoc, resolveTarget, toWorkspaceRelativePath } from './design-inspector-source';

export async function inspectDesignTarget(input: {
  workspaceRoot: string;
  selection: DesignSelection;
  activeScreen?: {
    id: string;
    storyId?: string | undefined;
    filePath?: string | undefined;
    implementationFilePath?: string | undefined;
  };
}): Promise<DesignInspectResult> {
  const recoveredSelection = recoverActiveScreenSourceSelection({
    workspaceRoot: input.workspaceRoot,
    selection: input.selection,
    ...(input.activeScreen ? { activeScreen: input.activeScreen } : {}),
  });
  const target = resolveTarget(input.workspaceRoot, recoveredSelection ?? input.selection);
  if (target.sourceKind === 'dom-fallback' || !target.filePath || !target.line) {
    const reason =
      'This element has no safe React source location. Use Ask Assistant with the selected DOM context.';
    return {
      target,
      editable: false,
      reason,
      projectSupport: 'baseline-selection',
      sourceScope: 'unknown',
      capabilities: unmappedCapabilities(reason),
      diagnostics: [
        {
          level: 'info',
          code: 'design.baseline.dom-fallback',
          message:
            'This selection is still useful as agent context, but direct visual controls are locked.',
        },
      ],
    };
  }

  const contents = await readWorkspaceFile(input.workspaceRoot, target.filePath);
  const sourceFile = loadSourceFile(input.workspaceRoot, target.filePath);
  const opening = findJsxOpeningAt(sourceFile, {
    line: target.line,
    column: target.column ?? 0,
  });
  const tagName = getTagName(opening);
  const selfClosing = opening.getKind() === SyntaxKind.JsxSelfClosingElement;
  const jsxElement = selfClosing ? null : opening.getParentIfKind(SyntaxKind.JsxElement);
  const children = jsxElement ? extractChildrenText(jsxElement) : null;
  const props = extractProps(opening);
  const styles = extractStyles(opening);
  const capabilities = inferCapabilities({ children, props, styles, selfClosing });
  const projectIndex = await loadInspectorProjectIndex(input.workspaceRoot);
  const sourceScope = inferSourceScope(target, input.activeScreen, projectIndex);
  const componentFilePath = target.componentLoc ? parseLoc(target.componentLoc)?.file : null;
  const componentInstance = await resolveComponentInstance({
    workspaceRoot: input.workspaceRoot,
    target: { ...target, tagName },
    targetTagName: tagName,
    activeScreen: input.activeScreen,
    projectIndex,
  }).catch(() => null);

  return {
    target: {
      ...target,
      tagName,
    },
    editable: true,
    projectSupport: 'design-readable',
    sourceScope,
    capabilities,
    diagnostics: recoveredSelection
      ? [
          {
            level: 'info',
            code: 'design.generated-screen.source-recovered',
            message:
              'Recovered a unique JSX source target from the active generated screen implementation.',
            ...(target.filePath ? { path: target.filePath } : {}),
          },
        ]
      : [],
    baseline: {
      filePath: target.filePath,
      hash: sha256(contents),
    },
    jsx: {
      tagName,
      isComponent: /^[A-Z]/.test(tagName),
      props,
      ...(children?.text !== undefined ? { childrenText: children.text } : {}),
      ...(children ? { childrenEditable: children.editable } : {}),
      ...(children?.reason ? { childrenReason: children.reason } : {}),
      selfClosing,
    },
    styles,
    ...(target.componentName
      ? {
          component: {
            name: target.componentName,
            ...(componentFilePath ? { filePath: componentFilePath } : {}),
          },
        }
      : {}),
    ...(componentInstance ? { componentInstance } : {}),
  };
}

function extractChildrenText(element: Node): {
  text?: string;
  editable: boolean;
  reason?: string;
} {
  if (!Node.isJsxElement(element)) return { editable: false, reason: 'Not a JSX element.' };
  const children = element.getJsxChildren();
  if (children.length === 0) return { text: '', editable: true };
  const textParts: string[] = [];
  for (const child of children) {
    if (child.getKind() === SyntaxKind.JsxText) {
      textParts.push(child.getText());
      continue;
    }
    if (child.getText().trim() === '') continue;
    return {
      editable: false,
      reason: 'Mixed JSX children are read-only in Visual Design MVP.',
    };
  }
  return {
    text: textParts.join('').replace(/\s+/g, ' ').trim(),
    editable: true,
  };
}

function extractStyles(node: Node): NonNullable<DesignInspectResult['styles']> {
  const className = extractClassName(node);
  const style = extractStyleObject(node);
  return {
    ...(className.value !== undefined ? { className: className.value } : {}),
    classNameEditable: className.editable,
    ...(className.reason ? { classNameReason: className.reason } : {}),
    ...(style.value ? { styleObject: style.value } : {}),
    styleEditable: style.editable,
    ...(style.reason ? { styleReason: style.reason } : {}),
  };
}

function extractClassName(node: Node): {
  value?: string;
  editable: boolean;
  reason?: string;
} {
  const attr = getJsxAttributes(node).find(
    (item) =>
      item.getKind() === SyntaxKind.JsxAttribute &&
      item.asKindOrThrow(SyntaxKind.JsxAttribute).getNameNode().getText() === 'className',
  );
  if (!attr) return { editable: true };
  const jsxAttr = attr.asKindOrThrow(SyntaxKind.JsxAttribute);
  const initializer = jsxAttr.getInitializer();
  if (!initializer) return { editable: false, reason: 'Boolean className is not editable.' };
  if (Node.isStringLiteral(initializer)) {
    return { value: initializer.getLiteralText(), editable: true };
  }
  if (initializer.getKind() === SyntaxKind.JsxExpression) {
    const expression = initializer.asKindOrThrow(SyntaxKind.JsxExpression).getExpression();
    if (expression && Node.isStringLiteral(expression)) {
      return { value: expression.getLiteralText(), editable: true };
    }
  }
  return {
    value: initializer.getText(),
    editable: false,
    reason: 'Expression-based className is read-only in Visual Design MVP.',
  };
}

function extractStyleObject(node: Node): {
  value?: Record<string, string>;
  editable: boolean;
  reason?: string;
} {
  const attr = getJsxAttributes(node).find(
    (item) =>
      item.getKind() === SyntaxKind.JsxAttribute &&
      item.asKindOrThrow(SyntaxKind.JsxAttribute).getNameNode().getText() === 'style',
  );
  if (!attr) return { editable: true };
  const initializer = attr.asKindOrThrow(SyntaxKind.JsxAttribute).getInitializer();
  if (!initializer || initializer.getKind() !== SyntaxKind.JsxExpression) {
    return { editable: false, reason: 'Non-expression style prop is read-only.' };
  }
  const expression = initializer.asKindOrThrow(SyntaxKind.JsxExpression).getExpression();
  if (!expression || !Node.isObjectLiteralExpression(expression)) {
    const result = {
      editable: false,
      reason: 'Complex style expression is read-only in Visual Design MVP.',
    };
    return expression?.getText() ? { ...result, value: { value: expression.getText() } } : result;
  }
  const result: Record<string, string> = {};
  for (const property of expression.getProperties()) {
    if (Node.isSpreadAssignment(property)) {
      return {
        value: result,
        editable: false,
        reason: 'Style objects with spreads are read-only in Visual Design MVP.',
      };
    }
    if (!Node.isPropertyAssignment(property)) continue;
    const name = propertyName(property.getNameNode());
    if (!name) continue;
    result[name] = displayExpression(property.getInitializer());
  }
  return { value: result, editable: true };
}

function propertyName(nameNode: Node): string | null {
  if (Node.isStringLiteral(nameNode) || Node.isNoSubstitutionTemplateLiteral(nameNode)) {
    return nameNode.getLiteralText();
  }
  return nameNode.getText();
}

function displayExpression(node: Node | undefined): string {
  if (!node) return '';
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralText();
  }
  return node.getText();
}

function sha256(contents: string): string {
  return createHash('sha256').update(contents).digest('hex');
}
