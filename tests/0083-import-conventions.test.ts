/**
 * 0083 G1 — project import-convention cheat-sheet. Reproduces the DCM
 * name-collision class: the kit and MUI both export `Grid`/`Table`, and the
 * model imported the wrong one. The pack must tell the model which module the
 * project actually uses, flagging collisions.
 */
import { expect, test } from 'bun:test';

import {
  collectImportConventions,
  renderImportConventionsBlock,
} from '../services/api/src/component-intelligence/import-conventions';

const screen = (...lines: string[]) => ({ contents: lines.join('\n') });

test('flags a symbol imported from two modules as a collision, most-used module first', () => {
  const files = [
    screen("import { Grid } from '@mui/material';", "import { Text } from '@/components/atoms';"),
    screen("import { Grid, Box } from '@mui/material';"),
    screen("import { Grid } from '@/components/atoms';"), // the wrong one, used once
  ];

  const conventions = collectImportConventions(files);
  const grid = conventions.find((c) => c.symbol === 'Grid');
  expect(grid?.collision).toBe(true);
  expect(grid?.modules[0]).toEqual({ module: '@mui/material', count: 2 });
  expect(grid?.modules[1]).toEqual({ module: '@/components/atoms', count: 1 });

  // Collisions are ordered before non-collisions.
  expect(conventions[0].symbol).toBe('Grid');
});

test('non-colliding frequent symbols carry their single canonical module', () => {
  const files = [
    screen("import { Text } from '@/components/atoms';"),
    screen("import { Text } from '@/components/atoms';"),
  ];
  const text = collectImportConventions(files).find((c) => c.symbol === 'Text');
  expect(text?.collision).toBe(false);
  expect(text?.modules).toEqual([{ module: '@/components/atoms', count: 2 }]);
});

test('ignores type-only imports, namespace imports, and non-component (lowercase) symbols', () => {
  const files = [
    screen(
      "import type { TableProps } from '@/components/organisms/Tables';",
      "import * as React from 'react';",
      "import { useState } from 'react';",
    ),
  ];
  const conventions = collectImportConventions(files);
  expect(conventions.find((c) => c.symbol === 'TableProps')).toBeUndefined(); // type-only
  expect(conventions.find((c) => c.symbol === 'useState')).toBeUndefined(); // lowercase
  expect(conventions.find((c) => c.symbol === 'React')).toBeUndefined(); // namespace
});

test('drops Storybook, relative-path, and *Props noise (code-review R1)', () => {
  const files = [
    screen(
      "import { Meta } from '@storybook/blocks';", // @storybook value import → drop
      "import { ButtonProps } from '@/components/atoms/buttons/Button/Button';", // *Props → drop
      "import { Icon } from '../Icon';", // relative path → drop
      "import { Grid } from '@mui/material';", // real DS/framework import → keep
    ),
  ];
  const symbols = collectImportConventions(files).map((c) => c.symbol);
  expect(symbols).toContain('Grid');
  expect(symbols).not.toContain('Meta');
  expect(symbols).not.toContain('ButtonProps');
  expect(symbols).not.toContain('Icon');
});

test('renders a compact cheat-sheet that calls out collisions', () => {
  const files = [
    screen("import { Grid } from '@mui/material';"),
    screen("import { Grid } from '@mui/material';"),
    screen("import { Grid } from '@/components/atoms';"),
    screen("import { Text } from '@/components/atoms';"),
  ];
  const block = renderImportConventionsBlock(collectImportConventions(files));
  const text = block.join('\n');
  expect(text).toContain('Project import conventions');
  expect(text).toContain('Grid ← @mui/material');
  expect(text).toContain('COLLISION');
  expect(text).toContain('Text ← @/components/atoms');
});

test('empty input renders no block', () => {
  expect(renderImportConventionsBlock(collectImportConventions([]))).toEqual([]);
});
