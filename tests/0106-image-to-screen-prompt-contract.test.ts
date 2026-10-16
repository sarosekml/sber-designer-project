import { expect, test } from 'bun:test';
import { formatPromptAttachmentReferences } from '../services/api/src/prompt-attachments';

test('image references tell the agent to treat visuals as requirements', () => {
  const text = formatPromptAttachmentReferences([
    {
      id: 'att-png',
      name: 'screen.png',
      mimeType: 'image/png',
      size: 1200,
      sha256: 'a'.repeat(64),
      width: 1440,
      height: 900,
      runPath: '.sber-designer/runs/run/attachments/01-screen.png',
      sourceKind: 'upload',
    },
  ]);

  expect(text).toContain('Attached Image References');
  expect(text).toContain('visual requirements for the screen-generation task');
  expect(text).toContain('They do not change the allowed target files.');
});
