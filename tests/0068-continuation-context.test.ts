import { mkdir, readFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import {
  buildRunContinuationContextSnapshot,
  readPromptAttachmentEvidenceFromContinuationMessages,
  readRunContinuationContextSnapshot,
  runContinuationContextPath,
  writeRunContinuationContextSnapshot,
} from '../services/api/src/agent/continuation-context';
import { completeAgentRun, createAgentRun } from '../services/api/src/agent/run-record/manifest';
import { recordToolReceipt } from '../services/api/src/agent/run-record/receipts';

test('writes continuation context snapshot and refreshes it when the run completes', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0068-continuation-'));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'local-model',
    projectName: 'IBP UI Kit',
    workspacePath: workspace,
    userGoal: 'Continue from the attached BRD.',
    activeScreen: {
      id: 'screen-approval',
      name: 'Approval Dashboard',
      kind: 'page',
      implementationFilePath: 'src/screens/ApprovalDashboard.tsx',
      filePath: 'src/screens/ApprovalDashboard.stories.tsx',
    },
  });

  const snapshot = await writeRunContinuationContextSnapshot({
    workspacePath: workspace,
    runId: run.runId,
    sessionId: 'assistant-screen-approval',
    screenId: 'screen-approval',
    messages: [
      {
        id: 'user-brd',
        role: 'user',
        content: 'Generate the approval dashboard from the BRD.',
        attachments: [
          {
            id: 'att-brd',
            name: 'IBP BRD.md',
            mimeType: 'text/markdown',
            size: 5600,
            kind: 'text',
          },
        ],
      },
      { id: 'assistant-1', role: 'assistant', content: 'I started implementation.' },
      {
        id: 'user-corrective',
        role: 'user',
        content: 'Use the compact approval flow and keep deviation cards visible.',
      },
      { id: 'continue-1', role: 'user', content: 'Continue the previous run.' },
    ],
    taskSummary: 'Implementation started but render validation failed.',
    activeTarget: {
      screenId: 'screen-approval',
      screenName: 'Approval Dashboard',
      implementationFilePath: 'src/screens/ApprovalDashboard.tsx',
      storyFilePath: 'src/screens/ApprovalDashboard.stories.tsx',
    },
    attachments: [
      {
        id: 'att-brd',
        kind: 'text',
        documentKind: 'markdown',
        name: 'IBP BRD.md',
        mimeType: 'text/markdown',
        size: 5600,
        sha256: 'b'.repeat(64),
        runPath: `.sber-designer/runs/${run.runId}/attachments/01-ibp-brd.md`,
        excerpt: 'IBP approval dashboard BRD',
      },
    ],
    runStatus: 'running',
  });

  expect(snapshot.sourcePrompt).toMatchObject({
    messageId: 'user-corrective',
    compacted: false,
  });
  expect(snapshot.sourcePrompt.text).toContain('compact approval flow');
  expect(snapshot.sourcePrompt.text).not.toContain('Continue the previous run');
  expect(snapshot.attachments[0]).toMatchObject({ kind: 'text', name: 'IBP BRD.md' });
  expect(runContinuationContextPath(run.runId)).toBe(
    `.sber-designer/runs/${run.runId}/continuation-context.json`,
  );

  await recordToolReceipt({
    workspacePath: workspace,
    runId: run.runId,
    tool: 'apply_patch',
    status: 'ok',
    changedFiles: ['src/screens/ApprovalDashboard.tsx'],
    summary: 'Updated approval dashboard component.',
  });
  await completeAgentRun({
    workspacePath: workspace,
    runId: run.runId,
    status: 'failed',
    summary: 'Render health failed after the patch.',
  });

  const updated = await readRunContinuationContextSnapshot(workspace, run.runId);
  expect(updated?.runStatus).toBe('failed');
  expect(updated?.runSummary).toContain('Render health failed');
  expect(updated?.changedFiles).toEqual(['src/screens/ApprovalDashboard.tsx']);
  expect(updated?.lastToolCalls).toContainEqual({
    name: 'apply_patch',
    status: 'ok',
    summary: 'Updated approval dashboard component.',
  });

  const handoff = await readFile(
    join(workspace, '.sber-designer', 'runs', run.runId, 'handoff.md'),
    'utf8',
  );
  expect(handoff).toContain('- Continuation context: continuation-context.json');
});

test('recovers source prompt from compact context when continue payload has no real user prompt', () => {
  const snapshot = buildRunContinuationContextSnapshot({
    workspacePath: '/workspace',
    runId: 'run-2026-06-02T10-00-00-00000000',
    messages: [
      {
        role: 'system',
        content: [
          'Compact assistant task context',
          '',
          'Source prompt:',
          'Use the IBP BRD to build the approval dashboard.',
          '',
          'Task summary:',
          'Previous run failed during render health.',
        ].join('\n'),
      },
      { role: 'user', content: 'Continue the previous run.' },
    ],
  });

  expect(snapshot.sourcePrompt.text).toBe('Use the IBP BRD to build the approval dashboard.');
  expect(snapshot.sourcePrompt.compacted).toBe(false);
});

test('keeps html attachment analysis in continuation snapshots', () => {
  const snapshot = buildRunContinuationContextSnapshot({
    workspacePath: '/workspace',
    runId: 'run-2026-06-02T11-00-00-00000000',
    messages: [{ id: 'user-1', role: 'user', content: 'Build from the attached HTML.' }],
    attachments: [
      {
        id: 'att-html',
        kind: 'text',
        documentKind: 'html',
        name: 'dashboard.html',
        mimeType: 'text/html',
        size: 900,
        sha256: 'c'.repeat(64),
        runPath:
          '.sber-designer/runs/run-2026-06-02T11-00-00-00000000/attachments/01-dashboard.html',
        excerpt: 'Dashboard Approve Reject',
        analysis: {
          title: 'Dashboard',
          headings: [{ level: 1, text: 'Dashboard' }],
          landmarks: [],
          sections: [],
          forms: [],
          tables: [],
          lists: [],
          actions: ['Approve', 'Reject'],
          mockText: ['Dashboard'],
          classHints: [],
          warnings: [],
        },
      },
    ],
  });

  expect(snapshot.attachments[0]).toMatchObject({
    kind: 'text',
    documentKind: 'html',
    analysis: { actions: ['Approve', 'Reject'] },
  });
});

test('recovers prompt attachment evidence from compact continuation context chains', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0068-continuation-evidence-'));
  const originalRunId = 'run-2026-06-02T12-00-00-00000000';
  const continueRunId = 'run-2026-06-02T12-05-00-00000000';
  await mkdir(join(workspace, '.sber-designer', 'runs', originalRunId), { recursive: true });
  await mkdir(join(workspace, '.sber-designer', 'runs', continueRunId), { recursive: true });
  const htmlEvidence = {
    id: 'att-html',
    kind: 'text' as const,
    documentKind: 'html' as const,
    name: 'dashboard.html',
    mimeType: 'text/html',
    size: 900,
    sha256: 'd'.repeat(64),
    runPath: `.sber-designer/runs/${originalRunId}/attachments/01-dashboard.html`,
    excerpt: 'Dashboard Approve Reject',
    analysis: {
      title: 'Dashboard',
      headings: [{ level: 1, text: 'Dashboard' }],
      landmarks: [],
      sections: [],
      forms: [],
      tables: [],
      lists: [],
      actions: ['Approve', 'Reject'],
      mockText: ['Dashboard'],
      classHints: [],
      warnings: [],
    },
  };

  await writeRunContinuationContextSnapshot({
    workspacePath: workspace,
    runId: originalRunId,
    messages: [{ id: 'user-1', role: 'user', content: 'Build from the attached HTML.' }],
    attachments: [htmlEvidence],
  });

  const firstCarry = await readPromptAttachmentEvidenceFromContinuationMessages({
    workspacePath: workspace,
    messages: [
      {
        role: 'system',
        content: [
          'Compact assistant task context',
          '',
          'Last run:',
          `- continuationContext: ${runContinuationContextPath(originalRunId)}`,
        ].join('\n'),
      },
      { role: 'user', content: 'Continue the previous run.' },
    ],
  });

  expect(firstCarry).toEqual([htmlEvidence]);

  await writeRunContinuationContextSnapshot({
    workspacePath: workspace,
    runId: continueRunId,
    messages: [{ role: 'user', content: 'Continue the previous run.' }],
    attachments: firstCarry,
  });

  const secondCarry = await readPromptAttachmentEvidenceFromContinuationMessages({
    workspacePath: workspace,
    messages: [
      {
        role: 'system',
        content: [
          'Compact assistant task context',
          '',
          'Last run:',
          `- continuationContext: ${runContinuationContextPath(continueRunId)}`,
        ].join('\n'),
      },
      { role: 'user', content: 'Continue the previous run.' },
    ],
  });

  expect(secondCarry).toEqual([htmlEvidence]);
});
