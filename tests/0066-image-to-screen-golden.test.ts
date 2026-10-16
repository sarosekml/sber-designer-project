import { mkdir, readFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import type { SberDesignerConfig } from '@sber-designer/llm-gateway';

import {
  resolveAgentModelTarget,
  type AgentModelTarget,
} from '../services/api/src/agent-model-target';
import { createAgentRun } from '../services/api/src/agent/run-record/manifest';
import { type AgentRunTargetCapabilities } from '../services/api/src/agent/run-record/types';
import { buildCodexRunArgs } from '../services/api/src/agent-runtimes/codex-runner';
import {
  formatPromptAttachmentReferences,
  recordPromptAttachments,
  validatePromptAttachmentsForTarget,
} from '../services/api/src/prompt-attachments';
import { transcriptRunNotice } from '../apps/web/src/lib/agent-run-status';

const pngAttachment = {
  id: 'att-png',
  kind: 'image' as const,
  name: 'reference.png',
  mimeType: 'image/png',
  size: 68,
  dataUrl:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
};

test('codex-runtime/default with PNG records attachment evidence and passes image paths to Codex', async () => {
  const workspace = await createWorkspace('sd-0066-codex-image-');
  const target = resolveAgentModelTarget({
    config: testConfig('codex-runtime', 'default'),
    active: { provider: 'codex-runtime', model: 'default' },
  });

  const validation = validatePromptAttachmentsForTarget({
    target,
    attachments: [pngAttachment],
  });
  expect(validation.ok).toBe(true);

  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'codex-runtime',
    model: 'default',
    runtimeKind: 'cli',
    targetCapabilities: targetCapabilities(target),
    workspacePath: workspace,
    userGoal: 'Draw the attached screen.',
    activeScreen: {
      id: 'screen-admin',
      name: 'Administration',
      kind: 'story',
      filePath: 'src/stories/screens/Administration.stories.tsx',
      implementationFilePath: 'src/screens/Administration.tsx',
    },
  });
  const evidence = await recordPromptAttachments({
    workspacePath: workspace,
    runId: run.runId,
    attachments: [pngAttachment],
  });

  const imagePaths = evidence
    .filter((attachment) => attachment.mimeType !== 'image/svg+xml')
    .map((attachment) => attachment.runPath);
  const args = buildCodexRunArgs('default', workspace, imagePaths);

  expect(args).toContain('--image');
  expect(args[args.indexOf('--image') + 1]).toBe(evidence[0]!.runPath);
  expect(args).not.toContain('--model');
  expect(formatPromptAttachmentReferences(evidence)).toContain('## Attached Image References');
  expect(formatPromptAttachmentReferences(evidence)).toContain('01-reference.png');
});

test('API vision model with PNG passes target validation and writes attachment evidence', async () => {
  const workspace = await createWorkspace('sd-0066-api-vision-');
  const target = resolveAgentModelTarget({
    config: testConfig('api-provider', 'vision-model'),
    active: { provider: 'api-provider', model: 'vision-model' },
  });
  const validation = validatePromptAttachmentsForTarget({
    target,
    attachments: [pngAttachment],
  });

  expect(target.imageInputMode).toBe('inline');
  expect(validation.ok).toBe(true);

  const run = await createAgentRun({
    route: 'chat',
    user: 'test-user',
    provider: 'api-provider',
    model: 'vision-model',
    runtimeKind: 'api',
    targetCapabilities: targetCapabilities(target),
    workspacePath: workspace,
    userGoal: 'Recreate the attached screen.',
  });
  const evidence = await recordPromptAttachments({
    workspacePath: workspace,
    runId: run.runId,
    attachments: [pngAttachment],
  });

  const manifest = JSON.parse(
    await readFile(
      join(workspace, '.sber-designer', 'runs', run.runId, 'run-manifest.json'),
      'utf8',
    ),
  );
  expect(evidence).toHaveLength(1);
  expect(manifest.promptAttachments[0].runPath).toBe(evidence[0]!.runPath);
});

test('API text-only model with PNG is a preflight rejection, not an iteration limit', () => {
  const target = resolveAgentModelTarget({
    config: testConfig('api-provider', 'text-model'),
    active: { provider: 'api-provider', model: 'text-model' },
  });
  const validation = validatePromptAttachmentsForTarget({
    target,
    attachments: [pngAttachment],
  });
  const notice = transcriptRunNotice({
    runStatus: 'preflight_rejected',
    truncated: false,
    iterations: 0,
  });

  expect(validation.ok).toBe(false);
  expect(validation.code).toBe('model_cannot_read_images');
  expect(notice?.title).toBe('Request rejected before agent start');
  expect(notice?.action).toBeNull();
});

test('SVG-only image context passes text-only validation and renders source excerpt', async () => {
  const workspace = await createWorkspace('sd-0066-svg-');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>Admin</text></svg>';
  const target = resolveAgentModelTarget({
    config: testConfig('api-provider', 'text-model'),
    active: { provider: 'api-provider', model: 'text-model' },
  });
  const attachment = {
    id: 'att-svg',
    kind: 'image' as const,
    name: 'reference.svg',
    mimeType: 'image/svg+xml',
    size: svg.length,
    dataUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
  };
  const validation = validatePromptAttachmentsForTarget({
    target,
    attachments: [attachment],
  });
  const run = await createAgentRun({
    route: 'chat',
    user: 'test-user',
    provider: 'api-provider',
    model: 'text-model',
    runtimeKind: 'api',
    targetCapabilities: targetCapabilities(target),
    workspacePath: workspace,
    userGoal: 'Use the SVG as reference.',
  });
  const evidence = await recordPromptAttachments({
    workspacePath: workspace,
    runId: run.runId,
    attachments: [attachment],
  });
  const references = formatPromptAttachmentReferences(evidence);

  expect(validation.ok).toBe(true);
  expect(references).toContain('svgSourceExcerpt');
  expect(references).toContain('<text>Admin</text>');
});

async function createWorkspace(prefix: string): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), prefix));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  return workspace;
}

function testConfig(provider: string, model: string): SberDesignerConfig {
  return {
    agent: {
      default: { provider, model },
    },
    provider: {
      'api-provider': {
        type: 'mock',
        name: 'API Provider',
        models: {
          'text-model': { name: 'Text model', vision: false },
          'vision-model': { name: 'Vision model', vision: true },
        },
      },
    },
    mcpServers: {},
  };
}

function targetCapabilities(target: AgentModelTarget): AgentRunTargetCapabilities {
  return {
    targetKind: target.kind,
    runtimeKind: target.runtimeKind,
    imageInputMode: target.imageInputMode,
    rasterImageInput: target.capabilities.rasterImageInput,
    svgSourceInput: target.capabilities.svgSourceInput,
    nativeFileInput: target.capabilities.nativeFileInput,
    projectMcpTools: target.capabilities.projectMcpTools,
    ownMcpConfig: target.capabilities.ownMcpConfig,
  };
}
