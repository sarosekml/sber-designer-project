import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { loadDesignTokens } from '../services/api/src/design-tokens';

test('loads tokens from design index and CSS variables', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-design-tokens-'));
  await mkdir(join(root, '.sber-designer', 'design-index'), { recursive: true });
  await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(
    join(root, '.sber-designer', 'design-index', 'tokens.json'),
    JSON.stringify({
      tokens: [
        {
          id: 'design-md:colors.primary',
          name: 'colors.primary',
          value: '#00aa9b',
          kind: 'color',
          source: 'design-md',
          filePath: 'DESIGN.md',
        },
      ],
    }),
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'styles.css'),
    ':root { --radius-md: 8px; --space-sm: 0.5rem; }',
    'utf8',
  );

  const tokens = await loadDesignTokens(root);

  expect(tokens.colors).toContainEqual({
    id: 'design-md:colors.primary',
    name: 'colors.primary',
    value: '#00aa9b',
    source: 'DESIGN.md',
  });
  expect(tokens.radius.some((token) => token.name === '--radius-md')).toBe(true);
  expect(tokens.spacing.some((token) => token.name === '--space-sm')).toBe(true);
});

test('loads simple flat Tailwind theme tokens', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-design-tailwind-'));
  await writeFile(
    join(root, 'tailwind.config.js'),
    [
      'export default {',
      '  theme: {',
      '    extend: {',
      '      colors: { brand: "#10b981" },',
      '      spacing: { panel: "24px" },',
      '      borderRadius: { soft: "10px" },',
      '    },',
      '  },',
      '};',
      '',
    ].join('\n'),
    'utf8',
  );

  const tokens = await loadDesignTokens(root);

  expect(tokens.colors.some((token) => token.name === 'colors.brand')).toBe(true);
  expect(tokens.spacing.some((token) => token.name === 'spacing.panel')).toBe(true);
  expect(tokens.radius.some((token) => token.name === 'borderRadius.soft')).toBe(true);
});
