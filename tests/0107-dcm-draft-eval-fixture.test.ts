import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'bun:test';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(TEST_DIR, 'fixtures', '0080-eval', 'ibp-ui-kit', 'dcm-draft-deal');

type DcmDraftDealExpectedFixture = {
  fixture: string;
  screen: string;
  brief: string;
  reference: string;
  project: string;
  runEvidence: {
    runId: string;
    status: string;
    renderHealth: {
      provider: string;
      weakEvidence: boolean;
      reasonCode: string;
    };
  };
  expectedRegions: string[];
  expectedDesignScreen: {
    status: string;
    inspectableElements: number;
    editableProps: number;
    indexedComponents: string[];
  };
  expected: Array<{
    role: string;
    anyOf: string[];
  }>;
};

test('DcmDraftDealPage live fixture captures the 0107 D4 regression contract', async () => {
  const brief = await readFile(join(FIXTURE_DIR, 'brief.md'), 'utf8');
  const expected = JSON.parse(
    await readFile(join(FIXTURE_DIR, 'expected-components.json'), 'utf8'),
  ) as DcmDraftDealExpectedFixture;

  expect(brief).toContain('# Page: DcmDraftDealPage');
  expect(brief).toContain('Перевести в сделку DCM');
  expect(brief).toContain('## States');
  expect(brief).toContain('## Interactions');

  expect(expected.fixture).toBe('ibp-ui-kit/dcm-draft-deal');
  expect(expected.screen).toBe('DcmDraftDealPage');
  expect(expected.brief).toBe('brief.md');
  expect(expected.reference).toContain('keep local');
  expect(expected.project).toBe('/Users/dev/Work Dev/ibp-ui-kit');

  expect(expected.runEvidence).toMatchObject({
    runId: 'run-2026-06-25T17-05-57-374-3f40f468',
    status: 'needs_review',
    renderHealth: {
      provider: 'storybook-http',
      weakEvidence: true,
      reasonCode: 'browser_evidence_unavailable',
    },
  });

  expect(expected.expectedRegions).toEqual([
    'Клиент',
    'Условия кредита',
    'Холдинг',
    'Комментарии',
    'Потенциалы холдинга',
  ]);
  expect(expected.expectedDesignScreen).toMatchObject({
    status: 'compatible',
    inspectableElements: 67,
    editableProps: 158,
  });
  expect(expected.expectedDesignScreen.indexedComponents).toEqual(
    expect.arrayContaining([
      'BreadCrumbs',
      'Button',
      'DictionaryBadge',
      'Grid',
      'IconButton',
      'Page',
      'Table',
      'Text',
    ]),
  );

  const byRole = new Map(expected.expected.map((entry) => [entry.role, entry.anyOf]));
  expect(byRole.get('breadcrumbs')).toContain('molecules-breadcrumbs');
  expect(byRole.get('content-tile')).toContain('molecules-tiles-tile');
  expect(byRole.get('primary-action')).toContain('atoms-buttons-button');
  expect(byRole.get('status-badge')).toContain('atoms-dictionarybadge');
  expect(byRole.get('data-table')).toContain('organisms-table-basic');
  expect(byRole.get('row-action')).toContain('atoms-iconbutton');
});
