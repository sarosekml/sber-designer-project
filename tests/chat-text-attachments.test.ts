import { expect, test } from 'bun:test';

import {
  IMAGE_ATTACHMENT_MAX_BYTES,
  SVG_ATTACHMENT_MAX_BYTES,
  buildTextAttachmentContext,
  isSupportedImageAttachment,
  isSupportedPromptAttachment,
  isSupportedTextAttachment,
} from '../apps/web/src/lib/chat-attachments';

test('accepts markdown and plain text prompt attachments', () => {
  expect(isSupportedTextAttachment({ name: 'prompt.md', type: 'text/markdown' })).toBe(true);
  expect(isSupportedTextAttachment({ name: 'brief.txt', type: 'text/plain' })).toBe(true);
  expect(isSupportedTextAttachment({ name: 'data.json', type: 'application/json' })).toBe(true);
  expect(isSupportedTextAttachment({ name: 'mockup.html', type: 'text/html' })).toBe(true);
  expect(isSupportedTextAttachment({ name: 'mockup.htm', type: '' })).toBe(true);
  expect(isSupportedTextAttachment({ name: 'tokens.css', type: 'text/css' })).toBe(true);
  expect(isSupportedTextAttachment({ name: 'components.css', type: '' })).toBe(true);
});

test('rejects unsupported text attachment extensions', () => {
  expect(isSupportedTextAttachment({ name: 'archive.zip', type: 'application/zip' })).toBe(false);
  expect(isSupportedTextAttachment({ name: 'mock.png', type: 'image/png' })).toBe(false);
});

test('accepts png jpeg webp and svg prompt image attachments', () => {
  expect(isSupportedImageAttachment({ name: 'reference.png', type: 'image/png' })).toBe(true);
  expect(isSupportedImageAttachment({ name: 'mock.jpeg', type: 'image/jpeg' })).toBe(true);
  expect(isSupportedImageAttachment({ name: 'mock.jpg', type: '' })).toBe(true);
  expect(isSupportedImageAttachment({ name: 'icon.svg', type: 'image/svg+xml' })).toBe(true);
  expect(isSupportedImageAttachment({ name: 'screen.webp', type: 'image/webp' })).toBe(true);
  expect(isSupportedImageAttachment({ name: 'animated.gif', type: 'image/gif' })).toBe(false);
  expect(isSupportedImageAttachment({ name: 'notes.md', type: 'text/markdown' })).toBe(false);
});

test('classifies supported prompt attachments across text and image kinds', () => {
  expect(isSupportedPromptAttachment({ name: 'brd.md', type: 'text/markdown' })).toBe(true);
  expect(isSupportedPromptAttachment({ name: 'reference.svg', type: '' })).toBe(true);
  expect(isSupportedPromptAttachment({ name: 'archive.zip', type: 'application/zip' })).toBe(false);
  expect(IMAGE_ATTACHMENT_MAX_BYTES).toBe(5 * 1024 * 1024);
  expect(SVG_ATTACHMENT_MAX_BYTES).toBe(5 * 1024 * 1024);
});

test('renders text attachments as a prompt context block', () => {
  const context = buildTextAttachmentContext([
    {
      name: 'prompt.md',
      mimeType: 'text/markdown',
      size: 24,
      text: '# Deal page\n\nUse cards.',
    },
  ]);

  expect(context).toContain('Attached text files:');
  expect(context).toContain('prompt.md');
  expect(context).toContain('```markdown');
  expect(context).toContain('# Deal page');
});

test('renders html attachments as fenced html prompt context', () => {
  const context = buildTextAttachmentContext([
    {
      name: 'mockup.htm',
      mimeType: 'text/html',
      size: 48,
      text: '<main><h1>Deal page</h1><button>Approve</button></main>',
    },
  ]);

  expect(context).toContain('mockup.htm');
  expect(context).toContain('```html');
  expect(context).toContain('<button>Approve</button>');
});

test('renders css attachments as fenced css prompt context', () => {
  const context = buildTextAttachmentContext([
    {
      name: 'tokens.css',
      mimeType: 'text/css',
      size: 48,
      text: ':root { --color-accent: #15803d; }',
    },
  ]);

  expect(context).toContain('tokens.css');
  expect(context).toContain('```css');
  expect(context).toContain('--color-accent');
});
