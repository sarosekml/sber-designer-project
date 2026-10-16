import { expect, test } from 'bun:test';
import {
  EXTERNAL_DESIGN_SOURCE_DIRECTIVE_START,
  buildExternalDesignSourceDirective,
  type ExternalDesignSourceIntent,
} from '@sber-designer/shared-types';
import type { ChatAttachment } from '@/stores/chat-store';

import {
  buildChatComposerSendPayload,
  composerKeyIntent,
  remainingAttachmentSlots,
  resolveSendBlockReason,
  selectSupportedAttachmentFiles,
} from './chat-composer';

const attachment = (id: string): ChatAttachment => ({
  id,
  name: `${id}.txt`,
  mimeType: 'text/plain',
  size: 12,
  kind: 'text',
  text: 'hello',
});

test('resolveSendBlockReason blocks send when attachment compatibility is an error', () => {
  expect(
    resolveSendBlockReason({
      sessionMode: 'design',
      draft: 'Use this screenshot',
      attachmentCount: 1,
      pending: false,
      providerUnavailable: false,
      autoRunning: false,
      attachmentCompatibility: {
        severity: 'error',
        detail: 'The selected model cannot read image attachments.',
      },
    }),
  ).toBe('The selected model cannot read image attachments.');
});

test('buildChatComposerSendPayload strips a leading subagent mention and routes through options', () => {
  const payload = buildChatComposerSendPayload({
    sessionMode: 'design',
    draft: '@qa-agent tighten the spacing',
    attachments: [attachment('a')],
    knownAgents: [{ name: 'qa-agent', mode: 'subagent' }],
    activePrimaryAgentName: 'designer',
  });

  expect(payload?.content).toBe('tighten the spacing');
  expect(payload?.displayContent).toBeUndefined();
  expect(payload?.agentName).toBe('qa-agent');
  expect(payload?.primaryAgentName).toBe('designer');
});

test('buildChatComposerSendPayload appends a design-source directive exactly once', () => {
  const intent: ExternalDesignSourceIntent = {
    source: { kind: 'figma', input: 'link', url: 'https://figma.com/design/demo' },
    target: { mode: 'new-screen', name: 'Checkout', folder: 'Flows' },
    policies: { tokens: 'prefer-project-tokens', components: 'prefer-existing' },
  };
  const directive = buildExternalDesignSourceDirective(intent);

  const payload = buildChatComposerSendPayload({
    sessionMode: 'design',
    draft: `Create this screen\n\n${directive}`,
    attachments: [],
    knownAgents: [],
    designSourceDirective: directive,
  });

  const occurrences = payload?.content.split(EXTERNAL_DESIGN_SOURCE_DIRECTIVE_START).length ?? 0;
  expect(occurrences - 1).toBe(1);
  expect(payload?.content.startsWith('Create this screen')).toBe(true);
  expect(payload?.displayContent).toBe('Create this screen');
});

test('selectSupportedAttachmentFiles skips unsupported files before applying the limit', () => {
  const unsupported = { name: 'archive.zip', type: 'application/zip' };
  const firstSupported = { name: 'notes.md', type: 'text/markdown' };
  const secondSupported = { name: 'reference.json', type: 'application/json' };

  expect(
    selectSupportedAttachmentFiles([unsupported, firstSupported, secondSupported], {
      currentCount: 3,
      maxCount: 4,
    }),
  ).toEqual([firstSupported]);
});

test('remainingAttachmentSlots clamps the available attachment count', () => {
  expect(remainingAttachmentSlots(1, 4)).toBe(3);
  expect(remainingAttachmentSlots(4, 4)).toBe(0);
  expect(remainingAttachmentSlots(8, 4)).toBe(0);
});

test('composerKeyIntent sends on Enter and keeps Shift+Enter as a newline', () => {
  expect(composerKeyIntent({ key: 'Enter', shiftKey: false, metaKey: false, ctrlKey: false })).toBe(
    'send',
  );
  expect(composerKeyIntent({ key: 'Enter', shiftKey: true, metaKey: false, ctrlKey: false })).toBe(
    'newline',
  );
  expect(composerKeyIntent({ key: 'a', shiftKey: false, metaKey: false, ctrlKey: false })).toBe(
    'ignore',
  );
});
