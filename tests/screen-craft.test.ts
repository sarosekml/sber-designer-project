import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { CANONICAL_DESIGN_INDEX_PATHS } from '../packages/design-indexer/src';
import { validateScreenCraft, type ScreenCraftResult } from '../services/api/src/screen-craft';
import type { TaskRelevantComponentPack } from '../services/api/src/component-intelligence/component-pack';
import { designRouter } from '../services/api/src/routes/design';
import { ALL_TOOLS } from '../services/api/src/agent/toolset';
import type { ToolContext } from '../services/api/src/agent/types';

test('screen craft validator flags fake metrics, raw hex values, icon-only buttons, and missing states', async () => {
  const root = await createCraftWorkspace({
    screenSource: [
      'function DownloadIcon() { return <svg aria-hidden="true" />; }',
      '',
      'export function RiskDashboard() {',
      '  return (',
      '    <main className="grid gap-4" style={{ backgroundColor: "#fef3c7" }}>',
      '      <header><h1>Risk overview</h1><p>$2.4M blocked exposure</p></header>',
      '      <button><DownloadIcon /></button>',
      '      <DataTable rows={[]} />',
      '    </main>',
      '  );',
      '}',
      '',
    ].join('\n'),
  });

  const result = await validateScreenCraft({
    workspaceRoot: root,
    screen: { screenId: 'risk' },
  });

  expect(result.status).toBe('blocked');
  expect(result.target.filePath).toBe('src/screens/RiskDashboard.tsx');
  expect(result.findings).toContainEqual(
    expect.objectContaining({
      severity: 'blocking',
      ruleId: 'craft.fake-metric',
    }),
  );
  expect(result.findings).toContainEqual(
    expect.objectContaining({
      severity: 'should-fix',
      ruleId: 'craft.raw-hex',
    }),
  );
  expect(result.findings).toContainEqual(
    expect.objectContaining({
      severity: 'blocking',
      ruleId: 'craft.icon-button-label',
    }),
  );
  expect(result.findings).toContainEqual(
    expect.objectContaining({
      severity: 'should-fix',
      ruleId: 'craft.missing-state',
    }),
  );
  expect(result.summary.findings.blocking).toBe(2);
  expect(result.summary.findings.shouldFix).toBe(2);
});

test('screen craft profile disables categories and reports disabled separately from passed', async () => {
  const root = await createCraftWorkspace({
    screenSource: [
      'export function RiskDashboard() {',
      '  return <main style={{ color: "#ff0000" }}><h1>Risk queue</h1><p>$2.4M exposure</p></main>;',
      '}',
      '',
    ].join('\n'),
  });

  const result = await validateScreenCraft({
    workspaceRoot: root,
    screen: { screenId: 'risk' },
    screenReadiness: {
      enabled: true,
      profile: 'custom',
      categories: {
        designSystemFit: false,
      },
    },
  });

  expect(result.findings.map((finding) => finding.ruleId)).toEqual(['craft.fake-metric']);
  expect(result.readiness?.categoryResults.designSystemFit.status).toBe('disabled');
  expect(result.readiness?.categoryResults.dataHonesty.status).toBe('blocked');
  expect(result.summary.findings.shouldFix).toBe(0);
});

test('screen craft Strict profile promotes selected should-fix findings to blocking', async () => {
  const root = await createCraftWorkspace({
    screenSource: [
      '// Mock data.',
      'export function RiskDashboard() {',
      '  return <main style={{ color: "#ff0000" }}><h1>Risk queue</h1></main>;',
      '}',
      '',
    ].join('\n'),
  });

  const result = await validateScreenCraft({
    workspaceRoot: root,
    screen: { screenId: 'risk' },
    screenReadiness: {
      enabled: true,
      profile: 'strict',
      categories: {},
    },
  });

  expect(result.findings).toContainEqual(
    expect.objectContaining({
      ruleId: 'craft.raw-hex',
      severity: 'blocking',
    }),
  );
  expect(result.status).toBe('blocked');
  expect(result.readiness?.categoryResults.designSystemFit.status).toBe('blocked');
});

test('screen craft blocks React hooks called outside components', async () => {
  const root = await createCraftWorkspace({
    screenSource: [
      "import React, { useMemo } from 'react';",
      '',
      'const rows = [{ value: 1 }];',
      'const totals = useMemo(() => rows.length, []);',
      '',
      'export function RiskDashboard() {',
      '  return <main data-sd-screen-root>{totals}</main>;',
      '}',
      '',
    ].join('\n'),
  });

  const result = await validateScreenCraft({
    workspaceRoot: root,
    screen: { screenId: 'risk' },
  });

  expect(result.status).toBe('blocked');
  expect(result.findings).toContainEqual(
    expect.objectContaining({
      severity: 'blocking',
      ruleId: 'craft.react-hook-outside-component',
    }),
  );
});

test('screen craft allows nested icon and visible text inside buttons', async () => {
  const root = await createCraftWorkspace({
    screenSource: [
      'function PlusIcon() { return <svg aria-hidden="true" />; }',
      '',
      'export function RiskDashboard() {',
      '  return (',
      '    <main>',
      '      <Button>',
      '        <Grid>',
      '          <PlusIcon />',
      '          <span>Добавить платёж</span>',
      '        </Grid>',
      '      </Button>',
      '      <button><PlusIcon /></button>',
      '    </main>',
      '  );',
      '}',
      '',
    ].join('\n'),
  });

  const result = await validateScreenCraft({
    workspaceRoot: root,
    screen: { screenId: 'risk' },
  });
  const iconFindings = result.findings.filter(
    (finding) => finding.ruleId === 'craft.icon-button-label',
  );

  expect(iconFindings).toHaveLength(1);
  expect(iconFindings[0]?.message).toContain('button');
});

test('screen craft route and agent tool expose the same validator result', async () => {
  const root = await createCraftWorkspace({
    screenSource: [
      'export function RiskDashboard() {',
      '  return <main className="bg-surface-default"><h1>Risk queue</h1><p>No findings.</p></main>;',
      '}',
      '',
    ].join('\n'),
  });

  const routeResponse = await designRouter.request('http://localhost/craft', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      workspacePath: root,
      screen: { screenId: 'risk' },
    }),
  });
  const routeBody = (await routeResponse.json()) as ScreenCraftResult;
  const toolBody = (await findTool('validate_screen_craft').handler(
    { screenId: 'risk' },
    toolContext(root),
  )) as ScreenCraftResult;

  expect(routeResponse.status).toBe(200);
  expect(routeBody.status).toBe('passed');
  expect(toolBody.status).toBe(routeBody.status);
  expect(toolBody.target.filePath).toBe(routeBody.target.filePath);
});

test('screen craft does not block BRD mock/sample metrics when the file declares mock data', async () => {
  const root = await createCraftWorkspace({
    screenSource: [
      '// Mock data based on the attached BRD sample.',
      'export function RiskDashboard() {',
      '  return <main><h1>Risk queue</h1><p>2.85% margin and $2.4M exposure</p></main>;',
      '}',
      '',
    ].join('\n'),
  });

  const result = await validateScreenCraft({
    workspaceRoot: root,
    screen: { screenId: 'risk' },
  });

  expect(result.findings).not.toContainEqual(
    expect.objectContaining({ ruleId: 'craft.fake-metric' }),
  );
});

test('screen craft accepts metrics explicitly attributed to an attached reference', async () => {
  const root = await createHtmlCraftWorkspace({
    html: [
      '<!-- Reference-backed content from the attached image. -->',
      '<main data-sd-screen-root><h1>Account balance</h1><p>$35,340.89</p></main>',
      '',
    ].join('\n'),
  });

  const result = await validateScreenCraft({
    workspaceRoot: root,
    screen: { implementationFilePath: 'site/page.html' },
  });

  expect(result.findings).not.toContainEqual(
    expect.objectContaining({ ruleId: 'craft.fake-metric' }),
  );
});

test('screen craft reports HTML comments that stand in for visible reference regions', async () => {
  const root = await createHtmlCraftWorkspace({
    html: [
      '<main data-sd-screen-root>',
      '  <section class="chart-card"><h2>Overview</h2><!-- Inline SVG or CSS for chart --></section>',
      '</main>',
      '',
    ].join('\n'),
  });

  const result = await validateScreenCraft({
    workspaceRoot: root,
    screen: { implementationFilePath: 'site/page.html' },
  });

  expect(result.findings).toContainEqual(
    expect.objectContaining({
      severity: 'should-fix',
      ruleId: 'craft.placeholder-asset',
    }),
  );
});

test('screen craft ignores CSS numeric contexts but still blocks textual fake metrics', async () => {
  const cssLike = await createCraftWorkspace({
    screenSource: [
      'export function RiskDashboard() {',
      '  return (',
      '    <main style={{ background: "linear-gradient(90deg, hsl(210 60% 44%), var(--surface-default))" }}>',
      '      <section style={{ width: "calc(100% - 24px)" }} />',
      '      <h1>Risk queue</h1>',
      '    </main>',
      '  );',
      '}',
      '',
    ].join('\n'),
  });
  const textualMetric = await createCraftWorkspace({
    screenSource: [
      'export function RiskDashboard() {',
      '  return <main><h1>Risk queue</h1><p>Conversion improved 12.5% this month.</p></main>;',
      '}',
      '',
    ].join('\n'),
  });

  const cssResult = await validateScreenCraft({
    workspaceRoot: cssLike,
    screen: { screenId: 'risk' },
  });
  const textualResult = await validateScreenCraft({
    workspaceRoot: textualMetric,
    screen: { screenId: 'risk' },
  });

  expect(cssResult.findings).not.toContainEqual(
    expect.objectContaining({ ruleId: 'craft.fake-metric' }),
  );
  expect(textualResult.findings).toContainEqual(
    expect.objectContaining({ ruleId: 'craft.fake-metric' }),
  );
});

test('screen craft ignores percentage values used by JSX layout props', async () => {
  const root = await createCraftWorkspace({
    screenSource: [
      'function Skeleton({ width }: { width: string }) { return <div style={{ width }} />; }',
      'export function RiskDashboard() {',
      '  const fallbackWidth = undefined;',
      '  return (',
      '    <main>',
      '      <Skeleton width="100%" />',
      "      <Skeleton width={fallbackWidth ?? '80%'} />",
      "      <span style={{ borderRadius: '50%' }} />",
      '      <h1>Risk queue</h1>',
      '    </main>',
      '  );',
      '}',
      '',
    ].join('\n'),
  });

  const result = await validateScreenCraft({
    workspaceRoot: root,
    screen: { screenId: 'risk' },
  });

  expect(result.findings).not.toContainEqual(
    expect.objectContaining({ ruleId: 'craft.fake-metric' }),
  );
});

test('screen craft treats a declared VAT percentage as a tax rate, not an invented metric', async () => {
  const root = await createCraftWorkspace({
    screenSource: [
      'export function Invoice() {',
      '  return <main><h1>Invoice</h1><p>НДС 20%, руб.</p><p>VAT 20%</p></main>;',
      '}',
      '',
    ].join('\n'),
  });

  const result = await validateScreenCraft({
    workspaceRoot: root,
    screen: { screenId: 'invoice' },
  });

  expect(result.findings).not.toContainEqual(
    expect.objectContaining({ ruleId: 'craft.fake-metric' }),
  );
});

test('B2 craft rules flag native numeric tables without alignment and required forms without errors', async () => {
  const root = await createCraftWorkspace({
    screenSource: [
      'const rows = [{ id: "a", amount: "Bound amount" }];',
      'export function RiskDashboard() {',
      '  return (',
      '    <main>',
      '      <form><label>Email<input name="email" required /></label></form>',
      '      <table>',
      '        <thead><tr><th>Account</th><th>Amount</th></tr></thead>',
      '        <tbody>{rows.map((row) => <tr key={row.id}><td>{row.id}</td><td>{row.amount}</td></tr>)}</tbody>',
      '      </table>',
      '    </main>',
      '  );',
      '}',
      '',
    ].join('\n'),
  });

  const result = await validateScreenCraft({
    workspaceRoot: root,
    screen: { screenId: 'risk' },
  });

  expect(result.findings).toContainEqual(
    expect.objectContaining({
      severity: 'should-fix',
      ruleId: 'craft.data-table.numeric-alignment',
    }),
  );
  expect(result.findings).toContainEqual(
    expect.objectContaining({
      severity: 'should-fix',
      ruleId: 'craft.form.missing-error-state',
    }),
  );
});

test('B2 craft rules accept explicit numeric alignment and recoverable form errors', async () => {
  const root = await createCraftWorkspace({
    screenSource: [
      'const rows = [{ id: "a", amount: "Bound amount" }];',
      'export function RiskDashboard() {',
      '  return (',
      '    <main>',
      '      <form>',
      '        <label>Email<input name="email" required aria-invalid="true" /></label>',
      '        <p role="alert">Enter a valid email address.</p>',
      '      </form>',
      '      <table>',
      '        <thead><tr><th>Account</th><th className="text-right">Amount</th></tr></thead>',
      '        <tbody>{rows.map((row) => <tr key={row.id}><td>{row.id}</td><td className="text-right tabular-nums">{row.amount}</td></tr>)}</tbody>',
      '      </table>',
      '    </main>',
      '  );',
      '}',
      '',
    ].join('\n'),
  });

  const result = await validateScreenCraft({
    workspaceRoot: root,
    screen: { screenId: 'risk' },
  });
  const ruleIds = result.findings.map((finding) => finding.ruleId);

  expect(ruleIds).not.toContain('craft.data-table.numeric-alignment');
  expect(ruleIds).not.toContain('craft.form.missing-error-state');
});

test('D9.4 screen craft lints HTML profile artifacts', async () => {
  const root = await createHtmlCraftWorkspace({
    html: [
      '<main data-sd-screen-root>',
      '  <section class="bg-blue-500 text-gray-900" style="color: #123456">',
      '    <h1>Risk queue</h1>',
      '    <button class="icon-button">⚙</button>',
      '    <img src="https://placehold.co/640x360" alt="placeholder" />',
      '  </section>',
      '</main>',
      '',
    ].join('\n'),
  });

  const result = await validateScreenCraft({
    workspaceRoot: root,
    screen: { screenId: 'html-page' },
  });
  const ruleIds = result.findings.map((finding) => finding.ruleId);

  expect(ruleIds).toEqual(
    expect.arrayContaining([
      'craft.raw-hex',
      'craft.default-palette',
      'craft.emoji-icon',
      'craft.placeholder-asset',
    ]),
  );
});

test('connected HTML design system escalates raw palette/font to blocking (0108.5.3)', async () => {
  const root = await createConnectedHtmlDesignSystemWorkspace({
    html: [
      '<main data-sd-screen-root>',
      '  <section style="color: #123456; background: #abcdef; font-family: \'Comic Sans MS\', cursive">',
      '    <h1>Deal page</h1>',
      '  </section>',
      '</main>',
      '',
    ].join('\n'),
  });

  const result = await validateScreenCraft({
    workspaceRoot: root,
    screen: { screenId: 'html-page' },
  });

  expect(result.status).toBe('blocked');
  expect(result.findings).toContainEqual(
    expect.objectContaining({
      ruleId: 'craft.raw-hex',
      severity: 'blocking',
      message: expect.stringContaining('#123456'),
    }),
  );
  expect(result.findings).toContainEqual(
    expect.objectContaining({
      ruleId: 'craft.raw-font-family',
      severity: 'blocking',
      message: expect.stringContaining('Comic Sans MS'),
    }),
  );
});

test('HTML component CSS authoring keeps connected design-system raw color gate (0112 stage 4)', async () => {
  const root = await createConnectedHtmlDesignSystemWorkspace({
    html: '<main data-sd-screen-root><h1>Catalog</h1></main>\n',
  });
  await writeFile(
    join(root, 'components.css'),
    '.pricing-card { color: #123456; border-color: var(--color-brand); }\n',
    'utf8',
  );

  const result = await validateScreenCraft({
    workspaceRoot: root,
    screen: { implementationFilePath: 'components.css' },
  });

  expect(result.status).toBe('findings');
  expect(result.findings).toContainEqual(
    expect.objectContaining({
      ruleId: 'craft.raw-hex',
      severity: 'should-fix',
      filePath: 'components.css',
      message: expect.stringContaining('#123456'),
    }),
  );
});

test('connected HTML design system accepts token-only screens without palette findings (0108.5.3)', async () => {
  const root = await createConnectedHtmlDesignSystemWorkspace({
    html: [
      '<main data-sd-screen-root>',
      '  <section style="color: var(--color-brand); font-family: var(--font-sans)">',
      '    <h1>Deal page</h1>',
      '  </section>',
      '</main>',
      '',
    ].join('\n'),
  });

  const result = await validateScreenCraft({
    workspaceRoot: root,
    screen: { screenId: 'html-page' },
  });

  expect(result.findings).not.toContainEqual(expect.objectContaining({ ruleId: 'craft.raw-hex' }));
  expect(result.findings).not.toContainEqual(
    expect.objectContaining({ ruleId: 'craft.raw-font-family' }),
  );
});

test('wireframe screen craft profile skips greybox data/reuse blockers but keeps source checks', async () => {
  const root = await createCraftWorkspace({
    screenSource: [
      'const rows = [{ id: 1, amount: "$2.4M" }];',
      'type Row = (typeof rows)[number];',
      '',
      'function RawRowsSurface({ rows: surfaceRows }: { rows: Row[] }) {',
      '  return (',
      '    <section className="row">',
      '      <button>Filter</button>',
      '      {surfaceRows.map((row) => <div className="row" key={row.id}>{row.amount}</div>)}',
      '    </section>',
      '  );',
      '}',
      '',
      'export function RiskDashboard() {',
      '  return (',
      '    <main data-sd-screen-root>',
      '      <h1>Risk queue</h1>',
      '      <RawRowsSurface rows={rows} />',
      '    </main>',
      '  );',
      '}',
      '',
    ].join('\n'),
  });
  const componentPack: TaskRelevantComponentPack = {
    status: 'ready',
    source: 'design-index',
    stale: false,
    taskKind: 'screen-generation',
    diagnostics: [],
    candidates: [
      {
        role: 'data-table',
        componentId: 'components-data-table',
        title: 'Components/DataTable',
        shortName: 'ProjectDataTable',
        confidence: 'high',
        recordConfidence: 'high',
        score: 12,
        reason: 'Matched dense data table role.',
        guidance: [],
        variantHints: [],
      },
    ],
  };

  const standard = await validateScreenCraft({
    workspaceRoot: root,
    screen: { screenId: 'risk' },
    componentPack,
  });
  const wireframe = await validateScreenCraft({
    workspaceRoot: root,
    screen: { screenId: 'risk' },
    componentPack,
    profile: 'wireframe',
  });

  expect(standard.findings.map((finding) => finding.ruleId)).toEqual(
    expect.arrayContaining([
      'craft.fake-metric',
      'craft.missing-state',
      'craft.component-family.missing-data-table',
    ]),
  );
  expect(wireframe.profile).toBe('wireframe');
  expect(wireframe.status).toBe('passed');
  expect(wireframe.findings.map((finding) => finding.ruleId)).not.toEqual(
    expect.arrayContaining([
      'craft.fake-metric',
      'craft.missing-state',
      'craft.component-family.missing-data-table',
    ]),
  );
});

test('wireframe screen craft profile also relaxes HTML catalog reuse checks', async () => {
  const root = await createHtmlCraftWorkspace({
    html: [
      '<main data-sd-screen-root>',
      '  <section class="greybox">',
      '    <h1>Deal registry</h1>',
      '    <p>$2.4M exposure</p>',
      '  </section>',
      '</main>',
      '',
    ].join('\n'),
  });
  const componentPack: TaskRelevantComponentPack = {
    status: 'ready',
    source: 'design-index',
    stale: false,
    taskKind: 'screen-generation',
    diagnostics: [],
    candidates: [
      {
        role: 'content-panel',
        componentId: 'css-catalog-deal-panel',
        title: 'Deal panel',
        shortName: 'DealPanel',
        confidence: 'high',
        recordConfidence: 'high',
        score: 10,
        reason: 'Matched content panel role.',
        guidance: [],
        variantHints: [],
        requiredClasses: ['deal-panel'],
      },
    ],
  };

  const standard = await validateScreenCraft({
    workspaceRoot: root,
    screen: { screenId: 'html-page' },
    componentPack,
  });
  const wireframe = await validateScreenCraft({
    workspaceRoot: root,
    screen: { screenId: 'html-page' },
    componentPack,
    profile: 'wireframe',
  });

  expect(standard.findings.map((finding) => finding.ruleId)).toEqual(
    expect.arrayContaining(['craft.fake-metric', 'craft.component-reuse.missing-tile']),
  );
  expect(wireframe.profile).toBe('wireframe');
  expect(wireframe.status).toBe('passed');
  expect(wireframe.findings.map((finding) => finding.ruleId)).not.toEqual(
    expect.arrayContaining(['craft.fake-metric', 'craft.component-reuse.missing-tile']),
  );
});

// ---------- 0132.5: surface-aware craft ----------

const WELL_FORMED_MODAL = [
  '<style>',
  '  html, body { background: transparent; }',
  '  [data-sd-modal-window] { overflow: hidden; }',
  '  [data-sd-modal-region="body"] { flex: 1; min-height: 0; overflow-y: auto; }',
  '</style>',
  '<main data-sd-screen-root data-sd-modal-backdrop>',
  '  <div data-sd-modal-window data-sd-modal-content="scroll" style="--sd-modal-width: 420px; --sd-modal-height: auto"',
  '       role="dialog" aria-modal="true" aria-labelledby="t">',
  '    <header data-sd-modal-region="header"><h2 id="t">Delete file?</h2></header>',
  '    <div data-sd-modal-region="body"><p>This removes the file.</p></div>',
  '    <footer data-sd-modal-region="footer"><button>Cancel</button><button>Delete</button></footer>',
  '  </div>',
  '</main>',
  '',
].join('\n');

test('craft does not blocking-flag a well-formed modal or expect page regions (Р-11)', async () => {
  const root = await createHtmlCraftWorkspace({ html: WELL_FORMED_MODAL });
  const result = await validateScreenCraft({
    workspaceRoot: root,
    screen: { implementationFilePath: 'site/page.html' },
    surface: 'modal',
  });

  expect(result.findings.filter((finding) => finding.severity === 'blocking')).toEqual([]);
  for (const ruleId of result.findings.map((finding) => finding.ruleId)) {
    expect(ruleId).not.toBe('craft.component-reuse.missing-page-header');
    expect(ruleId).not.toBe('craft.component-reuse.missing-breadcrumb');
    expect(ruleId).not.toMatch(/^craft\.modal\./);
  }
});

test('craft flags a modal missing the window marker', async () => {
  const root = await createHtmlCraftWorkspace({
    html: '<main data-sd-screen-root><div>just a dialog</div></main>\n',
  });
  const result = await validateScreenCraft({
    workspaceRoot: root,
    screen: { implementationFilePath: 'site/page.html' },
    surface: 'modal',
  });
  expect(result.findings).toContainEqual(
    expect.objectContaining({ ruleId: 'craft.modal.missing-window', severity: 'blocking' }),
  );
  expect(result.status).toBe('blocked');
});

test('craft warns when a modal size is hardcoded instead of the contract variable (риск №18)', async () => {
  const root = await createHtmlCraftWorkspace({
    html: [
      '<main data-sd-screen-root data-sd-modal-backdrop>',
      '  <div data-sd-modal-window style="width: 420px" role="dialog" aria-modal="true">',
      '    <div data-sd-modal-region="body">x</div>',
      '  </div>',
      '</main>',
      '',
    ].join('\n'),
  });
  const result = await validateScreenCraft({
    workspaceRoot: root,
    screen: { implementationFilePath: 'site/page.html' },
    surface: 'modal',
  });
  expect(result.findings).toContainEqual(
    expect.objectContaining({ ruleId: 'craft.modal.size-not-in-contract', severity: 'blocking' }),
  );
});

test('craft counts rendered modal markers, not comments, and blocks duplicates', async () => {
  const root = await createHtmlCraftWorkspace({
    html: `${WELL_FORMED_MODAL}\n<!-- <div data-sd-modal-window>ignored</div> -->\n<div data-sd-modal-window></div>\n`,
  });
  const result = await validateScreenCraft({
    workspaceRoot: root,
    screen: { implementationFilePath: 'site/page.html' },
    surface: 'modal',
  });
  expect(result.findings).toContainEqual(
    expect.objectContaining({
      ruleId: 'craft.modal.ambiguous-window',
      severity: 'blocking',
    }),
  );
});

test('craft blocks a modal marker on a non-forwarding React component', async () => {
  const root = await createCraftWorkspace({
    screenSource: [
      'function Wrapper() { return null; }',
      'export function RiskDashboard() {',
      '  return (',
      '    <main data-sd-screen-root data-sd-modal-backdrop>',
      '      <Wrapper data-sd-modal-window data-sd-modal-content="scroll"',
      '        role="dialog" aria-modal="true" aria-label="Confirm"',
      '        style={{ "--sd-modal-width": "420px", "--sd-modal-height": "auto", overflow: "hidden" }}>',
      '        <div data-sd-modal-region="body" style={{ flex: 1, minHeight: 0, overflowY: "auto" }} />',
      '      </Wrapper>',
      '    </main>',
      '  );',
      '}',
      '',
    ].join('\n'),
  });
  const result = await validateScreenCraft({
    workspaceRoot: root,
    screen: { screenId: 'risk' },
    surface: 'modal',
  });
  expect(result.findings).toContainEqual(
    expect.objectContaining({ ruleId: 'craft.modal.non-forwarding-window' }),
  );
});

test('craft blocks page metadata that still renders a modal contract', async () => {
  const root = await createHtmlCraftWorkspace({ html: WELL_FORMED_MODAL });
  const result = await validateScreenCraft({
    workspaceRoot: root,
    screen: { implementationFilePath: 'site/page.html' },
    surface: 'page',
  });
  expect(result.findings).toContainEqual(
    expect.objectContaining({ ruleId: 'craft.modal.page-surface-mismatch' }),
  );
});

test('craft blocks opaque, inaccessible modal hosts with a broken scroll contract', async () => {
  const root = await createHtmlCraftWorkspace({
    html: [
      '<style>html, body { background: #fff; }</style>',
      '<main data-sd-screen-root data-sd-modal-backdrop>',
      '  <div data-sd-modal-window data-sd-modal-content="scroll"',
      '       style="--sd-modal-width: 420px; --sd-modal-height: 70vh">',
      '    <div data-sd-modal-region="body">Long content</div>',
      '  </div>',
      '</main>',
    ].join('\n'),
  });
  const result = await validateScreenCraft({
    workspaceRoot: root,
    screen: { implementationFilePath: 'site/page.html' },
    surface: 'modal',
  });
  expect(result.findings.map((finding) => finding.ruleId)).toEqual(
    expect.arrayContaining([
      'craft.modal.accessibility',
      'craft.modal.scroll-contract',
      'craft.modal.opaque-host',
    ]),
  );
  expect(result.status).toBe('blocked');
});

test('craft blocks grow mode when the backdrop cannot scroll', async () => {
  const root = await createHtmlCraftWorkspace({
    html: WELL_FORMED_MODAL.replace(
      'data-sd-modal-content="scroll"',
      'data-sd-modal-content="grow"',
    ),
  });
  const result = await validateScreenCraft({
    workspaceRoot: root,
    screen: { implementationFilePath: 'site/page.html' },
    surface: 'modal',
  });
  expect(result.findings).toContainEqual(
    expect.objectContaining({ ruleId: 'craft.modal.grow-contract' }),
  );
});

async function createCraftWorkspace(input: { screenSource: string }): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-screen-craft-'));
  await mkdir(join(root, 'src', 'screens'), { recursive: true });
  await mkdir(join(root, 'src', 'components'), { recursive: true });
  await mkdir(join(root, '.sber-designer/design-index'), { recursive: true });
  await writeFile(join(root, 'src', 'screens', 'RiskDashboard.tsx'), input.screenSource, 'utf8');
  await writeFile(
    join(root, 'src', 'components', 'DataTable.tsx'),
    'export function DataTable() { return <table />; }',
    'utf8',
  );
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.screens),
    [
      JSON.stringify({
        id: 'risk',
        name: 'Risk dashboard',
        implementationPath: 'src/screens/RiskDashboard.tsx',
        storyPath: 'src/stories/RiskDashboard.stories.tsx',
        routePath: '/risk',
        designReadableStatus: 'candidate',
        source: 'route',
      }),
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
    [
      JSON.stringify({
        id: 'components-data-table',
        title: 'Components/DataTable',
        shortName: 'DataTable',
        filePath: 'src/components/DataTable.tsx',
        storyCount: 1,
        stories: [{ id: 'components-data-table--default', name: 'Default' }],
        tags: [],
        groupIds: [],
        noteCount: 0,
        confidence: 'high',
      }),
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.tokens),
    JSON.stringify(
      {
        tokens: [
          {
            id: 'css:src/styles/tokens.css:surface-default',
            name: 'surface-default',
            value: '#ffffff',
            source: 'css',
            filePath: 'src/styles/tokens.css',
            kind: 'color',
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );
  return root;
}

async function createHtmlCraftWorkspace(input: { html: string }): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-html-screen-craft-'));
  await mkdir(join(root, 'site'), { recursive: true });
  await mkdir(join(root, '.sber-designer/design-index'), { recursive: true });
  await writeFile(join(root, 'site', 'page.html'), input.html, 'utf8');
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.screens),
    [
      JSON.stringify({
        id: 'html-page',
        name: 'HTML page',
        implementationPath: 'site/page.html',
        routePath: '/site/page.html',
        designReadableStatus: 'candidate',
        source: 'file-system',
      }),
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.tokens),
    JSON.stringify(
      {
        tokens: [
          {
            id: 'css:site/styles.css:surface-default',
            name: 'surface-default',
            value: '#ffffff',
            source: 'css',
            filePath: 'site/styles.css',
            kind: 'color',
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );
  return root;
}

async function createConnectedHtmlDesignSystemWorkspace(input: { html: string }): Promise<string> {
  const root = await createHtmlCraftWorkspace({ html: input.html });
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.tokens),
    JSON.stringify(
      {
        tokens: [
          {
            id: 'css:tokens.css:color-brand',
            name: 'color-brand',
            value: '#14532d',
            source: 'css',
            filePath: 'tokens.css',
            kind: 'color',
          },
          {
            id: 'css:tokens.css:font-sans',
            name: 'font-sans',
            value: 'Inter, sans-serif',
            source: 'css',
            filePath: 'tokens.css',
            kind: 'typography',
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.manifest),
    JSON.stringify(
      {
        version: 3,
        projectName: 'Connected HTML DS',
        projectProfile: {
          kind: 'html-css',
          componentModel: 'css-catalog',
          htmlDesignSystem: { status: 'connected', missingRequired: [] },
        },
      },
      null,
      2,
    ),
    'utf8',
  );
  return root;
}

function findTool(name: string) {
  const tool = ALL_TOOLS.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool;
}

function toolContext(workspacePath: string): ToolContext {
  return {
    user: 'test-user',
    projectName: 'Craft Project',
    activeScreen: null,
    assistantTaskIntent: null,
    workspacePath,
    canvasUrl: null,
  };
}
