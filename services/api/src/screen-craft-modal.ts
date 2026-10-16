import { Node, Project, ScriptKind, SyntaxKind } from 'ts-morph';
import {
  MODAL_BACKDROP_MARKER,
  MODAL_CONTENT_ATTR,
  MODAL_HEIGHT_VAR,
  MODAL_REGION_MARKER,
  MODAL_WIDTH_VAR,
  MODAL_WINDOW_MARKER,
} from '@sber-designer/shared-types';

import { scanHtmlStartTags } from './html-start-tags';
import type { ScreenCraftFinding } from './screen-craft';

interface MarkedElement {
  tagName: string;
  attributes: ReadonlyMap<string, string | null>;
  raw: string;
}

const DOM_FORWARDING_DIALOGS = new Set([
  'DialogContent',
  'AlertDialogContent',
  'SheetContent',
  'DrawerContent',
]);

export function findModalContractIssues(contents: string, filePath: string): ScreenCraftFinding[] {
  const elements = markedElements(contents, filePath);
  const windows = withAttribute(elements, MODAL_WINDOW_MARKER);
  const backdrops = withAttribute(elements, MODAL_BACKDROP_MARKER);
  const roots = withAttribute(elements, 'data-sd-screen-root');
  const regions = withAttribute(elements, MODAL_REGION_MARKER);
  const findings: ScreenCraftFinding[] = [];

  if (windows.length === 0) {
    return [
      finding(
        'craft.modal.missing-window',
        `Modal screen has no ${MODAL_WINDOW_MARKER} element; metadata and source layout disagree.`,
        filePath,
        `Add one DOM-forwarding ${MODAL_WINDOW_MARKER} dialog window before completing the conversion.`,
      ),
    ];
  }
  if (windows.length !== 1) {
    findings.push(
      finding(
        'craft.modal.ambiguous-window',
        `Modal screen has ${windows.length} ${MODAL_WINDOW_MARKER} elements; exactly one managed window is required.`,
        filePath,
        `Keep one ${MODAL_WINDOW_MARKER} on the rendered dialog-content element.`,
      ),
    );
  }
  const modalWindow = windows[0]!;

  if (backdrops.length !== 1 || !backdrops.some((item) => roots.includes(item))) {
    findings.push(
      finding(
        'craft.modal.backdrop-root',
        `The modal must have one viewport backdrop that is also the single data-sd-screen-root.`,
        filePath,
        `Put ${MODAL_BACKDROP_MARKER} and data-sd-screen-root on the same rendered root wrapper.`,
      ),
    );
  }

  if (!isDomForwardingTag(modalWindow.tagName)) {
    findings.push(
      finding(
        'craft.modal.non-forwarding-window',
        `${MODAL_WINDOW_MARKER} is attached to ${modalWindow.tagName}, which is not a known DOM-forwarding dialog element.`,
        filePath,
        `Move the marker to a native element or a known DOM-forwarding DialogContent primitive.`,
      ),
    );
  }

  if (!modalWindow.raw.includes(MODAL_WIDTH_VAR) || !modalWindow.raw.includes(MODAL_HEIGHT_VAR)) {
    findings.push(
      finding(
        'craft.modal.size-not-in-contract',
        `The modal window must carry both ${MODAL_WIDTH_VAR} and ${MODAL_HEIGHT_VAR} inline.`,
        filePath,
        `Put both contract variables on the single ${MODAL_WINDOW_MARKER} element.`,
      ),
    );
  }

  const contentMode = modalWindow.attributes.get(MODAL_CONTENT_ATTR);
  if (contentMode !== 'scroll' && contentMode !== 'grow') {
    findings.push(
      finding(
        'craft.modal.content-mode',
        `${MODAL_CONTENT_ATTR} must be "scroll" or "grow" on the modal window.`,
        filePath,
        `Set ${MODAL_CONTENT_ATTR} on ${MODAL_WINDOW_MARKER}.`,
      ),
    );
  }

  const bodyRegions = regions.filter(
    (element) => element.attributes.get(MODAL_REGION_MARKER) === 'body',
  );
  const headerRegions = regions.filter(
    (element) => element.attributes.get(MODAL_REGION_MARKER) === 'header',
  );
  const footerRegions = regions.filter(
    (element) => element.attributes.get(MODAL_REGION_MARKER) === 'footer',
  );
  if (bodyRegions.length !== 1 || headerRegions.length > 1 || footerRegions.length > 1) {
    findings.push(
      finding(
        'craft.modal.region-contract',
        `Modal regions are invalid: body=${bodyRegions.length}, header=${headerRegions.length}, footer=${footerRegions.length}.`,
        filePath,
        'Keep one body region and at most one header and one footer region.',
      ),
    );
  }

  const role = modalWindow.attributes.get('role');
  const ariaModal = modalWindow.attributes.get('aria-modal');
  const hasName =
    modalWindow.attributes.has('aria-label') || modalWindow.attributes.has('aria-labelledby');
  if ((role !== 'dialog' && role !== 'alertdialog') || ariaModal !== 'true' || !hasName) {
    findings.push(
      finding(
        'craft.modal.accessibility',
        'The modal window needs dialog/alertdialog semantics, aria-modal="true", and an accessible name.',
        filePath,
        'Add role, aria-modal, and aria-label or aria-labelledby to the dialog window.',
      ),
    );
  }

  if (contentMode === 'scroll' && !hasScrollBodyContract(contents)) {
    findings.push(
      finding(
        'craft.modal.scroll-contract',
        'Scroll mode must keep the body elastic and make the body the only vertical scroller.',
        filePath,
        'Give the body flex: 1, min-height: 0, and overflow-y: auto while the window clips overflow.',
      ),
    );
  }
  if (contentMode === 'grow' && !hasGrowContract(contents)) {
    findings.push(
      finding(
        'craft.modal.grow-contract',
        'Grow mode must let the window/body expand and make the backdrop scroll long content.',
        filePath,
        'Use auto height/no max-height on the window, visible body overflow, and overflow-y:auto on the backdrop.',
      ),
    );
  }

  if (/\.html?$/iu.test(filePath) && hasOpaquePreviewHost(contents)) {
    findings.push(
      finding(
        'craft.modal.opaque-host',
        'The modal preview host sets an opaque html/body background, so an underlay cannot show through.',
        filePath,
        'Keep html/body and the preview host transparent; the modal backdrop owns the scrim.',
      ),
    );
  }

  return findings;
}

export function findPageModalMismatch(contents: string, filePath: string): ScreenCraftFinding[] {
  const elements = markedElements(contents, filePath);
  if (
    withAttribute(elements, MODAL_WINDOW_MARKER).length === 0 &&
    withAttribute(elements, MODAL_BACKDROP_MARKER).length === 0
  ) {
    return [];
  }
  return [
    finding(
      'craft.modal.page-surface-mismatch',
      'Screen metadata says page, but the source still renders the managed modal contract.',
      filePath,
      'Complete the modal→page conversion in source or restore surface: modal.',
    ),
  ];
}

function markedElements(contents: string, filePath: string): MarkedElement[] {
  if (/\.html?$/iu.test(filePath)) {
    return scanHtmlStartTags(contents).map((tag) => ({
      tagName: tag.tagName,
      attributes: tag.attributes,
      raw: contents.slice(tag.start, tag.end),
    }));
  }
  const project = new Project({
    useInMemoryFileSystem: true,
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    skipLoadingLibFiles: true,
  });
  const source = project.createSourceFile('screen.tsx', contents, {
    overwrite: true,
    scriptKind: ScriptKind.TSX,
  });
  const nodes = [
    ...source.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ...source.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ];
  return nodes.map((node) => {
    const attributes = new Map<string, string | null>();
    for (const attribute of node.getAttributes()) {
      if (!Node.isJsxAttribute(attribute)) continue;
      const name = attribute.getNameNode().getText();
      const initializer = attribute.getInitializer();
      attributes.set(name, jsxAttributeValue(initializer?.getText()));
    }
    return {
      tagName: node.getTagNameNode().getText(),
      attributes,
      raw: node.getText(),
    };
  });
}

function jsxAttributeValue(text: string | undefined): string | null {
  if (!text) return null;
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1);
  }
  const expression = /^\{\s*["']([^"']+)["']\s*\}$/u.exec(text);
  return expression?.[1] ?? null;
}

function withAttribute(elements: MarkedElement[], attribute: string): MarkedElement[] {
  return elements.filter((element) => element.attributes.has(attribute));
}

function isDomForwardingTag(tagName: string): boolean {
  return /^[a-z]/u.test(tagName) || DOM_FORWARDING_DIALOGS.has(tagName);
}

function hasScrollBodyContract(contents: string): boolean {
  return (
    /(?:min-height\s*:\s*0|minHeight\s*:\s*0)/u.test(contents) &&
    /(?:overflow-y\s*:\s*auto|overflowY\s*:\s*['"]auto['"])/u.test(contents) &&
    /(?:overflow\s*:\s*hidden|overflow\s*:\s*['"]hidden['"])/u.test(contents)
  );
}

function hasGrowContract(contents: string): boolean {
  return (
    /(?:overflow-y\s*:\s*auto|overflowY\s*:\s*['"]auto['"])/u.test(contents) &&
    /(?:max-height\s*:\s*none|maxHeight\s*:\s*['"]none['"])/u.test(contents) &&
    /(?:overflow\s*:\s*visible|overflow\s*:\s*['"]visible['"])/u.test(contents)
  );
}

function hasOpaquePreviewHost(contents: string): boolean {
  for (const match of contents.matchAll(/([^{}]+)\{([^{}]*)\}/gu)) {
    const selectors = (match[1] ?? '').split(',').map((selector) => selector.trim());
    if (
      !selectors.some((selector) => /^(?:html|body|#storybook-root)(?:\s|$|[.:])/u.test(selector))
    ) {
      continue;
    }
    const declarations = match[2] ?? '';
    for (const background of declarations.matchAll(/\bbackground(?:-color)?\s*:\s*([^;]+)/giu)) {
      const value = background[1]?.trim().toLowerCase() ?? '';
      if (value && value !== 'transparent' && !/^rgba?\([^)]*,\s*0(?:[.)])/u.test(value)) {
        return true;
      }
    }
  }
  return false;
}

function finding(
  ruleId: string,
  message: string,
  filePath: string,
  fixHint: string,
): ScreenCraftFinding {
  return {
    severity: 'blocking',
    ruleId,
    category: 'sourceIntegrity',
    filePath,
    message,
    fixHint,
  };
}
