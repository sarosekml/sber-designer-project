/**
 * Deterministic modal-size rewriter (0132.3, Р-14/Р-17, риск №23/№15/№24).
 *
 * ts-morph does not parse HTML, and a full HTML serialize would reformat the
 * file. Instead this finds the single `data-sd-modal-window` start tag by source
 * offsets and patches only its size custom properties and long-content
 * attribute, leaving every other byte (CRLF, indentation, the rest of the file)
 * untouched. 0 markers → `no-marker`; >1 → `ambiguous-marker`; both block the
 * write and route to an agent repair. Values are re-validated with the shared
 * grammar, so nothing unsafe reaches the inline style.
 */
import {
  MODAL_CONTENT_ATTR,
  MODAL_HEIGHT_VAR,
  MODAL_WIDTH_VAR,
  MODAL_WINDOW_MARKER,
  parseModalDimension,
  type ModalLongContent,
} from '@sber-designer/shared-types';
import { htmlStartTagsWithAttribute } from './html-start-tags';

export interface ModalSizePatch {
  /** New window width (validated CSS length); omit to leave unchanged. */
  width?: string;
  /** New window height (validated CSS length or `auto`); omit to leave unchanged. */
  height?: string;
  /** New long-content mode; omit to leave unchanged. */
  longContent?: ModalLongContent;
}

export type ModalSizeRewriteError =
  | 'no-marker'
  | 'ambiguous-marker'
  | 'invalid-value'
  | 'empty-patch';

export interface ModalSizeRewriteResult {
  ok: boolean;
  html?: string;
  error?: ModalSizeRewriteError;
}

export function rewriteHtmlModalSize(html: string, patch: ModalSizePatch): ModalSizeRewriteResult {
  const normalized: ModalSizePatch = {};
  if (patch.width !== undefined) {
    const parsed = parseModalDimension(patch.width, { allowAuto: false });
    if (!parsed.ok || !parsed.value) return { ok: false, error: 'invalid-value' };
    normalized.width = parsed.value;
  }
  if (patch.height !== undefined) {
    const parsed = parseModalDimension(patch.height, { allowAuto: true });
    if (!parsed.ok || !parsed.value) return { ok: false, error: 'invalid-value' };
    normalized.height = parsed.value;
  }
  if (patch.longContent !== undefined) {
    if (patch.longContent !== 'scroll' && patch.longContent !== 'grow') {
      return { ok: false, error: 'invalid-value' };
    }
    normalized.longContent = patch.longContent;
  }
  if (
    normalized.width === undefined &&
    normalized.height === undefined &&
    normalized.longContent === undefined
  ) {
    return { ok: false, error: 'empty-patch' };
  }

  const spans = findModalWindowTagSpans(html);
  if (spans.length === 0) return { ok: false, error: 'no-marker' };
  if (spans.length > 1) return { ok: false, error: 'ambiguous-marker' };

  const span = spans[0]!;
  const tag = html.slice(span.start, span.end);
  const patched = patchStartTag(tag, normalized);
  return { ok: true, html: html.slice(0, span.start) + patched + html.slice(span.end) };
}

/** Read the current size contract from an HTML source, if the marker is unique. */
export function readHtmlModalSize(html: string): {
  ok: boolean;
  width?: string;
  height?: string;
  longContent?: ModalLongContent;
  error?: ModalSizeRewriteError;
} {
  const spans = findModalWindowTagSpans(html);
  if (spans.length === 0) return { ok: false, error: 'no-marker' };
  if (spans.length > 1) return { ok: false, error: 'ambiguous-marker' };
  const tag = html.slice(spans[0]!.start, spans[0]!.end);
  const style = tag.match(/\sstyle\s*=\s*(["'])([\s\S]*?)\1/u)?.[2] ?? '';
  const width = readDecl(style, MODAL_WIDTH_VAR);
  const height = readDecl(style, MODAL_HEIGHT_VAR);
  const content = tag.match(
    new RegExp(`\\s${escapeRegExp(MODAL_CONTENT_ATTR)}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'u'),
  )?.[2];
  const longContent = content === 'grow' || content === 'scroll' ? content : undefined;
  return {
    ok: true,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(longContent ? { longContent } : {}),
  };
}

interface TagSpan {
  start: number;
  end: number;
}

function findModalWindowTagSpans(html: string): TagSpan[] {
  return htmlStartTagsWithAttribute(html, MODAL_WINDOW_MARKER).map(({ start, end }) => ({
    start,
    end,
  }));
}

function patchStartTag(tag: string, patch: ModalSizePatch): string {
  let out = tag;
  const styleProps: Array<[string, string]> = [];
  if (patch.width !== undefined) styleProps.push([MODAL_WIDTH_VAR, patch.width]);
  if (patch.height !== undefined) styleProps.push([MODAL_HEIGHT_VAR, patch.height]);
  if (styleProps.length > 0) out = upsertStyleCustomProps(out, styleProps);
  if (patch.longContent !== undefined)
    out = upsertAttribute(out, MODAL_CONTENT_ATTR, patch.longContent);
  return out;
}

function upsertStyleCustomProps(tag: string, props: Array<[string, string]>): string {
  const styleMatch = tag.match(/(\sstyle\s*=\s*)(["'])([\s\S]*?)\2/u);
  if (styleMatch && styleMatch.index !== undefined) {
    let value = styleMatch[3]!;
    for (const [prop, next] of props) value = upsertDeclaration(value, prop, next);
    const quote = styleMatch[2]!;
    return (
      tag.slice(0, styleMatch.index) +
      styleMatch[1]! +
      quote +
      value +
      quote +
      tag.slice(styleMatch.index + styleMatch[0].length)
    );
  }
  const declarations = props.map(([prop, next]) => `${prop}: ${next}`).join('; ');
  return insertAttributeBeforeClose(tag, `style="${declarations}"`);
}

function upsertDeclaration(styleValue: string, property: string, next: string): string {
  const re = new RegExp(`(${escapeRegExp(property)}\\s*:\\s*)([^;]*)`, 'u');
  if (re.test(styleValue))
    return styleValue.replace(re, (_all, prefix: string) => `${prefix}${next}`);
  const trimmed = styleValue.replace(/\s*;?\s*$/u, '');
  return trimmed.length > 0 ? `${trimmed}; ${property}: ${next}` : `${property}: ${next}`;
}

function readDecl(styleValue: string, property: string): string | undefined {
  const match = styleValue.match(new RegExp(`${escapeRegExp(property)}\\s*:\\s*([^;]*)`, 'u'));
  return match?.[1]?.trim() || undefined;
}

function upsertAttribute(tag: string, name: string, value: string): string {
  const re = new RegExp(`(\\s${escapeRegExp(name)}\\s*=\\s*)(["'])([\\s\\S]*?)\\2`, 'u');
  if (re.test(tag)) {
    return tag.replace(
      re,
      (_all, prefix: string, quote: string) => `${prefix}${quote}${value}${quote}`,
    );
  }
  return insertAttributeBeforeClose(tag, `${name}="${value}"`);
}

function insertAttributeBeforeClose(tag: string, attribute: string): string {
  const selfClosing = /\/>\s*$/u.test(tag);
  const closeLength = selfClosing ? tag.length - tag.lastIndexOf('/') : 1;
  const body = tag.slice(0, tag.length - closeLength).replace(/\s+$/u, '');
  return `${body} ${attribute}${selfClosing ? ' />' : '>'}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
