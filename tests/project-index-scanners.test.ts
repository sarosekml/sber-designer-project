import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test } from 'bun:test';

import { scanRoutes } from '../packages/design-indexer/src/route-scanner';
import { scanProjectTokens } from '../packages/design-indexer/src/token-scanner';
import { indexFromStaticAst } from '../packages/storybook-indexer/src';

test('static component scanner indexes named exports, wrappers and folder barrels', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-static-scanner-'));
  await mkdir(join(root, 'src', 'components', 'toolbar'), { recursive: true });
  await writeFile(
    join(root, 'src', 'components', 'DataTable.tsx'),
    'export function DataTable() { return <table />; }',
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'components', 'MetricCard.tsx'),
    [
      'import { memo } from "react";',
      'const MetricCardView = () => <section />;',
      'export const MetricCard = memo(MetricCardView);',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'components', 'toolbar', 'ToolbarButton.tsx'),
    'export default function ToolbarButton() { return <button />; }',
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'components', 'toolbar', 'index.ts'),
    "export { default as ToolbarButton } from './ToolbarButton';",
    'utf8',
  );

  const catalog = await indexFromStaticAst(root);
  const components = catalog.components.map((component) => ({
    shortName: component.shortName,
    filePath: component.filePath,
  }));

  expect(components).toContainEqual({
    shortName: 'DataTable',
    filePath: 'src/components/DataTable.tsx',
  });
  expect(components).toContainEqual({
    shortName: 'MetricCard',
    filePath: 'src/components/MetricCard.tsx',
  });
  expect(components).toContainEqual({
    shortName: 'ToolbarButton',
    filePath: 'src/components/toolbar/index.ts',
  });
});

test('route scanner discovers simple react-router routes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-route-scanner-'));
  await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(
    join(root, 'src', 'App.tsx'),
    [
      'import { Route } from "react-router-dom";',
      'const routes = [{ path: "/reports", element: <Reports /> }];',
      'export default function App() {',
      '  return <Route path="/customers" element={<Customers />} />;',
      '}',
    ].join('\n'),
    'utf8',
  );

  const routes = await scanRoutes(root);

  expect(routes).toContainEqual(
    expect.objectContaining({
      routePath: '/customers',
      filePath: 'src/App.tsx',
      source: 'react-router',
    }),
  );
  expect(routes).toContainEqual(
    expect.objectContaining({
      routePath: '/reports',
      filePath: 'src/App.tsx',
      source: 'react-router',
    }),
  );
});

test('route scanner does not treat vite src/pages files as next pages', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-route-scanner-vite-pages-'));
  await mkdir(join(root, 'src', 'pages'), { recursive: true });
  await writeFile(
    join(root, 'src', 'pages', 'Foo.tsx'),
    'export default function Foo() { return <main>Foo</main>; }',
    'utf8',
  );

  const routes = await scanRoutes(root, { frameworks: ['react', 'vite'] });

  expect(routes.some((route) => route.filePath === 'src/pages/Foo.tsx')).toBe(false);
});

test('route scanner keeps next pages when next is detected', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-route-scanner-next-pages-'));
  await mkdir(join(root, 'src', 'pages'), { recursive: true });
  await writeFile(
    join(root, 'src', 'pages', 'Foo.tsx'),
    'export default function Foo() { return <main>Foo</main>; }',
    'utf8',
  );

  const routes = await scanRoutes(root, { frameworks: ['next', 'react'] });

  expect(routes).toContainEqual(
    expect.objectContaining({
      routePath: '/Foo',
      filePath: 'src/pages/Foo.tsx',
      source: 'next-pages',
    }),
  );
});

test('token scanner reads css variables, tailwind config and theme files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-token-scanner-'));
  await mkdir(join(root, 'src', 'styles'), { recursive: true });
  await mkdir(join(root, 'theme'), { recursive: true });
  await writeFile(
    join(root, 'src', 'styles', 'tokens.css'),
    ':root { --surface-default: #ffffff; --spacing-md: 16px; }',
    'utf8',
  );
  await writeFile(
    join(root, 'tailwind.config.ts'),
    "export default { theme: { extend: { colors: { brandPrimary: '#0f766e' } } } };",
    'utf8',
  );
  await writeFile(
    join(root, 'theme', 'tokens.json'),
    JSON.stringify({ radiusLg: '12px', fontBody: 'Inter' }, null, 2),
    'utf8',
  );

  const tokens = await scanProjectTokens(root, null, 'Use --chart-accent: #f97316; for charts.');

  expect(tokens).toContainEqual(
    expect.objectContaining({ name: 'surface-default', source: 'css' }),
  );
  expect(tokens).toContainEqual(
    expect.objectContaining({ name: 'brandPrimary', value: '#0f766e', source: 'tailwind' }),
  );
  expect(tokens).toContainEqual(
    expect.objectContaining({ name: 'radiusLg', value: '12px', source: 'theme' }),
  );
  expect(tokens).toContainEqual(
    expect.objectContaining({ name: 'chart-accent', value: '#f97316', source: 'design-brief' }),
  );
});
