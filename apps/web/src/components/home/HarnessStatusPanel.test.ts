import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

const panelPath = 'apps/web/src/components/home/HarnessStatusPanel.tsx';
const homePath = 'apps/web/src/components/home/HomeLanding.tsx';

test('home surfaces the current 0114 harness acceptance status', async () => {
  const [panel, home] = await Promise.all([
    readFile(panelPath, 'utf8'),
    readFile(homePath, 'utf8'),
  ]);

  expect(panel).toContain("episode: '0114 · Final live closure'");
  expect(panel).toContain("coreMatrix: 'Live verified'");
  expect(panel).toContain("coreEvidence: 'T5/T6 · T8 · T14–T17'");
  expect(panel).toContain("runtimeMcp: '3 / 3 verified'");
  expect(panel).toContain("regressionGate: '1839 green'");
  expect(panel).toContain("providerEval: 'Direct DeepSeek verified'");
  expect(panel).toContain("evalEvidence: '2 / 2 profiles · baseline active'");
  expect(panel).toContain('/how-it-works/agent-quality-harness#0114-core-closure-live-acceptance');
  expect(panel).toContain('aria-labelledby="agent-quality-rollout-title"');
  expect(home).toContain("import { HarnessStatusPanel } from './HarnessStatusPanel'");
  expect(home).toContain('<HarnessStatusPanel />');
  expect(home.indexOf('<RecentDocumentationPanel />')).toBeLessThan(
    home.indexOf('<HarnessStatusPanel />'),
  );
});
