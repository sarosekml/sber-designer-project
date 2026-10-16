import { basename } from 'node:path';

import { collectSourceFiles, normalizeScanPath } from './scan-shared';
import {
  blockForClass,
  extractElementSnippet,
  groupIdsForBlock,
  isCatalogHtml,
  isDesignSystemPreviewHtml,
  isModifierClass,
  kebabWords,
  pascalCase,
  readCatalogText,
  slug,
  unique,
} from './html-css-catalog-helpers';
import type {
  DesignIndexDiagnostic,
  HtmlCssCatalogManifest,
  HtmlCssDistillationClassFrequency,
  HtmlCssDistillationInlineStyleViolation,
  HtmlCssDistillationSummary,
  HtmlCssDistillationValueCategory,
  HtmlCssDistillationValueFrequency,
  HtmlDesignSystemSignals,
  IndexedComponentRecord,
} from './types';

const MAX_FILES = 300;
const MAX_DISTILLATION_VALUES = 40;
const MAX_DISTILLATION_CLASSES = 60;
const MAX_INLINE_STYLE_VIOLATIONS = 60;
const HTML_FILE_RE = /\.html?$/i;
const CSS_FILE_RE = /\.(css|scss|sass|less)$/i;

interface ClassEvidence {
  block: string;
  classes: Set<string>;
  modifiers: Set<string>;
  cssClasses: Set<string>;
  occurrences: number;
  sourcePath: string;
  docsAnchor: string;
  canonicalHtml: string;
  fromCatalogFile: boolean;
}

interface DistillationValueDraft {
  category: HtmlCssDistillationValueCategory;
  value: string;
  count: number;
  properties: Set<string>;
  filePaths: Set<string>;
}

interface DistillationClassDraft {
  className: string;
  count: number;
  filePaths: Set<string>;
}

export interface HtmlCssCatalogScan {
  components: IndexedComponentRecord[];
  manifest: HtmlCssCatalogManifest;
  diagnostics: DesignIndexDiagnostic[];
  htmlFiles: string[];
  cssFiles: string[];
}

export async function scanHtmlCssCatalog(workspaceRoot: string): Promise<HtmlCssCatalogScan> {
  const files: string[] = [];
  await collectSourceFiles(workspaceRoot, '.', files, {
    fileRe: /\.(html?|css|scss|sass|less)$/i,
    maxFiles: MAX_FILES,
  });
  const htmlFiles = files.filter((file) => HTML_FILE_RE.test(file)).sort();
  const cssFiles = files.filter((file) => CSS_FILE_RE.test(file)).sort();
  const cssClasses = new Map<string, Set<string>>();
  const selectors = new Set<string>();
  const tokenNames = new Set<string>();
  const rootTokenNames = new Set<string>();
  const componentClassNames = new Set<string>();
  const componentStylesheetBlocks = new Map<string, string>();
  const themeOverrideSelectors = new Set<string>();
  let hasComponentsStylesheet = false;
  const valueDrafts = new Map<string, DistillationValueDraft>();
  const classDrafts = new Map<string, DistillationClassDraft>();
  const inlineStyleViolations: HtmlCssDistillationInlineStyleViolation[] = [];
  const qualityHtmlFiles: string[] = [];
  for (const filePath of cssFiles) {
    const contents = await readCatalogText(workspaceRoot, filePath);
    for (const selector of extractCssSelectors(contents)) selectors.add(selector);
    for (const tokenName of extractCssVariableNames(contents)) tokenNames.add(tokenName);
    for (const tokenName of extractRootTokenNames(contents)) rootTokenNames.add(tokenName);
    for (const selector of extractThemeOverrideSelectors(contents)) {
      themeOverrideSelectors.add(selector);
    }
    if (isTokensStylesheet(filePath)) {
      // Token declarations are not reusable component classes.
    } else {
      const isComponentStylesheet = isComponentsStylesheet(filePath);
      if (isComponentStylesheet) hasComponentsStylesheet = true;
      for (const className of extractCssClasses(contents)) {
        componentClassNames.add(className);
        if (isComponentStylesheet) {
          const block = blockForClass(className);
          if (block && !componentStylesheetBlocks.has(block)) {
            componentStylesheetBlocks.set(block, filePath);
          }
        }
      }
    }
    for (const className of extractCssClasses(contents)) {
      const block = blockForClass(className);
      const classes = cssClasses.get(block) ?? new Set<string>();
      classes.add(className);
      cssClasses.set(block, classes);
    }
    collectCssDeclarationValues(valueDrafts, contents, filePath);
  }

  const evidence = new Map<string, ClassEvidence>();
  const customElements = new Set<string>();
  const pagesUsingVarTokens = new Set<string>();
  for (const filePath of htmlFiles) {
    const contents = await readCatalogText(workspaceRoot, filePath);
    const isManagedPreview = isDesignSystemPreviewHtml(filePath, contents);
    const isQualityPage = !isManagedPreview && !isCatalogHtml(filePath);
    if (isQualityPage) {
      qualityHtmlFiles.push(filePath);
      if (/var\(\s*--/u.test(contents)) pagesUsingVarTokens.add(normalizeScanPath(filePath));
    }
    if (isManagedPreview) continue;
    collectClassEvidence(evidence, contents, filePath, isCatalogHtml(filePath));
    if (isQualityPage) {
      collectHtmlClassFrequencies(classDrafts, contents, filePath);
      collectInlineStyleDistillation(valueDrafts, inlineStyleViolations, contents, filePath);
    }
    collectCustomElementEvidence(
      evidence,
      customElements,
      contents,
      filePath,
      isCatalogHtml(filePath),
    );
  }
  for (const [block, filePath] of componentStylesheetBlocks) {
    if (evidence.has(block)) continue;
    const item = getEvidence(evidence, block, filePath, block, '', true);
    item.classes.add(block);
  }
  const designSystemSignals = buildHtmlDesignSystemSignals({
    htmlFiles: qualityHtmlFiles,
    rootTokenCount: rootTokenNames.size,
    declaredTokenCount: tokenNames.size,
    themeOverrideSelectors: [...themeOverrideSelectors],
    componentClassCount: componentClassNames.size,
    hasComponentsStylesheet,
    pagesUsingVarTokens,
    inlineStyleViolations,
  });

  const indexedEvidence = Array.from(evidence.values())
    .filter((item) => shouldIndexBlock(item, cssClasses.get(item.block)))
    .sort((a, b) => a.block.localeCompare(b.block));
  const components = indexedEvidence
    .map((item) => toComponentRecord(item, cssClasses.get(item.block) ?? new Set<string>()))
    .sort((a, b) => a.id.localeCompare(b.id));
  const manifest = buildHtmlCssCatalogManifest({
    htmlFiles,
    cssFiles,
    selectors: [...selectors],
    tokenNames: [...tokenNames],
    customElements: [...customElements],
    components: indexedEvidence.map((item) =>
      toManifestComponent(item, cssClasses.get(item.block) ?? new Set<string>()),
    ),
    distillation: buildDistillationSummary(valueDrafts, classDrafts, inlineStyleViolations),
    designSystemSignals,
  });

  const diagnostics: DesignIndexDiagnostic[] = [];
  if (htmlFiles.length > 0 && cssFiles.length === 0) {
    diagnostics.push({
      level: 'warning',
      filePath: 'html-css-catalog',
      message: 'HTML files were detected, but no CSS files were found for component cataloging.',
    });
  }
  return { components, manifest, diagnostics, htmlFiles, cssFiles };
}

export function emptyHtmlCssCatalogManifest(): HtmlCssCatalogManifest {
  return buildHtmlCssCatalogManifest({
    htmlFiles: [],
    cssFiles: [],
    selectors: [],
    tokenNames: [],
    customElements: [],
    components: [],
    distillation: buildDistillationSummary(new Map(), new Map(), []),
    designSystemSignals: buildHtmlDesignSystemSignals({
      htmlFiles: [],
      rootTokenCount: 0,
      declaredTokenCount: 0,
      themeOverrideSelectors: [],
      componentClassCount: 0,
      hasComponentsStylesheet: false,
      pagesUsingVarTokens: new Set(),
      inlineStyleViolations: [],
    }),
  });
}

export function summarizeHtmlCssCatalogForPrompt(manifest: HtmlCssCatalogManifest): string[] {
  if (manifest.counts.components === 0 && manifest.counts.classes === 0) {
    return ['No CSS catalog manifest was generated for this project profile.'];
  }
  return [
    `${manifest.counts.components} CSS catalog components, ${manifest.counts.classes} classes, ${manifest.counts.selectors} selectors, ${manifest.counts.tokensDeclared} tokens declared.`,
    manifest.components.length > 0
      ? `Components: ${manifest.components
          .slice(0, 18)
          .map((component) => component.id)
          .join(', ')}`
      : 'Components: none',
    manifest.tokenNames.length > 0
      ? `Tokens declared: ${manifest.tokenNames.slice(0, 18).join(', ')}`
      : 'Tokens declared: none',
    summarizeDistillationPrep(manifest.distillation),
  ];
}

function collectClassEvidence(
  evidence: Map<string, ClassEvidence>,
  contents: string,
  filePath: string,
  fromCatalogFile: boolean,
): void {
  const tagRe = /<([a-z][a-z0-9-]*)\b[^<>]*>/giu;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(contents))) {
    const tag = match[1] ?? 'div';
    const openingTag = match[0] ?? '';
    const classes = splitClassNames(quotedAttributeValue(openingTag, 'class') ?? '');
    if (classes.length === 0) continue;
    const snippet = extractElementSnippet(contents, match.index, tag);
    const anchor = idFromOpeningTag(openingTag);
    for (const className of classes) {
      const block = blockForClass(className);
      if (!block) continue;
      const item = getEvidence(
        evidence,
        block,
        filePath,
        anchor ?? block,
        snippet,
        fromCatalogFile,
      );
      item.occurrences += 1;
      item.classes.add(className);
      if (isModifierClass(className, block)) item.modifiers.add(className);
      if (fromCatalogFile && !item.fromCatalogFile) {
        item.sourcePath = filePath;
        item.docsAnchor = anchor ?? block;
        item.canonicalHtml = snippet;
        item.fromCatalogFile = true;
      }
    }
  }
}

function collectCustomElementEvidence(
  evidence: Map<string, ClassEvidence>,
  customElements: Set<string>,
  contents: string,
  filePath: string,
  fromCatalogFile: boolean,
): void {
  const customElementRe = /<([a-z][a-z0-9]*-[a-z0-9-]*)(?=[\s>/])/giu;
  let match: RegExpExecArray | null;
  while ((match = customElementRe.exec(contents))) {
    const tag = match[1];
    if (!tag) continue;
    customElements.add(tag);
    const snippet = extractElementSnippet(contents, match.index, tag);
    const item = getEvidence(evidence, tag, filePath, tag, snippet, fromCatalogFile);
    item.occurrences += 1;
    item.classes.add(tag);
  }
}

function getEvidence(
  evidence: Map<string, ClassEvidence>,
  block: string,
  filePath: string,
  docsAnchor: string,
  canonicalHtml: string,
  fromCatalogFile: boolean,
): ClassEvidence {
  const existing = evidence.get(block);
  if (existing) return existing;
  const next: ClassEvidence = {
    block,
    classes: new Set<string>(),
    modifiers: new Set<string>(),
    cssClasses: new Set<string>(),
    occurrences: 0,
    sourcePath: filePath,
    docsAnchor,
    canonicalHtml,
    fromCatalogFile,
  };
  evidence.set(block, next);
  return next;
}

function shouldIndexBlock(item: ClassEvidence, cssClasses: Set<string> | undefined): boolean {
  if (item.block.includes('-') && item.classes.has(item.block) && item.block === item.docsAnchor) {
    return true;
  }
  if (item.fromCatalogFile) return true;
  if (item.modifiers.size > 0) return true;
  if ([...item.classes].some((className) => className.includes('__'))) return true;
  if ((cssClasses?.size ?? 0) > 0 && item.classes.has(item.block)) return true;
  return item.occurrences > 1;
}

function toComponentRecord(item: ClassEvidence, cssClasses: Set<string>): IndexedComponentRecord {
  const requiredClasses = unique(
    [...item.classes, ...cssClasses].filter((className) => !isModifierClass(className, item.block)),
  );
  const modifiers = unique(
    [...item.modifiers, ...cssClasses].filter((className) =>
      isModifierClass(className, item.block),
    ),
  );
  const shortName = pascalCase(item.block);
  return {
    id: `css-catalog-${slug(item.block)}`,
    title: `CSS/${shortName}`,
    shortName,
    filePath: normalizeScanPath(item.sourcePath),
    source: 'css-catalog',
    storyCount: 0,
    stories: [],
    description: `CSS catalog component .${item.block}.`,
    requiredClasses,
    modifiers,
    canonicalHtml: item.canonicalHtml,
    docsAnchor: item.docsAnchor,
    tags: unique(['css-catalog', item.block, ...kebabWords(shortName), ...requiredClasses]),
    groupIds: groupIdsForBlock(item.block),
    noteCount: 0,
    confidence: item.fromCatalogFile || modifiers.length > 0 ? 'high' : 'medium',
  };
}

function toManifestComponent(
  item: ClassEvidence,
  cssClasses: Set<string>,
): HtmlCssCatalogManifest['components'][number] {
  return {
    id: `css-catalog-${slug(item.block)}`,
    block: item.block,
    sourcePath: normalizeScanPath(item.sourcePath),
    ...(item.docsAnchor ? { docsAnchor: item.docsAnchor } : {}),
    requiredClasses: unique(
      [...item.classes, ...cssClasses].filter(
        (className) => !isModifierClass(className, item.block),
      ),
    ),
    modifiers: unique(
      [...item.modifiers, ...cssClasses].filter((className) =>
        isModifierClass(className, item.block),
      ),
    ),
  };
}

function buildHtmlCssCatalogManifest(input: {
  htmlFiles: string[];
  cssFiles: string[];
  selectors: string[];
  tokenNames: string[];
  customElements: string[];
  components: HtmlCssCatalogManifest['components'];
  distillation: HtmlCssDistillationSummary;
  designSystemSignals: HtmlDesignSystemSignals;
}): HtmlCssCatalogManifest {
  const classes = unique(
    input.components.flatMap((component) => [...component.requiredClasses, ...component.modifiers]),
  );
  const selectors = unique(input.selectors);
  const tokenNames = unique(input.tokenNames);
  const customElements = unique(input.customElements);
  const components = input.components.sort((a, b) => a.id.localeCompare(b.id));
  return {
    version: 1,
    source: 'html-css-catalog',
    htmlFiles: unique(input.htmlFiles),
    cssFiles: unique(input.cssFiles),
    classes,
    selectors,
    tokenNames,
    customElements,
    components,
    distillation: input.distillation,
    designSystemSignals: input.designSystemSignals,
    counts: {
      components: components.length,
      classes: classes.length,
      selectors: selectors.length,
      tokensDeclared: tokenNames.length,
      customElements: customElements.length,
      htmlFiles: input.htmlFiles.length,
      cssFiles: input.cssFiles.length,
      distillationValues: input.distillation.values.length,
      distillationClasses: input.distillation.classFrequencies.length,
      inlineStyleViolations: input.distillation.inlineStyleViolations.length,
    },
  };
}

function collectCssDeclarationValues(
  drafts: Map<string, DistillationValueDraft>,
  contents: string,
  filePath: string,
): void {
  for (const declaration of extractStyleDeclarations(contents)) {
    recordDistillationValue(drafts, declaration.property, declaration.value, filePath);
  }
}

function collectHtmlClassFrequencies(
  drafts: Map<string, DistillationClassDraft>,
  contents: string,
  filePath: string,
): void {
  const classAttrRe = /\bclass\s*=\s*(['"])(.*?)\1/giu;
  let match: RegExpExecArray | null;
  while ((match = classAttrRe.exec(contents))) {
    for (const className of splitClassNames(match[2] ?? '')) {
      const existing = drafts.get(className) ?? {
        className,
        count: 0,
        filePaths: new Set<string>(),
      };
      existing.count += 1;
      existing.filePaths.add(normalizeScanPath(filePath));
      drafts.set(className, existing);
    }
  }
}

function collectInlineStyleDistillation(
  valueDrafts: Map<string, DistillationValueDraft>,
  violations: HtmlCssDistillationInlineStyleViolation[],
  contents: string,
  filePath: string,
): void {
  const styleRe = /<([a-z][a-z0-9-]*)\b[^<>]*>/giu;
  let match: RegExpExecArray | null;
  while ((match = styleRe.exec(contents))) {
    const tagName = match[1] ?? 'div';
    const openingTag = match[0] ?? '';
    const style = quotedAttributeValue(openingTag, 'style');
    if (!style) continue;
    const classes = splitClassNames(classAttributeValue(openingTag) ?? '');
    for (const declaration of extractStyleDeclarations(style)) {
      const category = classifyDistillationValue(declaration.property, declaration.value);
      if (category === 'unknown') continue;
      recordDistillationValue(valueDrafts, declaration.property, declaration.value, filePath);
      violations.push({
        filePath: normalizeScanPath(filePath),
        tagName,
        classes,
        property: declaration.property,
        value: normalizeCssValue(declaration.value),
        category,
      });
    }
  }
}

function buildDistillationSummary(
  valueDrafts: Map<string, DistillationValueDraft>,
  classDrafts: Map<string, DistillationClassDraft>,
  inlineStyleViolations: HtmlCssDistillationInlineStyleViolation[],
): HtmlCssDistillationSummary {
  return {
    values: Array.from(valueDrafts.values())
      .map(toValueFrequency)
      .filter((item) => item.category !== 'unknown')
      .sort(byCountThenValue)
      .slice(0, MAX_DISTILLATION_VALUES),
    classFrequencies: Array.from(classDrafts.values())
      .map(toClassFrequency)
      .sort(byClassCountThenName)
      .slice(0, MAX_DISTILLATION_CLASSES),
    inlineStyleViolations: inlineStyleViolations
      .sort((a, b) => a.filePath.localeCompare(b.filePath) || a.property.localeCompare(b.property))
      .slice(0, MAX_INLINE_STYLE_VIOLATIONS),
  };
}

function summarizeDistillationPrep(summary: HtmlCssDistillationSummary): string {
  const topValues = summary.values
    .slice(0, 8)
    .map((item) => `${item.value} (${item.category}, ${item.count}x)`)
    .join(', ');
  const topClasses = summary.classFrequencies
    .slice(0, 8)
    .map((item) => `.${item.className} (${item.count}x)`)
    .join(', ');
  return [
    `Distillation prep: ${summary.values.length} value frequencies, ${summary.classFrequencies.length} class frequencies, ${summary.inlineStyleViolations.length} inline styles.`,
    topValues ? `Top values: ${topValues}` : 'Top values: none',
    topClasses ? `Top classes: ${topClasses}` : 'Top classes: none',
  ].join('\n');
}

function recordDistillationValue(
  drafts: Map<string, DistillationValueDraft>,
  property: string,
  rawValue: string,
  filePath: string,
): void {
  const value = normalizeCssValue(rawValue);
  if (!value) return;
  const normalizedProperty = property.trim().toLowerCase();
  const category = classifyDistillationValue(normalizedProperty, value);
  if (category === 'unknown') return;
  const key = `${category}\0${value}`;
  const existing = drafts.get(key) ?? {
    category,
    value,
    count: 0,
    properties: new Set<string>(),
    filePaths: new Set<string>(),
  };
  existing.count += 1;
  existing.properties.add(normalizedProperty);
  existing.filePaths.add(normalizeScanPath(filePath));
  drafts.set(key, existing);
}

function extractStyleDeclarations(contents: string): Array<{ property: string; value: string }> {
  const declarations: Array<{ property: string; value: string }> = [];
  const declarationRe = /(--?[A-Za-z_][\w-]*|[A-Za-z][\w-]*)\s*:\s*([^;{}]+);?/gu;
  let match: RegExpExecArray | null;
  while ((match = declarationRe.exec(contents))) {
    const property = match[1]?.trim();
    const value = match[2]?.trim();
    if (!property || !value) continue;
    declarations.push({ property, value });
  }
  return declarations;
}

function classifyDistillationValue(
  property: string,
  value: string,
): HtmlCssDistillationValueCategory {
  const prop = property.toLowerCase();
  const normalized = value.toLowerCase();
  if (
    prop.includes('color') ||
    prop.includes('background') ||
    /^--color-/u.test(prop) ||
    /(?:^|\s|,)#(?:[0-9a-f]{3,8})\b/iu.test(normalized) ||
    /\b(?:rgb|rgba|hsl|hsla)\(/u.test(normalized) ||
    /\bvar\(--color-/u.test(normalized)
  ) {
    return 'color';
  }
  if (prop.includes('radius') || /^--(?:radius|border-radius)/u.test(prop)) return 'radius';
  if (prop.includes('shadow') || /^--shadow/u.test(prop)) return 'shadow';
  if (
    prop.includes('font') ||
    prop === 'line-height' ||
    prop === 'letter-spacing' ||
    /^--font-/u.test(prop)
  ) {
    return 'typography';
  }
  if (
    /(?:margin|padding|gap|space|width|height|inset|top|right|bottom|left)/u.test(prop) ||
    /^--space-/u.test(prop)
  ) {
    return 'spacing';
  }
  return 'unknown';
}

function normalizeCssValue(value: string): string {
  return value
    .replace(/\s*!important\s*$/iu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function toValueFrequency(item: DistillationValueDraft): HtmlCssDistillationValueFrequency {
  return {
    category: item.category,
    value: item.value,
    count: item.count,
    properties: unique([...item.properties]),
    filePaths: unique([...item.filePaths]),
  };
}

function toClassFrequency(item: DistillationClassDraft): HtmlCssDistillationClassFrequency {
  return {
    className: item.className,
    count: item.count,
    filePaths: unique([...item.filePaths]),
  };
}

function byCountThenValue(
  a: HtmlCssDistillationValueFrequency,
  b: HtmlCssDistillationValueFrequency,
): number {
  return (
    b.count - a.count || a.category.localeCompare(b.category) || a.value.localeCompare(b.value)
  );
}

function byClassCountThenName(
  a: HtmlCssDistillationClassFrequency,
  b: HtmlCssDistillationClassFrequency,
): number {
  return b.count - a.count || a.className.localeCompare(b.className);
}

function classAttributeValue(openingTag: string): string | null {
  return quotedAttributeValue(openingTag, 'class');
}

function quotedAttributeValue(
  openingTag: string,
  attribute: 'class' | 'id' | 'style',
): string | null {
  const match = new RegExp(`\\b${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'iu').exec(
    openingTag,
  );
  return (match?.[1] ?? match?.[2])?.trim() || null;
}

function idFromOpeningTag(openingTag: string): string | null {
  return quotedAttributeValue(openingTag, 'id');
}

function splitClassNames(value: string): string[] {
  return value
    .split(/\s+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractCssClasses(contents: string): string[] {
  const classes = new Set<string>();
  const classRe = /\.([_a-zA-Z][_a-zA-Z0-9-]*)/g;
  let match: RegExpExecArray | null;
  while ((match = classRe.exec(contents))) {
    const className = match[1];
    if (className) classes.add(className);
  }
  return [...classes];
}

function extractCssSelectors(contents: string): string[] {
  const selectors = new Set<string>();
  const blockRe = /([^{}]+)\{/g;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(contents))) {
    const raw = match[1]?.trim();
    if (!raw || raw.startsWith('@')) continue;
    for (const selector of raw.split(',')) {
      const normalized = selector.replace(/\s+/gu, ' ').trim();
      if (normalized) selectors.add(normalized);
    }
  }
  return [...selectors];
}

function extractCssVariableNames(contents: string): string[] {
  const tokenNames = new Set<string>();
  const cssVarRe = /--([A-Za-z0-9_-]+)\s*:/g;
  let match: RegExpExecArray | null;
  while ((match = cssVarRe.exec(contents))) {
    if (match[1]) tokenNames.add(match[1]);
  }
  return [...tokenNames];
}

function extractRootTokenNames(contents: string): string[] {
  const tokenNames = new Set<string>();
  const rootBlockRe = /(?:^|[\s,}])(:root|html)\b[^{]*\{([^}]*)\}/gu;
  let block: RegExpExecArray | null;
  while ((block = rootBlockRe.exec(contents))) {
    for (const tokenName of extractCssVariableNames(block[2] ?? '')) tokenNames.add(tokenName);
  }
  return [...tokenNames];
}

function extractThemeOverrideSelectors(contents: string): string[] {
  const selectors = new Set<string>();
  const attributeRe = /\[data-(?:theme|mode|color-scheme)[~^|$*]?=["']?([a-z0-9_-]+)["']?\]/giu;
  let match: RegExpExecArray | null;
  while ((match = attributeRe.exec(contents))) {
    selectors.add(`[data-theme="${(match[1] ?? '').toLowerCase()}"]`);
  }
  if (/@media[^{]*prefers-color-scheme\s*:\s*dark/iu.test(contents)) {
    selectors.add('@media (prefers-color-scheme: dark)');
  }
  if (/(?:^|[\s,}])\.(?:theme-)?dark\b/u.test(contents)) selectors.add('.dark');
  return [...selectors];
}

function isTokensStylesheet(filePath: string): boolean {
  return basename(filePath).toLowerCase() === 'tokens.css';
}

function isComponentsStylesheet(filePath: string): boolean {
  return basename(filePath).toLowerCase() === 'components.css';
}

function buildHtmlDesignSystemSignals(input: {
  htmlFiles: string[];
  rootTokenCount: number;
  declaredTokenCount: number;
  themeOverrideSelectors: string[];
  componentClassCount: number;
  hasComponentsStylesheet: boolean;
  pagesUsingVarTokens: Set<string>;
  inlineStyleViolations: HtmlCssDistillationInlineStyleViolation[];
}): HtmlDesignSystemSignals {
  const pagesWithHardcodes = new Set(
    input.inlineStyleViolations
      .filter((violation) => violation.category === 'color' || violation.category === 'spacing')
      .map((violation) => violation.filePath),
  );
  const pageKeys = unique(input.htmlFiles.map((filePath) => normalizeScanPath(filePath)));
  const pagesOnTokens = pageKeys.filter(
    (key) => input.pagesUsingVarTokens.has(key) || !pagesWithHardcodes.has(key),
  ).length;
  return {
    rootTokenCount: input.rootTokenCount,
    declaredTokenCount: input.declaredTokenCount,
    themeOverride: input.themeOverrideSelectors.length > 0,
    themeOverrideSelectors: unique(input.themeOverrideSelectors).sort(),
    componentClassCount: input.componentClassCount,
    hasComponentsStylesheet: input.hasComponentsStylesheet,
    pagesTotal: pageKeys.length,
    pagesOnTokens,
    pagesWithInlineHardcodes: pageKeys.filter((key) => pagesWithHardcodes.has(key)).length,
  };
}
