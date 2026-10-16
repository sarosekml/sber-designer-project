#!/usr/bin/env bun
import { resolve } from 'node:path';

import { resolveCatalog } from '../services/api/src/catalog-cache';
import { generateProjectDesignContextFiles } from '../services/api/src/design-context';

const args = process.argv.slice(2);
const workspaceArg = args.find((arg) => !arg.startsWith('--'));
const workspaceRoot = resolve(workspaceArg ?? process.cwd());
const overwrite = args.includes('--overwrite');
const includeArg = args.find((arg) => arg.startsWith('--include='))?.slice('--include='.length) as
  | 'design'
  | 'component-map'
  | 'both'
  | undefined;
const projectName = args.find((arg) => arg.startsWith('--project-name='))?.slice(15);

if (includeArg && !['design', 'component-map', 'both'].includes(includeArg)) {
  console.error('Invalid --include value. Use design, component-map, or both.');
  process.exit(1);
}

const catalogResult = await resolveCatalog({ workspacePath: workspaceRoot, bypass: true });
const result = await generateProjectDesignContextFiles(workspaceRoot, {
  projectName,
  include: includeArg ?? 'both',
  overwrite,
  catalog: 'catalog' in catalogResult ? catalogResult.catalog : null,
});

console.log(`Generated design context for ${workspaceRoot}`);
console.log(`Changed: ${result.changedFiles.join(', ') || 'none'}`);
console.log(`Skipped: ${result.skippedFiles.join(', ') || 'none'}`);
console.log(`Status: ${result.context.validation.status}`);
for (const diagnostic of result.context.diagnostics) {
  console.log(`${diagnostic.level.toUpperCase()} ${diagnostic.filePath}: ${diagnostic.message}`);
}

process.exitCode = result.context.validation.status === 'error' ? 1 : 0;
