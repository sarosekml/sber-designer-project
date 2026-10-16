import { expect, test } from 'bun:test';

import {
  buildImageUrlAttachment,
  buildImageUrlAttachmentsFromText,
  extractImageUrlsFromText,
  isLikelyImageUrl,
} from './chat-attachments';

test('recognizes explicit image URLs for prompt attachments', () => {
  expect(isLikelyImageUrl('https://cdn.example.com/screen.png')).toBe(true);
  expect(isLikelyImageUrl('https://cdn.example.com/screen.jpg?size=large')).toBe(true);
  expect(isLikelyImageUrl('https://cdn.example.com/screen.jpeg')).toBe(true);
  expect(isLikelyImageUrl('https://cdn.example.com/screen.webp')).toBe(true);
  expect(isLikelyImageUrl('https://example.com/page')).toBe(false);
});

test('builds a URL-backed chat attachment without fetching in the browser', () => {
  expect(buildImageUrlAttachment('https://cdn.example.com/screen.png')).toMatchObject({
    kind: 'image',
    name: 'screen.png',
    mimeType: 'image/png',
    size: 0,
    sourceUrl: 'https://cdn.example.com/screen.png',
  });
});

test('extracts direct image URLs from prompt text', () => {
  expect(
    extractImageUrlsFromText(
      'Use https://cdn.example.com/screen.png and ignore https://example.com/page.',
    ),
  ).toEqual(['https://cdn.example.com/screen.png']);
  expect(
    extractImageUrlsFromText(
      'Same https://cdn.example.com/screen.png twice https://cdn.example.com/screen.png',
    ),
  ).toEqual(['https://cdn.example.com/screen.png']);
});

test('builds hidden prompt attachments from image URLs in text', () => {
  const attachments = buildImageUrlAttachmentsFromText({
    text: 'Сделай экран как на https://cdn.example.com/mockups/deal.webp.',
    maxCount: 3,
  });

  expect(attachments).toHaveLength(1);
  expect(attachments[0]).toMatchObject({
    kind: 'image',
    name: 'deal.webp',
    mimeType: 'image/webp',
    size: 0,
    sourceUrl: 'https://cdn.example.com/mockups/deal.webp',
  });
});
