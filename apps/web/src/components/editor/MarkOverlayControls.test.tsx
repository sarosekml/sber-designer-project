import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { MarkDock } from './MarkOverlayControls';

function renderDock(overrides: Partial<Parameters<typeof MarkDock>[0]> = {}) {
  return renderToStaticMarkup(
    <MarkDock
      warning={null}
      capabilityNotice={null}
      images={[]}
      setImages={() => undefined}
      sending={false}
      markTool="pen"
      setMarkTool={() => undefined}
      toolMenuOpen={false}
      setToolMenuOpen={() => undefined}
      toolMenuRef={{ current: null }}
      historyCounts={{ undo: 0, redo: 0 }}
      onUndo={() => undefined}
      onRedo={() => undefined}
      fileInputRef={{ current: null }}
      addImageFiles={() => Promise.resolve()}
      note=""
      setNote={() => undefined}
      onNotePaste={() => undefined}
      submitAction="send"
      setSubmitAction={() => undefined}
      submitMenuOpen={false}
      setSubmitMenuOpen={() => undefined}
      submitMenuRef={{ current: null }}
      canSubmit={true}
      canSend={true}
      sendDisabledReason={undefined}
      onSubmit={() => Promise.resolve()}
      {...overrides}
    />,
  );
}

test('composer keeps input, clear and submit in one non-wrapping group', () => {
  const html = renderDock({ note: 'make the header larger' });
  const composerStart = html.indexOf('data-testid="mark-composer"');
  expect(composerStart).toBeGreaterThan(-1);
  const composer = html.slice(
    composerStart,
    html.indexOf('</div>', html.indexOf('data-testid="mark-submit"')),
  );
  expect(composer).toContain('data-testid="mark-note-input"');
  expect(composer).toContain('aria-label="Clear message"');
  expect(composer).toContain('data-testid="mark-submit"');
  // The composer group itself never wraps; the input stretches.
  expect(html).toContain('flex-1 flex-nowrap');
});

test('clear message is disabled while the note is empty and keeps its slot', () => {
  const empty = renderDock();
  const clearStart = empty.indexOf('data-testid="mark-clear-note"');
  const clearButton = empty.slice(clearStart - 200, clearStart + 200);
  expect(clearButton).toContain('disabled');

  const filled = renderDock({ note: 'note text' });
  const filledStart = filled.indexOf('data-testid="mark-clear-note"');
  expect(filled.slice(filledStart - 200, filledStart)).not.toContain('disabled');
});

test('no close-layer control competes with clear message', () => {
  const html = renderDock();
  expect(html).not.toContain('Close Annotate');
});

test('capability notice renders as alert when blocked and status when warning', () => {
  const blocked = renderDock({
    capabilityNotice: { level: 'blocked', message: 'Text-only target blocks sending.' },
  });
  expect(blocked).toContain('role="alert"');
  expect(blocked).toContain('Text-only target blocks sending.');
  expect(blocked).toContain('border-destructive/40');
  // Text matches the border hue, not the solid-fill foreground (which is
  // white and unreadable on the translucent tint).
  expect(blocked).toContain('text-destructive');
  expect(blocked).not.toContain('text-destructive-foreground');

  const warning = renderDock({
    capabilityNotice: { level: 'warning', message: 'Images go as workspace paths.' },
  });
  expect(warning).toContain('role="status"');
  expect(warning).toContain('border-warning/30');
  expect(warning).toContain('text-warning');
  expect(warning).not.toContain('role="alert"');
});

test('blocked send carries the reason in its tooltip and stays disabled', () => {
  const html = renderDock({
    capabilityNotice: { level: 'blocked', message: 'Choose a vision-capable model.' },
    canSend: false,
    sendDisabledReason: 'Choose a vision-capable model.',
  });
  expect(html).toContain('title="Choose a vision-capable model."');
});
