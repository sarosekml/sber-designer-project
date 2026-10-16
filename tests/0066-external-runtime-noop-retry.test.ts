import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import type { AgentStreamEvent } from '../services/api/src/agent/stream';
import { runCodexHandoff } from '../services/api/src/agent-runtimes/codex-runner';
import { snapshotRuntimeTargetFiles } from '../services/api/src/agent-runtimes/change-validation';
import { createAgentRun } from '../services/api/src/agent/run-record/manifest';
import { readRunManifest } from '../services/api/src/agent/run-record/store';
import { readAgentRunReceipts } from '../services/api/src/agent/run-record/receipts';
import { createExternalDesignSystemProposalTargetDefaults } from '../packages/shared-types/src';
import {
  resolveExternalRuntimeStageWatchdogMs,
  streamExternalRuntimeHandoff,
} from '../services/api/src/routes/chat-stream/external';

const MOCK_CLI = join(import.meta.dir, 'mocks', 'runtime-mock.ts');

test('external runtime stage watchdog accepts a positive test override', () => {
  expect(resolveExternalRuntimeStageWatchdogMs({ stageWatchdogMs: 25 })).toBe(25);
  expect(resolveExternalRuntimeStageWatchdogMs({ stageWatchdogMs: 0 })).toBe(10 * 60 * 1000);
  expect(resolveExternalRuntimeStageWatchdogMs({})).toBe(10 * 60 * 1000);
});

test('external runtime stage watchdog fails a hung stream without waiting for the default timeout', async () => {
  const written: Array<{ data: string }> = [];
  let aborted = false;

  await streamExternalRuntimeHandoff({
    stream: {
      writeSSE(input) {
        written.push(input);
      },
    },
    abortRuntime: () => {
      aborted = true;
    },
    runtimeLabel: 'Codex',
    workspacePath: null,
    agentRun: null,
    snapshots: [],
    canvasUrl: null,
    visualSnapshot: {
      status: 'unavailable',
      bytes: null,
      path: null,
      message: 'test',
    },
    stageWatchdogMs: 25,
    events: {
      [Symbol.asyncIterator]() {
        return {
          next: () => new Promise<IteratorResult<AgentStreamEvent>>(() => undefined),
        };
      },
    },
  });

  const events = written.map((item) => JSON.parse(item.data) as AgentStreamEvent);
  expect(aborted).toBe(true);
  expect(events).toEqual([
    {
      type: 'error',
      message: 'Codex stage watchdog timed out after 0s without a stream event.',
    },
  ]);
});

test('external runtime stage watchdog closes the active iterator and records runtime_timeout', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-watchdog-close-'));
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'codex-runtime',
    model: 'default',
    workspacePath: workspace,
  });
  let returned = false;
  const events: AsyncIterable<AgentStreamEvent> = {
    [Symbol.asyncIterator]() {
      return {
        next: () => new Promise<IteratorResult<AgentStreamEvent>>(() => undefined),
        return: async () => {
          returned = true;
          return { done: true, value: undefined };
        },
      };
    },
  };

  await streamExternalRuntimeHandoff({
    stream: {
      writeSSE() {
        return undefined;
      },
    },
    runtimeLabel: 'Codex',
    workspacePath: workspace,
    agentRun,
    snapshots: [],
    canvasUrl: null,
    visualSnapshot: {
      status: 'unavailable',
      bytes: null,
      path: null,
      message: 'test',
    },
    stageWatchdogMs: 25,
    events,
  });

  const manifest = await readRunManifest(workspace, agentRun.runId);

  expect(returned).toBe(true);
  expect(manifest?.status).toBe('failed');
  expect(manifest?.diagnostics?.errorCode).toBe('runtime_timeout');
});

test('external runtime stage watchdog aborts and kills a hung child process', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-watchdog-process-'));
  const pidFile = join(workspace, 'mock.pid');
  const controller = new AbortController();

  await streamExternalRuntimeHandoff({
    stream: {
      writeSSE() {
        return undefined;
      },
    },
    runtimeLabel: 'Codex',
    workspacePath: null,
    agentRun: null,
    snapshots: [],
    canvasUrl: null,
    visualSnapshot: {
      status: 'unavailable',
      bytes: null,
      path: null,
      message: 'test',
    },
    stageWatchdogMs: 250,
    abortRuntime: (reason) => controller.abort(reason),
    events: runCodexHandoff({
      command: MOCK_CLI,
      model: 'default',
      cwd: workspace,
      prompt: 'Generate the active screen.',
      signal: controller.signal,
      env: {
        SD_MOCK_TRACE: 'codex/minimal-success',
        SD_MOCK_HANG_MS: '5000',
        SD_MOCK_PID_FILE: pidFile,
      },
    }),
  });

  const pid = Number((await readFile(pidFile, 'utf8')).trim());
  expect(pid).toBeGreaterThan(0);
  await expectProcessGone(pid);
});

test('external runtime closes the first-pass iterator before focused retry', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-retry-close-'));
  const targetPath = 'src/screens/Admin.tsx';
  await mkdir(join(workspace, 'src/screens'), { recursive: true });
  await writeFile(
    join(workspace, targetPath),
    ['export function Admin() {', '  return <main>Empty</main>;', '}', ''].join('\n'),
  );
  const snapshots = await snapshotRuntimeTargetFiles(workspace, [targetPath]);
  let returned = false;
  const firstPass: AsyncIterable<AgentStreamEvent> = {
    [Symbol.asyncIterator]() {
      let doneYielded = false;
      return {
        next: async () => {
          if (doneYielded) return new Promise<IteratorResult<AgentStreamEvent>>(() => undefined);
          doneYielded = true;
          return { done: false, value: doneEvent('I only inspected files.') };
        },
        return: async () => {
          returned = true;
          return { done: true, value: undefined };
        },
      };
    },
  };

  await streamExternalRuntimeHandoff({
    stream: {
      writeSSE() {
        return undefined;
      },
    },
    runtimeLabel: 'Codex',
    workspacePath: workspace,
    agentRun: null,
    snapshots,
    canvasUrl: null,
    visualSnapshot: {
      status: 'unavailable',
      bytes: null,
      path: null,
      message: 'test',
    },
    events: firstPass,
    retryOnNoTargetChanges: () =>
      (async function* retryEvents(): AsyncGenerator<AgentStreamEvent> {
        await writeFile(
          join(workspace, targetPath),
          [
            'export function Admin() {',
            '  return <main data-sd-screen-root="true"><h1>Administration</h1></main>;',
            '}',
            '',
          ].join('\n'),
        );
        yield doneEvent('Implemented the screen.');
      })(),
  });

  expect(returned).toBe(true);
});

test('external runtime target diff receipt records untracked created files without git index', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-created-receipt-'));
  const targetPath = 'src/screens/NewGenerated.tsx';
  await mkdir(join(workspace, 'src/screens'), { recursive: true });
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'codex-runtime',
    model: 'default',
    workspacePath: workspace,
    activeScreen: {
      id: 'screen-new-generated',
      name: 'New generated',
      kind: 'story',
      implementationFilePath: targetPath,
    },
  });
  const snapshots = await snapshotRuntimeTargetFiles(workspace, [targetPath]);
  const written: Array<{ data: string }> = [];

  await streamExternalRuntimeHandoff({
    stream: {
      writeSSE(input) {
        written.push(input);
      },
    },
    runtimeLabel: 'Codex',
    workspacePath: workspace,
    agentRun,
    snapshots,
    canvasUrl: null,
    visualSnapshot: {
      status: 'unavailable',
      bytes: null,
      path: null,
      message: 'test',
    },
    events: (async function* createdFileEvents(): AsyncGenerator<AgentStreamEvent> {
      await writeFile(
        join(workspace, targetPath),
        [
          'export function NewGenerated() {',
          '  return <main data-sd-screen-root="true"><h1>Generated</h1></main>;',
          '}',
          '',
        ].join('\n'),
      );
      yield doneEvent('Created the screen file.');
    })(),
  });

  const receipts = await readAgentRunReceipts(workspace, agentRun.runId);
  const diffReceipt = receipts.find((receipt) => receipt.tool === 'external_runtime_target_diff');

  expect(diffReceipt).toMatchObject({
    status: 'ok',
    changedFiles: [targetPath],
  });
  expect(diffReceipt?.metadata).toMatchObject({
    targetFiles: [targetPath],
    changedTargets: [
      {
        path: targetPath,
        kind: 'created',
        beforeBytes: 0,
      },
    ],
  });
});

test('external design-system bootstrap stays needs_review until the required proposal bundle exists', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-ds-proposal-incomplete-'));
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'codex-runtime',
    model: 'default',
    workspacePath: workspace,
    userGoal:
      'Create Design.md for a new HTML project from https://pixso.net/app/editor/abc?node-id=1-2',
  });
  const proposal = createExternalDesignSystemProposalTargetDefaults({ proposalId: agentRun.runId });
  const snapshots = await snapshotRuntimeTargetFiles(workspace, [
    proposal.designSystemFilePath,
    proposal.tokensFilePath,
    proposal.componentsFilePath,
    proposal.extractionReportFilePath,
  ]);
  const written: Array<{ data: string }> = [];

  await streamExternalRuntimeHandoff({
    stream: {
      writeSSE(input) {
        written.push(input);
      },
    },
    runtimeLabel: 'Codex',
    workspacePath: workspace,
    agentRun,
    snapshots,
    canvasUrl: null,
    visualSnapshot: {
      status: 'unavailable',
      bytes: null,
      path: null,
      message: 'test',
    },
    events: (async function* events(): AsyncGenerator<AgentStreamEvent> {
      await mkdir(join(workspace, proposal.proposalRoot), { recursive: true });
      await writeFile(
        join(workspace, proposal.designSystemFilePath),
        ['# Imported design system', '', 'Evidence-backed tokens and components.', ''].join('\n'),
      );
      yield doneEvent('Wrote the proposal Design.md.');
    })(),
  });

  const manifest = await readRunManifest(workspace, agentRun.runId);
  const events = written.map((item) => JSON.parse(item.data) as AgentStreamEvent);
  const finalDone = events.findLast((event) => event.type === 'done');

  expect(manifest?.status).toBe('needs_review');
  expect(manifest?.summary).toContain('Design-system proposal incomplete');
  expect(finalDone).toMatchObject({
    type: 'done',
    runStatus: 'needs_review',
  });
  if (finalDone?.type !== 'done') throw new Error('missing done event');
  expect(finalDone.finalResponse.text).toContain(proposal.extractionReportFilePath);
});

test('external design-system bootstrap completes once required proposal files are written', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-ds-proposal-complete-'));
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'codex-runtime',
    model: 'default',
    workspacePath: workspace,
    userGoal:
      'Create Design.md for a new HTML project from https://pixso.net/app/editor/abc?node-id=1-2',
  });
  const proposal = createExternalDesignSystemProposalTargetDefaults({ proposalId: agentRun.runId });
  const snapshots = await snapshotRuntimeTargetFiles(workspace, [
    proposal.designSystemFilePath,
    proposal.tokensFilePath,
    proposal.componentsFilePath,
    proposal.extractionReportFilePath,
  ]);

  await streamExternalRuntimeHandoff({
    stream: {
      writeSSE() {
        return undefined;
      },
    },
    runtimeLabel: 'Codex',
    workspacePath: workspace,
    agentRun,
    snapshots,
    canvasUrl: null,
    visualSnapshot: {
      status: 'unavailable',
      bytes: null,
      path: null,
      message: 'test',
    },
    events: (async function* events(): AsyncGenerator<AgentStreamEvent> {
      await mkdir(join(workspace, proposal.proposalRoot), { recursive: true });
      await writeFile(
        join(workspace, proposal.designSystemFilePath),
        ['# Imported design system', '', 'Evidence-backed tokens and components.', ''].join('\n'),
      );
      await writeFile(
        join(workspace, proposal.extractionReportFilePath),
        ['# Extraction report', '', '- Source: Pixso link.', '- Confidence: medium.', ''].join(
          '\n',
        ),
      );
      yield doneEvent('Wrote the proposal bundle.');
    })(),
  });

  const manifest = await readRunManifest(workspace, agentRun.runId);

  expect(manifest?.status).toBe('complete');
});

test('external design-system bootstrap stays needs_review when required proposal files are empty', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-ds-proposal-empty-'));
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'codex-runtime',
    model: 'default',
    workspacePath: workspace,
    userGoal:
      'Create Design.md for a new HTML project from https://pixso.net/app/editor/abc?node-id=1-2',
  });
  const proposal = createExternalDesignSystemProposalTargetDefaults({ proposalId: agentRun.runId });
  const snapshots = await snapshotRuntimeTargetFiles(workspace, [
    proposal.designSystemFilePath,
    proposal.tokensFilePath,
    proposal.componentsFilePath,
    proposal.extractionReportFilePath,
  ]);

  await streamExternalRuntimeHandoff({
    stream: {
      writeSSE() {
        return undefined;
      },
    },
    runtimeLabel: 'Codex',
    workspacePath: workspace,
    agentRun,
    snapshots,
    canvasUrl: null,
    visualSnapshot: {
      status: 'unavailable',
      bytes: null,
      path: null,
      message: 'test',
    },
    events: (async function* events(): AsyncGenerator<AgentStreamEvent> {
      await mkdir(join(workspace, proposal.proposalRoot), { recursive: true });
      await writeFile(join(workspace, proposal.designSystemFilePath), '\n\n');
      await writeFile(
        join(workspace, proposal.extractionReportFilePath),
        ['# Extraction report', '', '- Source: Pixso link.', '- Confidence: low.', ''].join('\n'),
      );
      yield doneEvent('Wrote an empty proposal file.');
    })(),
  });

  const manifest = await readRunManifest(workspace, agentRun.runId);

  expect(manifest?.status).toBe('needs_review');
  expect(manifest?.summary).toContain('empty required proposal file');
  expect(manifest?.summary).toContain(proposal.designSystemFilePath);
});

test('external runtime fails when the Storybook wrapper points at a missing implementation export', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-story-impl-gate-'));
  const targetPath = 'src/screens/DealPage.tsx';
  const storyPath = 'src/stories/screens/DealPage.stories.tsx';
  await mkdir(join(workspace, 'src/screens'), { recursive: true });
  await mkdir(join(workspace, 'src/stories/screens'), { recursive: true });
  await writeFile(
    join(workspace, targetPath),
    [
      'export function DealPage() {',
      '  return <main data-sd-screen-root="true">Deal page</main>;',
      '}',
      '',
    ].join('\n'),
  );
  await writeFile(
    join(workspace, storyPath),
    [
      "import { DealPage } from '../../screens/DealPage';",
      "export default { title: 'Screens/Deal Page', component: DealPage };",
      'export const Default = {};',
      '',
    ].join('\n'),
  );
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'codex-runtime',
    model: 'default',
    workspacePath: workspace,
    activeScreen: {
      id: 'screen-deal-page',
      name: 'Deal page',
      kind: 'story',
      storyId: 'screens-deal-page--default',
      filePath: storyPath,
      implementationFilePath: targetPath,
    },
  });
  const snapshots = await snapshotRuntimeTargetFiles(workspace, [targetPath]);
  const written: Array<{ data: string }> = [];

  await streamExternalRuntimeHandoff({
    stream: {
      writeSSE(input) {
        written.push(input);
      },
    },
    runtimeLabel: 'Codex',
    workspacePath: workspace,
    agentRun,
    snapshots,
    canvasUrl: null,
    visualSnapshot: {
      status: 'unavailable',
      bytes: null,
      path: null,
      message: 'test',
    },
    events: (async function* events(): AsyncGenerator<AgentStreamEvent> {
      await writeFile(
        join(workspace, targetPath),
        [
          'export function DealPageRenamed() {',
          '  return <main data-sd-screen-root="true">Deal page</main>;',
          '}',
          '',
        ].join('\n'),
      );
      yield doneEvent('Renamed the implementation export.');
    })(),
  });

  const events = written.map(
    (item) =>
      JSON.parse(item.data) as AgentStreamEvent & {
        runStatus?: string;
        runSummary?: string;
        delta?: string;
      },
  );
  const finalDone = events.findLast((event) => event.type === 'done');
  const gateNotice = events.find(
    (event) =>
      event.type === 'text-delta' && event.delta?.includes('Story implementation invariant failed'),
  );
  const receipts = await readAgentRunReceipts(workspace, agentRun.runId);
  const invariantReceipt = receipts.find(
    (receipt) => receipt.tool === 'runtime_story_implementation_invariant',
  );
  const diffReceipt = receipts.find((receipt) => receipt.tool === 'external_runtime_target_diff');

  expect(gateNotice).toBeTruthy();
  expect(finalDone?.runStatus).toBe('failed');
  expect(finalDone?.runSummary).toContain('DealPage');
  expect(invariantReceipt).toMatchObject({
    status: 'error',
    summary: expect.stringContaining('DealPage'),
  });
  expect(diffReceipt).toMatchObject({
    status: 'error',
    metadata: {
      storyImplementation: {
        status: 'broken',
        reasonCode: 'impl_export_missing',
      },
    },
  });
});

test('external runtime gets one focused retry when the first pass changes no target files', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-retry-'));
  const targetPath = 'src/screens/Admin.tsx';
  await mkdir(join(workspace, 'src/screens'), { recursive: true });
  await writeFile(
    join(workspace, targetPath),
    ['export function Admin() {', '  return <main>Empty</main>;', '}', ''].join('\n'),
  );
  const snapshots = await snapshotRuntimeTargetFiles(workspace, [targetPath]);
  const written: Array<{ data: string }> = [];
  let retryCalls = 0;

  await streamExternalRuntimeHandoff({
    stream: {
      writeSSE(input) {
        written.push(input);
      },
    },
    runtimeLabel: 'Codex',
    workspacePath: workspace,
    agentRun: null,
    snapshots,
    canvasUrl: null,
    visualSnapshot: {
      status: 'unavailable',
      bytes: null,
      path: null,
      message: 'test',
    },
    events: asyncGenerator([doneEvent('I only inspected files.')]),
    retryOnNoTargetChanges: () => {
      retryCalls += 1;
      return (async function* retryEvents(): AsyncGenerator<AgentStreamEvent> {
        await writeFile(
          join(workspace, targetPath),
          [
            'export function Admin() {',
            '  return <main data-sd-screen-root="true"><h1>Administration</h1></main>;',
            '}',
            '',
          ].join('\n'),
        );
        yield doneEvent('Implemented the screen.');
      })();
    },
  });

  const events = written.map(
    (item) =>
      JSON.parse(item.data) as AgentStreamEvent & {
        runStatus?: string;
      },
  );
  const retryNotice = events.find(
    (event) => event.type === 'text-delta' && event.delta.includes('Retrying'),
  );
  const finalDone = events.findLast((event) => event.type === 'done');

  expect(retryCalls).toBe(1);
  expect(retryNotice).toBeTruthy();
  expect(finalDone?.runStatus).not.toBe('failed');
});

test('external runtime completes without retry when target already contains a rendered screen root', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-existing-target-'));
  const targetPath = 'src/screens/Admin.tsx';
  await mkdir(join(workspace, 'src/screens'), { recursive: true });
  await writeFile(
    join(workspace, targetPath),
    [
      'export function Admin() {',
      '  return <main data-sd-screen-root="true"><h1>Administration</h1></main>;',
      '}',
      '',
    ].join('\n'),
  );
  const snapshots = await snapshotRuntimeTargetFiles(workspace, [targetPath]);
  const written: Array<{ data: string }> = [];
  let retryCalls = 0;

  await streamExternalRuntimeHandoff({
    stream: {
      writeSSE(input) {
        written.push(input);
      },
    },
    runtimeLabel: 'Codex',
    workspacePath: workspace,
    agentRun: null,
    snapshots,
    canvasUrl: null,
    visualSnapshot: {
      status: 'unavailable',
      bytes: null,
      path: null,
      message: 'test',
    },
    events: asyncGenerator([doneEvent('The screen is already implemented.')]),
    retryOnNoTargetChanges: () => {
      retryCalls += 1;
      return asyncGenerator([doneEvent('Should not run.')]);
    },
  });

  const events = written.map(
    (item) =>
      JSON.parse(item.data) as AgentStreamEvent & {
        runStatus?: string;
        runSummary?: string;
      },
  );
  const finalDone = events.findLast((event) => event.type === 'done');

  expect(retryCalls).toBe(0);
  expect(finalDone?.runStatus).toBe('complete');
  expect(finalDone?.runSummary).toContain('Existing generated screen is already applied');
});

test('external runtime retries when unchanged target only contains the blank screen template', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-blank-template-target-'));
  const targetPath = 'src/screens/Admin.tsx';
  await mkdir(join(workspace, 'src/screens'), { recursive: true });
  await writeFile(
    join(workspace, targetPath),
    [
      'export function Admin() {',
      '  return (',
      '    <main data-sd-screen-root="true">',
      '      <section data-sd-empty-canvas="true"><div /></section>',
      '    </main>',
      '  );',
      '}',
      '',
    ].join('\n'),
  );
  const snapshots = await snapshotRuntimeTargetFiles(workspace, [targetPath]);
  const written: Array<{ data: string }> = [];
  let retryCalls = 0;

  await streamExternalRuntimeHandoff({
    stream: {
      writeSSE(input) {
        written.push(input);
      },
    },
    runtimeLabel: 'Codex',
    workspacePath: workspace,
    agentRun: null,
    snapshots,
    canvasUrl: null,
    visualSnapshot: {
      status: 'unavailable',
      bytes: null,
      path: null,
      message: 'test',
    },
    events: asyncGenerator([doneEvent('The screen is already implemented.')]),
    retryOnNoTargetChanges: () => {
      retryCalls += 1;
      return (async function* retryEvents(): AsyncGenerator<AgentStreamEvent> {
        await writeFile(
          join(workspace, targetPath),
          [
            'export function Admin() {',
            '  return <main data-sd-screen-root="true"><h1>Administration</h1></main>;',
            '}',
            '',
          ].join('\n'),
        );
        yield doneEvent('Implemented the screen.');
      })();
    },
  });

  const events = written.map(
    (item) =>
      JSON.parse(item.data) as AgentStreamEvent & {
        runStatus?: string;
        runSummary?: string;
      },
  );
  const retryNotice = events.find(
    (event) => event.type === 'text-delta' && event.delta?.includes('Retrying'),
  );
  const finalDone = events.findLast((event) => event.type === 'done');

  expect(retryCalls).toBe(1);
  expect(retryNotice).toBeTruthy();
  expect(finalDone?.runStatus).toBe('complete');
  expect(finalDone?.runSummary).not.toContain('Existing generated screen is already applied');
});

test('image-to-screen no-op is classified as no_visible_write before focused retry', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-first-write-'));
  const targetPath = 'src/screens/ImageScreen.tsx';
  await mkdir(join(workspace, 'src/screens'), { recursive: true });
  await writeFile(
    join(workspace, targetPath),
    [
      'export function ImageScreen() {',
      '  return (',
      '    <main data-sd-screen-root="true">',
      '      <section data-sd-empty-canvas="true"><div /></section>',
      '    </main>',
      '  );',
      '}',
      '',
    ].join('\n'),
  );
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'claude-code-runtime',
    model: 'opus',
    workspacePath: workspace,
    userGoal: 'Сделай экран по приложенной картинке.',
    activeScreen: {
      id: 'screen-image',
      name: 'Image screen',
      kind: 'story',
      implementationFilePath: targetPath,
    },
  });
  const snapshots = await snapshotRuntimeTargetFiles(workspace, [targetPath]);
  const written: Array<{ data: string }> = [];
  let retryCalls = 0;
  let retryReason = '';

  await streamExternalRuntimeHandoff({
    stream: {
      writeSSE(input) {
        written.push(input);
      },
    },
    runtimeLabel: 'Claude Code CLI',
    workspacePath: workspace,
    agentRun,
    snapshots,
    canvasUrl: null,
    visualSnapshot: {
      status: 'unavailable',
      bytes: null,
      path: null,
      message: 'test',
    },
    componentPack: {
      status: 'weak',
      source: 'design-index',
      stale: false,
      taskKind: 'image-to-screen',
      candidates: [],
      diagnostics: ['test pack'],
    },
    events: asyncGenerator([doneEvent('I inspected the image and project conventions.')]),
    retryOnNoTargetChanges: ({ summary }) => {
      retryCalls += 1;
      retryReason = summary;
      return (async function* retryEvents(): AsyncGenerator<AgentStreamEvent> {
        await writeFile(
          join(workspace, targetPath),
          [
            'export function ImageScreen() {',
            '  return <main data-sd-screen-root="true"><h1>Generated from image</h1></main>;',
            '}',
            '',
          ].join('\n'),
        );
        yield doneEvent('Implemented the screen after focused retry.');
      })();
    },
  });

  const events = written.map(
    (item) =>
      JSON.parse(item.data) as AgentStreamEvent & {
        runStatus?: string;
        runSummary?: string;
        delta?: string;
      },
  );
  const retryNotice = events.find(
    (event) => event.type === 'text-delta' && event.delta?.includes('no_visible_write'),
  );
  const finalDone = events.findLast((event) => event.type === 'done');

  expect(retryCalls).toBe(1);
  expect(retryReason).toContain('no_visible_write');
  expect(retryNotice?.delta).toContain('first visible implementation write');
  expect(finalDone?.runStatus).toBe('complete');
});

test('external runtime runs automatic repair when Storybook render probe fails', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-render-repair-'));
  const targetPath = 'src/screens/Admin.tsx';
  const storyPath = 'src/stories/screens/Admin.stories.tsx';
  await mkdir(join(workspace, 'src/screens'), { recursive: true });
  await mkdir(join(workspace, 'src/stories/screens'), { recursive: true });
  await writeFile(
    join(workspace, targetPath),
    ['export function Admin() {', '  return <main>Empty</main>;', '}', ''].join('\n'),
  );
  await writeFile(
    join(workspace, storyPath),
    [
      "import { Admin } from '../../screens/Admin';",
      "export default { title: 'screens/Admin', component: Admin };",
      'export const Default = {};',
      '',
    ].join('\n'),
  );
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'codex-runtime',
    model: 'default',
    workspacePath: workspace,
    activeScreen: {
      id: 'screen-admin',
      name: 'Admin',
      kind: 'story',
      storyId: 'screens-admin--default',
      filePath: storyPath,
      implementationFilePath: targetPath,
    },
  });
  const snapshots = await snapshotRuntimeTargetFiles(workspace, [targetPath]);
  const written: Array<{ data: string }> = [];
  const previousFetch = globalThis.fetch;
  const previousChrome = process.env.SBER_DESIGNER_CHROME_DEBUGGING_URL;
  let renderOk = false;
  let repairCalls = 0;
  delete process.env.SBER_DESIGNER_CHROME_DEBUGGING_URL;
  globalThis.fetch = async (input) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('/index.json')) {
      return new Response(
        JSON.stringify({
          entries: {
            'screens-admin--default': {
              id: 'screens-admin--default',
              type: 'story',
            },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    return new Response(
      renderOk
        ? '<main data-sd-screen-root="true"><h1>Administration</h1></main>'
        : '<pre>Cannot find module ./MissingWidget</pre>',
      { status: 200, headers: { 'content-type': 'text/html' } },
    );
  };

  try {
    await streamExternalRuntimeHandoff({
      stream: {
        writeSSE(input) {
          written.push(input);
        },
      },
      runtimeLabel: 'Codex',
      workspacePath: workspace,
      agentRun,
      snapshots,
      canvasUrl: 'http://storybook.local/iframe.html?id=admin',
      visualSnapshot: {
        status: 'unavailable',
        bytes: null,
        path: null,
        message: 'test',
      },
      events: (async function* initialEvents(): AsyncGenerator<AgentStreamEvent> {
        await writeFile(
          join(workspace, targetPath),
          [
            "import { MissingWidget } from './MissingWidget';",
            'export function Admin() {',
            '  return <main data-sd-screen-root="true"><MissingWidget /></main>;',
            '}',
            '',
          ].join('\n'),
        );
        yield doneEvent('Implemented the screen with a missing import.');
      })(),
      repairOnRenderFailure: ({ reason, changedFiles, attempt, maxAttempts }) => {
        repairCalls += 1;
        expect(reason).toContain('Cannot find module');
        expect(changedFiles).toContain(targetPath);
        expect(attempt).toBe(1);
        expect(maxAttempts).toBe(2);
        return (async function* repairEvents(): AsyncGenerator<AgentStreamEvent> {
          renderOk = true;
          await writeFile(
            join(workspace, targetPath),
            [
              'export function Admin() {',
              '  return <main data-sd-screen-root="true"><h1>Administration</h1></main>;',
              '}',
              '',
            ].join('\n'),
          );
          yield doneEvent('Repaired the screen render.');
        })();
      },
    });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousChrome === undefined) {
      delete process.env.SBER_DESIGNER_CHROME_DEBUGGING_URL;
    } else {
      process.env.SBER_DESIGNER_CHROME_DEBUGGING_URL = previousChrome;
    }
  }

  const events = written.map(
    (item) =>
      JSON.parse(item.data) as AgentStreamEvent & {
        runStatus?: string;
        delta?: string;
      },
  );
  const repairNotice = events.find(
    (event) => event.type === 'text-delta' && event.delta?.includes('automatic repair pass 1/2'),
  );
  const finalDone = events.findLast((event) => event.type === 'done');

  expect(repairCalls).toBe(1);
  expect(repairNotice).toBeTruthy();
  expect(finalDone?.runStatus).toBe('complete');
});

test('external runtime done event includes run manifest metadata for chat persistence', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-done-metadata-'));
  const targetPath = 'src/screens/Admin.tsx';
  await mkdir(join(workspace, 'src/screens'), { recursive: true });
  await writeFile(
    join(workspace, targetPath),
    ['export function Admin() {', '  return <main>Empty</main>;', '}', ''].join('\n'),
  );
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'opencode',
    model: 'deepseek-v4-flash-free',
    workspacePath: workspace,
    activeScreen: {
      id: 'screen-admin',
      name: 'Admin',
      kind: 'story',
      storyId: 'screens-admin--default',
      implementationFilePath: targetPath,
    },
  });
  const snapshots = await snapshotRuntimeTargetFiles(workspace, [targetPath]);
  const written: Array<{ data: string }> = [];

  await streamExternalRuntimeHandoff({
    stream: {
      writeSSE(input) {
        written.push(input);
      },
    },
    runtimeLabel: 'OpenCode',
    workspacePath: workspace,
    agentRun,
    snapshots,
    canvasUrl: null,
    visualSnapshot: {
      status: 'unavailable',
      bytes: null,
      path: null,
      message: 'test',
    },
    events: (async function* events(): AsyncGenerator<AgentStreamEvent> {
      await writeFile(
        join(workspace, targetPath),
        [
          'export function Admin() {',
          '  return <main data-sd-screen-root="true"><h1>Administration</h1></main>;',
          '}',
          '',
        ].join('\n'),
      );
      yield doneEvent('Implemented the screen.');
    })(),
  });

  const events = written.map(
    (item) =>
      JSON.parse(item.data) as AgentStreamEvent & {
        runId?: string;
        runManifestPath?: string;
      },
  );
  const finalDone = events.findLast((event) => event.type === 'done');

  expect(finalDone?.runId).toBe(agentRun.runId);
  expect(finalDone?.runManifestPath).toBe(
    `.sber-designer/runs/${agentRun.runId}/run-manifest.json`,
  );
});

async function* asyncGenerator(events: AgentStreamEvent[]): AsyncGenerator<AgentStreamEvent> {
  for (const event of events) yield event;
}

function doneEvent(text: string): Extract<AgentStreamEvent, { type: 'done' }> {
  return {
    type: 'done',
    transcript: [{ role: 'assistant', content: text }],
    iterations: 1,
    truncated: false,
    hadErrors: false,
    stoppedAfterPermissionDeny: false,
    finalResponse: {
      text,
      provider: 'codex-runtime',
      model: 'default',
      finishReason: 'stop',
    },
  };
}

async function expectProcessGone(pid: number): Promise<void> {
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  expect(isProcessAlive(pid)).toBe(false);
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
