import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { settleCancelledToolCalls } from '@/lib/cancelled-transcript';
import { buildDesignDirectionOptions } from '@/lib/design-direction-picker';
import { Transcript } from './Transcript';

test('busy conflict names the run initiator and offers View run', () => {
  const html = renderToStaticMarkup(
    <Transcript
      messages={[]}
      pending={false}
      iterations={0}
      truncated={false}
      runStatus="preflight_rejected"
      runErrorCode="same_screen_active"
      runSummary={null}
      blockingRun={{
        clientRunId: 'client-a',
        sessionId: 'session-a',
        screenId: 'screen-a',
        provider: 'provider-a',
        model: 'model-a',
        displayName: 'Ada Lovelace',
        status: 'running',
        startedAt: 1,
        updatedAt: 1,
        title: 'Build funds list',
      }}
      componentReuse={null}
      runMetrics={null}
      debugLogPath={null}
      runManifestPath={null}
      onContinue={() => undefined}
      onViewBlockingRun={() => undefined}
      onReprobeRender={() => undefined}
      onExportEvidence={() => undefined}
      exportingEvidenceRunId={null}
      reprobingRenderRunId={null}
      renderProof={null}
    />,
  );

  expect(html).toContain('Agent is busy');
  expect(html).toContain('Run started by Ada Lovelace');
  expect(html).toContain('View run');
});

test('W7.3 cancelled transcript renders settled tool and one neutral terminal notice', () => {
  const messages = settleCancelledToolCalls(
    [
      { id: 'user', role: 'user', content: 'Create a screen' },
      {
        id: 'assistant-tool',
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'tool-1', name: 'write_file', arguments: '{}' }],
      },
    ],
    { afterMessageId: 'user', now: '2026-07-17T10:00:00.000Z' },
  );
  const html = renderToStaticMarkup(
    <Transcript
      messages={messages}
      pending={false}
      iterations={1}
      truncated={false}
      runStatus="cancelled"
      runErrorCode={null}
      runSummary="Cancelled by user."
      blockingRun={null}
      componentReuse={null}
      runMetrics={null}
      debugLogPath={null}
      runManifestPath={null}
      onContinue={() => undefined}
      onViewBlockingRun={() => undefined}
      onReprobeRender={() => undefined}
      onExportEvidence={() => undefined}
      exportingEvidenceRunId={null}
      reprobingRenderRunId={null}
      renderProof={null}
    />,
  );

  expect(html).toContain('write_file');
  expect(html).toContain('cancelled');
  expect(html).not.toContain('pending…');
  expect(html.match(/Agent run cancelled/gu)).toHaveLength(1);
});

test('0114 renders separate Total Input Output footers for consecutive assistant turns', () => {
  const html = renderToStaticMarkup(
    <Transcript
      messages={[
        { id: 'user-1', role: 'user', content: 'First' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'First answer',
          tokenUsage: { totalTokens: 120, inputTokens: 100, outputTokens: 20 },
        },
        { id: 'user-2', role: 'user', content: 'Second' },
        {
          id: 'assistant-2',
          role: 'assistant',
          content: 'Second answer',
          tokenUsage: { totalTokens: 255, inputTokens: 220, outputTokens: 35 },
        },
      ]}
      pending={false}
      iterations={1}
      truncated={false}
      runStatus="complete"
      runErrorCode={null}
      runSummary={null}
      blockingRun={null}
      componentReuse={null}
      runMetrics={{ totalTokens: 255, inputTokens: 220, outputTokens: 35 }}
      debugLogPath={null}
      runManifestPath={null}
      onContinue={() => undefined}
      onViewBlockingRun={() => undefined}
      onReprobeRender={() => undefined}
      onExportEvidence={() => undefined}
      exportingEvidenceRunId={null}
      reprobingRenderRunId={null}
      renderProof={null}
    />,
  );

  expect(html).toContain('Total 120 · Input 100 · Output 20');
  expect(html).toContain('Total 255 · Input 220 · Output 35');
  expect(html.match(/data-testid="assistant-token-usage"/gu)).toHaveLength(2);
});

test('0114 token footer shows unknown counters as em dash', () => {
  const html = renderToStaticMarkup(
    <Transcript
      messages={[
        {
          id: 'assistant',
          role: 'assistant',
          content: 'External answer',
          tokenUsage: { totalTokens: 300 },
        },
      ]}
      pending={false}
      iterations={null}
      truncated={false}
      runStatus="complete"
      runErrorCode={null}
      runSummary={null}
      blockingRun={null}
      componentReuse={null}
      runMetrics={null}
      debugLogPath={null}
      runManifestPath={null}
      onContinue={() => undefined}
      onViewBlockingRun={() => undefined}
      onReprobeRender={() => undefined}
      onExportEvidence={() => undefined}
      exportingEvidenceRunId={null}
      reprobingRenderRunId={null}
      renderProof={null}
    />,
  );

  expect(html).toContain('Total 300 · Input — · Output —');
});

test('0114 completed turn without provider usage still renders three unknown counters', () => {
  const html = renderToStaticMarkup(
    <Transcript
      messages={[
        {
          id: 'assistant',
          role: 'assistant',
          content: 'External answer without counters',
          tokenUsage: {},
        },
      ]}
      pending={false}
      iterations={null}
      truncated={false}
      runStatus="complete"
      runErrorCode={null}
      runSummary={null}
      blockingRun={null}
      componentReuse={null}
      runMetrics={null}
      debugLogPath={null}
      runManifestPath={null}
      onContinue={() => undefined}
      onViewBlockingRun={() => undefined}
      onReprobeRender={() => undefined}
      onExportEvidence={() => undefined}
      exportingEvidenceRunId={null}
      reprobingRenderRunId={null}
      renderProof={null}
    />,
  );

  expect(html).toContain('Total — · Input — · Output —');
});

test('0114 B5 completed run renders feedback controls for its Run ID', () => {
  const html = renderToStaticMarkup(
    <Transcript
      messages={[]}
      pending={false}
      iterations={1}
      truncated={false}
      runStatus="complete"
      runErrorCode={null}
      runSummary={null}
      blockingRun={null}
      componentReuse={null}
      runMetrics={null}
      debugLogPath={null}
      runManifestPath=".sber-designer/runs/run-feedback-1/run-manifest.json"
      onContinue={() => undefined}
      onViewBlockingRun={() => undefined}
      onReprobeRender={() => undefined}
      onExportEvidence={() => undefined}
      exportingEvidenceRunId={null}
      reprobingRenderRunId={null}
      renderProof={null}
    />,
  );

  expect(html).toContain('data-testid="agent-run-feedback"');
  expect(html).toContain('Rate this run');
  expect(html).toContain('Helpful run');
  expect(html).toContain('Unhelpful run');
  expect(html).toContain('Short reason (optional)');
});

test('0114 B6 renders three direction choices before a run starts', () => {
  const options = buildDesignDirectionOptions(null);
  const html = renderToStaticMarkup(
    <Transcript
      messages={[
        { id: 'user', role: 'user', content: 'Create the review screen' },
        {
          id: 'directions',
          role: 'assistant',
          content: 'Choose a design direction before Assistant starts editing:',
          contextEligible: false,
          metadata: {
            directionPicker: {
              version: 1,
              requestMessageId: 'user',
              baseGeneration: {},
              options,
            },
          },
        },
      ]}
      pending={false}
      iterations={null}
      truncated={false}
      runStatus={null}
      runErrorCode={null}
      runSummary={null}
      blockingRun={null}
      componentReuse={null}
      runMetrics={null}
      debugLogPath={null}
      runManifestPath={null}
      onContinue={() => undefined}
      onViewBlockingRun={() => undefined}
      onReprobeRender={() => undefined}
      onExportEvidence={() => undefined}
      exportingEvidenceRunId={null}
      reprobingRenderRunId={null}
      renderProof={null}
      onDirectionSelect={() => undefined}
    />,
  );

  expect(html).toContain('Assistant · direction');
  expect(html).toContain('Workflow focus');
  expect(html).toContain('Operational overview');
  expect(html).toContain('Guided progression');
  expect(html).toContain('Choose');
  expect(html).not.toContain('Direction selection is complete.');
});

test('0114 B6.2.9 renders separate freshness and expandable component evidence', () => {
  const html = renderToStaticMarkup(
    <Transcript
      messages={[
        {
          id: 'component-pack',
          role: 'assistant',
          content: 'Project DS summary',
          contextEligible: false,
          metadata: {
            componentPack: {
              status: 'ready',
              workspaceFreshness: 'stale',
              candidateCount: 9,
              selectedCount: 9,
              diagnosticCount: 0,
              indexedCount: 150,
              describedCount: 32,
              hydratedCount: 9,
              selections: [
                {
                  role: 'status-badge',
                  componentId: 'status-chip',
                  componentName: 'StatusChip',
                  reason: 'The paid state needs a compact operational status.',
                  regionIds: ['summary'],
                  required: true,
                  hydrated: true,
                  hydrationBatchIds: ['summary:1'],
                  resolutionStatus: 'resolved',
                  variants: ['state=paid', 'tone=success'],
                },
              ],
              lateSelections: [
                {
                  sequence: 1,
                  action: 'add',
                  role: 'side-preview',
                  componentId: 'preview-pane',
                  reason: 'Selected-row details need persistent context.',
                  regionIds: ['preview'],
                  resolutionStatus: 'resolved',
                },
              ],
            },
          },
        },
      ]}
      pending={false}
      iterations={1}
      truncated={false}
      runStatus="complete"
      runErrorCode={null}
      runSummary={null}
      blockingRun={null}
      componentReuse={null}
      runMetrics={null}
      debugLogPath={null}
      runManifestPath={null}
      onContinue={() => undefined}
      onViewBlockingRun={() => undefined}
      onReprobeRender={() => undefined}
      onExportEvidence={() => undefined}
      exportingEvidenceRunId={null}
      reprobingRenderRunId={null}
      renderProof={null}
    />,
  );

  expect(html).toContain('Project DS: 150 indexed · 32 described · 9 selected · 9 hydrated');
  expect(html).toContain('Component context: ready');
  expect(html).toContain('Workspace index: stale');
  expect(html).toContain('Selection &amp; hydration details');
  expect(html).toContain('The paid state needs a compact operational status.');
  expect(html).toContain('Regions: summary');
  expect(html).toContain('Variants: state=paid, tone=success');
  expect(html).toContain('Late additions');
  expect(html).toContain('Selected-row details need persistent context.');
  expect(html).not.toContain('component candidates');
});

test('0114 B6.1 renders one quality summary and explicit review action', () => {
  const html = renderToStaticMarkup(
    <Transcript
      messages={[
        {
          id: 'quality',
          role: 'assistant',
          content: 'Final quality summary',
          contextEligible: false,
          metadata: {
            qualitySummary: {
              version: 1,
              terminalStatus: 'needs_review',
              repair: { attempted: true, attempts: 1, succeeded: false },
              remainingFindings: { blocking: 1, shouldFix: 2, advisory: 0 },
              skippedChecks: ['responsiveVisualSanity'],
              craft: { status: 'blocked', categories: [] },
              designMode: { status: 'compatible' },
              render: { status: 'confirmed' },
              jury: { status: 'passed', rounds: 2, revisionAttempted: true },
            },
          },
        },
      ]}
      pending={false}
      iterations={3}
      truncated={false}
      runStatus="needs_review"
      runErrorCode={null}
      runSummary="One blocking finding remains."
      blockingRun={null}
      componentReuse={null}
      runMetrics={null}
      debugLogPath={null}
      runManifestPath=".sber-designer/runs/run-quality/run-manifest.json"
      onContinue={() => undefined}
      onViewBlockingRun={() => undefined}
      onReprobeRender={() => undefined}
      onExportEvidence={() => undefined}
      exportingEvidenceRunId={null}
      reprobingRenderRunId={null}
      renderProof={null}
    />,
  );

  expect(html).toContain('Final quality summary');
  expect(html).toContain('Automatic repair attempted');
  expect(html).toContain('1 blocking · 2 should-fix · 0 advisory');
  expect(html).toContain('Jury passed after revision');
  expect(html).toContain('Skipped: responsiveVisualSanity');
  expect(html).toContain('Mark reviewed');
  expect(html.match(/Final quality summary/gu)).toHaveLength(1);
});
