import { readFile } from 'node:fs/promises';
import { expect, test } from 'bun:test';

const sourcePath = 'apps/web/src/components/editor/chat/AssistantChatSelector.tsx';

test('chat selector uses the app dialog for task deletion instead of browser confirm', async () => {
  const source = await readFile(sourcePath, 'utf8');

  expect(source).not.toContain('window.confirm');
  expect(source).toContain('<DialogTitle>Delete chat?</DialogTitle>');
  expect(source).toContain('DialogFooter');
  expect(source).toContain('setDeleteCandidate(session)');
});
