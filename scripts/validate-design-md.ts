#!/usr/bin/env bun
import { resolve } from 'node:path';

import {
  loadProjectDesignContext,
  validateProjectDesignContext,
} from '../services/api/src/design-context';

const args = process.argv.slice(2);
const json = args.includes('--json');
const checkOnly = args.includes('--check-only');
const workspaceArg = args.find((arg) => !arg.startsWith('--'));
const workspaceRoot = resolve(workspaceArg ?? process.cwd());

const context = checkOnly
  ? await loadProjectDesignContext(workspaceRoot)
  : await validateProjectDesignContext(workspaceRoot);

if (json) {
  console.log(
    JSON.stringify(
      {
        status: context.validation.status,
        stale: context.validation.stale,
        validator: context.validation.validator,
        designMdSpecVersion: context.validation.designMdSpecVersion,
        googleDesignMdSourceCommit: context.validation.googleDesignMdSourceCommit,
        trackedFiles: context.validation.trackedFiles,
        checkedAt: context.validation.checkedAt,
        diagnostics: context.diagnostics,
      },
      null,
      2,
    ),
  );
} else {
  console.log(`DESIGN.md status: ${context.validation.status}`);
  console.log(`Validator: ${context.validation.validator}`);
  console.log(`Spec: design.md ${context.validation.designMdSpecVersion}`);
  console.log(`Google source commit: ${context.validation.googleDesignMdSourceCommit}`);
  console.log(`Tracked files: ${context.validation.trackedFiles}`);
  if (context.validation.checkedAt) {
    console.log(`Checked at: ${new Date(context.validation.checkedAt).toISOString()}`);
  }
  for (const diagnostic of context.diagnostics) {
    console.log(`${diagnostic.level.toUpperCase()} ${diagnostic.filePath}: ${diagnostic.message}`);
  }
}

process.exitCode = context.validation.status === 'error' ? 1 : 0;
