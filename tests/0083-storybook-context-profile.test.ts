/**
 * 0083 UX-4 — Storybook mode uses its own startup context profile: the
 * screen-generation component pack is not assembled (component work and the
 * description interview don't need it).
 */
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { loadRunComponentPack } from '../services/api/src/routes/chat-stream/run-context';
import type { EditorState } from '../services/api/src/state-store';

function state(partial: Partial<EditorState>): EditorState {
  return { ...partial } as EditorState;
}

test('loadRunComponentPack returns null in Storybook mode without touching the workspace', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-0083-ctx-'));
  const pack = await loadRunComponentPack({
    workspacePath: root,
    state: state({ canvasView: 'storybook' }),
    messages: [{ role: 'user', content: 'Describe my components' }],
    promptAttachments: [],
  });
  expect(pack).toBeNull();
});

test('loadRunComponentPack returns null for description role in html-first screen view', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-0112-ctx-'));
  const pack = await loadRunComponentPack({
    workspacePath: root,
    state: state({ canvasView: 'screen' }),
    messages: [{ role: 'user', content: '@ai-description-layer Describe my components' }],
    promptAttachments: [],
    agentName: 'ai-description-layer',
  });
  expect(pack).toBeNull();
});
