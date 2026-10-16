import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

import { SYSTEM_SETTINGS_SECTION_IDS } from '@/lib/settings-logic';

const settingsDialogPath = 'apps/web/src/components/editor/SettingsDialog.tsx';

test('settings dialog uses a one-column mobile layout before the desktop sidebar grid', async () => {
  const source = await readFile(settingsDialogPath, 'utf8');

  expect(source).toContain(
    'grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[250px_minmax(0,1fr)] md:grid-rows-1',
  );
  expect(source).toContain('border-b border-border bg-muted/30 px-4 py-4 md:flex');
  expect(source).toContain('px-4 py-5 md:px-8 md:py-7');
  expect(source).toContain('hidden truncate text-[11px] opacity-70 md:block');
});

test('settings dialog groups system settings before project settings', async () => {
  const source = await readFile(settingsDialogPath, 'utf8');

  expect(source).toContain('const SETTINGS_GROUPS');
  expect(source).toContain("label: 'System'");
  expect(source).toContain("label: 'Project'");
  expect(source).toContain(
    'mb-1.5 flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground',
  );
  expect(source).toContain('visibleGroups.map((group)');

  const groupsStart = source.indexOf('const SETTINGS_GROUPS');
  const groupsEnd = source.indexOf('const SETTINGS_SECTION_BY_ID');
  const groups = source.slice(groupsStart, groupsEnd);
  const systemGroupIndex = groups.indexOf("label: 'System'");
  const systemSectionsIndex = groups.indexOf('sectionIds: [...SYSTEM_SETTINGS_SECTION_IDS]');
  const projectGroupIndex = groups.indexOf("label: 'Project'");
  const projectIndex = groups.indexOf("'project'");
  const gitIndex = groups.indexOf("'git'");
  const tasksIndex = groups.indexOf("'tasks'");

  expect(systemGroupIndex).toBeGreaterThan(-1);
  expect(projectGroupIndex).toBeGreaterThan(systemGroupIndex);
  expect(systemSectionsIndex).toBeGreaterThan(systemGroupIndex);
  expect(systemSectionsIndex).toBeLessThan(projectGroupIndex);
  expect(projectIndex).toBeGreaterThan(projectGroupIndex);
  expect(gitIndex).toBeGreaterThan(projectIndex);
  expect(tasksIndex).toBeGreaterThan(gitIndex);
});

test('settings dialog orders System setup from general through integrations', async () => {
  const source = await readFile(settingsDialogPath, 'utf8');

  expect(SYSTEM_SETTINGS_SECTION_IDS).toEqual([
    'general',
    'llm',
    'agent',
    'generation',
    'mcp',
    'about',
  ]);
  expect(source).toContain("label: 'Harness setup'");
  expect(source).toContain("description: 'Defaults, review, and readiness'");
});

test('system-only scope keeps all System sections and hides the Project group', async () => {
  const source = await readFile(settingsDialogPath, 'utf8');

  expect(source).toContain("scope?: 'all' | 'system'");
  expect(source).toContain("SETTINGS_GROUPS.filter((group) => group.label === 'System')");
  expect(source).toContain('<AgentKitPanel />');
  expect(source).toContain('<GenerationPipelineSettings />');
  expect(source).toContain("sectionIds: ['project', 'indexing', 'git', 'tasks']");
  expect(source).toContain('<LlmProvidersSettingsPanel');
  expect(source).toContain('<McpServersSettingsPanel />');
});
