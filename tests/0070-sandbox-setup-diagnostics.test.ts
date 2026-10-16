import { expect, test } from 'bun:test';

import { classifySandboxFailure } from '../services/sandbox/src/log-matcher';

test('classifies exit 127 command-not-found sandbox failures as missing binary', () => {
  const diagnostic = classifySandboxFailure({
    command: 'bun',
    args: ['run', 'storybook'],
    exitCode: 127,
    signal: null,
    logsTail: ['[stderr] sh: storybook: command not found'],
  });

  expect(diagnostic).toMatchObject({
    reason: 'binary_missing',
    severity: 'error',
    command: 'bun run storybook',
    suggestedAction: 'Install dependencies, then restart the sandbox dev-server.',
  });
  expect(diagnostic.evidence).toContain('[stderr] sh: storybook: command not found');
});

test('classifies blocked internal registry install logs as package install blocked', () => {
  const diagnostic = classifySandboxFailure({
    command: 'npm',
    args: ['run', 'storybook'],
    exitCode: 1,
    signal: null,
    logsTail: [
      '[stderr] npm ERR! 403 Forbidden - GET https://sberosc.sigma.sbrf.ru/repo/npm/tar/-/tar-6.2.1.tgz',
      '[stderr] npm ERR! The package is blocked',
    ],
  });

  expect(diagnostic).toMatchObject({
    reason: 'package_install_blocked',
    severity: 'error',
    registry: 'https://sberosc.sigma.sbrf.ru/repo/npm/',
    suggestedAction: 'Ask the project setup owner for an approved dependency or registry remedy.',
  });
  expect(diagnostic.evidence.join('\n')).toContain('tar-6.2.1.tgz');
});
