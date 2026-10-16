import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import {
  CANONICAL_DESIGN_INDEX_PATHS,
  parseHtmlDesignSystemDesignMd,
  parseProjectStyleContract,
  projectStyleContractCoverage,
  summarizeProjectStyleContractForPrompt,
} from '../packages/design-indexer/src';
import { generateProjectDesignIndexFiles } from '../services/api/src/design-index';

test('B3 parses the portable numbered 9-section style contract', () => {
  const parsed = parseProjectStyleContract(portableStyleContract(), 'DESIGN.md');

  expect(parsed).not.toBeNull();
  expect(parsed?.schemaVersion).toBe('sber-designer/style-contract/v1');
  expect(parsed?.title).toBe('Operations Calm');
  expect(parsed?.category).toBe('Enterprise');
  expect(parsed?.sections.map((section) => section.id)).toEqual([
    'visual-theme-atmosphere',
    'color-palette-roles',
    'typography-rules',
    'component-stylings',
    'layout-principles',
    'depth-elevation',
    'dos-donts',
    'responsive-behavior',
    'agent-prompt-guide',
  ]);
  expect(parsed?.missingSectionIds).toEqual([]);
  expect(parsed?.sectionOrderValid).toBe(true);
  expect(parsed?.diagnostics).toEqual([]);
  expect(projectStyleContractCoverage(parsed)).toEqual({ present: 9, total: 9, score: 1 });

  const summary = summarizeProjectStyleContractForPrompt(parsed).join('\n');
  expect(summary).toContain('## Project style contract');
  expect(summary).toContain('Category: Enterprise.');
  expect(summary).toContain('### Agent Prompt Guide');
  expect(summary).toContain('Prefer clear hierarchy and exact product facts.');
});

test('B3 validator reports missing, duplicate and out-of-order sections', () => {
  const parsed = parseProjectStyleContract(
    [
      '# Broken style contract',
      '',
      '## 2. Color Palette & Roles',
      'Use semantic colors.',
      '',
      '## 1. Visual Theme & Atmosphere',
      'Calm and dense.',
      '',
      '## Visual Theme & Atmosphere',
      'Duplicate.',
    ].join('\n'),
    'Design.md',
  );

  expect(parsed).not.toBeNull();
  expect(parsed?.sectionOrderValid).toBe(false);
  expect(parsed?.duplicateSectionIds).toEqual(['visual-theme-atmosphere']);
  expect(parsed?.missingSectionIds).toContain('agent-prompt-guide');
  expect(parsed?.diagnostics.map((diagnostic) => diagnostic.message)).toEqual(
    expect.arrayContaining([
      expect.stringContaining('missing or has empty sections'),
      'Project style contract sections are out of canonical order.',
      expect.stringContaining('duplicate sections'),
    ]),
  );
});

test('B3 parser does not reinterpret Google DESIGN.md or legacy HTML Design.md', () => {
  const googleDesignMd = [
    '# Product Design',
    '',
    '## Overview',
    'Calm operations product.',
    '',
    '## Colors',
    'Use semantic tokens.',
    '',
    '## Typography',
    'Use the project scale.',
    '',
    '## Layout',
    'Use a 12-column grid.',
    '',
    '## Elevation & Depth',
    'One raised layer.',
    '',
    '## Shapes',
    'Use small radii.',
    '',
    '## Components',
    'Reuse catalog components.',
    '',
    "## Do's and Don'ts",
    'Do preserve facts.',
  ].join('\n');
  expect(parseProjectStyleContract(googleDesignMd, 'DESIGN.md')).toBeNull();

  const legacy = parseHtmlDesignSystemDesignMd(
    [
      '# Legacy HTML',
      ...[
        'Theme',
        'Color',
        'Typography',
        'Spacing',
        'Layout',
        'Components',
        'Motion',
        'Voice',
        'Anti-patterns',
      ].flatMap((heading) => ['', `## ${heading}`, `${heading} guidance.`]),
    ].join('\n'),
    'Design.md',
  );
  expect(legacy?.missingSectionIds).toEqual([]);
});

test('B3 style contract is indexed read-only for React projects', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-0114-style-contract-'));
  const source = portableStyleContract();
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ dependencies: { react: '^19.0.0' } }, null, 2),
    'utf8',
  );
  await writeFile(join(root, 'DESIGN.md'), source, 'utf8');

  await generateProjectDesignIndexFiles(root, {
    projectName: 'Style Contract React',
    catalog: null,
  });

  expect(await readFile(join(root, 'DESIGN.md'), 'utf8')).toBe(source);
  const promptSummary = await readFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.promptSummary),
    'utf8',
  );
  expect(promptSummary).toContain('## Project style contract');
  expect(promptSummary).toContain('### Component Stylings');
  expect(promptSummary).toContain('Reuse project component roles and variants.');

  const manifest = JSON.parse(
    await readFile(join(root, CANONICAL_DESIGN_INDEX_PATHS.manifest), 'utf8'),
  );
  expect(manifest.sources.designMd).toBe(true);
  expect(manifest.quality.checks).toContainEqual(
    expect.objectContaining({ id: 'project-style-contract-sections', status: 'passed' }),
  );
  const diagnostics = JSON.parse(
    await readFile(join(root, CANONICAL_DESIGN_INDEX_PATHS.diagnostics), 'utf8'),
  );
  expect(diagnostics.diagnostics).not.toContainEqual(
    expect.objectContaining({ message: expect.stringContaining('Project style contract') }),
  );
});

test('B3 style contract replaces the legacy section lens for HTML-first quality', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-0114-html-style-contract-'));
  const source = portableStyleContract();
  await mkdir(join(root, '.sber-designer'), { recursive: true });
  await mkdir(join(root, 'design-system'), { recursive: true });
  await writeFile(
    join(root, '.sber-designer/project.sdproj'),
    JSON.stringify({ version: 1, name: 'html-style', projectKind: 'html-first', screens: [] }),
    'utf8',
  );
  await writeFile(join(root, 'design-system/Design.md'), source, 'utf8');
  await writeFile(
    join(root, 'design-system/tokens.css'),
    ':root { --color-accent: #14532d; }\n',
    'utf8',
  );
  await writeFile(
    join(root, 'design-system/components.css'),
    '.button { color: var(--color-accent); }\n',
    'utf8',
  );

  await generateProjectDesignIndexFiles(root, {
    projectName: 'Style Contract HTML',
    catalog: null,
  });

  expect(await readFile(join(root, 'design-system/Design.md'), 'utf8')).toBe(source);
  const promptSummary = await readFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.promptSummary),
    'utf8',
  );
  expect(promptSummary).toContain('## Project style contract');
  expect(promptSummary).not.toContain('## HTML design system');

  const manifest = JSON.parse(
    await readFile(join(root, CANONICAL_DESIGN_INDEX_PATHS.manifest), 'utf8'),
  );
  expect(manifest.quality.checks).toContainEqual(
    expect.objectContaining({ id: 'project-style-contract-sections', status: 'passed' }),
  );
  expect(manifest.quality.checks).toContainEqual(
    expect.objectContaining({ id: 'html-design-system-sections', status: 'passed' }),
  );
});

function portableStyleContract(): string {
  return [
    '# Operations Calm',
    '',
    '> Category: Enterprise',
    '',
    '## 1. Visual Theme & Atmosphere',
    'Calm, precise, and suitable for dense operational work.',
    '',
    '## 2. Color Palette & Roles',
    'Use semantic surface, text, border, status, and action roles.',
    '',
    '## 3. Typography Rules',
    'Use the project type scale and tabular figures for numeric data.',
    '',
    '## 4. Component Stylings',
    'Reuse project component roles and variants.',
    '',
    '## 5. Layout Principles',
    'Use a compact grid with token-based spacing.',
    '',
    '## 6. Depth & Elevation',
    'Keep the default surface flat and reserve elevation for overlays.',
    '',
    "## 7. Do's and Don'ts",
    'Do preserve information hierarchy. Do not invent business facts.',
    '',
    '## 8. Responsive Behavior',
    'Collapse secondary columns before hiding primary actions.',
    '',
    '## 9. Agent Prompt Guide',
    'Prefer clear hierarchy and exact product facts.',
    '',
  ].join('\n');
}
