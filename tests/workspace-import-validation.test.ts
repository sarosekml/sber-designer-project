import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { validateWorkspaceRelativeImports } from '../services/api/src/agent/workspace-import-validation';

test('rejects unresolved workspace alias imports without an index file', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-import-validation-'));
  await mkdir(join(workspace, 'src/components/atoms/Header/DashboardGroupHeader'), {
    recursive: true,
  });
  await writeFile(
    join(workspace, 'src/components/atoms/Header/DashboardGroupHeader/DashboardGroupHeader.tsx'),
    'export const DashboardGroupHeader = () => null;\n',
    'utf8',
  );

  await expect(
    validateWorkspaceRelativeImports(
      workspace,
      'src/screens/Dev-test/RiskMetrics.tsx',
      [
        "import { DashboardGroupHeader } from '@/components/atoms/Header/DashboardGroupHeader';",
        'export function RiskMetrics() { return <DashboardGroupHeader />; }',
      ].join('\n'),
    ),
  ).rejects.toThrow('unresolved workspace import');
  await expect(
    validateWorkspaceRelativeImports(
      workspace,
      'src/screens/Dev-test/RiskMetrics.tsx',
      [
        "import { DashboardGroupHeader } from '@/components/atoms/Header/DashboardGroupHeader';",
        'export function RiskMetrics() { return <DashboardGroupHeader />; }',
      ].join('\n'),
    ),
  ).rejects.toThrow('@/components/atoms/Header/DashboardGroupHeader/DashboardGroupHeader');
});

test('accepts workspace alias imports that resolve through a barrel index', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-import-validation-'));
  await mkdir(join(workspace, 'src/components/atoms/Header'), { recursive: true });
  await writeFile(
    join(workspace, 'src/components/atoms/Header/index.ts'),
    "export { DashboardGroupHeader } from './DashboardGroupHeader/DashboardGroupHeader';\n",
    'utf8',
  );
  await mkdir(join(workspace, 'src/components/atoms/Header/DashboardGroupHeader'), {
    recursive: true,
  });
  await writeFile(
    join(workspace, 'src/components/atoms/Header/DashboardGroupHeader/DashboardGroupHeader.tsx'),
    'export const DashboardGroupHeader = () => null;\n',
    'utf8',
  );

  await expect(
    validateWorkspaceRelativeImports(
      workspace,
      'src/screens/Dev-test/RiskMetrics.tsx',
      [
        "import { DashboardGroupHeader } from '@/components/atoms/Header';",
        "import { Box } from '@mui/material';",
        'export function RiskMetrics() { return <DashboardGroupHeader />; }',
      ].join('\n'),
    ),
  ).resolves.toBeUndefined();
});

test('accepts alias imports for dotted TypeScript module names', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-import-validation-'));
  await mkdir(join(workspace, 'src/components/organisms/Navigation'), { recursive: true });
  await writeFile(
    join(workspace, 'src/components/organisms/Navigation/Navigation.types.ts'),
    'export interface NavigationItemsType { label: string; }\n',
    'utf8',
  );

  await expect(
    validateWorkspaceRelativeImports(
      workspace,
      'src/screens/Dev-test/RiskMetrics.tsx',
      [
        "import type { NavigationItemsType } from '@/components/organisms/Navigation/Navigation.types';",
        'const items: NavigationItemsType[] = [];',
      ].join('\n'),
    ),
  ).resolves.toBeUndefined();
});

test('rejects named imports that are not exported by a workspace barrel', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-import-validation-'));
  await mkdir(join(workspace, 'src/components/molecules/Card'), { recursive: true });
  await writeFile(
    join(workspace, 'src/components/molecules/index.ts'),
    "export * from './Card';\n",
    'utf8',
  );
  await writeFile(
    join(workspace, 'src/components/molecules/Card/index.ts'),
    "export { BaseCard as Card } from './Card';\n",
    'utf8',
  );
  await writeFile(
    join(workspace, 'src/components/molecules/Card/Card.tsx'),
    'export const BaseCard = () => null;\n',
    'utf8',
  );

  await expect(
    validateWorkspaceRelativeImports(
      workspace,
      'src/screens/2026-06-04/DCMDeal.tsx',
      [
        "import { BaseCard } from '@/components/molecules';",
        'export function DCMDeal() { return <BaseCard />; }',
      ].join('\n'),
    ),
  ).rejects.toThrow('has no named export BaseCard');
  await expect(
    validateWorkspaceRelativeImports(
      workspace,
      'src/screens/2026-06-04/DCMDeal.tsx',
      [
        "import { BaseCard } from '@/components/molecules';",
        'export function DCMDeal() { return <BaseCard />; }',
      ].join('\n'),
    ),
  ).rejects.toThrow('Available exports: Card');
});

test('accepts re-export aliases under their public barrel name', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-import-validation-'));
  await mkdir(join(workspace, 'src/components/molecules/Card'), { recursive: true });
  await writeFile(
    join(workspace, 'src/components/molecules/index.ts'),
    "export * from './Card';\n",
    'utf8',
  );
  await writeFile(
    join(workspace, 'src/components/molecules/Card/index.ts'),
    "export { BaseCard as Card } from './Card';\n",
    'utf8',
  );
  await writeFile(
    join(workspace, 'src/components/molecules/Card/Card.tsx'),
    'export const BaseCard = () => null;\n',
    'utf8',
  );

  await expect(
    validateWorkspaceRelativeImports(
      workspace,
      'src/screens/2026-06-04/DCMDeal.tsx',
      [
        "import { Card } from '@/components/molecules';",
        'export function DCMDeal() { return <Card />; }',
      ].join('\n'),
    ),
  ).resolves.toBeUndefined();
});

test('does not reject named imports when a barrel has external star re-exports', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-import-validation-'));
  await mkdir(join(workspace, 'src/components'), { recursive: true });
  await writeFile(
    join(workspace, 'src/components/index.ts'),
    ["export { LocalButton } from './LocalButton';", "export * from '@external/icons';", ''].join(
      '\n',
    ),
    'utf8',
  );
  await writeFile(
    join(workspace, 'src/components/LocalButton.tsx'),
    'export const LocalButton = () => null;\n',
    'utf8',
  );

  await expect(
    validateWorkspaceRelativeImports(
      workspace,
      'src/screens/ExternalIconScreen.tsx',
      [
        "import { ExternalIcon } from '@/components';",
        'export function ExternalIconScreen() { return <ExternalIcon />; }',
      ].join('\n'),
    ),
  ).resolves.toBeUndefined();

  await expect(
    validateWorkspaceRelativeImports(
      workspace,
      'src/screens/LocalButtonScreen.tsx',
      [
        "import { LocalButton } from '@/components';",
        'export function LocalButtonScreen() { return <LocalButton />; }',
      ].join('\n'),
    ),
  ).resolves.toBeUndefined();
});

test('still rejects missing named imports when unresolved star re-exports are local', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-import-validation-'));
  await mkdir(join(workspace, 'src/components'), { recursive: true });
  await writeFile(
    join(workspace, 'src/components/index.ts'),
    "export * from './MissingLocalModule';\n",
    'utf8',
  );

  await expect(
    validateWorkspaceRelativeImports(
      workspace,
      'src/screens/MissingLocalScreen.tsx',
      [
        "import { MissingLocalExport } from '@/components';",
        'export function MissingLocalScreen() { return <MissingLocalExport />; }',
      ].join('\n'),
    ),
  ).rejects.toThrow('has no named export MissingLocalExport');
});

test('validates named imports through tsconfig paths aliases', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-import-validation-'));
  await mkdir(join(workspace, 'src/components'), { recursive: true });
  await writeFile(
    join(workspace, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          baseUrl: '.',
          paths: {
            '@components/*': ['src/components/*'],
            '~/*': ['src/*'],
            'src/*': ['src/*'],
          },
        },
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    join(workspace, 'src/components/Button.tsx'),
    'export const Button = () => null;\n',
    'utf8',
  );

  await expect(
    validateWorkspaceRelativeImports(
      workspace,
      'src/screens/AliasedScreen.tsx',
      [
        "import { MissingButton } from '@components/Button';",
        'export function AliasedScreen() { return <MissingButton />; }',
      ].join('\n'),
    ),
  ).rejects.toThrow('has no named export MissingButton');

  await expect(
    validateWorkspaceRelativeImports(
      workspace,
      'src/screens/AliasedScreen.tsx',
      [
        "import { Button } from '@components/Button';",
        "import { Button as ButtonViaTilde } from '~/components/Button';",
        "import { Button as ButtonViaSrc } from 'src/components/Button';",
        'export function AliasedScreen() { return <><Button /><ButtonViaTilde /><ButtonViaSrc /></>; }',
      ].join('\n'),
    ),
  ).resolves.toBeUndefined();
});

test('validates named imports through vite object aliases', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-import-validation-'));
  await mkdir(join(workspace, 'src/kit'), { recursive: true });
  await writeFile(
    join(workspace, 'vite.config.ts'),
    [
      "import path from 'node:path';",
      "import { defineConfig } from 'vite';",
      '',
      'export default defineConfig({',
      '  resolve: {',
      '    alias: {',
      "      '@kit': path.resolve(__dirname, 'src/kit'),",
      "      '~': path.resolve(__dirname, 'src'),",
      '    },',
      '  },',
      '});',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(workspace, 'src/kit/Badge.tsx'),
    'export const Badge = () => null;\n',
    'utf8',
  );

  await expect(
    validateWorkspaceRelativeImports(
      workspace,
      'src/screens/ViteScreen.tsx',
      [
        "import { MissingBadge } from '@kit/Badge';",
        'export function ViteScreen() { return <MissingBadge />; }',
      ].join('\n'),
    ),
  ).rejects.toThrow('has no named export MissingBadge');

  await expect(
    validateWorkspaceRelativeImports(
      workspace,
      'src/screens/ViteScreen.tsx',
      [
        "import { Badge } from '@kit/Badge';",
        "import { Badge as BadgeViaTilde } from '~/kit/Badge';",
        'export function ViteScreen() { return <><Badge /><BadgeViaTilde /></>; }',
      ].join('\n'),
    ),
  ).resolves.toBeUndefined();
});

test('validates named imports through vite array aliases', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-import-validation-'));
  await mkdir(join(workspace, 'src/ui'), { recursive: true });
  await writeFile(
    join(workspace, 'vite.config.ts'),
    [
      "import path from 'node:path';",
      "import { defineConfig } from 'vite';",
      '',
      'export default defineConfig({',
      '  resolve: {',
      '    alias: [',
      "      { find: '@ui', replacement: path.resolve(__dirname, 'src/ui') },",
      '    ],',
      '  },',
      '});',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(join(workspace, 'src/ui/Card.tsx'), 'export const Card = () => null;\n', 'utf8');

  await expect(
    validateWorkspaceRelativeImports(
      workspace,
      'src/screens/ViteArrayScreen.tsx',
      [
        "import { MissingCard } from '@ui/Card';",
        'export function ViteArrayScreen() { return <MissingCard />; }',
      ].join('\n'),
    ),
  ).rejects.toThrow('has no named export MissingCard');

  await expect(
    validateWorkspaceRelativeImports(
      workspace,
      'src/screens/ViteArrayScreen.tsx',
      [
        "import { Card } from '@ui/Card';",
        'export function ViteArrayScreen() { return <Card />; }',
      ].join('\n'),
    ),
  ).resolves.toBeUndefined();
});
