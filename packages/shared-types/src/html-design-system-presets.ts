export const HTML_DESIGN_SYSTEM_PRESETS = [
  {
    id: 'dense-enterprise',
    name: 'Dense enterprise',
    description: 'Compact controls, data-heavy layouts, and restrained emphasis.',
  },
  {
    id: 'calm-document',
    name: 'Calm document',
    description: 'Readable long-form content, generous rhythm, and quiet surfaces.',
  },
  {
    id: 'dashboard-first',
    name: 'Dashboard first',
    description: 'Metric hierarchy, modular cards, and scan-friendly status color.',
  },
] as const;

export type HtmlDesignSystemPresetId = (typeof HTML_DESIGN_SYSTEM_PRESETS)[number]['id'];

export const DEFAULT_HTML_DESIGN_SYSTEM_PRESET_ID: HtmlDesignSystemPresetId = 'dense-enterprise';

export function isHtmlDesignSystemPresetId(value: unknown): value is HtmlDesignSystemPresetId {
  return HTML_DESIGN_SYSTEM_PRESETS.some((preset) => preset.id === value);
}
