import { expect, test } from 'bun:test';

import { resolveChatGenerationRequest } from './useChat';

test('0114 T14 consumes a pending one-shot generation profile when send options are stale', () => {
  expect(resolveChatGenerationRequest(undefined, { wireframe: true })).toEqual({
    wireframe: true,
  });
});

test('explicit chat generation options win over the pending one-shot fallback', () => {
  expect(resolveChatGenerationRequest({ critique: true }, { wireframe: true })).toEqual({
    critique: true,
  });
});
