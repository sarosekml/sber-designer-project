import { mkdir, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { validateGeneratedSourceHealth } from '../services/api/src/agent/generated-source-health';

test('generated source health reports parse errors', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-source-health-'));
  await mkdir(join(workspace, 'src', 'screens'), { recursive: true });
  await writeFile(
    join(workspace, 'src', 'screens', 'Broken.tsx'),
    'export function Broken() { return <main>; }\n',
    'utf8',
  );

  const health = await validateGeneratedSourceHealth({
    workspaceRoot: workspace,
    filePaths: ['src/screens/Broken.tsx'],
  });

  expect(health.ok).toBe(false);
  expect(health.findings).toContainEqual(
    expect.objectContaining({ ruleId: 'parse-error', severity: 'error' }),
  );
});

test('generated source health reports unknown JSX components', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-source-health-'));
  await mkdir(join(workspace, 'src', 'screens'), { recursive: true });
  await writeFile(
    join(workspace, 'src', 'screens', 'Broken.tsx'),
    'export function Broken() { return <Tab />; }\n',
    'utf8',
  );

  const health = await validateGeneratedSourceHealth({
    workspaceRoot: workspace,
    filePaths: ['src/screens/Broken.tsx'],
  });

  expect(health.ok).toBe(false);
  expect(health.findings).toContainEqual(
    expect.objectContaining({
      ruleId: 'unknown-jsx-component',
      message: expect.stringContaining('Tab'),
    }),
  );
});

test('generated source health reports unresolved JSX shorthand expression containers', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-source-health-'));
  await mkdir(join(workspace, 'src', 'screens'), { recursive: true });
  await writeFile(
    join(workspace, 'src', 'screens', 'Broken.tsx'),
    [
      "import { Tab } from './ui';",
      'export function Broken() {',
      '  return <Tab label={{label}} value={{i}} />;',
      '}',
    ].join('\n'),
    'utf8',
  );

  const health = await validateGeneratedSourceHealth({
    workspaceRoot: workspace,
    filePaths: ['src/screens/Broken.tsx'],
  });

  expect(health.ok).toBe(false);
  expect(health.findings).toContainEqual(
    expect.objectContaining({
      ruleId: 'unresolved-jsx-shorthand',
      message: expect.stringContaining('label'),
    }),
  );
  expect(health.findings).toContainEqual(
    expect.objectContaining({
      ruleId: 'unresolved-jsx-shorthand',
      message: expect.stringContaining('i'),
    }),
  );
});

test('generated source health allows imported components and local callback variables', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-source-health-'));
  await mkdir(join(workspace, 'src', 'screens'), { recursive: true });
  await writeFile(
    join(workspace, 'src', 'screens', 'Healthy.tsx'),
    [
      "import { Tab } from './ui';",
      'export function Healthy() {',
      "  const tabs = ['Overview'];",
      '  return <>{tabs.map((label, i) => <Tab key={label} label={label} value={i} />)}</>;',
      '}',
    ].join('\n'),
    'utf8',
  );

  const health = await validateGeneratedSourceHealth({
    workspaceRoot: workspace,
    filePaths: ['src/screens/Healthy.tsx'],
  });

  expect(health).toEqual({ ok: true, findings: [] });
});

test('generated source health warns when source suppresses TypeScript errors', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-source-health-'));
  await mkdir(join(workspace, 'src', 'screens'), { recursive: true });
  await writeFile(
    join(workspace, 'src', 'screens', 'Suppressed.tsx'),
    [
      'export function Suppressed() {',
      '  // @ts-ignore generated import mismatch',
      '  return <main data-state="ignored">Screen</main>;',
      '}',
    ].join('\n'),
    'utf8',
  );

  const health = await validateGeneratedSourceHealth({
    workspaceRoot: workspace,
    filePaths: ['src/screens/Suppressed.tsx'],
  });

  expect(health.ok).toBe(true);
  expect(health.findings).toContainEqual(
    expect.objectContaining({
      ruleId: 'ts-suppression-comment',
      severity: 'warning',
      message: expect.stringContaining('@ts-ignore'),
    }),
  );
});

test('generated source health rejects Lucide fallback names passed into project Icon iconName', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-source-health-'));
  await mkdir(join(workspace, '.sber-designer', 'design-index'), { recursive: true });
  await mkdir(join(workspace, 'src', 'screens'), { recursive: true });
  await writeFile(
    join(workspace, '.sber-designer', 'design-index', 'icon-candidates.jsonl'),
    [
      JSON.stringify({
        id: 'icon-candidate-project-icon-prop-riskalert',
        name: 'RiskAlert',
        source: 'project-icon-prop',
        validFor: ['project-icon-prop'],
        componentName: 'Icon',
        propName: 'iconName',
        confidence: 'high',
        filePath: 'src/components/Icon/Icon.const.ts',
      }),
      JSON.stringify({
        id: 'icon-candidate-lucide-fallback-search',
        name: 'Search',
        source: 'lucide-fallback',
        validFor: ['lucide-import'],
        importName: 'Search',
        importSource: 'lucide-react',
        confidence: 'fallback',
      }),
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(workspace, 'src', 'screens', 'BrokenIcon.tsx'),
    [
      "import { Icon } from '../components/Icon';",
      'export function BrokenIcon() {',
      '  return <Icon iconName="Search" />;',
      '}',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(workspace, 'src', 'screens', 'HealthyIcon.tsx'),
    [
      "import { Icon } from '../components/Icon';",
      'export function HealthyIcon() {',
      '  return <Icon iconName="RiskAlert" />;',
      '}',
    ].join('\n'),
    'utf8',
  );

  const broken = await validateGeneratedSourceHealth({
    workspaceRoot: workspace,
    filePaths: ['src/screens/BrokenIcon.tsx'],
  });
  const healthy = await validateGeneratedSourceHealth({
    workspaceRoot: workspace,
    filePaths: ['src/screens/HealthyIcon.tsx'],
  });

  expect(broken.ok).toBe(false);
  expect(broken.findings).toContainEqual(
    expect.objectContaining({
      ruleId: 'invalid-project-icon-prop',
      severity: 'error',
      message: expect.stringContaining('Search'),
    }),
  );
  expect(healthy).toEqual({ ok: true, findings: [] });
});
