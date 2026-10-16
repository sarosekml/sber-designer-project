import type { SelectedNode } from '@/stores/editor-store';
import type {
  DesignInspectResult,
  DesignPanelTab as SharedDesignPanelTab,
  DesignPropInfo,
  DesignSelection,
  DesignSourceKind,
  DesignTarget,
  DesignToken,
  DesignTokens,
  LayerNode,
  VisualChange,
} from '@sber-designer/shared-types';

export type DesignPanelTab = SharedDesignPanelTab;
export type {
  DesignInspectResult,
  DesignPropInfo,
  DesignSelection,
  DesignSourceKind,
  DesignTarget,
  DesignToken,
  DesignTokens,
  LayerNode,
  VisualChange,
};

/**
 * Keep the browser selection contract separate from the enriched target that
 * `/api/design/inspect` returns. A DesignTarget is structurally assignable to
 * SelectedNode, but its id/filePath/line/column fields are intentionally not
 * valid input for the strict inspect endpoint.
 */
export function toDesignSelection(selected: DesignSelection): DesignSelection {
  return {
    loc: selected.loc,
    tagName: selected.tagName,
    rect: selected.rect,
    ...(selected.sourceKind ? { sourceKind: selected.sourceKind } : {}),
    ...(selected.componentName ? { componentName: selected.componentName } : {}),
    ...(selected.componentLoc ? { componentLoc: selected.componentLoc } : {}),
    ...(selected.selector ? { selector: selected.selector } : {}),
    ...(selected.text ? { text: selected.text } : {}),
    ...(selected.attributes ? { attributes: selected.attributes } : {}),
    ...(selected.domPath ? { domPath: selected.domPath } : {}),
    ...(selected.componentPath ? { componentPath: selected.componentPath } : {}),
    ...(selected.selectionNotice ? { selectionNotice: selected.selectionNotice } : {}),
    ...(selected.inspectId ? { inspectId: selected.inspectId } : {}),
    ...(selected.computedStyles ? { computedStyles: selected.computedStyles } : {}),
  };
}

export function selectedToDesignTarget(selected: SelectedNode): DesignTarget {
  const parsed = parseLoc(selected.loc);
  const sourceKind =
    selected.sourceKind ?? (selected.loc.startsWith('dom://') ? 'dom-fallback' : 'react-source');
  return {
    id: designTargetId(selected),
    loc: selected.loc,
    filePath: parsed?.file ?? null,
    line: parsed?.line ?? null,
    column: parsed?.column ?? null,
    tagName: selected.tagName,
    rect: selected.rect,
    sourceKind,
    ...(selected.componentName ? { componentName: selected.componentName } : {}),
    ...(selected.componentLoc ? { componentLoc: selected.componentLoc } : {}),
    ...(selected.selector ? { selector: selected.selector } : {}),
    ...(selected.text ? { text: selected.text } : {}),
    ...(selected.attributes ? { attributes: selected.attributes } : {}),
    ...(selected.domPath ? { domPath: selected.domPath } : {}),
    ...(selected.componentPath ? { componentPath: selected.componentPath } : {}),
    ...(selected.selectionNotice ? { selectionNotice: selected.selectionNotice } : {}),
    ...(selected.inspectId ? { inspectId: selected.inspectId } : {}),
    ...(selected.computedStyles ? { computedStyles: selected.computedStyles } : {}),
  };
}

export function designTargetId(
  selected: Pick<SelectedNode, 'loc' | 'tagName' | 'selector' | 'text'>,
): string {
  return [selected.loc, selected.tagName, selected.selector ?? '', selected.text ?? ''].join('|');
}

function parseLoc(loc: string): { file: string; line: number; column: number } | null {
  if (loc.startsWith('dom://')) return null;
  const match = /^(.+):(\d+):(\d+)$/.exec(loc);
  if (!match) return null;
  return {
    file: match[1]!,
    line: Number(match[2]),
    column: Number(match[3]),
  };
}
