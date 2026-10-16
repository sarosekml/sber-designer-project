import { expect, test } from 'bun:test';

import {
  designSourceIntentKeyFor,
  shouldAutoOpenDesignSourceComposer,
  shouldUseDesignSourceScreenComposer,
} from './design-source-composer';

test('design source composer can be dismissed for the current detected intent', () => {
  const intentKey = designSourceIntentKeyFor({
    source: { kind: 'pixso', input: 'selection' },
    target: { mode: 'new-screen' },
    policies: { tokens: 'prefer-project-tokens', components: 'prefer-existing' },
  });

  expect(
    shouldAutoOpenDesignSourceComposer({
      intentKey,
      ignoredIntentKey: intentKey,
      currentComposerKey: null,
    }),
  ).toBe(false);
});

test('design source composer reopens for a different detected intent', () => {
  const ignoredIntentKey = designSourceIntentKeyFor({
    source: { kind: 'pixso', input: 'selection' },
    target: { mode: 'new-screen' },
    policies: { tokens: 'prefer-project-tokens', components: 'prefer-existing' },
  });
  const linkIntentKey = designSourceIntentKeyFor({
    source: { kind: 'pixso', input: 'link', url: 'https://pixso.net/app/editor/abc' },
    target: { mode: 'new-screen' },
    policies: { tokens: 'prefer-project-tokens', components: 'prefer-existing' },
  });

  expect(
    shouldAutoOpenDesignSourceComposer({
      intentKey: linkIntentKey,
      ignoredIntentKey,
      currentComposerKey: null,
    }),
  ).toBe(true);
});

test('design source composer does not recreate the already open composer', () => {
  const intentKey = designSourceIntentKeyFor({
    source: { kind: 'figma', input: 'link', url: 'https://figma.com/design/file/Product' },
    target: { mode: 'new-screen' },
    policies: { tokens: 'prefer-project-tokens', components: 'prefer-existing' },
  });

  expect(
    shouldAutoOpenDesignSourceComposer({
      intentKey,
      ignoredIntentKey: null,
      currentComposerKey: intentKey,
    }),
  ).toBe(false);
});

test('design source screen composer stays closed for design-system bootstrap intents', () => {
  expect(
    shouldUseDesignSourceScreenComposer({
      source: { kind: 'pixso', input: 'link', url: 'https://pixso.net/app/editor/abc' },
      target: { mode: 'design-system' },
      policies: { tokens: 'allow-source-values', components: 'allow-new-components' },
    }),
  ).toBe(false);
});
