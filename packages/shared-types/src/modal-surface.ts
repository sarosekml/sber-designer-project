/**
 * Modal surface (0132). A screen can live as a full-viewport `page` or as a
 * `modal` overlay. The distinction is one additive, ignorable field on
 * `ProjectScreen`; the modal's scrim, window, region markers, size variables
 * and long-content behavior all live in the screen file itself (Р-2/Р-14),
 * never in `.sdproj`. This module owns:
 *   - the surface type + normalized reader `screenSurface`;
 *   - the DOM contract constants shared by prompts / scaffold / craft /
 *     design-apply so no consumer hardcodes the marker strings;
 *   - the bounded, deterministic size grammar (Р-20) used identically on web
 *     and server.
 */

/** How a screen lives in the product. Absent reads as `page`. */
export type ProjectScreenSurface = 'page' | 'modal';

/** Normalized read of a screen's surface. Absent/unknown → `page`. */
export function screenSurface(
  screen: { surface?: ProjectScreenSurface | undefined } | null | undefined,
): ProjectScreenSurface {
  return screen?.surface === 'modal' ? 'modal' : 'page';
}

/** Long-content behavior of a modal window (Р-15). */
export type ModalLongContent = 'scroll' | 'grow';

/** Structural role of a marked region inside the modal window (Р-13). */
export type ModalRegionRole = 'header' | 'body' | 'footer';

/** Manual size + overflow contract materialized into the modal file (Р-14/Р-15). */
export interface ModalDefaults {
  /** CSS length for the window width, e.g. `640px`, `50%`. */
  width: string;
  /** CSS length for the window height, or `auto`. */
  height: string;
  /** Long-content behavior. */
  longContent: ModalLongContent;
}

/**
 * DOM contract constants shared across prompt / scaffold / craft / design-apply.
 * These are product `data-sd-*` conventions, never a customer component's class
 * name (universality rule 9).
 */
export const MODAL_BACKDROP_MARKER = 'data-sd-modal-backdrop';
export const MODAL_WINDOW_MARKER = 'data-sd-modal-window';
export const MODAL_REGION_MARKER = 'data-sd-modal-region';
export const MODAL_CONTENT_ATTR = 'data-sd-modal-content';
export const MODAL_WIDTH_VAR = '--sd-modal-width';
export const MODAL_HEIGHT_VAR = '--sd-modal-height';

/** Product fallback when a modal is created "Without template" (Р-3). */
export const MODAL_FALLBACK_DEFAULTS: ModalDefaults = {
  width: '640px',
  height: 'auto',
  longContent: 'scroll',
};

/** Units accepted by the MVP size grammar (Р-20). */
export const MODAL_DIMENSION_UNITS = [
  'px',
  '%',
  'rem',
  'em',
  'vw',
  'vh',
  'vmin',
  'vmax',
  'ch',
] as const;

const MODAL_DIMENSION_MAX_LENGTH = 16;
const MODAL_DIMENSION_PATTERN = /^(\d+(?:\.\d+)?)(px|%|rem|em|vw|vh|vmin|vmax|ch)$/u;

export type ModalDimensionRejection =
  | 'empty'
  | 'too-long'
  | 'illegal-char'
  | 'format'
  | 'non-positive';

export interface ModalDimensionResult {
  ok: boolean;
  /** Normalized value when `ok`. */
  value?: string;
  /** Machine-readable rejection reason when not `ok`. */
  reason?: ModalDimensionRejection;
}

/**
 * Bounded, deterministic size grammar shared by web and server (Р-20). Accepts
 * one positive number with a known unit; height additionally accepts `auto`.
 * Rejects CSS functions (`calc/min/max/clamp/var`), extra declarations and any
 * `;{}()` so the value is safe to inline into HTML/JSX without a CSS parser.
 */
export function parseModalDimension(
  raw: string,
  options: { allowAuto: boolean },
): ModalDimensionResult {
  const value = raw.trim();
  if (!value) return { ok: false, reason: 'empty' };
  if (value.length > MODAL_DIMENSION_MAX_LENGTH) return { ok: false, reason: 'too-long' };
  if (/[;{}()]/u.test(value)) return { ok: false, reason: 'illegal-char' };
  if (options.allowAuto && value.toLowerCase() === 'auto') return { ok: true, value: 'auto' };
  const match = MODAL_DIMENSION_PATTERN.exec(value);
  if (!match) return { ok: false, reason: 'format' };
  const magnitude = Number(match[1]);
  if (!Number.isFinite(magnitude) || magnitude <= 0) return { ok: false, reason: 'non-positive' };
  return { ok: true, value: `${magnitude}${match[2]}` };
}

/**
 * Resolve a partial modal-size spec to a complete `ModalDefaults`, filling from
 * `fallback` for missing/blank fields and collecting human-readable issues for
 * invalid provided values. Shared by the New-screen dialog (empty fields → the
 * product/template default) and the template frontmatter parser (Track 0132.0).
 */
export function normalizeModalDefaults(
  input: Partial<ModalDefaults> | undefined | null,
  fallback: ModalDefaults = MODAL_FALLBACK_DEFAULTS,
): { value: ModalDefaults; issues: string[] } {
  const issues: string[] = [];
  const resolveDimension = (
    raw: string | undefined,
    field: 'width' | 'height',
    allowAuto: boolean,
  ): string => {
    if (raw === undefined || raw.trim() === '') return fallback[field];
    const parsed = parseModalDimension(raw, { allowAuto });
    if (parsed.ok && parsed.value) return parsed.value;
    issues.push(
      `Invalid modal ${field} "${raw}" (${parsed.reason ?? 'invalid'}); using ${fallback[field]}.`,
    );
    return fallback[field];
  };
  const width = resolveDimension(input?.width, 'width', false);
  const height = resolveDimension(input?.height, 'height', true);
  let longContent: ModalLongContent = fallback.longContent;
  if (input?.longContent === 'scroll' || input?.longContent === 'grow') {
    longContent = input.longContent;
  } else if (input?.longContent !== undefined) {
    issues.push(
      `Invalid modal longContent "${String(input.longContent)}"; using ${fallback.longContent}.`,
    );
  }
  return { value: { width, height, longContent }, issues };
}
