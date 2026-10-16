import { readFile } from 'node:fs/promises';
import { posix, resolve } from 'node:path';

import {
  collectInterfaceBlocks,
  compactTypeName,
  extractLiteralUnionAliases,
  extractPropsBlocks,
  literalUnionValues,
  MAX_UNION_VALUES,
  MIN_UNION_VALUES,
  readComponentSources,
  splitMembers,
  STORY_FILE_RE as STORY_RE,
} from './props-source';
import {
  collectSourceFiles,
  importMatchesComponent,
  normalizeScanPath,
  parseImports,
  sliceBraceBlock,
} from './scan-shared';
import type { IndexedComponentRecord, UsageCardVariantGuidance } from './types';

const SOURCE_ROOTS = ['src', 'components', 'app', 'pages', 'screens', 'stories'];
const MAX_STORY_FILES = 400;

export interface ComponentVariantRecord {
  componentId: string;
  props: UsageCardVariantGuidance[];
  /** Required (non-optional) prop names from the component's *Props type (0082 Track 2). */
  requiredProps: string[];
}

const EXCLUDED_REQUIRED_PROPS = new Set(['children', 'key', 'ref', 'className', 'style']);
const MAX_REQUIRED_PROPS = 8;

export interface ScanComponentVariantsInput {
  workspaceRoot: string;
  components: IndexedComponentRecord[];
}

/**
 * Extract selection-relevant prop options per component (0080 Track A2):
 * any union-of-string-literals prop from the component's own TS sources, plus
 * Storybook `argTypes.<prop>.options` as enrichment when stories exist.
 * No hardcoded prop-name list — `variant`/`size` are common cases, not rules.
 */
export async function scanComponentVariants(
  input: ScanComponentVariantsInput,
): Promise<ComponentVariantRecord[]> {
  const records = new Map<string, Map<string, UsageCardVariantGuidance>>();
  const requiredByComponent = new Map<string, string[]>();

  for (const component of input.components) {
    const contents = await readComponentSources(input.workspaceRoot, component.filePath);
    if (!contents) continue;
    const props = extractUnionProps(contents);
    const required = extractRequiredProps(contents, component.shortName);
    if (props.length > 0) {
      const byProp = new Map<string, UsageCardVariantGuidance>();
      for (const prop of props) byProp.set(prop.prop, prop);
      records.set(component.id, byProp);
    }
    if (required.length > 0) requiredByComponent.set(component.id, required);
  }

  await enrichFromArgTypes(input, records);

  const componentIds = new Set([...records.keys(), ...requiredByComponent.keys()]);
  return Array.from(componentIds)
    .map((componentId) => ({
      componentId,
      props: Array.from(records.get(componentId)?.values() ?? []).sort((a, b) =>
        a.prop.localeCompare(b.prop),
      ),
      requiredProps: requiredByComponent.get(componentId) ?? [],
    }))
    .filter((record) => record.props.length > 0 || record.requiredProps.length > 0)
    .sort((a, b) => a.componentId.localeCompare(b.componentId));
}

/**
 * Required (non-optional) prop names from the component's `*Props` type and any
 * same-file interfaces it `extends` (0082 Track 2). Best-effort: props inherited
 * from imported interfaces are not followed across modules. Tells a
 * non-source-reading LLM which props it must set to instantiate the component.
 *
 * 0083 R6: scope to THIS component's `<shortName>Props` interface. When the chunk
 * holds several components (a barrel / `index.ts` / story reads siblings), pulling
 * required props from every `*Props` would assign a neighbour's props to this
 * component. Fall back to the sole `*Props` only when there is exactly one.
 */
function extractRequiredProps(contents: string, componentName: string): string[] {
  const interfaces = collectInterfaceBlocks(contents);
  const propsNames = Array.from(interfaces.keys()).filter((name) => name.endsWith('Props'));
  const target = `${compactTypeName(componentName)}props`;
  let roots = propsNames.filter((name) => compactTypeName(name) === target);
  if (roots.length === 0) roots = propsNames.length === 1 ? propsNames : [];
  if (roots.length === 0) return [];

  const required = new Set<string>();
  const visited = new Set<string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const name = queue.shift() as string;
    if (visited.has(name)) continue;
    visited.add(name);
    const block = interfaces.get(name);
    if (!block) continue;
    collectRequiredMembers(block.body, required);
    for (const parent of block.extends) if (!visited.has(parent)) queue.push(parent);
  }
  return Array.from(required).slice(0, MAX_REQUIRED_PROPS);
}

function collectRequiredMembers(block: string, out: Set<string>): void {
  for (const member of splitMembers(block)) {
    const match = /^(?:readonly\s+)?([A-Za-z_$][\w$]*)(\??)\s*:/u.exec(member.trim());
    const name = match?.[1];
    const optional = match?.[2] === '?';
    if (!name || optional) continue;
    if (EXCLUDED_REQUIRED_PROPS.has(name)) continue;
    out.add(name);
  }
}

function extractUnionProps(contents: string): UsageCardVariantGuidance[] {
  const aliases = extractLiteralUnionAliases(contents);
  const props = new Map<string, string[]>();

  for (const block of extractPropsBlocks(contents)) {
    for (const member of splitMembers(block)) {
      const match = /^(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*:\s*([\s\S]+)$/.exec(member.trim());
      const name = match?.[1];
      const typeText = match?.[2]?.trim();
      if (!name || !typeText) continue;
      const values = literalUnionValues(typeText) ?? aliases.get(typeText) ?? null;
      if (!values) continue;
      if (values.length < MIN_UNION_VALUES || values.length > MAX_UNION_VALUES) continue;
      if (!props.has(name)) props.set(name, values);
    }
  }

  return Array.from(props.entries()).map(([prop, values]) => ({
    prop,
    values: values.map((value) => ({ value, meaning: '' })),
    source: 'ts-union' as const,
  }));
}

async function enrichFromArgTypes(
  input: ScanComponentVariantsInput,
  records: Map<string, Map<string, UsageCardVariantGuidance>>,
): Promise<void> {
  const storyFiles: string[] = [];
  for (const root of SOURCE_ROOTS) {
    await collectSourceFiles(input.workspaceRoot, root, storyFiles, {
      fileRe: STORY_RE,
      maxFiles: MAX_STORY_FILES,
    });
    if (storyFiles.length >= MAX_STORY_FILES) break;
  }

  for (const storyPath of storyFiles.sort()) {
    let contents: string;
    try {
      contents = await readFile(resolve(input.workspaceRoot, storyPath), 'utf8');
    } catch {
      continue;
    }
    const component = resolveStoryComponent(contents, storyPath, input.components);
    if (!component) continue;
    const options = extractArgTypeOptions(contents);
    if (options.length === 0) continue;
    const byProp = records.get(component.id) ?? new Map<string, UsageCardVariantGuidance>();
    for (const option of options) {
      if (byProp.has(option.prop)) continue; // TS unions win; argTypes only fill gaps.
      byProp.set(option.prop, option);
    }
    records.set(component.id, byProp);
  }
}

function resolveStoryComponent(
  contents: string,
  storyPath: string,
  components: IndexedComponentRecord[],
): IndexedComponentRecord | null {
  const componentRef = /component\s*:\s*([A-Za-z_$][\w$]*)/.exec(contents)?.[1];
  if (componentRef) {
    const binding = parseImports(contents).get(componentRef);
    if (binding) {
      const match = components.find((component) =>
        importMatchesComponent(binding.source, storyPath, component),
      );
      if (match) return match;
    }
    const byName = components.filter((component) => component.shortName === componentRef);
    if (byName.length === 1) return byName[0] ?? null;
  }
  const title = /title\s*:\s*['"]([^'"]+)['"]/.exec(contents)?.[1];
  if (title) {
    const byTitle = components.find((component) => component.title === title);
    if (byTitle) return byTitle;
  }
  // Same-directory fallback: Button.stories.tsx next to Button.tsx.
  const dir = posix.dirname(normalizeScanPath(storyPath));
  const byDir = components.filter(
    (component) => posix.dirname(normalizeScanPath(component.filePath)) === dir,
  );
  return byDir.length === 1 ? (byDir[0] ?? null) : null;
}

function extractArgTypeOptions(contents: string): UsageCardVariantGuidance[] {
  const head = /argTypes\s*:\s*\{/.exec(contents);
  if (!head) return [];
  const block = sliceBraceBlock(contents, head.index + head[0].length - 1, 8_000);
  if (!block) return [];
  const result: UsageCardVariantGuidance[] = [];
  const propRe = /([A-Za-z_$][\w$]*)\s*:\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = propRe.exec(block)) !== null) {
    const prop = match[1];
    const propBlock = sliceBraceBlock(block, match.index + match[0].length - 1, 2_000);
    if (!prop || !propBlock) continue;
    const options = /options\s*:\s*\[([^\]]*)\]/.exec(propBlock)?.[1];
    if (!options) continue;
    const values = Array.from(options.matchAll(/['"]([^'"]+)['"]/g)).flatMap((m) =>
      m[1] === undefined ? [] : [m[1]],
    );
    if (values.length < MIN_UNION_VALUES || values.length > MAX_UNION_VALUES) continue;
    result.push({
      prop,
      values: Array.from(new Set(values)).map((value) => ({ value, meaning: '' })),
      source: 'argtypes',
    });
    propRe.lastIndex = match.index + match[0].length + propBlock.length - 1;
  }
  return result;
}
