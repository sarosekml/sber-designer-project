/**
 * 0136 R15 — `deploy/update.sh` used to check out, install and build in place
 * and then restart, with a single `curl -fsS` as the only verification. A
 * failed install or build left a half-updated tree under the live service,
 * and a slow start read as a failed deploy.
 *
 * These run the real script against a throwaway git repo with stub commands
 * on PATH. Nothing is installed, built, restarted or fetched from a network.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

interface Stage {
  repo: string;
  binDir: string;
  logPath: string;
  headBefore: string;
  targetSha: string;
}

async function stubCommand(binDir: string, name: string, body: string): Promise<void> {
  const path = join(binDir, name);
  await writeFile(path, `#!/usr/bin/env bash\n${body}\n`, 'utf8');
  await chmod(path, 0o755);
}

async function run(cmd: string[], cwd: string): Promise<string> {
  const proc = Bun.spawn(cmd, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const [out] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
  return out.trim();
}

/**
 * A git repo with two commits, a stub `bun`, a stub `curl` and a stub
 * `systemctl`, plus a copy of the real update.sh under deploy/.
 */
async function stage(
  options: { bunBehaviour?: string; curlBehaviour?: string } = {},
): Promise<Stage> {
  const base = await mkdtemp(join(tmpdir(), 'sd-0136-update-'));
  temporaryDirectories.push(base);
  const repo = join(base, 'repo');
  const binDir = join(base, 'bin');
  await mkdir(join(repo, 'deploy'), { recursive: true });
  await mkdir(binDir, { recursive: true });
  const logPath = join(base, 'calls.log');

  await Bun.write(
    join(repo, 'deploy', 'update.sh'),
    await Bun.file(`${ROOT}/deploy/update.sh`).text(),
  );
  await chmod(join(repo, 'deploy', 'update.sh'), 0o755);

  const git = (args: string[]) => run(['git', ...args], repo);
  await git(['init', '-q']);
  await git(['config', 'user.email', 'test@example.com']);
  await git(['config', 'user.name', 'test']);
  await writeFile(
    join(repo, '.gitignore'),
    'node_modules/\napps/web/dist/\nBUILD_INFO.json\n.sd-update-*/\n',
  );
  await writeFile(join(repo, 'marker.txt'), 'v1', 'utf8');
  await git(['add', '-A']);
  await git(['commit', '-qm', 'v1']);
  await writeFile(join(repo, 'marker.txt'), 'v2', 'utf8');
  await git(['add', '-A']);
  await git(['commit', '-qm', 'v2']);
  const targetSha = await git(['rev-parse', 'HEAD']);
  // `git fetch --tags origin` must succeed without a network: point origin at
  // the repo itself, which is a valid remote.
  await git(['remote', 'add', 'origin', repo]);
  await git(['checkout', '-q', '--detach', 'HEAD~1']);
  const headBefore = await git(['rev-parse', 'HEAD']);

  await mkdir(join(repo, 'node_modules'), { recursive: true });
  await writeFile(join(repo, 'node_modules', 'marker'), 'old-dependencies');
  await mkdir(join(repo, 'apps/web/dist'), { recursive: true });
  await writeFile(join(repo, 'apps/web/dist/index.html'), 'old-bundle');
  await writeFile(join(repo, 'BUILD_INFO.json'), JSON.stringify({ gitSha: headBefore }));
  await stubCommand(
    binDir,
    'bun',
    [
      `echo "live=$(cat "$SD_LIVE_REPO/marker.txt") bundle=$(cat "$SD_LIVE_REPO/apps/web/dist/index.html")" >> "$SD_LOG"`,
      `mkdir -p node_modules apps/web/dist`,
      `echo new-dependencies > node_modules/marker`,
      `echo new-bundle > apps/web/dist/index.html`,
      `echo "{"gitSha":"$SD_TARGET_SHA"}" > BUILD_INFO.json`,
      options.bunBehaviour ?? `echo "bun $*" >> "${logPath}"; exit 0`,
    ].join('\n'),
  );

  await stubCommand(
    binDir,
    'curl',
    options.curlBehaviour ??
      `echo "curl $*" >> "${logPath}"; echo '{"gitSha":"'"$SD_TARGET_SHA"'"}'; exit 0`,
  );
  await stubCommand(binDir, 'systemctl', `echo "systemctl $*" >> "${logPath}"; exit 0`);

  return { repo, binDir, logPath, headBefore, targetSha };
}

async function runUpdate(
  s: Stage,
  ref: string,
  env: Record<string, string> = {},
): Promise<{ code: number; out: string }> {
  const proc = Bun.spawn(['bash', 'deploy/update.sh', ref], {
    cwd: s.repo,
    env: {
      PATH: `${s.binDir}:${process.env.PATH ?? ''}`,
      SD_LIVE_REPO: s.repo,
      SD_LOG: s.logPath,
      SD_TARGET_SHA: s.targetSha,
      SBER_DESIGNER_ENV_FILE: '/nonexistent/env',
      SBER_DESIGNER_BUN_PATH: join(s.binDir, 'bun'),
      SBER_DESIGNER_SKIP_SYSTEMCTL: '1',
      SBER_DESIGNER_SKIP_SMOKE: '1',
      SBER_DESIGNER_READY_TIMEOUT: '1',
      SBER_DESIGNER_READY_INTERVAL: '0.05',
      ...env,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { code, out: `${stdout}\n${stderr}` };
}

describe('0136 R15 update sequence', () => {
  test('a clean update checks out, installs frozen, builds, then restarts', async () => {
    const s = await stage();
    const { code, out } = await runUpdate(s, s.targetSha);
    expect(code, out).toBe(0);

    const calls = await Bun.file(s.logPath).text();
    const install = calls.indexOf('install --frozen-lockfile');
    const build = calls.indexOf('bun run build');
    const health = calls.indexOf('curl');
    expect(install).toBeGreaterThanOrEqual(0);
    expect(build).toBeGreaterThan(install);
    expect(calls).toContain('live=v1 bundle=old-bundle');
    expect(await Bun.file(join(s.repo, 'apps/web/dist/index.html')).text()).toBe('new-bundle\n');
    expect(health).toBeGreaterThan(build);
    expect(out).toContain('rollback point is');
    expect(await run(['git', 'rev-parse', 'HEAD'], s.repo)).toBe(s.targetSha);
  });

  test('a failed install rolls the checkout back and never restarts', async () => {
    const s = await stage({
      bunBehaviour: `echo "bun $*" >> "$SD_LOG"; if [[ "$1" == "install" ]]; then exit 1; fi; exit 0`,
    });
    const { code, out } = await runUpdate(s, s.targetSha, { SD_LOG: s.logPath });

    expect(code).not.toBe(0);
    expect(out).toContain('install failed; the running version was not changed');
    expect(await run(['git', 'rev-parse', 'HEAD'], s.repo)).toBe(s.headBefore);
    const calls = await Bun.file(s.logPath).text();
    expect(calls).not.toContain('bun run build');
    expect(calls).not.toContain('curl');
  });

  test('a failed build rolls back too', async () => {
    const s = await stage({
      bunBehaviour: `echo "bun $*" >> "$SD_LOG"; if [[ "$2" == "build" ]]; then exit 1; fi; exit 0`,
    });
    const { code, out } = await runUpdate(s, s.targetSha, { SD_LOG: s.logPath });

    expect(code).not.toBe(0);
    expect(out).toContain('build failed; the running version was not changed');
    expect(await run(['git', 'rev-parse', 'HEAD'], s.repo)).toBe(s.headBefore);
  });

  test('disabling rollback never exposes a failed preparation', async () => {
    const s = await stage({
      bunBehaviour: `echo "bun $*" >> "$SD_LOG"; if [[ "$1" == "install" ]]; then exit 1; fi; exit 0`,
    });
    const { code, out } = await runUpdate(s, s.targetSha, {
      SD_LOG: s.logPath,
      SBER_DESIGNER_UPDATE_NO_ROLLBACK: '1',
    });

    expect(code).not.toBe(0);
    expect(out).toContain('the running version was not changed');
    expect(await run(['git', 'rev-parse', 'HEAD'], s.repo)).toBe(s.headBefore);
  });

  test('a slow service is retried, not declared failed on the first probe', async () => {
    const s = await stage({
      curlBehaviour: [
        `attempts_file="$SD_LOG.attempts"`,
        `count=$(cat "$attempts_file" 2>/dev/null || echo 0)`,
        `count=$((count + 1))`,
        `echo "$count" > "$attempts_file"`,
        `echo "curl $*" >> "$SD_LOG"`,
        `if [[ "$count" -lt 3 ]]; then exit 7; fi`,
        `echo '{"gitSha":"'"$SD_TARGET_SHA"'"}'`,
      ].join('\n'),
    });
    const { code, out } = await runUpdate(s, s.targetSha, {
      SD_LOG: s.logPath,
      SBER_DESIGNER_READY_TIMEOUT: '3',
    });

    expect(code, out).toBe(0);
    expect(out).toContain('api is ready');
    expect(Number(await Bun.file(`${s.logPath}.attempts`).text())).toBeGreaterThan(2);
  });

  test('a service that never comes up fails the deploy with a clear reason', async () => {
    const s = await stage({ curlBehaviour: `echo "curl $*" >> "$SD_LOG"; exit 7` });
    const { code, out } = await runUpdate(s, s.targetSha, { SD_LOG: s.logPath });

    expect(code).not.toBe(0);
    expect(out).toContain('did not become ready');
    expect(await run(['git', 'rev-parse', 'HEAD'], s.repo)).toBe(s.headBefore);
    expect(await Bun.file(join(s.repo, 'apps/web/dist/index.html')).text()).toBe('old-bundle');
    expect(await Bun.file(join(s.repo, 'node_modules/marker')).text()).toBe('old-dependencies');
  });

  test('a successful health response with the wrong SHA rolls back', async () => {
    const s = await stage({ curlBehaviour: `echo '{"gitSha":"wrong-version"}'` });
    const { code, out } = await runUpdate(s, s.targetSha);
    expect(code).not.toBe(0);
    expect(out).toContain('version parity failed');
    expect(await run(['git', 'rev-parse', 'HEAD'], s.repo)).toBe(s.headBefore);
    expect(await Bun.file(join(s.repo, 'apps/web/dist/index.html')).text()).toBe('old-bundle');
  });

  test('a ref that does not exist fails before anything is installed', async () => {
    const s = await stage();
    const { code } = await runUpdate(s, 'no-such-ref-anywhere');
    expect(code).not.toBe(0);
    expect(await run(['git', 'rev-parse', 'HEAD'], s.repo)).toBe(s.headBefore);
  });
});
