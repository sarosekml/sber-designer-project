export const LIVE_INSPECT_STYLE_PROPERTIES = [
  'color',
  'backgroundColor',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'textAlign',
  'padding',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomRightRadius',
  'borderBottomLeftRadius',
] as const;

export type LiveInspectStyleProperty = (typeof LIVE_INSPECT_STYLE_PROPERTIES)[number];
export type LiveInspectStyles = Partial<Record<LiveInspectStyleProperty, string>>;

export const FONT_WEIGHT_OPTIONS = ['100', '300', '400', '500', '600', '700', '800', '900'];
export const TEXT_ALIGN_OPTIONS = ['left', 'center', 'right', 'justify'] as const;

const LIVE_INSPECT_STYLE_SET = new Set<string>(LIVE_INSPECT_STYLE_PROPERTIES);
const UNSAFE_CSS_VALUE = /<\/?style|<\/?script|[{};\n\r<>]/i;

export function normalizeLiveInspectStyles(styles: Record<string, unknown>): LiveInspectStyles {
  const result: LiveInspectStyles = {};
  for (const [property, rawValue] of Object.entries(styles)) {
    if (!LIVE_INSPECT_STYLE_SET.has(property)) continue;
    if (typeof rawValue !== 'string') continue;
    const value = rawValue.trim();
    if (!value || value.length > 160 || UNSAFE_CSS_VALUE.test(value)) continue;
    result[property as LiveInspectStyleProperty] = value;
  }
  return result;
}

export function toCssPropertyName(property: string): string {
  return property.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

export function colorInputValue(value: string): string {
  return cssColorToHex(value) ?? '#000000';
}

export function cssColorToHex(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(trimmed);
  if (hex?.[1]) {
    const raw = hex[1];
    return raw.length === 3
      ? `#${raw
          .split('')
          .map((char) => char + char)
          .join('')}`
      : `#${raw}`;
  }
  const rgb =
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(?:1|1\.0|0?\.\d+))?\s*\)$/i.exec(
      trimmed,
    );
  if (!rgb) return null;
  return `#${[rgb[1], rgb[2], rgb[3]]
    .map((part) =>
      Math.max(0, Math.min(255, Number(part)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

export function pxNumber(value: string, fallback = 0): number {
  const match = /(-?\d+(?:\.\d+)?)px/.exec(value);
  if (!match) return fallback;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatPxValue(value: number): string {
  return `${Math.round(value)}px`;
}

export function postLiveInspectStyle(
  targetWindow: Window | null,
  inspectId: string | undefined,
  styles: Record<string, unknown>,
): LiveInspectStyles {
  const normalized = normalizeLiveInspectStyles(styles);
  if (!targetWindow || !inspectId || Object.keys(normalized).length === 0) return normalized;
  targetWindow.postMessage(
    {
      type: 'sber-designer:preview-style',
      inspectId,
      styles: normalized,
    },
    '*',
  );
  return normalized;
}

export function postLiveInspectReset(
  targetWindow: Window | null,
  inspectId: string | undefined,
  properties?: readonly LiveInspectStyleProperty[],
): void {
  if (!targetWindow || !inspectId) return;
  targetWindow.postMessage(
    {
      type: 'sber-designer:reset-preview-style',
      inspectId,
      ...(properties ? { properties } : {}),
    },
    '*',
  );
}
