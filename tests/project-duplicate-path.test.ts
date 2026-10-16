import { expect, test } from 'bun:test';

import {
  duplicateProjectCopyPath,
  isDuplicateNestedProjectPath,
  projectFolderNameFromName,
  scaffoldProjectWorkspacePath,
} from '../apps/web/src/lib/project-paths';

test('duplicate copy path creates a child workspace folder inside the chosen parent', () => {
  expect(duplicateProjectCopyPath('/Users/dev/Work Dev', 'demo-project-experimants')).toBe(
    '/Users/dev/Work Dev/demo-project-experimants',
  );
});

test('duplicate copy path uses the same slug shown to the user', () => {
  expect(projectFolderNameFromName('Demo Project Experimants')).toBe('demo-project-experimants');
  expect(duplicateProjectCopyPath('/tmp/projects/', 'Demo Project Experimants')).toBe(
    '/tmp/projects/demo-project-experimants',
  );
});

test('new project path defaults to the selected folder unless a subfolder is requested', () => {
  expect(scaffoldProjectWorkspacePath('/tmp/projects/demo-project', 'Demo Project', false)).toBe(
    '/tmp/projects/demo-project',
  );
  expect(scaffoldProjectWorkspacePath('/tmp/projects', 'Demo Project', true)).toBe(
    '/tmp/projects/demo-project',
  );
});

test('nested new project path detects accidental duplicate folder nesting', () => {
  expect(isDuplicateNestedProjectPath('/tmp/projects/demo-project/', 'Demo Project')).toBe(true);
  expect(isDuplicateNestedProjectPath('/tmp/projects', 'Demo Project')).toBe(false);
});
