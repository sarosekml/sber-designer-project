import { access, readFile, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import ts from 'typescript';
import type {
  ComponentDescriptionLayer,
  ComponentEntry,
  StoryDescriptionLayer,
} from '@sber-designer/shared-types';

import {
  coerceComponentLayer,
  descriptionLayerFromMarkdown,
  extractStructuredLayerBlock,
} from './description-for-ai';

interface ComponentUsageMetadata {
  description?: string;
  descriptionLayer?: ComponentDescriptionLayer;
}

interface StoryUsageMetadata {
  description?: string;
  descriptionLayer?: StoryDescriptionLayer;
}

/**
 * Identity of the real component a story documents, read from the CSF default
 * export `component:` and its import statement (0082 Track 1). Used to merge
 * story files that document the same component into one catalog entry, keyed by
 * the public import name + raw module specifier (what the agent imports).
 */
export interface ComponentIdentity {
  /** Local name as imported by the story, e.g. `Table`. */
  name: string;
  /** Raw module specifier the component is imported from, e.g. `@/components/organisms/Tables`. */
  importSource: string;
}

export interface StorybookUsageMetadata {
  component?: ComponentUsageMetadata;
  componentIdentity?: ComponentIdentity;
  stories: Map<string, StoryUsageMetadata>;
}

interface NamedImport {
  imported: string;
  sourcePath: string;
}

interface ParsedModule {
  filePath: string;
  sourceFile: ts.SourceFile;
  imports: Map<string, NamedImport>;
  declarations: Map<string, ts.Expression>;
  exports: Map<string, ts.Expression>;
}

interface ExtractContext {
  workspaceRoot: string;
  modules: Map<string, ParsedModule>;
  resolving: Set<string>;
}

export async function extractStorybookUsageMetadata(input: {
  workspaceRoot: string;
  importPath: string;
}): Promise<StorybookUsageMetadata> {
  const workspaceRoot = resolve(input.workspaceRoot);
  const storyPath = await resolveStoryImportPath(workspaceRoot, input.importPath);
  if (!storyPath) return { stories: new Map() };

  const ctx: ExtractContext = {
    workspaceRoot,
    modules: new Map(),
    resolving: new Set(),
  };
  const mod = await parseModule(ctx, storyPath);
  if (!mod) return { stories: new Map() };

  const component = await extractDefaultMetaDescription(ctx, mod);
  const componentIdentity = extractComponentIdentity(mod);
  const stories = await extractStoryDescriptions(ctx, mod);
  return {
    ...(component ? { component } : {}),
    ...(componentIdentity ? { componentIdentity } : {}),
    stories,
  };
}

/**
 * Read the CSF default-export `component:` symbol and the raw module specifier
 * it is imported from. Returns undefined when the meta omits `component`, when
 * it is not a plain identifier, or when no matching import is found (callers
 * then fall back to grouping by story title).
 */
function extractComponentIdentity(mod: ParsedModule): ComponentIdentity | undefined {
  const metaExpr = defaultExportExpression(mod);
  if (!metaExpr) return undefined;
  const componentExpr = objectPropertyExpression(metaExpr, 'component');
  if (!componentExpr) return undefined;
  const unwrapped = unwrapExpression(componentExpr);
  if (!ts.isIdentifier(unwrapped)) return undefined;
  const localName = unwrapped.text;
  const importSource = rawImportSpecifierFor(mod, localName);
  if (!importSource) return undefined;
  return { name: localName, importSource };
}

/** Raw `from '...'` specifier of the import that binds `localName`. */
function rawImportSpecifierFor(mod: ParsedModule, localName: string): string | null {
  for (const statement of mod.sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const clause = statement.importClause;
    if (!clause) continue;
    if (clause.name?.text === localName) return statement.moduleSpecifier.text;
    const bindings = clause.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        if (element.name.text === localName) return statement.moduleSpecifier.text;
      }
    }
  }
  return null;
}

type SidecarComponent = Pick<ComponentEntry, 'id' | 'title' | 'shortName' | 'filePath'>;

function sidecarCandidatePaths(component: SidecarComponent): string[] {
  const baseName = component.filePath.replace(/\.[^.]+$/, '');
  return unique([
    `.sber-designer/components/${component.id}.md`,
    `.sber-designer/components/${component.shortName}.md`,
    `.sber-designer/components/${component.title.replace(/[\\/]+/g, '-')}.md`,
    `${baseName}.sd.md`,
    join(dirname(component.filePath), `${component.shortName}.sd.md`),
  ]);
}

async function readFirstSidecar(
  workspaceRoot: string,
  component: SidecarComponent,
): Promise<string | null> {
  const root = resolve(workspaceRoot);
  for (const candidate of sidecarCandidatePaths(component)) {
    const abs = resolve(root, candidate);
    if (!isInside(root, abs)) continue;
    try {
      const info = await stat(abs);
      if (!info.isFile() || info.size > 200_000) continue;
      return await readFile(abs, 'utf8');
    } catch {
      continue;
    }
  }
  return null;
}

export async function readComponentSidecarDescription(
  workspaceRoot: string,
  component: SidecarComponent,
): Promise<string | null> {
  const raw = await readFirstSidecar(workspaceRoot, component);
  return raw === null ? null : raw.slice(0, 12_000);
}

/**
 * 0083 — read the no-Storybook sidecar as a structured source: a fenced
 * `sberDesigner`/`sd-ai` JSON block wins; otherwise derive a layer from a
 * `## Description for AI` markdown section. `description` keeps the readable
 * markdown for back-compat with the catalog's `ComponentEntry.description`.
 */
export async function readComponentSidecarLayer(
  workspaceRoot: string,
  component: SidecarComponent,
): Promise<{ description: string; descriptionLayer?: ComponentDescriptionLayer } | null> {
  const raw = await readFirstSidecar(workspaceRoot, component);
  if (raw === null) return null;
  const descriptionLayer = extractStructuredLayerBlock(raw) ?? descriptionLayerFromMarkdown(raw);
  return {
    description: raw.slice(0, 12_000),
    ...(descriptionLayer ? { descriptionLayer } : {}),
  };
}

export function componentDescriptionToMarkdown(layer: ComponentDescriptionLayer): string {
  const usage = layer.usage
    .map((item) => {
      const props = item.props
        ? `\n  Props: ${Object.entries(item.props)
            .map(([key, value]) => `${key}=${value}`)
            .join(', ')}`
        : '';
      return `- **${item.title}:** ${item.when}${props}`;
    })
    .join('\n');

  return [
    layer.purpose,
    layer.anatomy.length > 0 ? `**Anatomy:** ${layer.anatomy.join(', ')}.` : '',
    usage ? `**Usage:**\n${usage}` : '',
    layer.agentGuidance.length > 0
      ? `**Agent guidance:**\n${layer.agentGuidance.map((item) => `- ${item}`).join('\n')}`
      : '',
    layer.sourceHtml ? `Source reference: \`${layer.sourceHtml}\`.` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function storyDescriptionToMarkdown(layer: StoryDescriptionLayer): string {
  const usage =
    layer.usage && layer.usage.length > 0
      ? `\n\nUsage:\n${layer.usage.map((item) => `- **${item.title}:** ${item.when}`).join('\n')}`
      : '';
  const guidance =
    layer.agentGuidance.length > 0
      ? `\n\nAgent guidance:\n${layer.agentGuidance.map((item) => `- ${item}`).join('\n')}`
      : '';
  return `${layer.purpose}${usage}${guidance}`;
}

async function extractDefaultMetaDescription(
  ctx: ExtractContext,
  mod: ParsedModule,
): Promise<ComponentUsageMetadata | null> {
  const expr = defaultExportExpression(mod);
  if (!expr) return null;
  const resolved = await expressionToObject(expr, ctx, mod);
  const parameters = objectPropertyExpression(resolved.sourceExpression, 'parameters');
  if (parameters) {
    return await parseComponentParameters(parameters, ctx, mod);
  }
  const paramsValue = objectAtPath(resolved.value, ['parameters']);
  if (paramsValue && isObject(paramsValue)) {
    return descriptionFromParametersObject(paramsValue, 'component');
  }
  return null;
}

async function extractStoryDescriptions(
  ctx: ExtractContext,
  mod: ParsedModule,
): Promise<Map<string, StoryUsageMetadata>> {
  const stories = new Map<string, StoryUsageMetadata>();
  for (const statement of mod.sourceFile.statements) {
    if (
      !ts.isVariableStatement(statement) ||
      !hasModifier(statement, ts.SyntaxKind.ExportKeyword)
    ) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
      const storyName = declaration.name.text;
      if (storyName === 'meta') continue;
      const storyObject = await expressionToObject(declaration.initializer, ctx, mod);
      const parameters = objectPropertyExpression(storyObject.sourceExpression, 'parameters');
      const metadata = parameters
        ? await parseStoryParameters(parameters, ctx, mod)
        : descriptionFromParametersObject(objectAtPath(storyObject.value, ['parameters']), 'story');
      if (metadata) stories.set(storyName, metadata);
    }
  }
  return stories;
}

async function parseComponentParameters(
  expr: ts.Expression,
  ctx: ExtractContext,
  mod: ParsedModule,
): Promise<ComponentUsageMetadata | null> {
  const callLayer = await layerFromDescribeCall(expr, ctx, mod);
  if (callLayer) {
    const layer = isComponentLayer(callLayer) ? callLayer : coerceComponentLayer(callLayer);
    if (layer) {
      return {
        description: componentDescriptionToMarkdown(layer),
        descriptionLayer: layer,
      };
    }
  }

  const { value } = await expressionToObject(expr, ctx, mod);
  return descriptionFromParametersObject(value, 'component');
}

async function parseStoryParameters(
  expr: ts.Expression,
  ctx: ExtractContext,
  mod: ParsedModule,
): Promise<StoryUsageMetadata | null> {
  const callLayer = await layerFromDescribeCall(expr, ctx, mod);
  if (callLayer && isStoryLayer(callLayer)) {
    return {
      description: storyDescriptionToMarkdown(callLayer),
      descriptionLayer: callLayer,
    };
  }

  const { value } = await expressionToObject(expr, ctx, mod);
  return descriptionFromParametersObject(value, 'story');
}

async function layerFromDescribeCall(
  expr: ts.Expression,
  ctx: ExtractContext,
  mod: ParsedModule,
): Promise<Record<string, unknown> | null> {
  const unwrapped = unwrapExpression(expr);
  if (!ts.isCallExpression(unwrapped) || unwrapped.arguments.length === 0) return null;
  const callee = unwrapped.expression;
  if (!ts.isIdentifier(callee)) return null;
  if (callee.text !== 'describeComponent' && callee.text !== 'describeStory') return null;
  const first = unwrapped.arguments[0];
  if (!first) return null;
  const { value } = await expressionToObject(first, ctx, mod);
  return isObject(value) ? value : null;
}

function descriptionFromParametersObject(
  value: unknown,
  kind: 'component',
): ComponentUsageMetadata | null;
function descriptionFromParametersObject(value: unknown, kind: 'story'): StoryUsageMetadata | null;
function descriptionFromParametersObject(
  value: unknown,
  kind: 'component' | 'story',
): ComponentUsageMetadata | StoryUsageMetadata | null {
  if (!isObject(value)) return null;
  const docsDescription = objectAtPath(value, [
    'docs',
    'description',
    kind === 'component' ? 'component' : 'story',
  ]);
  const layerValue =
    kind === 'component'
      ? objectAtPath(value, ['sberDesigner', 'descriptionLayer'])
      : objectAtPath(value, ['sberDesigner', 'storyDescription']);
  if (kind === 'component') {
    const structured = isComponentLayer(layerValue) ? layerValue : coerceComponentLayer(layerValue);
    // 0083: when no structured layer, derive one from a `## Description for AI`
    // section embedded in the visible `docs.description.component` markdown.
    const derived =
      !structured && typeof docsDescription === 'string'
        ? descriptionLayerFromMarkdown(docsDescription)
        : null;
    const layer = structured ?? derived;
    if (!layer && typeof docsDescription !== 'string') return null;
    return {
      ...(typeof docsDescription === 'string' ? { description: docsDescription } : {}),
      ...(layer ? { descriptionLayer: layer } : {}),
    };
  }

  const layer = isStoryLayer(layerValue) ? layerValue : null;
  if (!layer && typeof docsDescription !== 'string') return null;
  return {
    ...(typeof docsDescription === 'string' ? { description: docsDescription } : {}),
    ...(layer ? { descriptionLayer: layer } : {}),
  };
}

async function expressionToObject(
  expr: ts.Expression,
  ctx: ExtractContext,
  mod: ParsedModule,
): Promise<{ value: unknown; sourceExpression: ts.Expression }> {
  const unwrapped = unwrapExpression(expr);
  if (ts.isIdentifier(unwrapped)) {
    const resolved = await resolveIdentifier(ctx, mod, unwrapped.text);
    return {
      value: resolved ?? null,
      sourceExpression:
        mod.declarations.get(unwrapped.text) ?? mod.exports.get(unwrapped.text) ?? unwrapped,
    };
  }
  const value = await expressionToValue(unwrapped, ctx, mod);
  return { value, sourceExpression: unwrapped };
}

async function expressionToValue(
  expr: ts.Expression,
  ctx: ExtractContext,
  mod: ParsedModule,
): Promise<unknown> {
  const unwrapped = unwrapExpression(expr);
  if (ts.isStringLiteral(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped)) {
    return unwrapped.text;
  }
  if (ts.isNumericLiteral(unwrapped)) return Number(unwrapped.text);
  if (unwrapped.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (unwrapped.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (unwrapped.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isArrayLiteralExpression(unwrapped)) {
    const values: unknown[] = [];
    for (const element of unwrapped.elements) {
      if (ts.isSpreadElement(element)) continue;
      values.push(await expressionToValue(element, ctx, mod));
    }
    return values;
  }
  if (ts.isIdentifier(unwrapped)) {
    return (await resolveIdentifier(ctx, mod, unwrapped.text)) ?? null;
  }
  if (!ts.isObjectLiteralExpression(unwrapped)) return null;

  const out: Record<string, unknown> = {};
  for (const prop of unwrapped.properties) {
    if (ts.isSpreadAssignment(prop)) {
      const spread = await expressionToValue(prop.expression, ctx, mod);
      if (isObject(spread)) Object.assign(out, spread);
      continue;
    }
    if (!ts.isPropertyAssignment(prop)) continue;
    const key = propertyName(prop.name);
    if (!key) continue;
    out[key] = await expressionToValue(prop.initializer, ctx, mod);
  }
  return out;
}

async function resolveIdentifier(
  ctx: ExtractContext,
  mod: ParsedModule,
  name: string,
): Promise<unknown> {
  const key = `${mod.filePath}::${name}`;
  if (ctx.resolving.has(key)) return null;
  ctx.resolving.add(key);
  try {
    const local = mod.declarations.get(name) ?? mod.exports.get(name);
    if (local) return await expressionToValue(local, ctx, mod);

    const imported = mod.imports.get(name);
    if (!imported) return null;
    const importedMod = await parseModule(ctx, imported.sourcePath);
    if (!importedMod) return null;
    const exported = importedMod.exports.get(imported.imported);
    if (!exported) return null;
    return await expressionToValue(exported, ctx, importedMod);
  } finally {
    ctx.resolving.delete(key);
  }
}

async function parseModule(ctx: ExtractContext, filePath: string): Promise<ParsedModule | null> {
  const abs = resolve(filePath);
  if (!isInside(ctx.workspaceRoot, abs)) return null;
  const cached = ctx.modules.get(abs);
  if (cached) return cached;
  let raw: string;
  try {
    raw = await readFile(abs, 'utf8');
  } catch {
    return null;
  }
  const sourceFile = ts.createSourceFile(abs, raw, ts.ScriptTarget.Latest, true, scriptKind(abs));
  const mod: ParsedModule = {
    filePath: abs,
    sourceFile,
    imports: new Map(),
    declarations: new Map(),
    exports: new Map(),
  };
  ctx.modules.set(abs, mod);

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      collectImports(ctx, mod, statement);
      continue;
    }
    if (!ts.isVariableStatement(statement)) continue;
    const exported = hasModifier(statement, ts.SyntaxKind.ExportKeyword);
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
      mod.declarations.set(declaration.name.text, declaration.initializer);
      if (exported) mod.exports.set(declaration.name.text, declaration.initializer);
    }
  }
  return mod;
}

function collectImports(ctx: ExtractContext, mod: ParsedModule, statement: ts.ImportDeclaration) {
  if (!ts.isStringLiteral(statement.moduleSpecifier)) return;
  const importClause = statement.importClause;
  if (!importClause?.namedBindings || !ts.isNamedImports(importClause.namedBindings)) return;
  const sourcePath = resolveModuleSpecifier(
    ctx.workspaceRoot,
    dirname(mod.filePath),
    statement.moduleSpecifier.text,
  );
  if (!sourcePath) return;
  for (const element of importClause.namedBindings.elements) {
    mod.imports.set(element.name.text, {
      imported: element.propertyName?.text ?? element.name.text,
      sourcePath,
    });
  }
}

function defaultExportExpression(mod: ParsedModule): ts.Expression | null {
  for (const statement of mod.sourceFile.statements) {
    if (!ts.isExportAssignment(statement) || statement.isExportEquals) continue;
    const expr = unwrapExpression(statement.expression);
    if (ts.isIdentifier(expr)) {
      return mod.declarations.get(expr.text) ?? expr;
    }
    return expr;
  }
  return null;
}

function objectPropertyExpression(expr: ts.Expression, name: string): ts.Expression | null {
  const unwrapped = unwrapExpression(expr);
  if (!ts.isObjectLiteralExpression(unwrapped)) return null;
  for (const prop of unwrapped.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    if (propertyName(prop.name) === name) return prop.initializer;
  }
  return null;
}

function unwrapExpression(expr: ts.Expression): ts.Expression {
  let current = expr;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function propertyName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return null;
}

function objectAtPath(value: unknown, path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!isObject(current)) return undefined;
    current = current[key];
  }
  return current;
}

function isComponentLayer(value: unknown): value is ComponentDescriptionLayer {
  if (!isObject(value)) return false;
  return (
    typeof value.purpose === 'string' &&
    isStringArray(value.anatomy) &&
    Array.isArray(value.usage) &&
    value.usage.every(isUsageExample) &&
    isStringArray(value.agentGuidance) &&
    (value.sourceHtml === undefined || typeof value.sourceHtml === 'string')
  );
}

function isStoryLayer(value: unknown): value is StoryDescriptionLayer {
  if (!isObject(value)) return false;
  return (
    typeof value.purpose === 'string' &&
    (value.usage === undefined ||
      (Array.isArray(value.usage) && value.usage.every(isUsageExample))) &&
    isStringArray(value.agentGuidance)
  );
}

function isUsageExample(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    typeof value.title === 'string' &&
    typeof value.when === 'string' &&
    (value.props === undefined || isStringRecord(value.props))
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!isObject(value)) return false;
  return Object.values(value).every((item) => typeof item === 'string');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return (
    ts.canHaveModifiers(node) && (ts.getModifiers(node)?.some((mod) => mod.kind === kind) ?? false)
  );
}

async function resolveStoryImportPath(
  workspaceRoot: string,
  importPath: string,
): Promise<string | null> {
  const cleaned = importPath.replace(/^\.\//, '');
  const abs = isAbsolute(cleaned) ? resolve(cleaned) : resolve(workspaceRoot, cleaned);
  if (!isInside(workspaceRoot, abs)) return null;
  return (await pathExists(abs)) ? abs : null;
}

function resolveModuleSpecifier(
  workspaceRoot: string,
  fromDir: string,
  specifier: string,
): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(fromDir, specifier);
  const candidates = extname(base)
    ? [base]
    : [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.js`,
        `${base}.jsx`,
        join(base, 'index.ts'),
        join(base, 'index.tsx'),
        join(base, 'index.js'),
        join(base, 'index.jsx'),
      ];
  for (const candidate of candidates) {
    const abs = resolve(candidate);
    if (!isInside(workspaceRoot, abs)) continue;
    if (existsSyncEnough(abs)) return abs;
  }
  return null;
}

function existsSyncEnough(path: string): boolean {
  // Keep module parsing synchronous-free except for the rare import
  // resolution probe; TypeScript source files are local and tiny here.
  return ts.sys.readFile(path) !== undefined;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function scriptKind(path: string): ts.ScriptKind {
  if (path.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (path.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (path.endsWith('.js')) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function isInside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
