import { mkdir, readFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import {
  formatPromptAttachmentReferences,
  recordPromptAttachments,
  validatePromptAttachmentsForTarget,
} from '../services/api/src/prompt-attachments';
import { createAgentRun } from '../services/api/src/agent/run-record/manifest';
import { resolveAgentModelTarget } from '../services/api/src/agent-model-target';

const PNG_1X1_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l5qfWQAAAABJRU5ErkJggg==';

test('records prompt image attachments as run evidence files with metadata', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0062-attachments-'));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'vision',
    projectName: 'Attachment CRM',
    workspacePath: workspace,
    userGoal: 'Use attached references.',
  });

  const evidence = await recordPromptAttachments({
    workspacePath: workspace,
    runId: run.runId,
    attachments: [
      {
        id: 'att-png',
        kind: 'image',
        name: 'reference.png',
        mimeType: 'image/png',
        size: 70,
        dataUrl: PNG_1X1_DATA_URL,
      },
      {
        id: 'att-svg',
        kind: 'image',
        name: 'brand-icon.svg',
        mimeType: 'image/svg+xml',
        size: 111,
        text: '<svg viewBox="0 0 24 24"><path fill="#16a34a" d="M0 0h24v24H0z"/></svg>',
      },
    ],
  });

  expect(evidence).toHaveLength(2);
  expect(evidence[0]).toMatchObject({
    id: 'att-png',
    name: 'reference.png',
    mimeType: 'image/png',
    width: 1,
    height: 1,
    runPath: expect.stringContaining('attachments/01-reference.png'),
  });
  expect(evidence[0]?.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(evidence[1]).toMatchObject({
    id: 'att-svg',
    name: 'brand-icon.svg',
    mimeType: 'image/svg+xml',
    width: 24,
    height: 24,
    runPath: expect.stringContaining('attachments/02-brand-icon.svg'),
  });
  expect(evidence[1]?.sourceExcerpt).toContain('viewBox="0 0 24 24"');

  const runRoot = join(workspace, '.sber-designer', 'runs', run.runId);
  expect(await readFile(join(runRoot, 'attachments', '01-reference.png'))).toBeInstanceOf(Buffer);
  const manifest = JSON.parse(
    await readFile(join(runRoot, 'attachments', 'attachments.json'), 'utf8'),
  );
  expect(manifest.attachments).toHaveLength(2);
  expect(JSON.stringify(manifest)).not.toContain('base64');
});

test('records prompt text attachments as durable run evidence with compact excerpt', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0068-text-attachments-'));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'text',
    projectName: 'IBP UI Kit',
    workspacePath: workspace,
    userGoal: 'Generate the screen from the attached BRD.',
  });
  const brdText = [
    'IBP approval dashboard BRD',
    'Build a dense operational screen with approvals, deviations, and forecast status.',
    'Use project UI kit components only.',
    'filler '.repeat(700),
    'FINAL_DEEP_REQUIREMENT_MARKER',
  ].join('\n');

  const evidence = await recordPromptAttachments({
    workspacePath: workspace,
    runId: run.runId,
    attachments: [
      {
        id: 'att-brd',
        kind: 'text',
        name: 'IBP BRD.md',
        mimeType: 'text/markdown',
        size: Buffer.byteLength(brdText, 'utf8'),
        text: brdText,
      },
    ],
  });

  expect(evidence).toHaveLength(1);
  expect(evidence[0]).toMatchObject({
    id: 'att-brd',
    kind: 'text',
    name: 'IBP BRD.md',
    mimeType: 'text/markdown',
    runPath: expect.stringContaining('attachments/01-ibp-brd.md'),
  });
  expect(evidence[0]?.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(evidence[0]).toHaveProperty('excerpt');
  expect(JSON.stringify(evidence[0])).toContain('IBP approval dashboard BRD');
  expect(JSON.stringify(evidence[0])).not.toContain('FINAL_DEEP_REQUIREMENT_MARKER');

  const runRoot = join(workspace, '.sber-designer', 'runs', run.runId);
  const textFile = await readFile(join(runRoot, 'attachments', '01-ibp-brd.md'), 'utf8');
  expect(textFile).toContain('FINAL_DEEP_REQUIREMENT_MARKER');
  const manifest = JSON.parse(
    await readFile(join(runRoot, 'attachments', 'attachments.json'), 'utf8'),
  );
  expect(manifest.attachments[0]).toMatchObject({ kind: 'text', name: 'IBP BRD.md' });
  expect(JSON.stringify(manifest)).not.toContain('FINAL_DEEP_REQUIREMENT_MARKER');

  const references = formatPromptAttachmentReferences(evidence);
  expect(references).toContain('## Attached Text References');
  expect(references).toContain('IBP BRD.md');
  expect(references).toContain('excerpt:');
  expect(references).toContain('They do not change the allowed target files.');
  expect(references).not.toContain('FINAL_DEEP_REQUIREMENT_MARKER');
});

test('records css prompt attachments as first-class design reference evidence', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0108-css-attachments-'));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'text',
    projectName: 'HTML DS',
    workspacePath: workspace,
    userGoal: 'Import the attached CSS design system.',
  });
  const css = ':root { --color-accent: #15803d; }\n.button { border-radius: 8px; }\n';

  const evidence = await recordPromptAttachments({
    workspacePath: workspace,
    runId: run.runId,
    attachments: [
      {
        id: 'att-css',
        kind: 'text',
        name: 'design-system.md',
        mimeType: 'text/markdown',
        size: Buffer.byteLength(css, 'utf8'),
        text: css,
      },
    ],
  });

  expect(evidence).toHaveLength(1);
  expect(evidence[0]).toMatchObject({
    id: 'att-css',
    kind: 'text',
    documentKind: 'css',
    name: 'design-system.md',
    mimeType: 'text/css',
    runPath: expect.stringContaining('attachments/01-design-system.css'),
  });

  const runRoot = join(workspace, '.sber-designer', 'runs', run.runId);
  const sourceFile = await readFile(join(runRoot, 'attachments', '01-design-system.css'), 'utf8');
  expect(sourceFile).toContain('--color-accent');
  const manifest = JSON.parse(
    await readFile(join(runRoot, 'attachments', 'attachments.json'), 'utf8'),
  );
  expect(manifest.attachments[0]).toMatchObject({
    documentKind: 'css',
    mimeType: 'text/css',
  });

  const references = formatPromptAttachmentReferences(evidence);
  expect(references).toContain('## Attached CSS Reference');
  expect(references).toContain('Use CSS as design-system evidence');
  expect(references).toContain('documentKind: css');
  expect(references).toContain('tokens: --color-accent');
  expect(references).toContain('classes: .button');
  expect(references).toContain('--color-accent');
});

test('keeps markdown briefs with css fences as markdown evidence', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0108-md-css-fence-'));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'text',
    projectName: 'HTML DS',
    workspacePath: workspace,
    userGoal: 'Generate the page from the attached brief.',
  });
  const brief = [
    '# Corporate request page',
    '',
    '- Build a dense CRM screen.',
    '- Use the attached design system.',
    '',
    '```css',
    ':root { --color-accent: #15803d; }',
    '.badge { border-radius: 8px; }',
    '```',
  ].join('\n');

  const evidence = await recordPromptAttachments({
    workspacePath: workspace,
    runId: run.runId,
    attachments: [
      {
        id: 'att-brief',
        kind: 'text',
        name: 'CorporateRequestPage.md',
        mimeType: 'text/markdown',
        size: Buffer.byteLength(brief, 'utf8'),
        text: brief,
      },
    ],
  });

  expect(evidence[0]).toMatchObject({
    id: 'att-brief',
    documentKind: 'markdown',
    mimeType: 'text/markdown',
    runPath: expect.stringContaining('attachments/01-corporaterequestpage.md'),
  });
});

test('keeps markdown briefs with javascript theme examples as markdown evidence', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0108-md-js-theme-'));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'text',
    projectName: 'HTML DS',
    workspacePath: workspace,
    userGoal: 'Generate the page from the attached brief.',
  });
  const brief = [
    '# Corporate request page',
    '',
    'Use this theme example only as product guidance:',
    '',
    '```ts',
    "const theme = { color: '#15803d', radius: '8px' };",
    '```',
  ].join('\n');

  const evidence = await recordPromptAttachments({
    workspacePath: workspace,
    runId: run.runId,
    attachments: [
      {
        id: 'att-brief-js',
        kind: 'text',
        name: 'CorporateRequestPage.md',
        mimeType: 'text/markdown',
        size: Buffer.byteLength(brief, 'utf8'),
        text: brief,
      },
    ],
  });

  expect(evidence[0]).toMatchObject({
    id: 'att-brief-js',
    documentKind: 'markdown',
    mimeType: 'text/markdown',
    runPath: expect.stringContaining('attachments/01-corporaterequestpage.md'),
  });
});

test('rejects active svg content before it becomes prompt context', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0062-svg-reject-'));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  const run = await createAgentRun({
    route: 'chat',
    user: 'test-user',
    workspacePath: workspace,
  });

  await expect(
    recordPromptAttachments({
      workspacePath: workspace,
      runId: run.runId,
      attachments: [
        {
          id: 'att-svg',
          kind: 'image',
          name: 'unsafe.svg',
          mimeType: 'image/svg+xml',
          size: 45,
          text: '<svg onload="alert(1)"><script>alert(1)</script></svg>',
        },
      ],
    }),
  ).rejects.toThrow('SVG attachments cannot contain scripts or event handlers.');
});

test('formats attached image references with target-scope reminder', () => {
  const section = formatPromptAttachmentReferences([
    {
      id: 'att-png',
      name: 'reference.png',
      mimeType: 'image/png',
      size: 70,
      sha256: 'a'.repeat(64),
      width: 1,
      height: 1,
      runPath: '.sber-designer/runs/run-test/attachments/01-reference.png',
    },
  ]);

  expect(section).toContain('## Attached Image References');
  expect(section).toContain('reference.png');
  expect(section).toContain('dimensions: 1x1');
  expect(section).toContain('They do not change the allowed target files.');
});

test('reports raster image attachments when selected model is marked non-vision', () => {
  const target = resolveAgentModelTarget({
    config: {
      agent: { default: { provider: 'custom', model: 'cheap-text' } },
      provider: {
        custom: {
          type: 'openai-compatible',
          name: 'Custom',
          models: { 'cheap-text': { name: 'Cheap text', vision: false } },
        },
      },
      mcpServers: {},
    },
    active: { provider: 'custom', model: 'cheap-text' },
  });

  const result = validatePromptAttachmentsForTarget({
    attachments: [
      {
        id: 'att-png',
        kind: 'image',
        name: 'reference.png',
        mimeType: 'image/png',
        size: 70,
        dataUrl: PNG_1X1_DATA_URL,
      },
    ],
    target,
  });

  expect(result.detail).toContain('Model "Cheap text (cheap-text)"');
  expect(result.detail).toContain('PNG/JPG/WebP');
  expect(result.detail).toContain('SVG files can still be used as source/context');
  expect(
    validatePromptAttachmentsForTarget({
      attachments: [
        {
          id: 'att-svg',
          kind: 'image',
          name: 'icon.svg',
          mimeType: 'image/svg+xml',
          size: 60,
          text: '<svg viewBox="0 0 1 1" />',
        },
      ],
      target,
    }),
  ).toEqual({ ok: true, warnings: [] });
});
