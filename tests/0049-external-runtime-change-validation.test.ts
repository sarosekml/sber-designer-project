import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import {
  checkRuntimeStoryImplementationInvariant,
  checkRuntimeStoryIdentity,
  classifyRuntimeVisibleAcceptance,
  compareRuntimeScreenshotBytes,
  formatRuntimeCompletionNotice,
  formatRuntimeStoryIdentityNotice,
  summarizeRuntimeTargetChanges,
  snapshotRuntimeTargetFiles,
} from '../services/api/src/agent-runtimes/change-validation';

test('detects direct external runtime edits to untracked target files', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-diff-'));
  await mkdir(join(workspace, 'src/screens'), { recursive: true });
  await writeFile(join(workspace, 'src/screens/PaymentDetail.tsx'), 'export const A = 1;\n');

  const snapshots = await snapshotRuntimeTargetFiles(workspace, ['src/screens/PaymentDetail.tsx']);
  await writeFile(join(workspace, 'src/screens/PaymentDetail.tsx'), 'export const A = 2;\n');

  const summary = await summarizeRuntimeTargetChanges(workspace, snapshots);

  expect(summary.changedFiles).toEqual(['src/screens/PaymentDetail.tsx']);
  expect(summary.changedTargets[0]).toMatchObject({
    path: 'src/screens/PaymentDetail.tsx',
    kind: 'modified',
    changedLineCount: 1,
    sourceRisk: 'low_signal',
  });
});

test('detects direct external runtime creation of allowed target files', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-create-'));
  await mkdir(join(workspace, 'src/screens'), { recursive: true });

  const snapshots = await snapshotRuntimeTargetFiles(workspace, ['src/screens/NewScreen.tsx']);
  await writeFile(
    join(workspace, 'src/screens/NewScreen.tsx'),
    'export const NewScreen = () => null;\n',
  );

  const summary = await summarizeRuntimeTargetChanges(workspace, snapshots);

  expect(summary.changedFiles).toEqual(['src/screens/NewScreen.tsx']);
  expect(summary.changedTargets[0]).toMatchObject({
    path: 'src/screens/NewScreen.tsx',
    kind: 'created',
    sourceRisk: 'substantial',
  });
});

test('reports no changed target files when a runtime only talks', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-noop-'));
  await mkdir(join(workspace, 'src/screens'), { recursive: true });
  await writeFile(join(workspace, 'src/screens/PaymentDetail.tsx'), 'export const A = 1;\n');

  const snapshots = await snapshotRuntimeTargetFiles(workspace, ['src/screens/PaymentDetail.tsx']);

  const summary = await summarizeRuntimeTargetChanges(workspace, snapshots);

  expect(summary.changedFiles).toEqual([]);
  expect(summary.changedTargets).toEqual([]);
  expect(await readFile(join(workspace, 'src/screens/PaymentDetail.tsx'), 'utf8')).toBe(
    'export const A = 1;\n',
  );
});

test('accepts tiny source-only target edits with warning instead of needs_review', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-low-signal-'));
  await mkdir(join(workspace, 'src/screens'), { recursive: true });
  await writeFile(join(workspace, 'src/screens/PaymentDetail.tsx'), 'export const A = 1;\n');

  const snapshots = await snapshotRuntimeTargetFiles(workspace, ['src/screens/PaymentDetail.tsx']);
  await writeFile(join(workspace, 'src/screens/PaymentDetail.tsx'), 'export const A = 2;\n');

  const summary = await summarizeRuntimeTargetChanges(workspace, snapshots);
  const acceptance = classifyRuntimeVisibleAcceptance(summary);

  expect(acceptance.status).toBe('accepted');
  expect(acceptance.reason).toContain('low-signal');
});

test('accepts substantial target edits even when screenshot diff is unavailable', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-substantial-'));
  await mkdir(join(workspace, 'src/screens'), { recursive: true });
  await writeFile(
    join(workspace, 'src/screens/PaymentDetail.tsx'),
    ['export function PaymentDetail() {', '  return <main>Old</main>;', '}', ''].join('\n'),
  );

  const snapshots = await snapshotRuntimeTargetFiles(workspace, ['src/screens/PaymentDetail.tsx']);
  await writeFile(
    join(workspace, 'src/screens/PaymentDetail.tsx'),
    [
      'export function PaymentDetail() {',
      '  return <main><section><h1>Payment overview</h1><p>Ready for review</p></section></main>;',
      '}',
      '',
    ].join('\n'),
  );

  const summary = await summarizeRuntimeTargetChanges(workspace, snapshots);
  const acceptance = classifyRuntimeVisibleAcceptance(summary);

  expect(acceptance.status).toBe('accepted');
  expect(acceptance.reason).toContain('substantial');
});

test('accepts substantial target edits with warning when render validation is unavailable', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-render-required-'));
  await mkdir(join(workspace, 'src/screens'), { recursive: true });
  await writeFile(
    join(workspace, 'src/screens/PaymentDetail.tsx'),
    ['export function PaymentDetail() {', '  return <main>Old</main>;', '}', ''].join('\n'),
  );

  const snapshots = await snapshotRuntimeTargetFiles(workspace, ['src/screens/PaymentDetail.tsx']);
  await writeFile(
    join(workspace, 'src/screens/PaymentDetail.tsx'),
    [
      'export function PaymentDetail() {',
      '  return <main><section><h1>Payment overview</h1><p>Ready for review</p></section></main>;',
      '}',
      '',
    ].join('\n'),
  );

  const summary = await summarizeRuntimeTargetChanges(workspace, snapshots);
  const acceptance = classifyRuntimeVisibleAcceptance(summary, {
    visualDiff: compareRuntimeScreenshotBytes(null, null),
    requireVisualEvidence: true,
  });

  expect(acceptance.status).toBe('accepted');
  expect(acceptance.reason).toContain('render validation was unavailable');
  expect(acceptance.reason).toContain('Before/after screenshots were not both available');
});

test('compares before and after screenshot bytes against the visible-change threshold', () => {
  const unchanged = compareRuntimeScreenshotBytes(
    Buffer.from([1, 2, 3, 4]),
    Buffer.from([1, 2, 3, 5]),
    0.5,
  );
  const changed = compareRuntimeScreenshotBytes(
    Buffer.from([1, 2, 3, 4]),
    Buffer.from([9, 8, 7, 6]),
    0.5,
  );

  expect(unchanged.status).toBe('unchanged');
  expect(changed.status).toBe('changed');
});

test('failed render health overrides changed screenshot acceptance', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-render-failed-'));
  await mkdir(join(workspace, 'src/screens'), { recursive: true });
  await writeFile(
    join(workspace, 'src/screens/RiskMetrics.tsx'),
    ['export function RiskMetrics() {', '  return <main>Old</main>;', '}', ''].join('\n'),
  );

  const snapshots = await snapshotRuntimeTargetFiles(workspace, ['src/screens/RiskMetrics.tsx']);
  await writeFile(
    join(workspace, 'src/screens/RiskMetrics.tsx'),
    [
      'export function RiskMetrics() {',
      '  return <main><section><h1>Администрирование</h1></section></main>;',
      '}',
      '',
    ].join('\n'),
  );

  const summary = await summarizeRuntimeTargetChanges(workspace, snapshots);
  const visualDiff = compareRuntimeScreenshotBytes(
    Buffer.from([1, 2, 3, 4]),
    Buffer.from([9, 8, 7, 6]),
    0.5,
  );

  const acceptance = classifyRuntimeVisibleAcceptance(summary, {
    visualDiff,
    renderHealth: {
      status: 'failed',
      reason:
        "Canvas runtime error: Cannot find module '@/components/atoms/Header/DashboardGroupHeader'",
    },
  });

  expect(acceptance.status).toBe('failed');
  expect(acceptance.reason).toContain('Cannot find module');
});

test('detects active Storybook id drift after an external runtime renames the story title', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-story-id-'));
  await mkdir(join(workspace, 'src/stories/screens/2026-05-21'), { recursive: true });
  await writeFile(
    join(workspace, 'src/stories/screens/2026-05-21/NewScreenmpfcd493.stories.tsx'),
    [
      "import type { Meta, StoryObj } from '@storybook/react-vite';",
      "import { NewScreenmpfcd493 } from '../../../screens/2026-05-21/NewScreenmpfcd493';",
      '',
      'const meta = {',
      "  title: 'Screens/2026-05-21/Structured credit deal mpfcd493',",
      '  component: NewScreenmpfcd493,',
      '} satisfies Meta<typeof NewScreenmpfcd493>;',
      '',
      'export default meta;',
      'type Story = StoryObj<typeof meta>;',
      '',
      'export const Default: Story = {',
      "  name: 'Structured credit deal',",
      '};',
      '',
    ].join('\n'),
  );

  const identity = await checkRuntimeStoryIdentity(workspace, {
    storyId: 'screens-2026-05-21-new-screen-mpfcd493--default',
    filePath: 'src/stories/screens/2026-05-21/NewScreenmpfcd493.stories.tsx',
  });

  expect(identity.status).toBe('changed');
  expect(identity.expectedStoryId).toBe('screens-2026-05-21-new-screen-mpfcd493--default');
  expect(identity.actualStoryIds).toContain(
    'screens-2026-05-21-structured-credit-deal-mpfcd493--default',
  );
  expect(formatRuntimeStoryIdentityNotice(identity)).toContain('Storybook id changed');
});

test('detects stale story imports when implementation export was renamed', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-story-impl-invariant-'));
  await mkdir(join(workspace, 'src/stories/screens/2026-07-01'), { recursive: true });
  await mkdir(join(workspace, 'src/screens/2026-07-01'), { recursive: true });
  await writeFile(
    join(workspace, 'src/stories/screens/2026-07-01/DealPage.stories.tsx'),
    [
      "import type { Meta, StoryObj } from '@storybook/react-vite';",
      "import { DealPage } from '../../../screens/2026-07-01/DealPage';",
      '',
      "const meta = { title: 'Screens/2026-07-01/Deal Page', component: DealPage } satisfies Meta<typeof DealPage>;",
      'export default meta;',
      'type Story = StoryObj<typeof meta>;',
      'export const Default: Story = {};',
      '',
    ].join('\n'),
  );
  await writeFile(
    join(workspace, 'src/screens/2026-07-01/DealPage.tsx'),
    [
      'export function DealPageRenamed() {',
      '  return <main data-sd-screen-root="true">Deal page</main>;',
      '}',
      '',
    ].join('\n'),
  );

  const invariant = await checkRuntimeStoryImplementationInvariant(workspace, {
    storyId: 'screens-2026-07-01-deal-page--default',
    filePath: 'src/stories/screens/2026-07-01/DealPage.stories.tsx',
    implementationFilePath: 'src/screens/2026-07-01/DealPage.tsx',
  });

  expect(invariant.status).toBe('broken');
  expect(invariant.reasonCode).toBe('impl_export_missing');
  expect(invariant.reason).toContain('DealPage');
});

test('keeps active Storybook id valid when only the implementation changes', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-story-id-ok-'));
  await mkdir(join(workspace, 'src/stories/screens/2026-05-21'), { recursive: true });
  await writeFile(
    join(workspace, 'src/stories/screens/2026-05-21/NewScreenmpfcd493.stories.tsx'),
    [
      "import type { Meta, StoryObj } from '@storybook/react-vite';",
      "import { NewScreenmpfcd493 } from '../../../screens/2026-05-21/NewScreenmpfcd493';",
      '',
      'const meta = {',
      "  title: 'Screens/2026-05-21/New screen mpfcd493',",
      '  component: NewScreenmpfcd493,',
      '} satisfies Meta<typeof NewScreenmpfcd493>;',
      '',
      'export default meta;',
      'type Story = StoryObj<typeof meta>;',
      '',
      'export const Default: Story = {',
      "  name: 'New screen',",
      '};',
      '',
    ].join('\n'),
  );

  const identity = await checkRuntimeStoryIdentity(workspace, {
    storyId: 'screens-2026-05-21-new-screen-mpfcd493--default',
    filePath: 'src/stories/screens/2026-05-21/NewScreenmpfcd493.stories.tsx',
  });

  expect(identity.status).toBe('unchanged');
  expect(identity.expectedStoryId).toBe('screens-2026-05-21-new-screen-mpfcd493--default');
});

test('formats a visible external runtime completion notice even when the CLI final response is empty', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-summary-'));
  await mkdir(join(workspace, 'src/screens'), { recursive: true });
  await writeFile(
    join(workspace, 'src/screens/PaymentDetail.tsx'),
    ['export function PaymentDetail() {', '  return <main>Old</main>;', '}', ''].join('\n'),
  );

  const snapshots = await snapshotRuntimeTargetFiles(workspace, ['src/screens/PaymentDetail.tsx']);
  await writeFile(
    join(workspace, 'src/screens/PaymentDetail.tsx'),
    [
      'export function PaymentDetail() {',
      '  return <main><section><h1>Payment overview</h1><p>Ready for review</p></section></main>;',
      '}',
      '',
    ].join('\n'),
  );

  const summary = await summarizeRuntimeTargetChanges(workspace, snapshots);
  const acceptance = classifyRuntimeVisibleAcceptance(summary);
  const notice = formatRuntimeCompletionNotice({
    runtimeLabel: 'Codex CLI',
    summary,
    acceptance,
  });

  expect(notice).toContain('sber-designer: Codex CLI run summary');
  expect(notice).toContain('Changed files: src/screens/PaymentDetail.tsx');
  expect(notice).toContain('Verification: accepted');
});
