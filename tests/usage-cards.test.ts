import { expect, test } from 'bun:test';

import {
  buildUsageCards,
  type BuildUsageCardsInput,
} from '../packages/design-indexer/src/usage-cards';
import type {
  ComponentUsageCard,
  IndexedComponentRecord,
  ProjectAgentNote,
  UsageSnippetRecord,
} from '../packages/design-indexer/src/types';

function component(
  partial: Partial<IndexedComponentRecord> & { id: string },
): IndexedComponentRecord {
  return {
    title: partial.id,
    shortName: partial.id,
    filePath: 'src/unknown.tsx',
    storyCount: 0,
    stories: [],
    tags: [],
    groupIds: [],
    noteCount: 0,
    confidence: 'low',
    ...partial,
  } as IndexedComponentRecord;
}

function snippet(
  partial: Partial<UsageSnippetRecord> & { componentId: string },
): UsageSnippetRecord {
  return {
    id: `usage-${partial.componentId}-1`,
    sourcePath: 'src/screens/Page.tsx',
    line: 1,
    code: `<${partial.componentId} />`,
    propNames: [],
    propsPreview: {},
    count: 1,
    share: 1,
    origin: 'screen',
    ...partial,
  };
}

const BASE_INPUT: BuildUsageCardsInput = {
  components: [
    component({
      id: 'atoms-button',
      shortName: 'Button',
      filePath: 'src/components/atoms/Button/index.ts',
      descriptionLayer: {
        purpose: 'Primary action trigger.',
        anatomy: [],
        usage: [{ title: 'Submit', when: 'Use for form submission actions.' }],
        agentGuidance: ['Prefer Button over raw <button>.'],
      },
    }),
    component({ id: 'atoms-chip', shortName: 'Chip', filePath: 'src/components/atoms/Chip.tsx' }),
  ],
  snippets: [
    snippet({
      componentId: 'atoms-button',
      code: '<Button variant="outlined">Export</Button>',
      propNames: ['variant'],
      propsPreview: { variant: 'outlined' },
      count: 3,
      share: 0.75,
    }),
    snippet({
      componentId: 'atoms-button',
      id: 'usage-atoms-button-2',
      code: '<Button>Plain</Button>',
      count: 1,
      share: 0.25,
    }),
  ],
  stats: [
    {
      componentId: 'atoms-button',
      totalCount: 4,
      fileCount: 2,
      pairsWith: [{ componentId: 'atoms-chip', count: 2 }],
    },
  ],
  variants: [
    {
      componentId: 'atoms-button',
      props: [
        {
          prop: 'variant',
          values: [
            { value: 'outlined', meaning: '' },
            { value: 'contained', meaning: '' },
          ],
          source: 'ts-union',
        },
      ],
    },
  ],
  agentNotes: [
    {
      id: 'note-1',
      targetType: 'component',
      targetId: 'atoms-button',
      note: 'Use Button for all toolbar actions.',
      intent: 'prefer',
      source: 'manual',
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: 'note-2',
      targetType: 'component',
      targetId: 'atoms-button',
      note: 'Avoid Button for navigation; use Link.',
      intent: 'avoid',
      source: 'agent',
      createdAt: 1,
      updatedAt: 1,
    },
  ] satisfies ProjectAgentNote[],
  existingCardsContents: null,
  generatedAt: 1000,
};

test('compiles cards from descriptionLayer, notes, mining, and variants', () => {
  const cards = buildUsageCards(BASE_INPUT);
  // atoms-chip only appears as a co-usage pair of Button — no own signal, no card.
  expect(cards.map((card) => card.componentId)).toEqual(['atoms-button']);

  const button = cards[0];
  expect(button.purpose).toBe('Primary action trigger.');
  expect(button.publicImport).toEqual({
    name: 'Button',
    module: 'src/components/atoms/Button/index.ts',
  });
  expect(button.whenToUse).toEqual(['Use for form submission actions.']);
  expect(button.whenNotToUse).toEqual(['Avoid Button for navigation; use Link.']);
  expect(button.variantGuidance[0].prop).toBe('variant');
  expect(button.snippets).toHaveLength(2);
  expect(button.snippets[0].code).toContain('variant="outlined"');
  expect(button.pairsWith).toEqual(['atoms-chip']);
  expect(button.usageCount).toBe(4);
  expect(button.propsThatMatter).toEqual([
    { name: 'variant', note: 'set in ~75% of mined usages' },
  ]);

  const sources = button.facts.map((fact) => fact.source);
  expect(sources).toContain('description-layer');
  expect(sources).toContain('agent-note');
  expect(sources).toContain('mined-usage');
  const dlFact = button.facts.find((fact) => fact.source === 'description-layer');
  expect(dlFact?.status).toBe('confirmed');
  const minedFact = button.facts.find((fact) => fact.id.endsWith('mined-top-cluster'));
  expect(minedFact?.status).toBe('draft');
  expect(minedFact?.text).toContain('variant="outlined"');
});

test('rebuild preserves human fact statuses, meanings, and human-source facts', () => {
  const first = buildUsageCards(BASE_INPUT);
  const button = first.find((card) => card.componentId === 'atoms-button')!;

  const edited: ComponentUsageCard = {
    ...button,
    variantGuidance: button.variantGuidance.map((guidance) => ({
      ...guidance,
      values: guidance.values.map((value) =>
        value.value === 'outlined' ? { ...value, meaning: 'secondary actions' } : value,
      ),
    })),
    facts: [
      ...button.facts.map((fact) =>
        fact.id.endsWith('mined-top-cluster') ? { ...fact, status: 'rejected' as const } : fact,
      ),
      {
        id: 'fact-atoms-button-interview-1',
        text: 'Use contained variant only for the single primary page action.',
        source: 'interview',
        status: 'confirmed',
        createdAt: 500,
        updatedAt: 500,
      },
    ],
  };
  const existingContents = `${JSON.stringify(edited)}\n`;

  const second = buildUsageCards({
    ...BASE_INPUT,
    existingCardsContents: existingContents,
    generatedAt: 2000,
  });
  const rebuilt = second.find((card) => card.componentId === 'atoms-button')!;

  const mined = rebuilt.facts.find((fact) => fact.id.endsWith('mined-top-cluster'));
  expect(mined?.status).toBe('rejected');

  const interview = rebuilt.facts.find((fact) => fact.source === 'interview');
  expect(interview).toBeDefined();
  expect(interview?.text).toContain('contained variant');
  expect(interview?.createdAt).toBe(500);

  const outlined = rebuilt.variantGuidance[0].values.find((value) => value.value === 'outlined');
  expect(outlined?.meaning).toBe('secondary actions');

  const dlFact = rebuilt.facts.find((fact) => fact.source === 'description-layer');
  expect(dlFact?.createdAt).toBe(1000);
  expect(dlFact?.updatedAt).toBe(1000);
});

test('compilation is idempotent for unchanged inputs', () => {
  const first = buildUsageCards(BASE_INPUT);
  const contents = first.map((card) => JSON.stringify(card)).join('\n');
  const second = buildUsageCards({ ...BASE_INPUT, existingCardsContents: contents });
  expect(second).toEqual(first);
});

test('components with no signal of any kind get no card', () => {
  const cards = buildUsageCards({
    components: [component({ id: 'bare', shortName: 'Bare' })],
    snippets: [],
    stats: [],
    variants: [],
    agentNotes: [],
    existingCardsContents: null,
    generatedAt: 1,
  });
  expect(cards).toEqual([]);
});

test('Track 2: required props lead propsThatMatter, explicit snippet wins, incomplete flag', () => {
  const cards = buildUsageCards({
    components: [
      component({ id: 'atoms-chip', shortName: 'Chip', filePath: 'src/components/atoms/Chip.tsx' }),
      component({ id: 'atoms-bare', shortName: 'Bare', filePath: 'src/components/atoms/Bare.tsx' }),
    ],
    snippets: [
      // Spread story snippet (hides props) is more frequent...
      snippet({
        componentId: 'atoms-chip',
        id: 'usage-atoms-chip-1',
        code: '<Chip {...args} />',
        propNames: [],
        count: 5,
        share: 0.7,
        origin: 'story',
      }),
      // ...but the explicit-prop usage must become the canonical snippet.
      snippet({
        componentId: 'atoms-chip',
        id: 'usage-atoms-chip-2',
        code: '<Chip code="paid" name="Paid" variant="outlined" />',
        propNames: ['code', 'name', 'variant'],
        count: 2,
        share: 0.3,
        origin: 'screen',
      }),
      // A used component with only a spread snippet and no other signal -> incomplete.
      snippet({
        componentId: 'atoms-bare',
        id: 'usage-atoms-bare-1',
        code: '<Bare {...args} />',
        propNames: [],
        count: 3,
        share: 1,
        origin: 'story',
      }),
    ],
    stats: [
      { componentId: 'atoms-chip', totalCount: 7, fileCount: 2, pairsWith: [] },
      { componentId: 'atoms-bare', totalCount: 3, fileCount: 1, pairsWith: [] },
    ],
    variants: [
      {
        componentId: 'atoms-chip',
        props: [
          {
            prop: 'variant',
            values: [
              { value: 'outlined', meaning: '' },
              { value: 'filled', meaning: '' },
            ],
            source: 'ts-union',
          },
        ],
        requiredProps: ['code', 'name'],
      },
    ],
    agentNotes: [],
    existingCardsContents: null,
    generatedAt: 1,
  });

  const chip = cards.find((card) => card.componentId === 'atoms-chip')!;
  // Required props lead, marked required, before mined frequency props.
  expect(chip.propsThatMatter.slice(0, 2)).toEqual([
    { name: 'code', note: 'required prop' },
    { name: 'name', note: 'required prop' },
  ]);
  // The explicit-prop usage is the canonical first snippet, not the {...args} one.
  expect(chip.snippets[0]?.code).toBe('<Chip code="paid" name="Paid" variant="outlined" />');
  expect(chip.incomplete).toBeUndefined();

  const bare = cards.find((card) => card.componentId === 'atoms-bare')!;
  // Used, but no variants / props / explicit snippet -> flagged for interview queue.
  expect(bare.incomplete).toBe(true);
});

test('R3: authored layer fields (variantGuidance/requiredProps/canonicalSnippets) reach the card', () => {
  const cards = buildUsageCards({
    components: [
      component({
        id: 'atoms-badge',
        shortName: 'Badge',
        filePath: 'src/components/atoms/Badge/Badge.tsx',
        descriptionLayer: {
          purpose: 'Status badge.',
          anatomy: [],
          usage: [],
          agentGuidance: [],
          variantGuidance: [
            { prop: 'variant', values: [{ value: 'outlined', meaning: 'secondary chips' }] },
          ],
          requiredProps: ['code', 'name'],
          canonicalSnippets: [{ code: '<Badge code={x} name={y} variant="outlined" />' }],
        },
      }),
    ],
    snippets: [],
    stats: [],
    variants: [],
    agentNotes: [],
    existingCardsContents: null,
    generatedAt: 1,
  });

  const card = cards.find((entry) => entry.componentId === 'atoms-badge')!;
  // Authored variant meaning is in the card, tagged as authored.
  expect(card.variantGuidance).toEqual([
    {
      prop: 'variant',
      values: [{ value: 'outlined', meaning: 'secondary chips' }],
      source: 'description-layer',
    },
  ]);
  // Authored required props lead propsThatMatter.
  expect(card.propsThatMatter.map((prop) => prop.name)).toEqual(['code', 'name']);
  // Authored canonical usage is the first snippet, sourced from the layer.
  expect(card.snippets[0]).toMatchObject({
    code: '<Badge code={x} name={y} variant="outlined" />',
    source: 'description-layer',
  });
});
