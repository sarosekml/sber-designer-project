import { expect, test } from 'bun:test';

import {
  resolveRuntimeLaunch,
  runtimeEnvOverrideName,
} from '../services/api/src/agent-runtimes/launch-resolution';
import {
  CODEX_RUNTIME_DEF,
  OPENCODE_RUNTIME_DEF,
} from '../services/api/src/agent-runtimes/registry';

test('runtime launch resolution separates selected bin from launch path and reports source diagnostics', async () => {
  const result = await resolveRuntimeLaunch(CODEX_RUNTIME_DEF, {
    env: { SBER_DESIGNER_CODEX_BIN: '/opt/company/codex-wrapper' },
    canExecute: async (path) => path === '/opt/company/codex-wrapper',
    findOnPath: async () => null,
  });

  expect(result).toMatchObject({
    command: '/opt/company/codex-wrapper',
    selectedBin: 'codex',
    launchPath: '/opt/company/codex-wrapper',
    source: 'env',
  });
  expect(result?.diagnostics).toContainEqual({
    code: 'launch_env_override',
    message: 'Using SBER_DESIGNER_CODEX_BIN for Codex CLI launch path.',
    severity: 'info',
  });
});

test('runtime launch resolution tries primary and fallback bins through PATH in order', async () => {
  const calls: string[] = [];
  const result = await resolveRuntimeLaunch(OPENCODE_RUNTIME_DEF, {
    env: {},
    canExecute: async () => false,
    findOnPath: async (bin) => {
      calls.push(bin);
      return bin === 'opencode' ? '/usr/local/bin/opencode' : null;
    },
  });

  expect(calls).toEqual(['opencode-cli', 'opencode']);
  expect(result).toMatchObject({
    command: '/usr/local/bin/opencode',
    selectedBin: 'opencode',
    launchPath: '/usr/local/bin/opencode',
    source: 'path',
  });
});

test('runtime launch resolution can use a local enterprise wrapper profile', async () => {
  const result = await resolveRuntimeLaunch(CODEX_RUNTIME_DEF, {
    profile: {
      name: 'corp-codex',
      runtime: 'codex',
      launchPath: '/opt/corp/bin/codex-wrapper',
      selectedBin: 'codex',
    },
    env: {},
    canExecute: async (path) => path === '/opt/corp/bin/codex-wrapper',
    findOnPath: async () => null,
  });

  expect(result).toMatchObject({
    command: '/opt/corp/bin/codex-wrapper',
    launchPath: '/opt/corp/bin/codex-wrapper',
    selectedBin: 'codex',
    source: 'profile',
  });
  expect(result?.diagnostics).toContainEqual({
    code: 'launch_local_profile',
    message: 'Using local runtime profile "corp-codex" for Codex CLI launch path.',
    severity: 'info',
  });
});

test('runtime launch resolution reports not found with GUI/native wrapper guidance', async () => {
  const result = await resolveRuntimeLaunch(CODEX_RUNTIME_DEF, {
    env: {},
    canExecute: async () => false,
    findOnPath: async () => null,
  });

  expect(result).toBeNull();
  expect(runtimeEnvOverrideName(CODEX_RUNTIME_DEF.kind)).toBe('SBER_DESIGNER_CODEX_BIN');
});
