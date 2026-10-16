/**
 * Catalog-component usage resolution for the Design panel's Component tab
 * (task 0133).
 *
 * A click on a library component resolves to source *inside* that component,
 * which is the wrong place to edit props: the user wants to configure this one
 * usage on the screen. React's fiber boundary already reports where the
 * instance was written (`componentLoc`), so this module pairs that usage site
 * with the params the component declares, and decides whether writing there is
 * safe (screen usage) or shared (component definition, other screens).
 */
import { createHash } from 'node:crypto';
import { SyntaxKind } from 'ts-morph';
import {
  DESIGN_INDEX_PATHS,
  extractComponentParams,
  readColocatedStorySources,
  readComponentSources,
  readImportedTypeSources,
  type IndexedComponentRecord,
} from '@sber-designer/design-indexer';
import type {
  ComponentParam,
  DesignComponentInstance,
  DesignPropInfo,
  DesignSourceScope,
  DesignTarget,
} from '@sber-designer/shared-types';

import {
  extractProps,
  findJsxOpeningAt,
  getTagName,
  inferSourceScope,
  loadSourceFile,
  parseLoc,
  toWorkspaceRelativePath,
  type InspectorProjectIndex,
} from './design-inspector-source';
import { readWorkspaceFile } from './safe-fs';

interface ActiveScreenRef {
  filePath?: string | undefined;
  implementationFilePath?: string | undefined;
}

export interface ResolveComponentInstanceInput {
  workspaceRoot: string;
  target: DesignTarget;
  /** JSX tag resolved at the element target, used to detect self-instances. */
  targetTagName: string;
  activeScreen?: ActiveScreenRef | undefined;
  projectIndex?: InspectorProjectIndex | undefined;
}

/**
 * Resolve the component usage behind a selection, or `null` when the selection
 * is not a catalog component (a plain `<div>`, a DOM fallback, an unmatched
 * local element).
 */
export async function resolveComponentInstance(
  input: ResolveComponentInstanceInput,
): Promise<DesignComponentInstance | null> {
  const site = resolveInstanceSite(input);
  if (!site) return null;

  const components = await loadIndexedComponents(input.workspaceRoot);
  const match = matchCatalogComponent({
    components,
    componentName: site.componentName,
    definitionFilePath: definitionFilePathFromTarget(input.target, site.componentName),
  });

  const definitionFilePath =
    match?.record.filePath ?? definitionFilePathFromTarget(input.target, site.componentName);
  const params = definitionFilePath
    ? await loadComponentParams(input.workspaceRoot, definitionFilePath, site.componentName)
    : [];

  // Gate on "is there anything to configure": a catalog component always gets
  // the tab (so it can explain an empty schema), while an incidental boundary —
  // the screen component above a plain `<div>` — is dropped unless it really
  // declares params.
  if (params.length === 0 && !match) return null;

  const scope = inferSourceScope(
    { ...input.target, filePath: site.filePath },
    input.activeScreen,
    input.projectIndex,
  );
  const baseline = await readBaseline(input.workspaceRoot, site.filePath);
  const sourceOwned = scope === 'screen-instance' || scope === 'storybook-wrapper';
  const editable = sourceOwned && Boolean(baseline);

  return {
    loc: site.loc,
    filePath: site.filePath,
    line: site.line,
    column: site.column,
    tagName: site.tagName,
    componentName: site.componentName,
    ...(match ? { componentId: match.record.id, matchedBy: match.matchedBy } : {}),
    ...(definitionFilePath ? { definitionFilePath } : {}),
    params: withOptionMeanings(params, match?.record),
    props: site.props,
    editable,
    ...(editable
      ? {}
      : {
          reason: sourceOwned
            ? `The source baseline for ${site.filePath} could not be read. Re-index or reconnect the project before editing its params.`
            : sharedInstanceReason(scope, site.filePath),
        }),
    scope,
    ...(baseline ? { baseline } : {}),
  };
}

interface InstanceSite {
  loc: string;
  filePath: string;
  line: number;
  column: number;
  tagName: string;
  componentName: string;
  props: DesignPropInfo[];
}

/**
 * The usage site is either the selected element itself or the fiber component
 * boundary above it.
 *
 * Order matters. A click on a library component usually resolves to the
 * innermost JSX that carries a debug source, which lives in the component's own
 * file and is often a component tag itself (`<MuiButton>` inside `Button.tsx`).
 * So the selected element only counts as the instance when it sits in the file
 * being edited; otherwise the boundary — the `<Button …>` written on the screen
 * — is what the user can actually configure.
 */
function resolveInstanceSite(input: ResolveComponentInstanceInput): InstanceSite | null {
  const target = input.target;
  const editedFiles = new Set(
    [input.activeScreen?.implementationFilePath, input.activeScreen?.filePath].filter(
      (path): path is string => Boolean(path),
    ),
  );
  const targetIsEditableUsage =
    Boolean(target.filePath) &&
    Boolean(target.line) &&
    isComponentTag(input.targetTagName) &&
    target.sourceKind !== 'dom-fallback' &&
    (editedFiles.size === 0 ? !target.componentLoc : editedFiles.has(target.filePath ?? ''));

  if (targetIsEditableUsage && target.filePath && target.line) {
    const opening = findJsxOpeningAt(loadSourceFile(input.workspaceRoot, target.filePath), {
      line: target.line,
      column: target.column ?? 0,
    });
    return {
      loc: target.loc,
      filePath: target.filePath,
      line: target.line,
      column: target.column ?? 0,
      tagName: input.targetTagName,
      componentName: input.targetTagName,
      props: extractInstanceProps(opening),
    };
  }

  if (!target.componentLoc || !target.componentName || !isComponentTag(target.componentName)) {
    return null;
  }
  const parsed = parseLoc(target.componentLoc);
  if (!parsed) return null;

  let filePath: string;
  try {
    filePath = toWorkspaceRelativePath(input.workspaceRoot, parsed.file);
  } catch {
    return null;
  }

  try {
    const sourceFile = loadSourceFile(input.workspaceRoot, filePath);
    const opening = findJsxOpeningAt(sourceFile, { line: parsed.line, column: parsed.column });
    const tagName = getTagName(opening);
    if (!isComponentTag(tagName)) return null;
    return {
      loc: `${filePath}:${parsed.line}:${parsed.column}`,
      filePath,
      line: parsed.line,
      column: parsed.column,
      tagName,
      componentName: target.componentName,
      props: extractInstanceProps(opening),
    };
  } catch {
    // Stale fiber location or unparsable source: no instance controls, and the
    // rest of the inspect result stays usable.
    return null;
  }
}

function extractInstanceProps(opening: ReturnType<typeof findJsxOpeningAt>): DesignPropInfo[] {
  const props = extractProps(opening);
  if (opening.getKind() === SyntaxKind.JsxSelfClosingElement) return props;
  const element = opening.getParentIfKind(SyntaxKind.JsxElement);
  if (!element) return props;
  const children = element.getJsxChildren();
  if (children.length === 0) {
    return [...props, { name: 'children', value: '', kind: 'string', editable: true }];
  }

  const textParts: string[] = [];
  for (const child of children) {
    if (child.getKind() === SyntaxKind.JsxText) {
      textParts.push(child.getText());
      continue;
    }
    if (child.getText().trim() === '') continue;
    return [
      ...props,
      {
        name: 'children',
        value: child.getText().trim(),
        kind: 'expression',
        editable: false,
        reason: 'Mixed or expression children are read-only in the Component tab.',
      },
    ];
  }
  return [
    ...props,
    {
      name: 'children',
      value: textParts.join('').replace(/\s+/gu, ' ').trim(),
      kind: 'string',
      editable: true,
    },
  ];
}

function isComponentTag(tagName: string): boolean {
  return /^[A-Z]/u.test(tagName);
}

/** The component's own source when the click landed inside its definition. */
function definitionFilePathFromTarget(target: DesignTarget, componentName: string): string | null {
  if (!target.filePath) return null;
  if (target.componentName !== componentName) return null;
  if (!target.componentLoc) return null;
  const instanceFile = parseLoc(target.componentLoc)?.file ?? '';
  // When the instance lives elsewhere, the selected file is the definition.
  return instanceFile.endsWith(target.filePath) ? null : target.filePath;
}

interface CatalogMatch {
  record: IndexedComponentRecord;
  matchedBy: 'source-path' | 'name';
}

export function matchCatalogComponent(input: {
  components: IndexedComponentRecord[];
  componentName: string;
  definitionFilePath?: string | null;
}): CatalogMatch | null {
  if (input.components.length === 0) return null;
  const byName = input.components.filter((record) => record.shortName === input.componentName);

  if (input.definitionFilePath) {
    const normalized = normalizePath(input.definitionFilePath);
    const bySourcePath = (byName.length > 0 ? byName : input.components).find(
      (record) => normalizePath(record.filePath) === normalized,
    );
    if (bySourcePath) return { record: bySourcePath, matchedBy: 'source-path' };
  }
  if (byName.length === 1 && byName[0]) return { record: byName[0], matchedBy: 'name' };
  return null;
}

function normalizePath(value: string): string {
  return value.split('\\').join('/').replace(/^\.\//u, '');
}

async function loadComponentParams(
  workspaceRoot: string,
  definitionFilePath: string,
  componentName: string,
): Promise<ComponentParam[]> {
  try {
    const sourceText = await readComponentSources(workspaceRoot, definitionFilePath);
    if (!sourceText) return [];
    const [storyText, typeSourceText] = await Promise.all([
      readColocatedStorySources(workspaceRoot, definitionFilePath, componentName),
      readImportedTypeSources(workspaceRoot, definitionFilePath, sourceText),
    ]);
    return extractComponentParams({
      sourceText,
      componentName,
      ...(storyText ? { storyText } : {}),
      ...(typeSourceText ? { typeSourceText } : {}),
    });
  } catch {
    return [];
  }
}

/** Human meaning for enum values, when the description layer carries one. */
function withOptionMeanings(
  params: ComponentParam[],
  record: IndexedComponentRecord | undefined,
): ComponentParam[] {
  const guidance = record?.descriptionLayer?.variantGuidance ?? [];
  if (guidance.length === 0) return params;
  const meanings = new Map(
    guidance.map((entry) => [
      entry.prop,
      new Map(entry.values.map((value) => [value.value, value.meaning])),
    ]),
  );
  return params.map((param) => {
    const byValue = meanings.get(param.prop);
    if (!byValue || !param.options) return param;
    return {
      ...param,
      options: param.options.map((option) => {
        const meaning = byValue.get(option.value);
        return meaning ? { ...option, meaning } : option;
      }),
    };
  });
}

function sharedInstanceReason(scope: DesignSourceScope, filePath: string): string {
  if (scope === 'component-definition') {
    return `This usage lives in ${filePath}, which is shared source — editing it here would change every screen that renders it. Open the screen that owns the instance, or ask the assistant.`;
  }
  return `This usage lives in ${filePath}, outside the active screen. Open that screen to edit its params.`;
}

async function readBaseline(
  workspaceRoot: string,
  filePath: string,
): Promise<{ filePath: string; hash: string } | null> {
  try {
    const contents = await readWorkspaceFile(workspaceRoot, filePath);
    return { filePath, hash: createHash('sha256').update(contents).digest('hex') };
  } catch {
    return null;
  }
}

interface ComponentsCacheEntry {
  key: string;
  components: IndexedComponentRecord[];
}

let componentsCache: ComponentsCacheEntry | null = null;

/**
 * `components.jsonl` for the workspace, memoized on a content hash so a
 * click-heavy Design session does not re-read the whole catalog per selection.
 */
async function loadIndexedComponents(workspaceRoot: string): Promise<IndexedComponentRecord[]> {
  let contents = '';
  try {
    contents = await readWorkspaceFile(workspaceRoot, DESIGN_INDEX_PATHS.components);
  } catch {
    return [];
  }
  const key = `${workspaceRoot}:${createHash('sha256').update(contents).digest('hex')}`;
  if (componentsCache?.key === key) return componentsCache.components;
  const components = contents
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as IndexedComponentRecord];
      } catch {
        return [];
      }
    });
  componentsCache = { key, components };
  return components;
}

export function resetIndexedComponentsCacheForTests(): void {
  componentsCache = null;
}
