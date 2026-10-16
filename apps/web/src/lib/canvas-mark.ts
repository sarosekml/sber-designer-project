/**
 * Mark layer model (0127): red-marker annotations drawn over the live canvas.
 *
 * The Mark layer is a *layer* over the current editor mode, not a fourth mode
 * (ADR-0004). The user boxes / draws / labels regions of the running screen,
 * types a note, and hands the whole thing to the assistant as one message:
 * a composited screenshot attachment plus a structured `<canvas-mark>` block.
 *
 * Reference UX: Open Design's Mark tool (PreviewDrawOverlay) — box select,
 * freehand pen, droppable text labels, undo/redo, attach images, and a
 * Send / Add-to-input split action.
 *
 * Everything here is pure: geometry in normalized frame coordinates (0..1),
 * canvas painting parameterized by a 2D context, and the prompt-block builder.
 * The DOM/react half lives in components/editor/MarkOverlay.tsx.
 */

export type MarkTool = 'box' | 'pen' | 'text';
export type MarkSubmitAction = 'send' | 'draft';

/** Normalized point inside the canvas frame: 0..1 on both axes. */
export interface MarkPoint {
  x: number;
  y: number;
}

export interface MarkStroke {
  points: MarkPoint[];
}

/** Normalized rect inside the canvas frame (0..1 units). */
export interface MarkRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A free text label dropped onto the frame; position is its top-left corner. */
export interface MarkTextLabel {
  id: number;
  x: number;
  y: number;
  text: string;
}

export interface MarkScene {
  boxes: MarkRect[];
  strokes: MarkStroke[];
  texts: MarkTextLabel[];
}

export const MARK_STROKE_COLOR = '#ff3b30';
export const MARK_STROKE_WIDTH = 4;
export const MARK_BOX_FILL = 'rgba(255, 59, 48, 0.10)';
/** Label glyph height as a fraction of frame height (min px below). */
export const MARK_TEXT_FONT_FRACTION = 0.03;
export const MARK_TEXT_MIN_FONT_PX = 12;
export const MARK_TEXT_LINE_HEIGHT = 1.25;
export const MARK_TEXT_FONT_FAMILY = 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

/** Window CustomEvent bridging MarkOverlay → ChatPanel. */
export const CANVAS_MARK_EVENT = 'sber-designer:canvas-mark';

export interface CanvasMarkImage {
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
}

export interface CanvasMarkEventDetail {
  action: MarkSubmitAction;
  note: string;
  /** Composited PNG (canvas snapshot + marks); null when capture failed. */
  screenshot: CanvasMarkImage | null;
  /** Images the user attached in the mark dock to ride along with the mark. */
  extraImages: CanvasMarkImage[];
  scene: MarkSceneSummary;
  /** Union bounds of all marks, normalized to the frame; null without marks. */
  bounds: MarkRect | null;
  /** Frame CSS size at capture time, so bounds can be reported in px. */
  frameSize: { width: number; height: number };
  screen: { id: string; name: string; filePath?: string } | null;
  ack?: (result: { ok: boolean; message?: string }) => void;
}

export interface MarkSceneSummary {
  boxCount: number;
  strokeCount: number;
  labelCount: number;
  labels: string[];
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function normalizedRectFromPoints(a: MarkPoint, b: MarkPoint): MarkRect {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  return {
    x: left,
    y: top,
    width: Math.max(0, Math.max(a.x, b.x) - left),
    height: Math.max(0, Math.max(a.y, b.y) - top),
  };
}

/** Drags smaller than this (normalized) are treated as accidental clicks. */
export const MARK_MIN_BOX_SIZE = 0.006;

export function isMeaningfulBox(rect: MarkRect): boolean {
  return rect.width >= MARK_MIN_BOX_SIZE && rect.height >= MARK_MIN_BOX_SIZE;
}

export function strokeBounds(stroke: MarkStroke): MarkRect | null {
  if (stroke.points.length === 0) return null;
  const xs = stroke.points.map((p) => p.x);
  const ys = stroke.points.map((p) => p.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return {
    x: left,
    y: top,
    width: Math.max(...xs) - left,
    height: Math.max(...ys) - top,
  };
}

export function unionRects(rects: (MarkRect | null | undefined)[]): MarkRect | null {
  const real = rects.filter((rect): rect is MarkRect => Boolean(rect));
  if (real.length === 0) return null;
  const left = Math.min(...real.map((rect) => rect.x));
  const top = Math.min(...real.map((rect) => rect.y));
  const right = Math.max(...real.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...real.map((rect) => rect.y + rect.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Union bounds of the whole scene, normalized. Text labels contribute their
 * drop point plus a caller-measured rect when available (DOM knows the size).
 */
export function markSceneBounds(
  scene: MarkScene,
  measuredTextRects: MarkRect[] = [],
): MarkRect | null {
  const textFallbacks: MarkRect[] =
    measuredTextRects.length > 0
      ? measuredTextRects
      : scene.texts
          .filter((label) => label.text.trim().length > 0)
          .map((label) => ({ x: label.x, y: label.y, width: 0.001, height: 0.001 }));
  return unionRects([
    ...scene.boxes,
    ...scene.strokes.map((stroke) => strokeBounds(stroke)),
    ...textFallbacks,
  ]);
}

export function sceneHasMarks(scene: MarkScene): boolean {
  return (
    scene.boxes.length > 0 ||
    scene.strokes.length > 0 ||
    scene.texts.some((label) => label.text.trim().length > 0)
  );
}

export function summarizeScene(scene: MarkScene): MarkSceneSummary {
  const labels = scene.texts
    .map((label) => label.text.trim())
    .filter(Boolean)
    .slice(0, 8);
  return {
    boxCount: scene.boxes.length,
    strokeCount: scene.strokes.length,
    labelCount: labels.length,
    labels,
  };
}

export function markTextFontPx(frameHeight: number): number {
  return Math.max(MARK_TEXT_MIN_FONT_PX, MARK_TEXT_FONT_FRACTION * frameHeight);
}

/**
 * Minimal 2D-context surface the painter needs — keeps the painter testable
 * without a real canvas and away from DOM types.
 */
export interface MarkPaintContext {
  strokeStyle: string | CanvasGradient | CanvasPattern;
  fillStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  font: string;
  textBaseline: CanvasTextBaseline;
  shadowColor: string;
  shadowBlur: number;
  save(): void;
  restore(): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  stroke(): void;
  setLineDash(segments: number[]): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
}

/**
 * Paint the scene into a pixel space of `width`×`height`. Used both for the
 * live overlay canvas and for baking marks into the captured screenshot, so
 * the agent sees exactly what the user saw.
 */
export function paintMarkScene(
  ctx: MarkPaintContext,
  scene: MarkScene,
  width: number,
  height: number,
  options: { strokeScale?: number } = {},
): void {
  const strokeScale = options.strokeScale ?? 1;
  ctx.save();
  ctx.fillStyle = MARK_BOX_FILL;
  ctx.strokeStyle = MARK_STROKE_COLOR;
  ctx.lineWidth = Math.max(2, Math.round(Math.min(width, height) * 0.002));
  ctx.setLineDash([10, 6]);
  for (const box of scene.boxes) {
    ctx.fillRect(
      box.x * width,
      box.y * height,
      Math.max(1, box.width * width),
      Math.max(1, box.height * height),
    );
    ctx.strokeRect(
      box.x * width,
      box.y * height,
      Math.max(1, box.width * width),
      Math.max(1, box.height * height),
    );
  }
  ctx.restore();

  ctx.save();
  ctx.setLineDash([]);
  ctx.strokeStyle = MARK_STROKE_COLOR;
  ctx.lineWidth = MARK_STROKE_WIDTH * strokeScale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const stroke of scene.strokes) {
    const [first, ...rest] = stroke.points;
    if (!first) continue;
    ctx.beginPath();
    ctx.moveTo(first.x * width, first.y * height);
    for (const point of rest) ctx.lineTo(point.x * width, point.y * height);
    ctx.stroke();
  }
  ctx.restore();

  const fontPx = markTextFontPx(height);
  const lineHeight = fontPx * MARK_TEXT_LINE_HEIGHT;
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.font = `600 ${fontPx}px ${MARK_TEXT_FONT_FAMILY}`;
  ctx.fillStyle = MARK_STROKE_COLOR;
  // Soft white halo keeps red text legible over any screen background.
  ctx.shadowColor = 'rgba(255,255,255,0.75)';
  ctx.shadowBlur = Math.max(1, fontPx * 0.14);
  const topPad = (lineHeight - fontPx) / 2;
  for (const label of scene.texts) {
    if (label.text.trim().length === 0) continue;
    const baseX = label.x * width;
    const baseY = label.y * height + topPad;
    label.text.split('\n').forEach((line, index) => {
      ctx.fillText(line, baseX, baseY + index * lineHeight);
    });
  }
  ctx.restore();
}

export interface CanvasMarkBlockInput {
  scene: MarkSceneSummary;
  bounds: MarkRect | null;
  frameSize: { width: number; height: number };
  note: string;
  screen: { id: string; name: string; filePath?: string } | null;
  hasScreenshot: boolean;
}

function describeSceneMarks(scene: MarkSceneSummary): string {
  const parts: string[] = [];
  if (scene.boxCount > 0) {
    parts.push(`${scene.boxCount} box${scene.boxCount > 1 ? 'es' : ''}`);
  }
  if (scene.strokeCount > 0) {
    parts.push(`${scene.strokeCount} pen stroke${scene.strokeCount > 1 ? 's' : ''}`);
  }
  if (scene.labelCount > 0) {
    parts.push(`${scene.labelCount} text label${scene.labelCount > 1 ? 's' : ''}`);
  }
  return parts.join(', ');
}

function formatRegion(bounds: MarkRect, frame: { width: number; height: number }): string {
  const px = {
    x: Math.round(bounds.x * frame.width),
    y: Math.round(bounds.y * frame.height),
    width: Math.max(1, Math.round(bounds.width * frame.width)),
    height: Math.max(1, Math.round(bounds.height * frame.height)),
  };
  const norm = (value: number) => value.toFixed(3);
  return (
    `x${px.x} y${px.y} ${px.width}x${px.height}px of ${Math.round(frame.width)}x` +
    `${Math.round(frame.height)}px viewport (normalized x${norm(bounds.x)} y${norm(bounds.y)} ` +
    `w${norm(bounds.width)} h${norm(bounds.height)})`
  );
}

/**
 * Structured context appended to the wire message (never to the visible chat
 * text). Mirrors Open Design's `<attached-preview-comments>` contract: hard
 * scope on the marked region, screenshot-optional anchoring.
 */
export function buildCanvasMarkBlock(input: CanvasMarkBlockInput): string {
  const lines = ['<canvas-mark>'];
  lines.push(
    'The user marked a region of the live canvas with the Mark tool. Treat the marked region as the scope of this request: inspect it first and do not modify unrelated parts of the screen. Surface out-of-scope issues in your reply instead of fixing them.',
  );
  if (input.screen) {
    const file = input.screen.filePath ? ` (${input.screen.filePath})` : '';
    lines.push(`screen: ${input.screen.name}${file}`);
  }
  const markSummary = describeSceneMarks(input.scene);
  if (markSummary) lines.push(`marks: ${markSummary}`);
  if (input.scene.labels.length > 0) {
    lines.push(`labelTexts: ${input.scene.labels.join(' | ')}`);
  }
  if (input.bounds) {
    lines.push(`region: ${formatRegion(input.bounds, input.frameSize)}`);
  }
  lines.push(
    input.hasScreenshot
      ? 'intent: The attached screenshot is the current canvas with red marks (dashed boxes, strokes, labels) identifying the region the user wants changed.'
      : 'intent: No screenshot could be captured; locate the region from the screen and region fields above.',
  );
  lines.push('</canvas-mark>');
  return lines.join('\n');
}

/** Visible composer/transcript text for a mark submission. */
export function markDisplayText(note: string, scene: MarkSceneSummary): string {
  if (note.trim()) return note.trim();
  const summary = describeSceneMarks(scene);
  return summary ? `Marked the canvas: ${summary}.` : 'Marked the canvas.';
}

/** Wire message text: note (or fallback) plus the structured block. */
export function buildMarkWireContent(input: CanvasMarkBlockInput): string {
  return [markDisplayText(input.note, input.scene), buildCanvasMarkBlock(input)].join('\n\n');
}

/** Rough byte size of a base64 data URL payload (for attachment limits). */
export function dataUrlByteSize(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return 0;
  const body = dataUrl.slice(comma + 1);
  const padding = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((body.length * 3) / 4) - padding);
}
