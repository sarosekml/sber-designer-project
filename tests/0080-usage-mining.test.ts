/**
 * 0080 Phase 1 vertical slice: usage mining -> usage cards -> patterns ->
 * component pack -> agent tools, plus the screen-template quality gate.
 */
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import type { ComponentCatalog } from '@sber-designer/shared-types';

import {
  CANONICAL_DESIGN_INDEX_PATHS,
  ICON_SOURCE_MANIFEST_PATH,
  type ComponentUsageCard,
  type CompositionPatternRecord,
  type DesignIndexManifest,
  type UsageSnippetRecord,
} from '../packages/design-indexer/src';
import { ALL_TOOLS } from '../services/api/src/agent/toolset';
import type { ToolContext } from '../services/api/src/agent/types';
import {
  buildTaskRelevantComponentPack,
  renderTaskRelevantComponentPack,
} from '../services/api/src/component-intelligence/component-pack';
import { generateProjectDesignIndexFiles } from '../services/api/src/design-index';
import {
  resolveScreenTemplates,
  validateScreenTemplate,
} from '../services/api/src/screen-templates';

async function write(root: string, filePath: string, contents: string): Promise<void> {
  await mkdir(join(root, filePath, '..'), { recursive: true });
  await writeFile(join(root, filePath), contents);
}

async function readJsonl<T>(root: string, filePath: string): Promise<T[]> {
  const contents = await readFile(join(root, filePath), 'utf8').catch(() => '');
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

const CATALOG: ComponentCatalog = {
  source: 'static',
  generatedAt: 1,
  components: [
    {
      id: 'molecules-datatable',
      title: 'Molecules/DataTable',
      shortName: 'DataTable',
      filePath: 'src/components/molecules/DataTable/DataTable.tsx',
      stories: [],
    },
    {
      id: 'atoms-statuschip',
      title: 'Atoms/StatusChip',
      shortName: 'StatusChip',
      filePath: 'src/components/atoms/StatusChip/StatusChip.tsx',
      stories: [],
    },
  ],
};

async function createWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-0080-'));
  await write(
    root,
    'src/components/molecules/DataTable/DataTable.tsx',
    [
      'export interface DataTableProps {',
      "  density?: 'compact' | 'comfortable';",
      '  sortable?: boolean;',
      '  children?: unknown;',
      '}',
      'export function DataTable(props: DataTableProps) { return <table>{props.children}</table>; }',
    ].join('\n'),
  );
  await write(
    root,
    'src/components/atoms/StatusChip/StatusChip.tsx',
    [
      "export type ChipState = 'expected' | 'paid' | 'rejected';",
      'export interface StatusChipProps {',
      "  variant?: 'outlined' | 'filled';",
      '  state: ChipState;',
      '  label?: string;',
      '}',
      'export function StatusChip(props: StatusChipProps) { return <span>{props.label}</span>; }',
    ].join('\n'),
  );
  await write(
    root,
    'src/screens/PaymentsRegistry.tsx',
    [
      "import { DataTable } from '../components/molecules/DataTable/DataTable';",
      "import { StatusChip } from '../components/atoms/StatusChip/StatusChip';",
      'export function PaymentsRegistry() {',
      '  return (',
      '    <DataTable density="compact" sortable>',
      '      <StatusChip variant="outlined" state="expected" label="Expected" />',
      '      <StatusChip variant="outlined" state="paid" label="Paid" />',
      '    </DataTable>',
      '  );',
      '}',
    ].join('\n'),
  );
  await write(
    root,
    '.sber-designer/screen-templates/registry-page.screen.md',
    [
      '---',
      'name: Payments registry page',
      'description: Dense registry table page with dictionary status chips.',
      'kind: list-table',
      'states: [loading, empty]',
      'componentRoles:',
      '  - role: data-table',
      '    intent: dense sortable registry table',
      '  - role: status-badge',
      '    intent: dictionary status values in table cells',
      'componentBindings:',
      '  - role: data-table',
      '    components: [molecules-datatable]',
      '    preset: sortable columns, footer totals row',
      '  - role: status-badge',
      '    components: [StatusChip]',
      'evidence: [reference-screens/payments/schedule.png]',
      'viewport: 1920',
      '---',
      '',
      '## Intent',
      '',
      'Registry pages optimise for scanning. Statuses are chips, never text.',
      '',
      '## Layout',
      '',
      '```text',
      '┌──────────────────────────────┐',
      '│ Table (sortable, statuses)    │',
      '│ Footer totals                 │',
      '└──────────────────────────────┘',
      '```',
      '',
      '## Regions',
      '',
      '- **Table** — the work surface. Role: `data-table`.',
      '- **Footer totals** — inline totals row. Role: `data-table`.',
      '',
      '## Component guidance',
      '',
      '- Status cells use the status-badge role component, outlined variant.',
      '',
      '## States',
      '',
      '- Loading: skeleton rows.',
      '- Empty: explanatory empty state.',
    ].join('\n'),
  );
  await write(
    root,
    '.sber-designer/screen-templates/broken-binding.screen.md',
    [
      '---',
      'name: Broken binding example',
      'description: Template whose binding points at a missing component.',
      'componentRoles:',
      '  - role: hero',
      'componentBindings:',
      '  - role: hero',
      '    components: [GhostWidget]',
      '---',
      '',
      '## Intent',
      '',
      'hero region for the broken template.',
      '',
      '## Layout',
      '',
      '```text',
      '┌────────┐',
      '│ Hero    │',
      '└────────┘',
      '```',
      '',
      '## Regions',
      '',
      '- **Hero** — top area. Role: `hero`.',
    ].join('\n'),
  );
  return root;
}

test('index build mines usage, compiles cards, and compiles template patterns', async () => {
  const root = await createWorkspace();
  const result = await generateProjectDesignIndexFiles(root, {
    projectName: '0080 Fixture',
    catalog: CATALOG,
  });

  const manifest = JSON.parse(
    await readFile(join(root, CANONICAL_DESIGN_INDEX_PATHS.manifest), 'utf8'),
  ) as DesignIndexManifest;
  expect(manifest.version).toBe(3);
  expect(manifest.sources.usageScan).toBe(true);
  expect(manifest.sources.screenTemplates).toBe(true);
  expect(manifest.counts.usageSnippets).toBeGreaterThan(0);
  expect(manifest.counts.usageCards).toBeGreaterThanOrEqual(2);
  expect(manifest.counts.patterns).toBe(2);

  const snippets = await readJsonl<UsageSnippetRecord>(
    root,
    CANONICAL_DESIGN_INDEX_PATHS.usageSnippets,
  );
  const tableSnippet = snippets.find((snippet) => snippet.componentId === 'molecules-datatable');
  expect(tableSnippet?.propsPreview.density).toBe('compact');
  expect(tableSnippet?.origin).toBe('screen');

  const cards = await readJsonl<ComponentUsageCard>(root, CANONICAL_DESIGN_INDEX_PATHS.usageCards);
  const chipCard = cards.find((card) => card.componentId === 'atoms-statuschip');
  expect(chipCard).toBeDefined();
  expect(chipCard?.publicImport.name).toBe('StatusChip');
  const variantProps = chipCard?.variantGuidance.map((guidance) => guidance.prop) ?? [];
  expect(variantProps).toContain('variant');
  expect(variantProps).toContain('state');
  expect(chipCard?.usageCount).toBe(2);
  expect(chipCard?.pairsWith).toContain('molecules-datatable');

  const patterns = await readJsonl<CompositionPatternRecord>(
    root,
    CANONICAL_DESIGN_INDEX_PATHS.patterns,
  );
  const registry = patterns.find((pattern) => pattern.id === 'template-registry-page');
  expect(registry).toBeDefined();
  expect(registry?.kind).toBe('screen');
  expect(registry?.status).toBe('confirmed');
  const tableSlot = registry?.slots.find((slot) => slot.role === 'data-table');
  expect(tableSlot?.componentIds).toEqual(['molecules-datatable']);
  expect(tableSlot?.preset).toBe('sortable columns, footer totals row');
  const chipSlot = registry?.slots.find((slot) => slot.role === 'status-badge');
  expect(chipSlot?.componentIds).toEqual(['atoms-statuschip']);
  expect(registry?.evidence).toContainEqual({
    source: 'reference-screen',
    ref: 'reference-screens/payments/schedule.png',
  });

  // The broken binding surfaces as both a validator and a compile diagnostic.
  const diagnostics = JSON.parse(
    await readFile(join(root, CANONICAL_DESIGN_INDEX_PATHS.diagnostics), 'utf8'),
  ) as { diagnostics: { message: string }[] };
  expect(diagnostics.diagnostics.some((item) => item.message.includes('GhostWidget'))).toBe(true);

  // Steady-state rebuild is idempotent. The first rebuild may legitimately
  // change diagnostics (the cold run exported DESIGN.md, clearing a warning);
  // from then on only the timestamp-bearing artifacts may rewrite.
  await generateProjectDesignIndexFiles(root, {
    projectName: '0080 Fixture',
    catalog: CATALOG,
  });
  const third = await generateProjectDesignIndexFiles(root, {
    projectName: '0080 Fixture',
    catalog: CATALOG,
  });
  const volatile = new Set<string>([
    CANONICAL_DESIGN_INDEX_PATHS.manifest, // generatedAt changes by design
    CANONICAL_DESIGN_INDEX_PATHS.fingerprints,
    CANONICAL_DESIGN_INDEX_PATHS.promptSummary, // embeds generatedAt
    CANONICAL_DESIGN_INDEX_PATHS.componentSelectionMap, // run-independent map embeds generatedAt
    ICON_SOURCE_MANIFEST_PATH, // source manifest includes generatedAt
  ]);
  expect(third.changedFiles.filter((file) => !volatile.has(file))).toEqual([]);
  void result;
});

test('component pack candidates carry variants and real usage snippets', async () => {
  const root = await createWorkspace();
  await generateProjectDesignIndexFiles(root, { projectName: '0080 Fixture', catalog: CATALOG });

  const pack = await buildTaskRelevantComponentPack({
    workspaceRoot: root,
    taskKind: 'screen-generation',
    userRequest: 'Payments registry table with dictionary status chips and totals.',
  });
  const table = pack.candidates.find(
    (candidate) => candidate.componentId === 'molecules-datatable',
  );
  expect(table).toBeDefined();
  expect(table?.snippet?.code).toContain('<DataTable density="compact"');
  expect(table?.variantHints?.join(' ')).toContain('density: compact | comfortable');

  const chip = pack.candidates.find((candidate) => candidate.componentId === 'atoms-statuschip');
  expect(chip?.variantHints?.join(' ')).toContain('variant: outlined | filled');
  // 0082 Track 2: the required `state` prop reaches the candidate so a
  // non-source-reading LLM knows it must be set.
  expect(chip?.requiredProps).toContain('state');

  const rendered = renderTaskRelevantComponentPack(pack);
  expect(rendered).toContain('- variants: density: compact | comfortable');
  expect(rendered).toContain('- required props: state');
  expect(rendered).toContain('prop contract: state is mandatory');
  expect(rendered).toContain('canonical usage contract from this project');
  expect(rendered).toContain('```tsx');
  expect(rendered).toContain('<DataTable density="compact" sortable>');
});

test('get_usage_card, list_patterns, and get_pattern tools read the new artifacts', async () => {
  const root = await createWorkspace();
  await generateProjectDesignIndexFiles(root, { projectName: '0080 Fixture', catalog: CATALOG });
  const ctx: ToolContext = {
    user: 'test-user',
    projectName: '0080 Fixture',
    activeScreen: null,
    workspacePath: root,
    canvasUrl: null,
  };

  const cardResult = (await findTool('get_usage_card').handler(
    { componentId: 'StatusChip' },
    ctx,
  )) as { card: ComponentUsageCard };
  expect(cardResult.card.componentId).toBe('atoms-statuschip');
  expect(cardResult.card.variantGuidance.length).toBeGreaterThan(0);

  const listResult = (await findTool('list_patterns').handler({}, ctx)) as {
    patterns: { id: string; slotRoles: string[] }[];
  };
  const ids = listResult.patterns.map((pattern) => pattern.id);
  expect(ids).toContain('template-registry-page');

  const patternResult = (await findTool('get_pattern').handler(
    { id: 'template-registry-page' },
    ctx,
  )) as { pattern: CompositionPatternRecord };
  expect(patternResult.pattern.slots.map((slot) => slot.role)).toEqual([
    'data-table',
    'status-badge',
  ]);

  await expect(
    findTool('get_usage_card').handler({ componentId: 'NoSuchThing' }, ctx),
  ).rejects.toThrow('Indexed component not found');
});

test('the built-in screen templates pass the quality gate', async () => {
  const resolved = await resolveScreenTemplates(null);
  const builtIns = resolved.templates.filter((template) => template.source === 'built-in');
  expect(builtIns.map((template) => template.id)).toEqual([
    'dashboard',
    'list-table',
    'detail',
    'form',
    'settings',
    'modal-form',
    'modal-confirm',
  ]);
  expect(resolved.diagnostics).toEqual([]);
  for (const template of builtIns) {
    const findings = validateScreenTemplate(template);
    expect({ id: template.id, errors: findings.filter((f) => f.level === 'error') }).toEqual({
      id: template.id,
      errors: [],
    });
    expect({ id: template.id, findings }).toEqual({ id: template.id, findings: [] });
  }
});

function findTool(name: string) {
  const tool = ALL_TOOLS.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool;
}
