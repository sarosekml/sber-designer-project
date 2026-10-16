/**
 * 0132.3 — deterministic modal-size HTML rewriter (Р-17, риск №23/№15/№24).
 */
import { expect, test } from 'bun:test';

import { readHtmlModalSize, rewriteHtmlModalSize } from '../services/api/src/modal-size-rewrite';

const withWindow = (attrs: string, rest = ''): string =>
  `<!doctype html>\n<html><body>\n  <div data-sd-screen-root data-sd-modal-backdrop>\n    <div ${attrs}>\n      <div data-sd-modal-region="body">${rest}</div>\n    </div>\n  </div>\n</body></html>\n`;

test('replaces the size custom properties and leaves everything else byte-identical', () => {
  const html = withWindow(
    'data-sd-modal-window data-sd-modal-content="scroll" style="--sd-modal-width: 640px; --sd-modal-height: auto; display: flex"',
  );
  const result = rewriteHtmlModalSize(html, { width: '300px', height: '50%' });
  expect(result.ok).toBe(true);
  expect(result.html).toContain('--sd-modal-width: 300px');
  expect(result.html).toContain('--sd-modal-height: 50%');
  // Untouched declarations and the rest of the file survive.
  expect(result.html).toContain('display: flex');
  expect(result.html).toContain('data-sd-modal-region="body"');
  // Only the window tag changed: byte length differs only by the value edits.
  expect(result.html).toBe(
    withWindow(
      'data-sd-modal-window data-sd-modal-content="scroll" style="--sd-modal-width: 300px; --sd-modal-height: 50%; display: flex"',
    ),
  );
});

test('switches the long-content attribute', () => {
  const html = withWindow(
    'data-sd-modal-window data-sd-modal-content="scroll" style="--sd-modal-width: 640px"',
  );
  const result = rewriteHtmlModalSize(html, { longContent: 'grow' });
  expect(result.ok).toBe(true);
  expect(result.html).toContain('data-sd-modal-content="grow"');
});

test('adds size custom properties into an existing style attribute', () => {
  const html = withWindow('data-sd-modal-window style="display: flex"');
  const result = rewriteHtmlModalSize(html, { width: '480px' });
  expect(result.ok).toBe(true);
  expect(result.html).toContain('style="display: flex; --sd-modal-width: 480px"');
});

test('adds a style attribute and the content attribute when neither exists', () => {
  const html = withWindow('data-sd-modal-window');
  const result = rewriteHtmlModalSize(html, { width: '300px', longContent: 'grow' });
  expect(result.ok).toBe(true);
  expect(result.html).toContain('style="--sd-modal-width: 300px"');
  expect(result.html).toContain('data-sd-modal-content="grow"');
});

test('honors single-quoted style attributes', () => {
  const html = withWindow("data-sd-modal-window style='--sd-modal-width: 640px'");
  const result = rewriteHtmlModalSize(html, { width: '320px' });
  expect(result.ok).toBe(true);
  expect(result.html).toContain("style='--sd-modal-width: 320px'");
});

test('is idempotent', () => {
  const html = withWindow('data-sd-modal-window style="--sd-modal-width: 640px"');
  const once = rewriteHtmlModalSize(html, { width: '300px' });
  const twice = rewriteHtmlModalSize(once.html!, { width: '300px' });
  expect(twice.html).toBe(once.html!);
});

test('preserves CRLF line endings', () => {
  const html = withWindow('data-sd-modal-window style="--sd-modal-width: 640px"').replace(
    /\n/g,
    '\r\n',
  );
  const result = rewriteHtmlModalSize(html, { width: '300px' });
  expect(result.ok).toBe(true);
  expect(result.html).toContain('\r\n');
  expect(result.html).not.toMatch(/[^\r]\n/);
});

test('reports no-marker and ambiguous-marker', () => {
  expect(rewriteHtmlModalSize('<div>no window here</div>', { width: '300px' }).error).toBe(
    'no-marker',
  );
  const twoMarkers = '<div data-sd-modal-window></div>\n<div data-sd-modal-window></div>';
  expect(rewriteHtmlModalSize(twoMarkers, { width: '300px' }).error).toBe('ambiguous-marker');
});

test('does not false-match the marker inside a quoted attribute value', () => {
  const html = withWindow('title="foo data-sd-modal-window bar" id="x"');
  // No real window marker attribute present → treated as missing.
  expect(rewriteHtmlModalSize(html, { width: '300px' }).error).toBe('no-marker');
});

test('ignores marker-like text in comments, scripts, and styles', () => {
  const html = [
    '<!-- <div data-sd-modal-window> -->',
    '<script>const sample = `<div data-sd-modal-window>`;</script>',
    '<style>.x::after { content: "<div data-sd-modal-window>"; }</style>',
  ].join('\n');
  expect(rewriteHtmlModalSize(html, { width: '300px' }).error).toBe('no-marker');
});

test('rejects invalid or unsafe values (риск №24)', () => {
  const html = withWindow('data-sd-modal-window style="--sd-modal-width: 640px"');
  expect(rewriteHtmlModalSize(html, { width: 'calc(100%)' }).error).toBe('invalid-value');
  expect(rewriteHtmlModalSize(html, { width: '300px;color:red' }).error).toBe('invalid-value');
  expect(rewriteHtmlModalSize(html, { height: 'auto' }).ok).toBe(true); // height allows auto
  expect(rewriteHtmlModalSize(html, { width: 'auto' }).error).toBe('invalid-value'); // width does not
});

test('an empty patch is rejected', () => {
  const html = withWindow('data-sd-modal-window');
  expect(rewriteHtmlModalSize(html, {}).error).toBe('empty-patch');
});

test('readHtmlModalSize returns the current contract values', () => {
  const html = withWindow(
    'data-sd-modal-window data-sd-modal-content="grow" style="--sd-modal-width: 300px; --sd-modal-height: 50%"',
  );
  expect(readHtmlModalSize(html)).toEqual({
    ok: true,
    width: '300px',
    height: '50%',
    longContent: 'grow',
  });
});
