import { sourceForElement, formatLoc, type SourceKind } from '@/lib/dom-source';
import { isUsableDomTestId } from '@/lib/dom-selection';
import type {
  DesignRect,
  DesignSourceScope,
  LayerNode,
  ProjectScreen,
} from '@sber-designer/shared-types';

export interface LayerSnapshotNode {
  id?: string;
  tagName: string;
  componentName?: string;
  loc?: string;
  sourceKind?: SourceKind;
  selector?: string;
  text?: string;
  domPath?: string;
  componentPath?: string[];
  attributes?: Record<string, string>;
  rect: DesignRect;
  children?: LayerSnapshotNode[];
}

export interface LayerOwnershipContext {
  activeScreen?: ProjectScreen | null;
}

export function normalizeLayerTree(
  snapshot: LayerSnapshotNode | null,
  context: LayerOwnershipContext = {},
): LayerNode | null {
  if (!snapshot) return null;
  const sourceScope = inferLayerSourceScope(snapshot, context);
  return {
    ...snapshot,
    id: snapshot.id ?? stableLayerId(snapshot),
    sourceScope,
    children: (snapshot.children ?? [])
      .map((child) => normalizeLayerTree(child, context))
      .filter((child): child is LayerNode => Boolean(child)),
  };
}

export function stableLayerId(node: LayerSnapshotNode): string {
  const loc = normalizeLoc(node.loc);
  if (loc && node.sourceKind !== 'dom-fallback') {
    return `source:${node.sourceKind ?? 'react-source'}:${loc}`;
  }
  const flowId = node.attributes?.['data-sd-flow-id'];
  if (flowId) return `flow:${flowId}`;
  if (node.selector) return `selector:${node.selector}`;
  if (node.domPath) return `dom:${node.domPath}`;
  return `element:${node.tagName.toLowerCase()}:${Math.round(node.rect.x)}:${Math.round(node.rect.y)}`;
}

export function inferLayerSourceScope(
  node: Pick<LayerSnapshotNode, 'loc' | 'sourceKind'>,
  context: LayerOwnershipContext = {},
): DesignSourceScope {
  if (!node.loc || node.sourceKind === 'dom-fallback' || node.loc.startsWith('dom://')) {
    return 'unknown';
  }

  const filePath = fileFromLoc(node.loc);
  if (!filePath) return 'unknown';

  const screen = context.activeScreen;
  if (screen?.implementationFilePath && samePath(screen.implementationFilePath, filePath)) {
    return 'screen-instance';
  }
  if (screen?.filePath && samePath(screen.filePath, filePath)) {
    return screen.implementationFilePath && !samePath(screen.implementationFilePath, filePath)
      ? 'storybook-wrapper'
      : 'screen-instance';
  }
  if (isStoryFile(filePath)) return 'storybook-wrapper';
  return 'component-definition';
}

export function buildLayerSnapshotFromDocument(doc: Document): LayerSnapshotNode | null {
  const root =
    doc.querySelector<HTMLElement>('#storybook-root') ??
    doc.querySelector<HTMLElement>('#root') ??
    doc.body;
  if (!root) return null;
  let count = 0;
  const visit = (element: HTMLElement, depth: number): LayerSnapshotNode | null => {
    if (count >= 500 || depth > 10 || shouldSkipLayerElement(element)) return null;
    count += 1;
    const source = sourceForElement(element);
    const rect = toRect(element.getBoundingClientRect());
    const attributes = selectedAttributes(element);
    const text = normalizeText(element.innerText || element.textContent || '');
    const selector = preferredSelector(element, attributes) ?? source.domPath;
    const children =
      depth >= 10
        ? []
        : Array.from(element.children)
            .filter((child): child is HTMLElement => child instanceof HTMLElement)
            .map((child) => visit(child, depth + 1))
            .filter((child): child is LayerSnapshotNode => Boolean(child));
    const node: LayerSnapshotNode = {
      tagName: element.tagName,
      loc: formatLoc(source.loc),
      sourceKind: source.sourceKind,
      rect,
      children,
      ...(source.componentName ? { componentName: source.componentName } : {}),
      ...(source.domPath ? { domPath: source.domPath } : {}),
      ...(source.componentPath ? { componentPath: source.componentPath } : {}),
      ...(selector ? { selector } : {}),
      ...(text ? { text } : {}),
      ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
    };
    return {
      ...node,
      id: stableLayerId(node),
    };
  };
  return visit(root, 0);
}

function normalizeLoc(loc: string | undefined): string | null {
  if (!loc) return null;
  return loc
    .replace(/^file:\/\//, '')
    .split('\\')
    .join('/');
}

function fileFromLoc(loc: string): string | null {
  if (loc.startsWith('dom://')) return null;
  const match = /^(.+):(\d+):(\d+)$/.exec(normalizeLoc(loc) ?? '');
  return match?.[1]?.replace(/^\.\//, '') ?? null;
}

function samePath(a: string, b: string): boolean {
  return (
    a.split('\\').join('/').replace(/^\.\//, '') === b.split('\\').join('/').replace(/^\.\//, '')
  );
}

function isStoryFile(filePath: string): boolean {
  return /\.(stories|story)\.[tj]sx?$/.test(filePath);
}

function shouldSkipLayerElement(element: HTMLElement): boolean {
  const tag = element.tagName.toLowerCase();
  if (tag === 'script' || tag === 'style' || tag === 'link' || tag === 'meta') return true;
  const rect = element.getBoundingClientRect();
  return rect.width <= 0 || rect.height <= 0;
}

function toRect(rect: DOMRect): DesignRect {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

function selectedAttributes(element: HTMLElement): Record<string, string> {
  const names = [
    'data-sd-flow-id',
    'data-sd-label',
    'data-sd-nav-group',
    'data-testid',
    'id',
    'href',
    'aria-label',
    'role',
  ];
  const attrs: Record<string, string> = {};
  for (const name of names) {
    const value = element.getAttribute(name);
    if (name === 'data-testid' && !isUsableDomTestId(value)) continue;
    if (value) attrs[name] = value;
  }
  return attrs;
}

function preferredSelector(element: HTMLElement, attrs: Record<string, string>): string | null {
  const tag = element.tagName.toLowerCase();
  if (attrs['data-sd-flow-id']) {
    return `[data-sd-flow-id="${escapeCssString(attrs['data-sd-flow-id'])}"]`;
  }
  if (attrs.id) return `#${escapeCssIdent(attrs.id)}`;
  if (attrs['data-testid']) {
    return `[data-testid="${escapeCssString(attrs['data-testid'])}"]`;
  }
  if (attrs['aria-label']) {
    return `${tag}[aria-label="${escapeCssString(attrs['aria-label'])}"]`;
  }
  return null;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 120);
}

function escapeCssString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function escapeCssIdent(value: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
}
