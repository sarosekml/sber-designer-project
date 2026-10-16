import { describe, expect, test } from 'bun:test';

import {
  buildCanvasMarkBlock,
  buildMarkWireContent,
  dataUrlByteSize,
  isMeaningfulBox,
  markDisplayText,
  markSceneBounds,
  markTextFontPx,
  normalizedRectFromPoints,
  paintMarkScene,
  sceneHasMarks,
  strokeBounds,
  summarizeScene,
  unionRects,
  type MarkPaintContext,
  type MarkScene,
} from './canvas-mark';

const emptyScene: MarkScene = { boxes: [], strokes: [], texts: [] };

describe('geometry', () => {
  test('normalizedRectFromPoints orders corners from any drag direction', () => {
    expect(normalizedRectFromPoints({ x: 0.8, y: 0.7 }, { x: 0.2, y: 0.1 })).toEqual({
      x: 0.2,
      y: 0.1,
      width: 0.6000000000000001,
      height: 0.6,
    });
  });

  test('isMeaningfulBox rejects micro-drags', () => {
    expect(isMeaningfulBox({ x: 0, y: 0, width: 0.004, height: 0.2 })).toBe(false);
    expect(isMeaningfulBox({ x: 0, y: 0, width: 0.05, height: 0.05 })).toBe(true);
  });

  test('strokeBounds spans the stroke and unionRects merges regions', () => {
    const stroke = strokeBounds({
      points: [
        { x: 0.1, y: 0.2 },
        { x: 0.5, y: 0.1 },
        { x: 0.3, y: 0.6 },
      ],
    });
    expect(stroke).toEqual({ x: 0.1, y: 0.1, width: 0.4, height: 0.5 });
    const union = unionRects([stroke, { x: 0.6, y: 0.05, width: 0.2, height: 0.1 }]);
    expect(union?.x).toBeCloseTo(0.1);
    expect(union?.y).toBeCloseTo(0.05);
    expect(union?.width).toBeCloseTo(0.7);
    expect(union?.height).toBeCloseTo(0.55);
    expect(unionRects([null, undefined])).toBeNull();
  });

  test('markSceneBounds prefers measured text rects over drop points', () => {
    const scene: MarkScene = {
      boxes: [],
      strokes: [],
      texts: [{ id: 1, x: 0.5, y: 0.5, text: 'fix' }],
    };
    const measured = markSceneBounds(scene, [{ x: 0.5, y: 0.5, width: 0.1, height: 0.04 }]);
    expect(measured?.x).toBe(0.5);
    expect(measured?.y).toBe(0.5);
    expect(measured?.width).toBeCloseTo(0.1);
    expect(measured?.height).toBeCloseTo(0.04);
    const fallback = markSceneBounds(scene);
    expect(fallback?.x).toBe(0.5);
    expect(fallback?.width).toBeCloseTo(0.001);
  });
});

describe('scene state', () => {
  test('sceneHasMarks ignores whitespace-only labels', () => {
    expect(sceneHasMarks(emptyScene)).toBe(false);
    expect(sceneHasMarks({ ...emptyScene, texts: [{ id: 1, x: 0, y: 0, text: '   ' }] })).toBe(
      false,
    );
    expect(sceneHasMarks({ ...emptyScene, boxes: [{ x: 0, y: 0, width: 0.1, height: 0.1 }] })).toBe(
      true,
    );
  });

  test('summarizeScene counts marks and trims labels', () => {
    expect(
      summarizeScene({
        boxes: [{ x: 0, y: 0, width: 0.1, height: 0.1 }],
        strokes: [{ points: [{ x: 0, y: 0 }] }, { points: [{ x: 1, y: 1 }] }],
        texts: [
          { id: 1, x: 0, y: 0, text: '  правки  ' },
          { id: 2, x: 0, y: 0, text: '' },
        ],
      }),
    ).toEqual({ boxCount: 1, strokeCount: 2, labelCount: 1, labels: ['правки'] });
  });

  test('markTextFontPx scales with frame height with a floor', () => {
    expect(markTextFontPx(1000)).toBe(30);
    expect(markTextFontPx(100)).toBe(12);
  });
});

describe('prompt block', () => {
  const summary = summarizeScene({
    boxes: [{ x: 0.1, y: 0.2, width: 0.25, height: 0.3 }],
    strokes: [{ points: [{ x: 0.5, y: 0.5 }] }],
    texts: [{ id: 1, x: 0.7, y: 0.1, text: 'править тут' }],
  });

  test('buildCanvasMarkBlock includes scope, screen, region, and intent', () => {
    const block = buildCanvasMarkBlock({
      scene: summary,
      bounds: { x: 0.1, y: 0.2, width: 0.25, height: 0.3 },
      frameSize: { width: 1280, height: 800 },
      note: 'tighten spacing',
      screen: { id: 's1', name: 'Deal draft', filePath: 'src/screens/DealDraft.tsx' },
      hasScreenshot: true,
    });
    expect(block).toContain('<canvas-mark>');
    expect(block).toContain('screen: Deal draft (src/screens/DealDraft.tsx)');
    expect(block).toContain('marks: 1 box, 1 pen stroke, 1 text label');
    expect(block).toContain('labelTexts: править тут');
    expect(block).toContain('region: x128 y160 320x240px of 1280x800px viewport');
    expect(block).toContain('normalized x0.100 y0.200 w0.250 h0.300');
    expect(block).toContain('attached screenshot is the current canvas');
    expect(block).toContain('</canvas-mark>');
  });

  test('screenshot-less block redirects the agent to structured fields', () => {
    const block = buildCanvasMarkBlock({
      scene: summary,
      bounds: null,
      frameSize: { width: 1280, height: 800 },
      note: '',
      screen: null,
      hasScreenshot: false,
    });
    expect(block).toContain('No screenshot could be captured');
    expect(block).not.toContain('region:');
    expect(block).not.toContain('screen:');
  });

  test('markDisplayText falls back to a mark summary when the note is empty', () => {
    expect(markDisplayText(' polish this ', summary)).toBe('polish this');
    expect(markDisplayText('', summary)).toBe(
      'Marked the canvas: 1 box, 1 pen stroke, 1 text label.',
    );
  });

  test('buildMarkWireContent stacks display text above the block', () => {
    const wire = buildMarkWireContent({
      scene: summary,
      bounds: null,
      frameSize: { width: 100, height: 100 },
      note: 'note text',
      screen: null,
      hasScreenshot: true,
    });
    expect(wire.startsWith('note text\n\n<canvas-mark>')).toBe(true);
  });
});

describe('painter', () => {
  function recordingContext(): { ctx: MarkPaintContext; calls: string[] } {
    const calls: string[] = [];
    const record =
      (name: string) =>
      (...args: unknown[]) => {
        calls.push(`${name}(${args.map((value) => String(value)).join(',')})`);
      };
    const ctx: MarkPaintContext = {
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 0,
      lineCap: 'butt',
      lineJoin: 'miter',
      font: '',
      textBaseline: 'alphabetic',
      shadowColor: '',
      shadowBlur: 0,
      save: record('save'),
      restore: record('restore'),
      beginPath: record('beginPath'),
      moveTo: record('moveTo'),
      lineTo: record('lineTo'),
      stroke: record('stroke'),
      setLineDash: record('setLineDash'),
      fillRect: record('fillRect'),
      strokeRect: record('strokeRect'),
      fillText: record('fillText'),
    };
    return { ctx, calls };
  }

  test('paintMarkScene maps normalized marks into pixel space', () => {
    const { ctx, calls } = recordingContext();
    paintMarkScene(
      ctx,
      {
        boxes: [{ x: 0.25, y: 0.5, width: 0.5, height: 0.25 }],
        strokes: [
          {
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 1 },
            ],
          },
        ],
        texts: [{ id: 1, x: 0.1, y: 0.1, text: 'a\nb' }],
      },
      200,
      100,
    );
    expect(calls).toContain('strokeRect(50,50,100,25)');
    expect(calls).toContain('moveTo(0,0)');
    expect(calls).toContain('lineTo(200,100)');
    // Two lines rendered at the label drop point, one line-height apart.
    expect(calls.filter((call) => call.startsWith('fillText')).length).toBe(2);
  });

  test('empty scene still balances save/restore pairs', () => {
    const { ctx, calls } = recordingContext();
    paintMarkScene(ctx, emptyScene, 100, 100);
    expect(calls.filter((call) => call === 'save()').length).toBe(
      calls.filter((call) => call === 'restore()').length,
    );
  });
});

describe('dataUrlByteSize', () => {
  test('computes decoded size with padding', () => {
    // 'AAAA' → 3 bytes; 'AAA=' → 2; 'AA==' → 1.
    expect(dataUrlByteSize('data:image/png;base64,AAAA')).toBe(3);
    expect(dataUrlByteSize('data:image/png;base64,AAA=')).toBe(2);
    expect(dataUrlByteSize('data:image/png;base64,AA==')).toBe(1);
    expect(dataUrlByteSize('not-a-data-url')).toBe(0);
  });
});
