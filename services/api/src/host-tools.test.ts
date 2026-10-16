import { expect, test } from 'bun:test';
import type { SpawnOptions } from 'node:child_process';

import {
  createHostCommandInvocation,
  launchHostApp,
  listHostApps,
  probeCommandOnPath,
  type HostSpawnedProcess,
  type SpawnHostProcess,
} from './host-tools';

const missingAccess = async () => {
  throw new Error('missing');
};

test('host catalogue is filtered by platform', async () => {
  const darwin = await listHostApps({ platform: 'darwin', accessFile: missingAccess });
  const win32 = await listHostApps({ platform: 'win32', accessFile: missingAccess });
  const linux = await listHostApps({ platform: 'linux', accessFile: missingAccess });

  expect(darwin.apps.map((app) => app.id)).toContain('finder');
  expect(darwin.apps.map((app) => app.id)).toContain('terminal');
  expect(darwin.apps.map((app) => app.id)).toContain('warp');
  expect(darwin.apps.map((app) => app.id)).not.toContain('explorer');
  expect(win32.apps.map((app) => app.id)).toContain('explorer');
  expect(win32.apps.map((app) => app.id)).not.toContain('finder');
  expect(linux.apps.map((app) => app.id)).toContain('file-manager');
  expect(linux.apps.map((app) => app.id)).not.toContain('warp');
});

test('PATH probe handles Windows executable suffixes', async () => {
  const visited: string[] = [];
  const result = await probeCommandOnPath('code', {
    platform: 'win32',
    env: { PATH: '/tools;/fallback' },
    accessFile: async (candidate) => {
      visited.push(candidate);
      if (candidate !== '/tools/code.exe') throw new Error('missing');
    },
  });

  expect(result).toBe('/tools/code.exe');
  expect(visited[0]).toBe('/tools/code.exe');
});

test('host launch waits for spawn and never requests a shell', async () => {
  let spawnOptions: SpawnOptions | null = null;
  let unrefCalled = false;
  const spawnProcess: SpawnHostProcess = (_command, _args, options) => {
    spawnOptions = options;
    const child = {
      once(event: 'spawn' | 'error', listener: (() => void) | ((error: Error) => void)) {
        if (event === 'spawn') queueMicrotask(() => (listener as () => void)());
        return child;
      },
      unref() {
        unrefCalled = true;
      },
    } as HostSpawnedProcess;
    return child;
  };

  await expect(
    launchHostApp('/usr/bin/open', ['/workspace/Work Dev/project'], {
      platform: 'darwin',
      spawnProcess,
    }),
  ).resolves.toEqual({ ok: true });
  const capturedOptions = spawnOptions as SpawnOptions | null;
  expect(capturedOptions).not.toHaveProperty('shell');
  expect(capturedOptions?.detached).toBe(true);
  expect(unrefCalled).toBe(true);
});

test('host launch reports asynchronous child errors', async () => {
  const spawnProcess: SpawnHostProcess = () => {
    const child = {
      once(event: 'spawn' | 'error', listener: (() => void) | ((error: Error) => void)) {
        if (event === 'error') {
          queueMicrotask(() => (listener as (error: Error) => void)(new Error('EACCES')));
        }
        return child;
      },
      unref() {},
    } as HostSpawnedProcess;
    return child;
  };

  await expect(
    launchHostApp('/Applications/Blocked', [], { platform: 'darwin', spawnProcess }),
  ).resolves.toEqual({ ok: false, error: 'EACCES' });
});

test('Windows cmd shims use a verbatim cmd.exe invocation with escaped percent signs', () => {
  const invocation = createHostCommandInvocation(
    'C:\\Tools\\editor.cmd',
    ['C:\\Work Dev\\100%project% & files'],
    'win32',
    { ComSpec: 'C:\\Windows\\System32\\cmd.exe' },
  );

  expect(invocation.command).toBe('C:\\Windows\\System32\\cmd.exe');
  expect(invocation.args.slice(0, 3)).toEqual(['/d', '/s', '/c']);
  expect(invocation.args[3]).toContain('"^%"');
  expect(invocation.windowsVerbatimArguments).toBe(true);
});
