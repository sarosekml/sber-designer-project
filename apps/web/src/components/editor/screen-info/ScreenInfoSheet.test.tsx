import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ScreenGenerationInfo } from '@sber-designer/shared-types';

import { TooltipProvider } from '@/components/ui/tooltip';
import { statusChipClasses } from '@/lib/status-chip';
import { ScreenInfoContent } from './ScreenInfoSheet';

test('screen info renders totals, missing usage, attachments, and pruned evidence', () => {
  const html = renderToStaticMarkup(
    <TooltipProvider>
      <ScreenInfoContent data={fixture()} workspacePath="/projects/demo" />
    </TooltipProvider>,
  );

  expect(html).toContain('Checkout');
  expect(html).toContain('Generation usage');
  expect(html).toContain('2,048');
  expect(html).toContain('Input — · Output — · Total —');
  expect(html).toContain(statusChipClasses.warning);
  expect(html).toContain('reference.png');
  expect(html).toContain('Logs were pruned; metadata remains available.');
  expect(html).toContain('.sber-designer/runs/run-1');
});

test('screen info explains an empty generation history', () => {
  const data = fixture();
  data.runs = [];
  data.totals = {
    runs: 0,
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    runsWithoutTokenData: 0,
  };

  const html = renderToStaticMarkup(
    <TooltipProvider>
      <ScreenInfoContent data={data} workspacePath={null} />
    </TooltipProvider>,
  );

  expect(html).toContain('No generation runs yet');
});

test('screen info never renders missing aggregate usage as zero', () => {
  const data = fixture();
  data.totals = {
    runs: 1,
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    runsWithoutTokenData: 1,
  };

  const html = renderToStaticMarkup(
    <TooltipProvider>
      <ScreenInfoContent data={data} workspacePath={null} />
    </TooltipProvider>,
  );

  expect(html).toContain('Token usage was not recorded for these runs.');
  expect(html).toContain('Tokens</p><p class="mt-0.5 text-sm font-semibold text-foreground">—');
  expect(html).not.toContain('Tokens</p><p class="mt-0.5 text-sm font-semibold text-foreground">0');
});

function fixture(): ScreenGenerationInfo {
  return {
    screen: {
      id: 'checkout',
      name: 'Checkout',
      folder: 'Commerce',
      kind: 'story',
      implementationFilePath: 'src/screens/Checkout.tsx',
      createdAt: { value: Date.parse('2026-07-20T10:00:00.000Z'), source: 'recorded' },
      updatedAt: { value: Date.parse('2026-07-21T10:00:00.000Z'), source: 'estimated' },
    },
    totals: {
      runs: 1,
      inputTokens: 1_800,
      outputTokens: 248,
      totalTokens: 2_048,
      costUsd: 0.25,
      runsWithoutTokenData: 1,
    },
    runs: [
      {
        runId: 'run-1',
        startedAt: '2026-07-21T09:00:00.000Z',
        completedAt: '2026-07-21T09:01:00.000Z',
        status: 'needs_review',
        route: 'chat-stream',
        sessionMode: 'design',
        provider: 'codex-runtime',
        model: 'gpt-5',
        runtimeKind: 'cli',
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        attribution: 'active-screen',
        logs: { runDir: '.sber-designer/runs/run-1', available: false },
        attachments: [
          {
            kind: 'image',
            name: 'reference.png',
            mimeType: 'image/png',
            size: 2_048,
            sha256: 'abc',
          },
        ],
      },
    ],
  };
}
