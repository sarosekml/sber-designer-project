import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { beforeEach, expect, test } from 'bun:test';

import { listProjectTemplates } from '../services/api/src/project-templates';
import {
  findScreenTemplate,
  parseScreenTemplateFile,
  resetScreenTemplatesCache,
  resolveScreenTemplates,
} from '../services/api/src/screen-templates';

const BUILT_IN_PAGE_IDS = ['dashboard', 'list-table', 'detail', 'form', 'settings'];
const BUILT_IN_IDS = [...BUILT_IN_PAGE_IDS, 'modal-form', 'modal-confirm'];

async function makeWorkspace(name: string): Promise<string> {
  const workspace = join(
    tmpdir(),
    `sd-screen-templates-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await mkdir(join(workspace, '.sber-designer', 'screen-templates'), { recursive: true });
  return workspace;
}

async function writeProjectTemplate(
  workspace: string,
  fileName: string,
  body: string,
): Promise<void> {
  await writeFile(join(workspace, '.sber-designer', 'screen-templates', fileName), body, 'utf8');
}

beforeEach(() => {
  resetScreenTemplatesCache();
});

// ---------- built-in resolution ----------

test('built-in screen templates resolve from files in canonical order', async () => {
  const { templates, diagnostics } = await resolveScreenTemplates();

  expect(templates.map((template) => template.id)).toEqual(BUILT_IN_IDS);
  expect(templates.every((template) => template.source === 'built-in')).toBe(true);
  expect(diagnostics.filter((d) => d.level === 'error')).toEqual([]);
});

test('built-in templates carry ASCII layout schema and component roles', async () => {
  const { templates } = await resolveScreenTemplates();
  const dashboard = templates.find((template) => template.id === 'dashboard');

  expect(dashboard).toBeDefined();
  expect(dashboard?.layoutSchema).toContain('PageHeader');
  expect(dashboard?.kind).toBe('dashboard');
  expect((dashboard?.componentRoles ?? []).some((role) => role.role === 'page-header')).toBe(true);
});

test('TEMPLATE.screen.md skeleton is excluded from resolution', async () => {
  const { templates } = await resolveScreenTemplates();
  expect(templates.some((template) => template.id === 'template')).toBe(false);
});

// ---------- project-local resolution ----------

test('project templates merge with built-ins and keep their source/path', async () => {
  const workspace = await makeWorkspace('merge');
  await writeProjectTemplate(
    workspace,
    'deal.screen.md',
    [
      '---',
      'name: Deal page',
      'description: Single-deal review page.',
      'kind: detail',
      '---',
      '## Intent',
      'Review one deal.',
      '## Layout',
      '```text',
      'PageHeader',
      '```',
      '## Regions',
      '- PageHeader — header. Role: `page-header`.',
      '',
    ].join('\n'),
  );

  const { templates } = await resolveScreenTemplates(workspace);
  const deal = findScreenTemplate(templates, { id: 'deal', source: 'project' });

  expect(templates.map((template) => template.id)).toEqual([...BUILT_IN_IDS, 'deal']);
  expect(deal?.source).toBe('project');
  expect(deal?.filePath).toBe('.sber-designer/screen-templates/deal.screen.md');
  expect(deal?.layoutSchema).toBe('PageHeader');
});

test('same-id project template coexists with the built-in (both tagged)', async () => {
  const workspace = await makeWorkspace('coexist');
  await writeProjectTemplate(
    workspace,
    'dashboard.screen.md',
    [
      '---',
      'name: Dashboard',
      'description: Team-tuned dashboard.',
      'kind: dashboard',
      '---',
      '## Intent',
      'Project dashboard.',
      '## Layout',
      '```text',
      'KPIs',
      '```',
      '## Regions',
      '- KPIs — metrics. Role: `kpi-card`.',
      '',
    ].join('\n'),
  );

  const { templates } = await resolveScreenTemplates(workspace);
  const dashboards = templates.filter((template) => template.id === 'dashboard');

  expect(dashboards).toHaveLength(2);
  expect(dashboards.map((template) => template.source).sort()).toEqual(['built-in', 'project']);
  expect(findScreenTemplate(templates, { id: 'dashboard', source: 'project' })?.description).toBe(
    'Team-tuned dashboard.',
  );
});

test('duplicate ids within the project source keep the first and warn', async () => {
  const workspace = await makeWorkspace('dup');
  const file = (label: string) =>
    [
      '---',
      'name: Queue',
      'description: A queue.',
      'id: queue',
      '---',
      '## Intent',
      label,
      '## Layout',
      '```text',
      'Table',
      '```',
      '## Regions',
      '- Table — rows. Role: `data-table`.',
      '',
    ].join('\n');
  await writeProjectTemplate(workspace, 'a-queue.screen.md', file('first'));
  await writeProjectTemplate(workspace, 'b-queue.screen.md', file('second'));

  const { templates, diagnostics } = await resolveScreenTemplates(workspace);
  const queues = templates.filter((template) => template.id === 'queue');

  expect(queues).toHaveLength(1);
  expect(queues[0]?.content).toContain('first');
  expect(diagnostics.some((d) => d.code === 'screen_template_duplicate_id')).toBe(true);
});

test('missing project screen-templates folder yields built-ins only', async () => {
  const workspace = join(tmpdir(), `sd-screen-templates-empty-${Date.now()}`);
  await mkdir(workspace, { recursive: true });

  const { templates } = await resolveScreenTemplates(workspace);
  expect(templates.map((template) => template.id)).toEqual(BUILT_IN_IDS);
});

// ---------- parser unit ----------

test('parser derives id from file name and extracts the layout schema', () => {
  const result = parseScreenTemplateFile({
    source: 'project',
    fileName: 'My-Cool.screen.md',
    raw: [
      '---',
      'name: My cool screen',
      'description: Does cool things.',
      '---',
      '## Intent',
      'Be cool.',
      '## Layout',
      '```text',
      '┌──────┐',
      '│ Body │',
      '└──────┘',
      '```',
      '## Regions',
      '- Body — content. Role: `card`.',
    ].join('\n'),
  });

  expect(result.template?.id).toBe('my-cool');
  expect(result.template?.layoutSchema).toBe('┌──────┐\n│ Body │\n└──────┘');
  expect(result.diagnostics.filter((d) => d.level === 'error')).toEqual([]);
});

test('parser parses componentRoles as an array of objects', () => {
  const result = parseScreenTemplateFile({
    source: 'project',
    fileName: 'roles.screen.md',
    raw: [
      '---',
      'name: Roles',
      'description: Role parsing.',
      'componentRoles:',
      '  - role: page-header',
      '    intent: title and actions',
      '  - role: data-table',
      '    intent: dense rows',
      '---',
      '## Intent',
      'x',
      '## Layout',
      '```text',
      'T',
      '```',
      '## Regions',
      '- T — table. Role: `data-table`.',
    ].join('\n'),
  });

  expect(result.template?.componentRoles).toEqual([
    { role: 'page-header', intent: 'title and actions' },
    { role: 'data-table', intent: 'dense rows' },
  ]);
});

test('parser rejects a template missing required fields', () => {
  const result = parseScreenTemplateFile({
    source: 'project',
    fileName: 'broken.screen.md',
    raw: ['---', 'description: no name here', '---', '## Intent', 'x'].join('\n'),
  });

  expect(result.template).toBeUndefined();
  expect(result.diagnostics.some((d) => d.code === 'invalid_screen_template')).toBe(true);
});

test('parser warns (soft) when the layout section is missing', () => {
  const result = parseScreenTemplateFile({
    source: 'project',
    fileName: 'nolayout.screen.md',
    raw: ['---', 'name: No layout', 'description: missing layout.', '---', '## Intent', 'x'].join(
      '\n',
    ),
  });

  expect(result.template).toBeDefined();
  expect(
    result.diagnostics.some(
      (d) => d.code === 'screen_template_missing_section' && d.message.includes('Layout'),
    ),
  ).toBe(true);
});

test('parser flags a project-specific smell in a built-in template', () => {
  const result = parseScreenTemplateFile({
    source: 'built-in',
    fileName: 'leaky.screen.md',
    raw: [
      '---',
      'name: Leaky',
      'description: leaks an import.',
      '---',
      '## Intent',
      'x',
      '## Layout',
      '```text',
      "import { Foo } from '@/components/Foo'",
      '```',
      '## Regions',
      '- Foo — uses Foo.',
    ].join('\n'),
  });

  expect(result.diagnostics.some((d) => d.code === 'screen_template_universality')).toBe(true);
});

// ---------- legacy project-template alias ----------

test('legacy project template alias surfaces built-ins, not legacy markdown', async () => {
  const workspace = join(tmpdir(), `sd-screen-templates-legacy-${Date.now()}`);
  await mkdir(join(workspace, '.sber-designer', 'templates'), { recursive: true });
  await writeFile(
    join(workspace, '.sber-designer', 'templates', 'legacy-dashboard.md'),
    '# Legacy dashboard\n\nThis should not appear in the new creation flow.\n',
    'utf8',
  );

  const templates = await listProjectTemplates(workspace);

  // The legacy ProjectTemplate alias is page-only; modal built-ins are excluded (0132).
  expect(templates.map((template) => template.id)).toEqual(BUILT_IN_PAGE_IDS);
  expect(templates.some((template) => template.id === 'legacy-dashboard')).toBe(false);
  expect(templates.every((template) => template.filePath.startsWith('sber-designer://'))).toBe(
    true,
  );
});
