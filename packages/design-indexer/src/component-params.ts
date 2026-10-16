/**
 * Declared-parameter extraction for catalog components (task 0133).
 *
 * Answers "what can this component be configured with", so the Design panel can
 * render real controls instead of free-form CSS. Sources, in priority order:
 *
 *   1. the component's own TS props (`ts-props`) — authoritative;
 *   2. `cva()` variant maps (`cva`) — the shadcn/ui-style pattern where options
 *      live in the class-variance map rather than in a literal union;
 *   3. Storybook `argTypes` (`argtypes`) and `args` (`story-args`) — gap filler
 *      for options, control kind, description, and default hints.
 *
 * Best-effort by design: it must survive JS-only and partially typed projects,
 * so anything it cannot read confidently is dropped rather than guessed.
 */
import type {
  ComponentParam,
  ComponentParamControl,
  ComponentParamOption,
} from '@sber-designer/shared-types';

import {
  collectComponentPropsMembers,
  extractLiteralUnionAliases,
  literalUnionValues,
  MIN_UNION_VALUES,
  parsePropMember,
  splitMembers,
} from './props-source';
import { sliceBraceBlock } from './scan-shared';

/** Owned by other panel surfaces (text, styles) or not user-facing. */
const EXCLUDED_PARAMS = new Set(['className', 'style', 'key', 'ref']);
const MAX_PARAMS = 40;
const MAX_PARAM_OPTIONS = 300;
const MAX_DESCRIPTION_CHARS = 200;

export interface ExtractComponentParamsInput {
  /** Component definition source (plus siblings when the entry is a barrel). */
  sourceText: string;
  /** Colocated story source, when one exists. */
  storyText?: string;
  /**
   * Imported modules read only for shared union aliases (`type Size = …`).
   * Kept separate from `sourceText` so a neighbour's `*Props` block can never
   * be mistaken for this component's own.
   */
  typeSourceText?: string;
  /** Component export name, used to scope the props type. */
  componentName: string;
}

export function extractComponentParams(input: ExtractComponentParamsInput): ComponentParam[] {
  const byProp = new Map<string, ComponentParam>();

  for (const param of paramsFromTsProps(
    input.sourceText,
    input.componentName,
    input.typeSourceText,
  )) {
    byProp.set(param.prop, param);
  }
  for (const param of paramsFromCva(input.sourceText, input.componentName)) {
    // A cva variant map carries the real option list even when the prop is
    // typed as `VariantProps<...>`; it only loses to an explicit TS union.
    const existing = byProp.get(param.prop);
    if (existing && existing.control === 'enum') continue;
    byProp.set(param.prop, { ...param, required: existing?.required ?? false });
  }

  const defaults = {
    ...defaultsFromCva(input.sourceText, input.componentName),
    ...defaultsFromDestructuring(input.sourceText, input.componentName),
  };
  const descriptions = descriptionsFromJsDoc(input.sourceText);

  if (input.storyText) {
    for (const param of paramsFromArgTypes(input.storyText)) {
      const existing = byProp.get(param.prop);
      if (!existing) {
        byProp.set(param.prop, param);
        continue;
      }
      // argTypes only fill gaps: options for an untyped prop, plus description.
      const merged: ComponentParam = {
        ...existing,
        ...(param.label ? { label: param.label } : {}),
        ...(existing.control !== 'enum' && param.control === 'enum'
          ? { control: 'enum' as const, options: param.options }
          : {}),
        ...(existing.description
          ? {}
          : param.description
            ? { description: param.description }
            : {}),
      };
      byProp.set(param.prop, merged);
    }
    for (const [prop, value] of Object.entries(defaultsFromStoryArgs(input.storyText))) {
      if (defaults[prop] === undefined) defaults[prop] = value;
    }
  }

  const params = Array.from(byProp.values())
    .filter((param) => !EXCLUDED_PARAMS.has(param.prop))
    .map((param) => {
      const description = param.description ?? descriptions[param.prop];
      const defaultValue = param.defaultValue ?? defaults[param.prop];
      return {
        ...param,
        ...(description ? { description: compact(description) } : {}),
        ...(defaultValue !== undefined ? { defaultValue } : {}),
      };
    });

  return params
    .sort((a, b) => {
      if (a.required !== b.required) return a.required ? -1 : 1;
      return a.prop.localeCompare(b.prop);
    })
    .slice(0, MAX_PARAMS);
}

function paramsFromTsProps(
  contents: string,
  componentName: string,
  typeSourceText?: string,
): ComponentParam[] {
  const named = collectComponentPropsMembers(contents, componentName);
  const members =
    named.members.length > 0 ? named.members : inlinePropsMembers(contents, componentName);
  if (members.length === 0) return [];
  const aliases = extractLiteralUnionAliases(
    typeSourceText ? `${contents}\n${typeSourceText}` : contents,
    MAX_PARAM_OPTIONS,
  );
  if (typeSourceText) {
    for (const [name, values] of extractLiteralUnionAliases(typeSourceText, MAX_PARAM_OPTIONS)) {
      if (!aliases.has(name)) aliases.set(name, values);
    }
  }
  const params: ComponentParam[] = [];

  for (const member of members) {
    const parsed = parsePropMember(member);
    if (!parsed) continue;
    const typeText = stripNullish(parsed.type);
    const control = controlForType(typeText, aliases);
    if (!control) continue;
    params.push({
      prop: parsed.name,
      control: control.control,
      ...(control.options ? { options: control.options } : {}),
      required: !parsed.optional,
      source: 'ts-props',
    });
  }
  return params;
}

function controlForType(
  typeText: string,
  aliases: Map<string, string[]>,
): { control: ComponentParamControl; options?: ComponentParamOption[] } | null {
  const values = literalUnionValues(typeText) ?? aliases.get(typeText) ?? null;
  if (values) {
    if (values.length < MIN_UNION_VALUES || values.length > MAX_PARAM_OPTIONS) return null;
    return { control: 'enum', options: values.map((value) => ({ value })) };
  }
  if (typeText === 'boolean') return { control: 'boolean' };
  if (typeText === 'number') return { control: 'number' };
  if (typeText === 'string') return { control: 'string' };
  return null;
}

/** `'a' | 'b' | undefined` and `boolean | null` still describe an editable prop. */
function stripNullish(typeText: string): string {
  return typeText
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part !== 'undefined' && part !== 'null')
    .join(' | ')
    .trim();
}

/**
 * `cva(base, { variants: { variant: { default: …, ghost: … } } })` — the option
 * list lives in the class map, so a `VariantProps<typeof x>` prop still gets a
 * real control.
 */
function paramsFromCva(contents: string, componentName: string): ComponentParam[] {
  const params: ComponentParam[] = [];
  for (const { config } of componentCvaConfigBlocks(contents, componentName)) {
    const variants = nestedBlock(config, 'variants');
    if (!variants) continue;
    for (const entry of topLevelEntries(variants)) {
      if (!entry.value.startsWith('{')) continue;
      const options = topLevelEntries(entry.value.slice(1, -1))
        .map((option) => ({ value: option.key }))
        .slice(0, MAX_PARAM_OPTIONS);
      if (options.length < MIN_UNION_VALUES) continue;
      params.push({ prop: entry.key, control: 'enum', options, required: false, source: 'cva' });
    }
  }
  return params;
}

function defaultsFromCva(contents: string, componentName: string): Record<string, string> {
  const defaults: Record<string, string> = {};
  for (const { config } of componentCvaConfigBlocks(contents, componentName)) {
    const block = nestedBlock(config, 'defaultVariants');
    if (!block) continue;
    for (const entry of topLevelEntries(block)) {
      const value = unquote(entry.value);
      if (value) defaults[entry.key] = value;
    }
  }
  return defaults;
}

interface CvaConfigBlock {
  name?: string;
  config: string;
}

function cvaConfigBlocks(contents: string): CvaConfigBlock[] {
  const blocks: CvaConfigBlock[] = [];
  const callRe = /(?:(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*)?\bcva\s*\(/gu;
  let match: RegExpExecArray | null;
  while ((match = callRe.exec(contents)) !== null) {
    const objectStart = contents.indexOf('{', match.index + match[0].length);
    if (objectStart < 0) continue;
    const block = sliceBraceBlock(contents, objectStart, 20_000);
    if (block) {
      blocks.push({
        ...(match[1] ? { name: match[1] } : {}),
        config: block.slice(1, -1),
      });
    }
  }
  return blocks;
}

function componentCvaConfigBlocks(contents: string, componentName: string): CvaConfigBlock[] {
  const blocks = cvaConfigBlocks(contents);
  if (blocks.length <= 1) return blocks;

  const linkedNames = cvaNamesLinkedFromProps(contents, componentName);
  const linked = blocks.filter((block) => block.name && linkedNames.has(block.name));
  if (linked.length > 0) return linked;

  // Common convention: Button -> buttonVariants. Use it only when unambiguous;
  // otherwise omit CVA enrichment rather than borrowing a neighbour's variants.
  const compactComponent = compactName(componentName);
  const byName = blocks.filter(
    (block) => block.name && compactName(block.name).startsWith(compactComponent),
  );
  return byName.length === 1 ? byName : [];
}

function cvaNamesLinkedFromProps(contents: string, componentName: string): Set<string> {
  const declarations: Array<{ name: string; header: string }> = [];
  const declarationRe = /(?:interface|type)\s+([A-Za-z_$][\w$]*Props)\b([\s\S]{0,1200}?)\{/gu;
  let match: RegExpExecArray | null;
  while ((match = declarationRe.exec(contents)) !== null) {
    if (match[1]) declarations.push({ name: match[1], header: match[2] ?? '' });
  }
  const expected = `${compactName(componentName)}props`;
  let candidates = declarations.filter((entry) => compactName(entry.name) === expected);
  if (candidates.length === 0 && declarations.length === 1) candidates = declarations;

  const names = new Set<string>();
  for (const declaration of candidates) {
    for (const reference of declaration.header.matchAll(
      /VariantProps\s*<\s*typeof\s+([A-Za-z_$][\w$]*)\s*>/gu,
    )) {
      if (reference[1]) names.add(reference[1]);
    }
  }
  return names;
}

function compactName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/gu, '');
}

/**
 * The destructuring pattern and props annotation of a component signature:
 * `function Button({ variant = 'default' }: ButtonProps)` or the inline form
 * `function Notice({ tone }: { tone?: 'info' | 'warning' })`.
 */
function findComponentSignature(
  contents: string,
  componentName: string,
): { pattern: string; annotation: string } | null {
  const escaped = componentName.replace(/[^\w$]/gu, '');
  if (!escaped) return null;
  const signatureRe = new RegExp(
    `(?:function\\s+${escaped}\\s*\\(|(?:const|let|var)\\s+${escaped}\\s*(?::[^=]*)?=\\s*(?:React\\.)?(?:forwardRef\\s*(?:<[^(]*>)?\\s*\\()?\\s*(?:function\\s*[\\w$]*\\s*)?\\()`,
    'u',
  );
  const signature = signatureRe.exec(contents);
  if (!signature) return null;
  const patternStart = contents.indexOf('{', signature.index + signature[0].length - 1);
  if (patternStart < 0) return null;
  const pattern = sliceBraceBlock(contents, patternStart, 4_000);
  if (!pattern) return null;
  const after = contents.slice(
    patternStart + pattern.length,
    patternStart + pattern.length + 4_000,
  );
  const annotation = /^\s*:\s*/u.test(after) ? after.replace(/^\s*:\s*/u, '') : '';
  return { pattern: pattern.slice(1, -1), annotation };
}

/** `function Notice({ tone }: { tone?: 'info' | 'warning'; dense?: boolean })` */
function inlinePropsMembers(contents: string, componentName: string): string[] {
  const signature = findComponentSignature(contents, componentName);
  if (!signature?.annotation) return [];
  const braceStart = signature.annotation.indexOf('{');
  if (braceStart < 0) return [];
  const block = sliceBraceBlock(signature.annotation, braceStart, 8_000);
  if (!block) return [];
  return splitMembers(block.slice(1, -1));
}

/** `function Button({ variant = 'default', size = 'md' }: ButtonProps)` */
function defaultsFromDestructuring(
  contents: string,
  componentName: string,
): Record<string, string> {
  const defaults: Record<string, string> = {};
  const signature = findComponentSignature(contents, componentName);
  if (!signature) return defaults;
  for (const entry of destructuringDefaults(signature.pattern)) {
    defaults[entry.key] = entry.value;
  }
  return defaults;
}

function destructuringDefaults(block: string): { key: string; value: string }[] {
  const out: { key: string; value: string }[] = [];
  const re = /([A-Za-z_$][\w$]*)\s*=\s*(['"][^'"]*['"]|true|false|-?\d+(?:\.\d+)?)/gu;
  let match: RegExpExecArray | null;
  while ((match = re.exec(block)) !== null) {
    const key = match[1];
    const raw = match[2];
    if (!key || !raw) continue;
    out.push({ key, value: unquote(raw) });
  }
  return out;
}

function paramsFromArgTypes(storyText: string): ComponentParam[] {
  const block = nestedBlock(storyText, 'argTypes');
  if (!block) return [];
  const params: ComponentParam[] = [];
  for (const entry of topLevelEntries(block)) {
    if (!entry.value.startsWith('{')) continue;
    const body = entry.value.slice(1, -1);
    const description = /description\s*:\s*(['"])([\s\S]*?)\1/u.exec(body)?.[2];
    const label = /\bname\s*:\s*(['"])([\s\S]*?)\1/u.exec(body)?.[2];
    const optionsRaw = /options\s*:\s*\[([^\]]*)\]/u.exec(body)?.[1];
    const options = optionsRaw
      ? Array.from(optionsRaw.matchAll(/['"]([^'"]*)['"]/gu)).flatMap((match) =>
          match[1] === undefined ? [] : [{ value: match[1] }],
        )
      : [];
    const controlType =
      /control\s*:\s*\{[^}]*type\s*:\s*['"]([\w-]+)['"]/u.exec(body)?.[1] ??
      /control\s*:\s*['"]([\w-]+)['"]/u.exec(body)?.[1];
    const control = argTypeControl(controlType, options.length);
    if (!control) continue;
    params.push({
      prop: entry.key,
      ...(label ? { label } : {}),
      control,
      ...(control === 'enum' && options.length > 0 ? { options } : {}),
      required: false,
      ...(description ? { description } : {}),
      source: 'argtypes',
    });
  }
  return params;
}

function argTypeControl(
  controlType: string | undefined,
  optionCount: number,
): ComponentParamControl | null {
  if (controlType === 'boolean') return 'boolean';
  if (controlType === 'number' || controlType === 'range') return 'number';
  if (controlType === 'text') return 'string';
  if (controlType === 'select' || controlType === 'radio' || controlType === 'inline-radio') {
    return optionCount >= MIN_UNION_VALUES ? 'enum' : null;
  }
  if (optionCount >= MIN_UNION_VALUES) return 'enum';
  return null;
}

function defaultsFromStoryArgs(storyText: string): Record<string, string> {
  const block = nestedBlock(storyText, 'args');
  if (!block) return {};
  const defaults: Record<string, string> = {};
  for (const entry of topLevelEntries(block)) {
    const value = unquote(entry.value);
    if (value && !value.includes('\n')) defaults[entry.key] = value;
  }
  return defaults;
}

/** JSDoc immediately preceding a prop member, used as the control hint. */
function descriptionsFromJsDoc(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /\/\*\*([\s\S]*?)\*\/\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*:/gu;
  let match: RegExpExecArray | null;
  while ((match = re.exec(contents)) !== null) {
    const body = match[1];
    const prop = match[2];
    if (!body || !prop || out[prop]) continue;
    const text = body
      .split('\n')
      .map((line) => line.replace(/^\s*\*?\s?/u, '').trim())
      .filter((line) => line && !line.startsWith('@'))
      .join(' ')
      .trim();
    if (text) out[prop] = text;
  }
  return out;
}

/** `key: { … }` block body inside an object literal or source chunk. */
function nestedBlock(contents: string, key: string): string | null {
  const head = new RegExp(`\\b${key}\\s*:\\s*\\{`, 'u').exec(contents);
  if (!head) return null;
  const block = sliceBraceBlock(contents, head.index + head[0].length - 1, 20_000);
  return block ? block.slice(1, -1) : null;
}

/**
 * Top-level `key: value` pairs of an object-literal body, skipping nested
 * braces, brackets, parens, and string contents.
 */
export function topLevelEntries(body: string): { key: string; value: string }[] {
  const out: { key: string; value: string }[] = [];
  let depth = 0;
  let quote: string | null = null;
  let keyStart = 0;
  let key: string | null = null;
  let valueStart = 0;

  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (quote) {
      if (char === '\\') index += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{' || char === '[' || char === '(') {
      depth += 1;
      continue;
    }
    if (char === '}' || char === ']' || char === ')') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth !== 0) continue;
    if (char === ':' && key === null) {
      key = body.slice(keyStart, index).trim();
      valueStart = index + 1;
      continue;
    }
    if (char === ',') {
      if (key !== null) {
        out.push({ key: cleanKey(key), value: body.slice(valueStart, index).trim() });
        key = null;
      }
      keyStart = index + 1;
    }
  }
  if (key !== null) out.push({ key: cleanKey(key), value: body.slice(valueStart).trim() });
  return out.filter((entry) => /^[A-Za-z_$][\w$-]*$/u.test(entry.key));
}

function cleanKey(key: string): string {
  return key
    .replace(/^['"]|['"]$/gu, '')
    .split('\n')
    .pop()!
    .trim();
}

function unquote(value: string): string {
  const trimmed = value.trim().replace(/,$/u, '').trim();
  const literal = /^(['"])([\s\S]*)\1$/u.exec(trimmed);
  return literal?.[2] ?? trimmed;
}

function compact(value: string): string {
  const text = value.replace(/\s+/gu, ' ').trim();
  return text.length > MAX_DESCRIPTION_CHARS
    ? `${text.slice(0, MAX_DESCRIPTION_CHARS - 1)}…`
    : text;
}
