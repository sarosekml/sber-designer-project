import { expect, test } from 'bun:test';

import { scopeFailureRecoveryActions, transcriptRunNotice } from './agent-run-status';

test('preflight rejected runs render as request rejection, not iteration limit', () => {
  expect(
    transcriptRunNotice({
      runStatus: 'preflight_rejected',
      truncated: false,
      iterations: 0,
    }),
  ).toEqual({
    tone: 'error',
    title: 'Request rejected before agent start',
    detail: 'No agent turns ran. Adjust the request or selected model/runtime and send again.',
    action: null,
  });
});

test('same-screen rejected runs render a blocking-run conflict notice', () => {
  expect(
    transcriptRunNotice({
      runStatus: 'preflight_rejected',
      truncated: false,
      iterations: 0,
      errorCode: 'same_screen_active',
      blockingRun: {
        clientRunId: 'client-a',
        sessionId: 'session-a',
        screenId: 'screen-a',
        provider: 'opencode-runtime',
        model: 'selected-model',
        displayName: 'Ada Lovelace',
        status: 'running',
        startedAt: 1,
        updatedAt: 1,
        title: 'Build funds list',
      },
    }),
  ).toEqual({
    tone: 'error',
    title: 'Agent is busy',
    detail: 'Run started by Ada Lovelace. Build funds list is still running.',
    action: 'view-run',
  });
});

test('truncated runs keep the continue action', () => {
  expect(
    transcriptRunNotice({
      runStatus: 'failed',
      truncated: true,
      iterations: 20,
    }),
  ).toEqual({
    tone: 'warning',
    title: 'Agent paused at the iteration limit',
    detail: '20 agent turns completed. Progress and tool results are preserved.',
    action: 'continue',
  });
});

test('failed truncated runs with finalizer summary show the primary failure cause', () => {
  expect(
    transcriptRunNotice({
      runStatus: 'failed',
      truncated: true,
      iterations: 20,
      runSummary: 'No data-sd-screen-root was found after canvas load.',
    }),
  ).toEqual({
    tone: 'error',
    title: 'Agent run failed',
    detail: '20 agent turns completed. No data-sd-screen-root was found after canvas load.',
    action: null,
  });
});

test('truncated needs-review runs render as saved source that needs review', () => {
  expect(
    transcriptRunNotice({
      runStatus: 'needs_review',
      truncated: true,
      iterations: 20,
    }),
  ).toEqual({
    tone: 'warning',
    title: 'Source saved, review needed',
    detail:
      '20 agent turns completed. Validation or preview did not finish, but the changed files were preserved.',
    action: 'continue',
  });
});

test('failed non-truncated runs render as failed completion, not a hidden no-op', () => {
  expect(
    transcriptRunNotice({
      runStatus: 'failed',
      truncated: false,
      iterations: 1,
    }),
  ).toEqual({
    tone: 'error',
    title: 'Agent run failed',
    detail: '1 agent turn completed. Check the transcript and run log before retrying.',
    action: null,
  });
});

test('current-screen scope failures render recovery actions instead of a dead-end error', () => {
  expect(
    transcriptRunNotice({
      runStatus: 'failed',
      truncated: false,
      iterations: 6,
      runSummary: 'write_file target is outside the current screen scope.',
    }),
  ).toEqual({
    tone: 'error',
    title: 'Task hit the current-screen write scope',
    detail:
      '6 agent turns completed. The requested change tried to write outside the selected screen. Continue with the preserved chat context using the right target.',
    action: 'scope-recovery',
  });

  expect(scopeFailureRecoveryActions().map((action) => action.label)).toEqual([
    'Create new screen and continue',
    'Switch to project/design-system task',
    'Retry on current screen',
  ]);
});

test('screen_create current-screen failures render the same recovery actions', () => {
  expect(
    transcriptRunNotice({
      runStatus: 'failed',
      truncated: false,
      iterations: 3,
      runSummary: 'screen_create is not allowed while editing the current screen.',
    })?.action,
  ).toBe('scope-recovery');
});

test('cancelled runs render as a neutral user-cancelled notice', () => {
  expect(
    transcriptRunNotice({
      runStatus: 'cancelled',
      truncated: false,
      iterations: 1,
      runSummary: 'Cancelled by user.',
    }),
  ).toEqual({
    tone: 'neutral',
    title: 'Agent run cancelled',
    detail: '1 agent turn completed. Cancelled by user.',
    action: null,
  });
});

test('legacy needs-review runs do not render a review/download notice', () => {
  expect(
    transcriptRunNotice({
      runStatus: 'needs_review',
      truncated: false,
      iterations: 6,
    }),
  ).toBeNull();
});

test('runtime proof pending without browser evidence renders as an info notice without re-probe', () => {
  expect(
    transcriptRunNotice({
      runStatus: 'needs_review',
      truncated: false,
      iterations: 3,
      runSummary: 'Screen updated — runtime proof pending.',
      renderProof: { canReprobe: false },
    }),
  ).toEqual({
    tone: 'info',
    title: 'Screen saved — browser verification pending',
    detail:
      '3 agent turns completed. Source saved, screen renders from available evidence, and browser proof can run when JS-capable preview evidence is available.',
    action: null,
  });
});

test('runtime proof pending with JS-capable evidence exposes a re-probe action', () => {
  expect(
    transcriptRunNotice({
      runStatus: 'needs_review',
      truncated: false,
      iterations: 3,
      runSummary: 'Screen saved — browser verification pending.',
      renderProof: { canReprobe: true },
    }),
  ).toEqual({
    tone: 'info',
    title: 'Screen saved — browser verification pending',
    detail:
      '3 agent turns completed. Source saved, screen renders from available evidence, and browser proof can run when JS-capable preview evidence is available.',
    action: 'reprobe',
  });
});

test('component reuse findings render as an actionable transcript warning', () => {
  expect(
    transcriptRunNotice({
      runStatus: 'complete',
      truncated: false,
      iterations: 4,
      componentReuse: {
        expected: ['BreadCrumbs', 'DashboardGroupHeader', 'PageBar', 'Tile'],
        used: ['Button', 'Card', 'IconButton', 'Paper', 'Text'],
        missing: ['BreadCrumbs', 'DashboardGroupHeader', 'PageBar', 'Tile'],
        score: { earned: 0.5, total: 4, label: '0.5/4' },
        substituted: [{ role: 'content-panel', expected: 'Tile', used: ['Card'] }],
        skipped: [
          { role: 'breadcrumb', expected: 'BreadCrumbs' },
          { role: 'page-header', expected: 'PageBar' },
          { role: 'section-header', expected: 'DashboardGroupHeader' },
        ],
      },
    }),
  ).toEqual({
    tone: 'warning',
    title: 'Project components were missed',
    detail:
      'Reuse score: 0.5/4. Missing: BreadCrumbs, DashboardGroupHeader, PageBar, Tile. Substituted: Tile -> Card. Used: Button, Card, IconButton, Paper, Text. Re-run with the component pack, re-index the project, or add component guidance. You can accept the draft anyway.',
    action: null,
  });
});
