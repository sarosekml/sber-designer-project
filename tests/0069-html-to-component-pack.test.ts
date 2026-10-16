import { expect, test } from 'bun:test';

import { resolveTaskRelevantComponentTaskKind } from '../services/api/src/routes/chat-stream/run-context';

test('html prompt references imply screen-generation component guidance', () => {
  const taskKind = resolveTaskRelevantComponentTaskKind({ activeScreen: null }, [
    {
      id: 'att-html',
      kind: 'text',
      documentKind: 'html',
      name: 'mockup.html',
      mimeType: 'text/html',
      size: 512,
      sha256: 'a'.repeat(64),
      runPath: '.sber-designer/runs/run-test/attachments/01-mockup.html',
      excerpt: 'Mockup',
      analysis: {
        headings: [{ level: 1, text: 'Mockup' }],
        landmarks: [],
        sections: [],
        forms: [],
        tables: [],
        lists: [],
        actions: [],
        mockText: [],
        classHints: [],
        warnings: [],
      },
    },
  ]);

  expect(taskKind).toBe('screen-generation');
});

test('design-system bootstrap image references do not imply image-to-screen component guidance', () => {
  const taskKind = resolveTaskRelevantComponentTaskKind(
    { activeScreen: null },
    [
      {
        id: 'att-image',
        name: 'reference.png',
        mimeType: 'image/png',
        size: 512,
        sha256: 'c'.repeat(64),
        runPath: '.sber-designer/runs/run-test/attachments/01-reference.png',
      },
    ],
    'Создай Design.md для нового html проекта по приложенному скриншоту',
  );

  expect(taskKind).toBe('unknown');
});

test('current-screen user target still controls task kind when html is attached', () => {
  const taskKind = resolveTaskRelevantComponentTaskKind(
    {
      assistantTaskIntent: { kind: 'edit-current-screen', targetScreenId: 'screen-a' },
      activeScreen: { id: 'screen-a', name: 'Current', kind: 'page' },
    },
    [
      {
        id: 'att-html',
        kind: 'text',
        documentKind: 'html',
        name: 'new-page.html',
        mimeType: 'text/html',
        size: 512,
        sha256: 'b'.repeat(64),
        runPath: '.sber-designer/runs/run-test/attachments/01-new-page.html',
        excerpt: 'New page',
        analysis: {
          headings: [{ level: 1, text: 'New page' }],
          landmarks: [],
          sections: [],
          forms: [],
          tables: [],
          lists: [],
          actions: [],
          mockText: [],
          classHints: [],
          warnings: [],
        },
      },
    ],
  );

  expect(taskKind).toBe('screen-edit');
});

test('current-screen local edit stays screen-edit when continuation carries an older raster', () => {
  const taskKind = resolveTaskRelevantComponentTaskKind(
    {
      canvasView: 'design',
      assistantTaskIntent: { kind: 'edit-current-screen', targetScreenId: 'screen-a' },
      activeScreen: { id: 'screen-a', name: 'Current', kind: 'story' },
    },
    [
      {
        id: 'att-carried-image',
        name: 'earlier-reference.png',
        mimeType: 'image/png',
        size: 512,
        sha256: 'e'.repeat(64),
        runPath: '.sber-designer/runs/run-earlier/attachments/01-earlier-reference.png',
      },
    ],
    'Исправь только кнопку «Документы» и больше ничего не меняй',
  );

  expect(taskKind).toBe('screen-edit');
});

test('selected-element local edit stays screen-edit when raster evidence is present', () => {
  const taskKind = resolveTaskRelevantComponentTaskKind(
    {
      canvasView: 'design',
      activeScreen: { id: 'screen-a', name: 'Current', kind: 'story' },
      selection: { componentId: 'documents-button', componentName: 'Button' },
    },
    [
      {
        id: 'att-reference-image',
        name: 'button-reference.png',
        mimeType: 'image/png',
        size: 512,
        sha256: 'f'.repeat(64),
        runPath: '.sber-designer/runs/run-current/attachments/01-button-reference.png',
      },
    ],
    'Сделай эту кнопку компактнее',
  );

  expect(taskKind).toBe('screen-edit');
});

test('blank active screen text tasks imply screen-generation component guidance', () => {
  const taskKind = resolveTaskRelevantComponentTaskKind(
    {
      canvasView: 'screen',
      activeScreen: {
        id: 'screen-blank',
        name: 'Blank generated screen',
        kind: 'story',
        filePath: 'src/stories/screens/BlankGenerated.stories.tsx',
        implementationFilePath: 'src/screens/BlankGenerated.tsx',
      },
    },
    [],
  );

  expect(taskKind).toBe('screen-generation');
});

test('broad restyle requests on an existing screen classify as screen-redesign', () => {
  const taskKind = resolveTaskRelevantComponentTaskKind(
    {
      canvasView: 'screen',
      activeScreen: {
        id: 'screen-existing',
        name: 'Payments',
        kind: 'story',
        filePath: 'src/stories/Payments.stories.tsx',
        implementationFilePath: 'src/screens/Payments.tsx',
      },
    },
    [],
    'Сделай существующий экран компактнее и полностью переработай композицию, сохранив данные',
  );

  expect(taskKind).toBe('screen-redesign');
});

test('selected element tweaks remain screen-edit instead of screen-redesign', () => {
  const taskKind = resolveTaskRelevantComponentTaskKind(
    {
      canvasView: 'design',
      activeScreen: { id: 'screen-existing', name: 'Payments', kind: 'story' },
      selection: { componentId: 'button-primary', componentName: 'Button' },
    },
    [],
    'Сделай эту кнопку компактнее',
  );

  expect(taskKind).toBe('screen-edit');
});

test('explicit existing-screen redesign stays redesign when an image reference is attached', () => {
  const taskKind = resolveTaskRelevantComponentTaskKind(
    {
      canvasView: 'screen',
      activeScreen: { id: 'screen-existing', name: 'Payments', kind: 'story' },
    },
    [
      {
        id: 'att-image',
        name: 'style-reference.png',
        mimeType: 'image/png',
        size: 512,
        sha256: 'd'.repeat(64),
        runPath: '.sber-designer/runs/run-test/attachments/01-style-reference.png',
      },
    ],
    'Redesign the existing screen in the style of the reference, but preserve all content.',
  );

  expect(taskKind).toBe('screen-redesign');
});

test('explicit selected-control redesign stays screen-edit', () => {
  const taskKind = resolveTaskRelevantComponentTaskKind(
    {
      canvasView: 'design',
      activeScreen: { id: 'screen-existing', name: 'Payments', kind: 'story' },
      selection: { componentId: 'button-primary', componentName: 'Button' },
    },
    [],
    'Redesign this selected button only.',
  );

  expect(taskKind).toBe('screen-edit');
});
