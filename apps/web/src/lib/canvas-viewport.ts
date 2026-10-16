export type CanvasViewportPresetId =
  | 'fluid'
  | 'full-hd'
  | 'desktop-1600'
  | 'desktop-1440'
  | 'desktop-1280'
  | 'tablet-960'
  | 'mobile-640'
  | 'iphone';

export interface CanvasViewportPreset {
  id: CanvasViewportPresetId;
  label: string;
  width: number | null;
}

export const DEFAULT_CANVAS_VIEWPORT_PRESET_ID: CanvasViewportPresetId = 'fluid';

export const CANVAS_VIEWPORT_PRESETS: CanvasViewportPreset[] = [
  { id: 'fluid', label: '100%', width: null },
  { id: 'full-hd', label: '1920 Full HD', width: 1920 },
  { id: 'desktop-1600', label: '1600', width: 1600 },
  { id: 'desktop-1440', label: '1440', width: 1440 },
  { id: 'desktop-1280', label: '1280', width: 1280 },
  { id: 'tablet-960', label: '960', width: 960 },
  { id: 'mobile-640', label: '640', width: 640 },
  { id: 'iphone', label: '440 iPhone', width: 440 },
];

export function canvasViewportWidth(id: CanvasViewportPresetId): number | null {
  return CANVAS_VIEWPORT_PRESETS.find((preset) => preset.id === id)?.width ?? null;
}
