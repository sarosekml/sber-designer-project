import { afterEach, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

import { createBuildMarkerTag, resolveViteStartupProfile } from '../apps/web/vite.config';
import { resolveStartupProfile } from '../packages/shared-types/src/deployment-mode';
import { writeBuildInfo } from '../scripts/write-build-info';
import { loadBuildInfo, parseBuildInfo } from '../services/api/src/build-info';
import { createVersionRouter } from '../services/api/src/routes/version';

const temporaryDirectories: string[] = [];
const workspaceRoot = resolve(import.meta.dir, '..');

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('0400 build version contract', () => {
  test('writes and loads one deterministic BUILD_INFO.json contract', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sd-build-info-'));
    temporaryDirectories.push(directory);
    const outputPath = join(directory, 'BUILD_INFO.json');

    const written = await writeBuildInfo({
      outputPath,
      env: {
        SBER_DESIGNER_BUILD_SHA: 'abc123',
        SBER_DESIGNER_BUILD_VERSION: 'v0.2.0-beta.1',
        SBER_DESIGNER_BUILD_TIME: '2026-07-09T12:00:00Z',
      },
    });

    const packageJson = JSON.parse(await readFile(join(workspaceRoot, 'package.json'), 'utf8')) as {
      name: string;
      author: string;
    };
    expect(written).toEqual({
      version: 'v0.2.0-beta.1',
      gitSha: 'abc123',
      buildTime: '2026-07-09T12:00:00.000Z',
      productName: packageJson.name,
      author: packageJson.author,
    });
    expect(loadBuildInfo(outputPath)).toEqual(written);
    expect(JSON.parse(await readFile(outputPath, 'utf8'))).toEqual(written);
  });

  test('keeps productName and author optional for older BUILD_INFO.json files', () => {
    const legacy = {
      version: '0.0.0',
      gitSha: 'abc123',
      buildTime: '2026-07-09T12:00:00.000Z',
    };
    expect(parseBuildInfo(legacy)).toEqual(legacy);
    expect(
      parseBuildInfo({
        ...legacy,
        productName: ' sber-designer ',
        author: 'Jane Doe <jane@example.com>',
      }),
    ).toEqual({ ...legacy, productName: 'sber-designer', author: 'Jane Doe <jane@example.com>' });
    expect(parseBuildInfo({ ...legacy, productName: '', author: null })).toEqual(legacy);
    expect(() => parseBuildInfo({ ...legacy, author: 42 })).toThrow(
      'author must be a string when present',
    );
  });

  test('package.json carries a real version and author for the build marker', async () => {
    const packageJson = JSON.parse(await readFile(join(workspaceRoot, 'package.json'), 'utf8')) as {
      version?: string;
      author?: string;
    };
    expect(packageJson.version).not.toBe('0.0.0');
    expect(packageJson.author?.trim()).toBeTruthy();
  });

  test('rejects malformed build metadata', async () => {
    expect(() => parseBuildInfo({ version: 'v1', gitSha: '', buildTime: 'not-a-date' })).toThrow(
      'gitSha must be a non-empty string',
    );

    const directory = await mkdtemp(join(tmpdir(), 'sd-build-info-invalid-'));
    temporaryDirectories.push(directory);
    const outputPath = join(directory, 'BUILD_INFO.json');
    await writeFile(outputPath, '{broken', 'utf8');
    expect(() => loadBuildInfo(outputPath)).toThrow('Cannot read build info');
  });

  test('serves the version publicly and returns 503 when metadata is unavailable', async () => {
    const info = {
      version: 'v0.2.0-beta.1',
      gitSha: 'abc123',
      buildTime: '2026-07-09T12:00:00.000Z',
    };
    const response = await createVersionRouter(() => info).request('http://localhost/');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(info);

    const unavailable = await createVersionRouter(() => {
      throw new Error('missing');
    }).request('http://localhost/');
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toEqual({
      error: 'build_info_unavailable',
      detail: 'Build metadata is unavailable. Run the repository build step before serving.',
    });
  });

  test('emits the web marker consumed by the smoke parity check', () => {
    expect(createBuildMarkerTag('abc123')).toEqual({
      tag: 'meta',
      attrs: { name: 'sber-designer-build', content: 'abc123' },
      injectTo: 'head',
    });
  });

  test('loads the Vite config through Node without executing workspace TypeScript', () => {
    const result = spawnSync(
      'node',
      [
        '--input-type=module',
        '-e',
        [
          "import { loadConfigFromFile } from 'vite';",
          "const loaded = await loadConfigFromFile({ command: 'serve', mode: 'development' }, 'apps/web/vite.config.ts');",
          "if (!loaded) throw new Error('Vite config was not loaded');",
          'console.log(loaded.path);',
        ].join(' '),
      ],
      {
        cwd: workspaceRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          SBER_DESIGNER_DEPLOYMENT_MODE: 'local',
          SBER_DESIGNER_AUTH_MODE: 'local',
        },
      },
    );

    if (result.status !== 0) {
      throw new Error(`Node could not load apps/web/vite.config.ts:\n${result.stderr}`);
    }
    expect(result.stdout).toContain('apps/web/vite.config.ts');
    expect(result.stderr).not.toContain('ERR_UNKNOWN_FILE_EXTENSION');
  });

  test('keeps the self-contained Vite startup profile in parity with shared types', () => {
    const cases = [
      {},
      { deploymentMode: ' local ', authMode: 'local' },
      { deploymentMode: 'server', authMode: 'password' },
      { deploymentMode: 'server', authMode: 'oidc' },
      { deploymentMode: 'server', oidcIssuer: 'https://issuer.internal' },
    ];

    for (const input of cases) {
      expect(resolveViteStartupProfile(input)).toEqual(resolveStartupProfile(input));
    }
    for (const input of [
      { deploymentMode: 'hybrid' },
      { authMode: 'basic' },
      { deploymentMode: 'server', authMode: 'local' },
    ]) {
      expect(() => resolveViteStartupProfile(input)).toThrow();
      expect(() => resolveStartupProfile(input)).toThrow();
    }
  });
});
