/**
 * Docker driver — alternative to local-spawn (Phase 4 / ADR-0008 redo).
 *
 * Runs the user's dev-server inside a `sd-sandbox` container with the
 * workspace bind-mounted and node_modules in a named volume. Talks to
 * the Docker daemon via the `docker` CLI; no SDK dep.
 *
 * Status follows the same shape as the local Session so the routes
 * don't have to care which driver is active.
 *
 * Set SBER_DESIGNER_SANDBOX_DRIVER=docker on the api-side controller
 * to enable. Set SBER_DESIGNER_SANDBOX_IMAGE to override the image
 * (default: sd-sandbox:latest).
 *
 * Phase 6.5 — warm cache. The node_modules volume is now keyed by a
 * stable hash of the workspace path, not by session id. Repeat
 * Connect calls reuse the install from the previous session, taking
 * cold-start from "bun install + compile" (30 s+) down to just
 * "compile" (typically <5 s on warm caches). Volumes are deliberately
 * NOT removed on session stop; clean up manually with
 *   docker volume ls --filter label=sd-sandbox=workspace
 *   docker volume rm <name>
 */
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { detectReady } from './log-matcher';
import type { SessionInfo, SessionStatus } from './session';

const IMAGE = process.env.SBER_DESIGNER_SANDBOX_IMAGE ?? 'sd-sandbox:latest';
/**
 * 0136 R05 — container hardening defaults. `-p 0:<port>` published on all
 * host interfaces, and the container ran unconstrained: no cpu, memory or
 * pid ceiling. Each of these is an env override so an operator can widen
 * them for a heavy project without editing the source.
 */
const PUBLISH_HOST = process.env.SBER_DESIGNER_SANDBOX_DOCKER_PUBLISH_HOST ?? '127.0.0.1';
const CONTAINER_CPUS = process.env.SBER_DESIGNER_SANDBOX_DOCKER_CPUS ?? '2';
const CONTAINER_MEMORY = process.env.SBER_DESIGNER_SANDBOX_DOCKER_MEMORY ?? '4g';
const CONTAINER_PIDS = process.env.SBER_DESIGNER_SANDBOX_DOCKER_PIDS ?? '512';
const DEFAULT_TIMEOUT_MS = 30_000;
const LOG_TAIL_LIMIT = 200;

interface DockerStartInput {
  workspacePath: string;
  command: string;
  args: string[];
  /** Container-internal port the dev-server listens on. Default 6006. */
  internalPort?: number;
}

export class DockerSession {
  readonly id = randomUUID();
  readonly startedAt = Date.now();
  readonly containerName = `sd-${this.id.slice(0, 12)}`;
  /**
   * node_modules volume name keyed by the absolute workspace path.
   * Stable across sessions so a re-Connect reuses the install (Phase 6.5).
   * 16 hex chars of sha256 → 64 bits of address space; collisions are
   * implausible for any practical number of workspaces on one host.
   */
  readonly volumeName: string;
  status: SessionStatus = 'starting';
  previewUrl: string | null = null;
  readyAt: number | null = null;
  errorMessage: string | null = null;
  port = 0;
  private logTail: string[] = [];
  private logStream: ReturnType<typeof spawn> | null = null;
  private stopped = false;

  constructor(
    readonly workspacePath: string,
    readonly command: string,
    readonly args: string[],
    readonly internalPort: number = 6006,
  ) {
    this.volumeName = `sd-modules-${createHash('sha256')
      .update(resolve(workspacePath))
      .digest('hex')
      .slice(0, 16)}`;
  }

  async start(): Promise<void> {
    const cwd = resolve(this.workspacePath);
    // Pre-create the named volume with a label so `docker volume ls
    // --filter label=sd-sandbox=workspace` lists exactly our caches.
    // `docker volume create` is idempotent — re-creating an existing
    // volume succeeds without changing it.
    await execDocker([
      'volume',
      'create',
      '--label',
      'sd-sandbox=workspace',
      '--label',
      `sd-workspace=${cwd}`,
      this.volumeName,
    ]).catch(() => undefined);

    // 1. docker run detached, publishing container's internalPort to a
    //    random host port (0:internalPort).
    const runArgs = [
      'run',
      '-d',
      '--rm',
      '--name',
      this.containerName,
      '-v',
      `${cwd}:/work`,
      '-v',
      `${this.volumeName}:/work/node_modules`,
      '-w',
      '/work',
      // Loopback-only publishing: the api reaches the container through the
      // host's loopback interface, nothing else needs to.
      '-p',
      `${PUBLISH_HOST}:0:${this.internalPort}`,
      '--cpus',
      CONTAINER_CPUS,
      '--memory',
      CONTAINER_MEMORY,
      '--pids-limit',
      CONTAINER_PIDS,
      // A dev-server never needs to raise privileges.
      '--security-opt',
      'no-new-privileges',
      '-e',
      `PORT=${this.internalPort}`,
      '-e',
      'BROWSER=none',
      // Lets the project's Storybook disable HMR full-reload for the embedded
      // preview (task 9999 — HMR blank-canvas trap).
      '-e',
      'SBER_DESIGNER_SANDBOX=1',
      IMAGE,
      this.command,
      ...this.args,
    ];

    const runRes = await execDocker(runArgs);
    if (!runRes.ok) {
      this.status = 'failed';
      this.errorMessage = `docker run failed: ${runRes.stderr.trim()}`;
      this.appendLog(`[error] ${this.errorMessage}`);
      return;
    }

    // 2. Discover the host-side mapped port.
    const portRes = await execDocker(['port', this.containerName, String(this.internalPort)]);
    if (!portRes.ok) {
      this.status = 'failed';
      this.errorMessage = `docker port failed: ${portRes.stderr.trim()}`;
      return;
    }
    // `docker port` outputs lines like "0.0.0.0:55001" (and an IPv6 dup).
    const m = /:(\d+)\s*$/m.exec(portRes.stdout.trim().split('\n')[0] ?? '');
    if (!m) {
      this.status = 'failed';
      this.errorMessage = `Could not parse host port from "${portRes.stdout.trim()}"`;
      return;
    }
    this.port = Number(m[1]);

    // 3. Tail container logs to detect "ready" lines and surface failures.
    this.logStream = spawn('docker', ['logs', '-f', this.containerName], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    pipeLines(this.logStream.stdout!, (line) => this.handleLog(line, 'stdout'));
    pipeLines(this.logStream.stderr!, (line) => this.handleLog(line, 'stderr'));
    this.logStream.on('exit', () => {
      // The logs stream exits when the container exits.
      if (this.status === 'starting' || this.status === 'ready') {
        this.status = 'stopped';
      }
    });
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    this.status = 'stopped';
    try {
      this.logStream?.kill('SIGTERM');
    } catch {
      // ignore
    }
    // Phase 6.5 — keep the node_modules volume so the next Connect for
    // the same workspace skips `bun install`. Container itself is
    // --rm above so it's gone the moment the dev-server exits.
    // `docker stop` instead of `kill` so finalizers (cache flushes,
    // SIGTERM handlers) have a chance to run.
    await execDocker(['stop', '-t', '5', this.containerName]).catch(() => undefined);
  }

  toJSON(): SessionInfo {
    return {
      id: this.id,
      workspacePath: this.workspacePath,
      command: this.command,
      args: this.args,
      port: this.port,
      status: this.status,
      previewUrl: this.previewUrl,
      logsTail: this.logTail.slice(-50),
      startedAt: this.startedAt,
      readyAt: this.readyAt,
      errorMessage: this.errorMessage,
      // The docker driver does not classify failures yet; the field is part
      // of SessionInfo, so report it explicitly rather than omitting it.
      diagnostics: null,
    };
  }

  private appendLog(line: string) {
    this.logTail.push(line);
    if (this.logTail.length > LOG_TAIL_LIMIT) this.logTail.shift();
  }

  private handleLog(line: string, channel: 'stdout' | 'stderr') {
    this.appendLog(`[${channel}] ${line}`);
    if (this.status === 'starting') {
      const sig = detectReady(line);
      if (sig) {
        this.status = 'ready';
        this.readyAt = Date.now();
        // Frameworks may report their own port; we keep using the host-side
        // mapped port (this.port) — that's the one the editor iframe loads.
        this.previewUrl = `http://localhost:${this.port}`;
      }
    }
  }
}

interface DockerResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
}

async function execDocker(args: string[]): Promise<DockerResult> {
  return new Promise((resolveFn) => {
    const child = spawn('docker', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (c) => (stdout += c));
    child.stderr?.on('data', (c) => (stderr += c));
    const timer = setTimeout(() => {
      try {
        child.kill('SIGTERM');
      } catch {
        // ignore
      }
    }, DEFAULT_TIMEOUT_MS);
    child.on('error', (err) =>
      resolveFn({ ok: false, stdout, stderr: stderr || err.message, code: null }),
    );
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolveFn({ ok: code === 0, stdout, stderr, code });
    });
  });
}

function pipeLines(stream: NodeJS.ReadableStream, onLine: (line: string) => void) {
  let buf = '';
  stream.setEncoding?.('utf8');
  stream.on('data', (chunk: string) => {
    buf += chunk;
    let idx = buf.indexOf('\n');
    while (idx !== -1) {
      const line = buf.slice(0, idx).replace(/\r$/, '');
      buf = buf.slice(idx + 1);
      if (line) onLine(line);
      idx = buf.indexOf('\n');
    }
  });
  stream.on('end', () => {
    const tail = buf.trim();
    if (tail) onLine(tail);
  });
}

export async function dockerAvailable(): Promise<boolean> {
  const r = await execDocker(['version', '--format', '{{.Server.Version}}']).catch(() => null);
  return Boolean(r && r.ok);
}

/**
 * Best-effort image pull on controller startup (Phase 6.5). Pre-warms
 * the daemon: if the image is already local this is a fast no-op; if
 * it's missing we pay the pull time once at boot instead of on first
 * Connect. Errors are swallowed and surfaced via logs only — Docker
 * absence is already handled in dockerAvailable().
 */
export async function ensureImagePulled(): Promise<{
  pulled: boolean;
  image: string;
  error?: string;
}> {
  if (!(await dockerAvailable())) {
    return { pulled: false, image: IMAGE, error: 'docker_unavailable' };
  }
  // `docker image inspect` exits non-zero when the image is missing.
  const inspect = await execDocker(['image', 'inspect', IMAGE]).catch(() => null);
  if (inspect && inspect.ok) return { pulled: false, image: IMAGE };
  const pull = await execDocker(['pull', IMAGE]).catch((e) => ({
    ok: false,
    stdout: '',
    stderr: e instanceof Error ? e.message : String(e),
    code: null as number | null,
  }));
  if (!pull.ok) {
    return {
      pulled: false,
      image: IMAGE,
      error: pull.stderr.trim() || `docker pull exit ${pull.code}`,
    };
  }
  return { pulled: true, image: IMAGE };
}

/**
 * Count workspace caches we've left behind — surfaced in /health so
 * an operator can see how warm the daemon is. Filters by our label so
 * unrelated volumes are ignored.
 */
export async function listWarmCaches(): Promise<string[]> {
  const r = await execDocker([
    'volume',
    'ls',
    '--filter',
    'label=sd-sandbox=workspace',
    '--format',
    '{{.Name}}',
  ]).catch(() => null);
  if (!r || !r.ok) return [];
  return r.stdout
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}
