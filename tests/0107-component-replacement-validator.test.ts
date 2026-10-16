import { expect, test } from 'bun:test';

import {
  extractComponentReplacementIntent,
  extractForbiddenComponentNames,
  extractRequiredComponentNames,
  positiveComponentIntentText,
  validateComponentRoleContractsSource,
  validateComponentReplacementSource,
} from '../services/api/src/component-intelligence/component-intent';

test('0114 extracts explicitly required components from English and Russian constraints', () => {
  expect(
    extractRequiredComponentNames(
      'Use component Tile for panels. Используй компонент DataTable для списка. Не используй компонент Grid.',
    ),
  ).toEqual(['Tile', 'DataTable']);
  expect(
    extractRequiredComponentNames(
      'Use component Tile for panels. Do not use component Grid. Never use Paper component.',
    ),
  ).toEqual(['Tile']);
  expect(
    extractForbiddenComponentNames(
      'Используй компонент Tile. Не используй текущие экраны. Не используй компонент Grid. Без компонента Paper.',
    ),
  ).toEqual(['Grid', 'Paper']);
  expect(extractRequiredComponentNames('Используй дизайн систему и компоненты')).toEqual([]);
  expect(positiveComponentIntentText('Создай профиль. Не используй Grid.')).toBe(
    'Создай профиль. Не используй .',
  );
});

test('D4 extracts English and Russian component replacement intent', () => {
  expect(extractComponentReplacementIntent('Replace Grid with Tile components')).toEqual({
    forbidden: 'Grid',
    required: 'Tile',
  });
  expect(extractComponentReplacementIntent('замени все grid на tile')).toEqual({
    forbidden: 'Grid',
    required: 'Tile',
  });
});

test('D4 fails Grid to Tile replacement when Grid disappears but raw Box layout remains', () => {
  const source = [
    "import { Box } from '@mui/material';",
    "import { BaseTile } from '@/components/molecules/Tiles';",
    '',
    'export function Screen() {',
    '  return (',
    "    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>",
    '      <BaseTile title="Client"><Box>Client data</Box></BaseTile>',
    '      <BaseTile title="Terms"><Box>Terms data</Box></BaseTile>',
    '    </Box>',
    '  );',
    '}',
    '',
  ].join('\n');

  const result = validateComponentReplacementSource(source, {
    forbidden: 'Grid',
    required: 'Tile',
  });

  expect(result.status).toBe('failed');
  expect(result.reasonCode).toBe('raw_layout_fallback');
  expect(result.reason).toContain('Box');
});

test('D4 accepts Grid to Tile replacement when the target Tile contract is used', () => {
  const source = [
    "import { Tile } from '@/components/molecules/Tiles';",
    '',
    'export function Screen() {',
    '  return (',
    '    <Tile gridSizes={{ xs: 12, md: 6 }} title="Client">',
    '      <Text>Client data</Text>',
    '    </Tile>',
    '  );',
    '}',
    '',
  ].join('\n');

  expect(
    validateComponentReplacementSource(source, {
      forbidden: 'Grid',
      required: 'Tile',
    }),
  ).toMatchObject({
    status: 'passed',
  });
});

test('D4 fails image-to-screen role contract when component-pack chose Tile but source used Paper cards', () => {
  const source = [
    "import { Box, Paper } from '@mui/material';",
    '',
    'function PageCard({ children }: { children: React.ReactNode }) {',
    '  return <Paper elevation={0}>{children}</Paper>;',
    '}',
    '',
    'export function Screen() {',
    '  return (',
    "    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>",
    '      <PageCard>Client data</PageCard>',
    '      <PageCard>Credit terms</PageCard>',
    '    </Box>',
    '  );',
    '}',
    '',
  ].join('\n');

  const result = validateComponentRoleContractsSource(source, {
    status: 'ready',
    source: 'design-index',
    stale: false,
    taskKind: 'image-to-screen',
    diagnostics: [],
    candidates: [
      {
        role: 'content-panel',
        componentId: 'components/molecules/Tile',
        title: 'Tile',
        shortName: 'Tile',
        confidence: 'high',
        recordConfidence: 'confirmed',
        score: 10,
        reason: 'Matched content panel.',
        guidance: ['Use Tile for content panels.'],
      },
    ],
  });

  expect(result).toMatchObject({
    status: 'failed',
    reasonCode: 'required_component_missing',
    role: 'content-panel',
    required: 'Tile',
    rawLayoutFallbacks: ['Paper', 'PageCard', 'Box'],
  });
});

test('W6.4 downgrades weak stale screen-edit role contract misses to advisory', () => {
  const source = [
    "import { Box } from '@mui/material';",
    '',
    'export function Screen() {',
    '  return <Box>Detail layout without the stale Overlay suggestion</Box>;',
    '}',
    '',
  ].join('\n');

  const result = validateComponentRoleContractsSource(source, {
    status: 'weak',
    source: 'design-index',
    stale: true,
    taskKind: 'screen-edit',
    diagnostics: ['component pack is stale'],
    candidates: [
      {
        role: 'data-table',
        componentId: 'components/organisms/Overlay',
        title: 'Overlay',
        shortName: 'Overlay',
        confidence: 'low',
        recordConfidence: 'inferred',
        score: 4,
        reason: 'Stale data-table match from previous broad context.',
        guidance: ['Use Overlay for table-like contexts.'],
      },
    ],
  });

  expect(result).toMatchObject({
    status: 'advisory',
    reasonCode: 'role_contract_advisory',
    role: 'data-table',
    required: 'Overlay',
    advisoryReason: 'component pack is weak',
  });
});

test('D4 accepts image-to-screen role contract when source uses Tile family', () => {
  const source = [
    "import { BaseTile } from '@/components/molecules/Tiles';",
    '',
    'export function Screen() {',
    '  return <BaseTile title="Client">Client data</BaseTile>;',
    '}',
    '',
  ].join('\n');

  const result = validateComponentRoleContractsSource(source, {
    status: 'ready',
    source: 'design-index',
    stale: false,
    taskKind: 'image-to-screen',
    diagnostics: [],
    candidates: [
      {
        role: 'content-panel',
        componentId: 'components/molecules/Tile',
        title: 'Tile',
        shortName: 'Tile',
        confidence: 'high',
        recordConfidence: 'confirmed',
        score: 10,
        reason: 'Matched content panel.',
        guidance: ['Use Tile for content panels.'],
      },
    ],
  });

  expect(result).toMatchObject({
    status: 'passed',
    reasonCode: 'role_contract_verified',
    role: 'content-panel',
    required: 'Tile',
  });
});

test('L8.3a accepts raw layout primitives inside the required component container', () => {
  const source = [
    "import { BaseTile } from '@/components/molecules/Tiles';",
    "import { Grid } from '@mui/material';",
    '',
    'export function Screen() {',
    '  return (',
    '    <main>',
    '      <BaseTile title="Client">',
    "        <Grid sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>",
    '          <Text>Client data</Text>',
    '          <Icon name="arrow-right" />',
    '        </Grid>',
    '      </BaseTile>',
    '    </main>',
    '  );',
    '}',
    '',
  ].join('\n');

  const result = validateComponentRoleContractsSource(source, {
    status: 'ready',
    source: 'design-index',
    stale: false,
    taskKind: 'image-to-screen',
    diagnostics: [],
    candidates: [
      {
        role: 'content-panel',
        componentId: 'components/molecules/Tile',
        title: 'Tile',
        shortName: 'Tile',
        confidence: 'high',
        recordConfidence: 'confirmed',
        score: 10,
        reason: 'Matched content panel.',
        guidance: ['Use Tile for content panels.'],
      },
    ],
  });

  expect(result).toMatchObject({
    status: 'passed',
    reasonCode: 'role_contract_verified',
    rawLayoutFallbacks: [],
  });
});

test('L8.3b skips data-table contract for detail pages without table intent', () => {
  const source = [
    "import { BaseTile } from '@/components/molecules/Tiles';",
    '',
    'export function Screen() {',
    '  return (',
    '    <main>',
    '      <BaseTile title="Deal">Deal details</BaseTile>',
    '      <BaseTile title="Documents">Contract.pdf</BaseTile>',
    '    </main>',
    '  );',
    '}',
    '',
  ].join('\n');

  const result = validateComponentRoleContractsSource(
    source,
    {
      status: 'ready',
      source: 'design-index',
      stale: false,
      taskKind: 'screen-generation',
      diagnostics: [],
      candidates: [
        {
          role: 'data-table',
          componentId: 'components/organisms/DataTable',
          title: 'DataTable',
          shortName: 'DataTable',
          confidence: 'medium',
          recordConfidence: 'medium',
          score: 8,
          reason: 'Catalog has table-like components.',
          guidance: ['Use DataTable for rows and columns.'],
        },
        {
          role: 'content-panel',
          componentId: 'components/molecules/Tile',
          title: 'Tile',
          shortName: 'Tile',
          confidence: 'high',
          recordConfidence: 'confirmed',
          score: 10,
          reason: 'Matched content panel.',
          guidance: ['Use Tile for detail sections.'],
        },
      ],
    },
    { userRequest: 'Build a deal detail page with client cards and a documents list.' },
  );

  expect(result).toMatchObject({
    status: 'passed',
    role: 'content-panel',
    required: 'Tile',
  });
});

test('L8.3b still enforces data-table contract for registry/table intent', () => {
  const source = [
    "import { BaseTile } from '@/components/molecules/Tiles';",
    '',
    'export function Screen() {',
    '  return <BaseTile title="Funds">Rows rendered as cards</BaseTile>;',
    '}',
    '',
  ].join('\n');

  const result = validateComponentRoleContractsSource(
    source,
    {
      status: 'ready',
      source: 'design-index',
      stale: false,
      taskKind: 'screen-generation',
      diagnostics: [],
      candidates: [
        {
          role: 'data-table',
          componentId: 'components/organisms/DataTable',
          title: 'DataTable',
          shortName: 'DataTable',
          confidence: 'high',
          recordConfidence: 'confirmed',
          score: 12,
          reason: 'Matched registry rows and columns.',
          guidance: ['Use DataTable for row-heavy registry screens.'],
        },
      ],
    },
    { userRequest: 'Build a funds registry table with rows and columns.' },
  );

  expect(result).toMatchObject({
    status: 'failed',
    reasonCode: 'required_component_missing',
    role: 'data-table',
    required: 'DataTable',
  });
});

test('D2.5 validates component role contracts from component-pack data without project-specific names', () => {
  const source = [
    "import { ForeignCard } from 'foreign-ui';",
    '',
    'export function Screen() {',
    '  return <ForeignCard>Client data</ForeignCard>;',
    '}',
    '',
  ].join('\n');

  const result = validateComponentRoleContractsSource(source, {
    status: 'ready',
    source: 'design-index',
    stale: false,
    taskKind: 'image-to-screen',
    diagnostics: [],
    candidates: [
      {
        role: 'content-panel',
        componentId: 'project/components/ProjectPanel',
        title: 'Project Panel',
        shortName: 'ProjectPanel',
        confidence: 'high',
        recordConfidence: 'confirmed',
        score: 10,
        reason: 'Matched project content panel.',
        guidance: ['Use ProjectPanel for content panels.'],
      },
    ],
  });

  expect(result).toMatchObject({
    status: 'failed',
    reasonCode: 'required_component_missing',
    role: 'content-panel',
    required: 'ProjectPanel',
    rawLayoutFallbacks: ['ForeignCard'],
  });
});

test('D2.5 accepts component-pack family aliases from project index data', () => {
  const source = [
    "import { ProjectSurface } from '@/project/components';",
    '',
    'export function Screen() {',
    '  return <ProjectSurface>Client data</ProjectSurface>;',
    '}',
    '',
  ].join('\n');

  const result = validateComponentRoleContractsSource(source, {
    status: 'ready',
    source: 'design-index',
    stale: false,
    taskKind: 'image-to-screen',
    diagnostics: [],
    candidates: [
      {
        role: 'content-panel',
        componentId: 'project/components/ProjectPanel',
        title: 'Project Panel',
        shortName: 'ProjectPanel',
        componentFamily: ['ProjectPanel', 'ProjectSurface'],
        confidence: 'high',
        recordConfidence: 'confirmed',
        score: 10,
        reason: 'Matched project content panel.',
        guidance: ['Use ProjectPanel or ProjectSurface for content panels.'],
      },
    ],
  });

  expect(result).toMatchObject({
    status: 'passed',
    reasonCode: 'role_contract_verified',
    role: 'content-panel',
    required: 'ProjectPanel',
  });
});

test('D7.4 validates css-catalog role contracts by required HTML classes', () => {
  const validHtml = [
    '<main data-sd-screen-root>',
    '  <article class="card card--featured">',
    '    <header class="card__header">Client</header>',
    '    <div class="card__body">Terms</div>',
    '  </article>',
    '</main>',
  ].join('\n');
  const invalidHtml = [
    '<main data-sd-screen-root>',
    '  <article class="panel">',
    '    <h2>Client</h2>',
    '  </article>',
    '</main>',
  ].join('\n');
  const componentPack = {
    status: 'ready',
    source: 'design-index',
    stale: false,
    taskKind: 'screen-generation',
    diagnostics: [],
    candidates: [
      {
        role: 'content-panel',
        componentId: 'css-catalog-card',
        title: 'CSS/Card',
        shortName: 'Card',
        confidence: 'high',
        recordConfidence: 'high',
        score: 10,
        reason: 'Matched content panel.',
        guidance: ['Use .card for content panels.'],
        requiredClasses: ['card', 'card__header', 'card__body'],
      },
    ],
  } as any;

  expect(validateComponentRoleContractsSource(validHtml, componentPack)).toMatchObject({
    status: 'passed',
    reasonCode: 'role_contract_verified',
  });
  expect(validateComponentRoleContractsSource(invalidHtml, componentPack)).toMatchObject({
    status: 'failed',
    reasonCode: 'required_component_missing',
    required: 'Card',
  });
});
