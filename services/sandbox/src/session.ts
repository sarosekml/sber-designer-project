/**
 * One spawned dev-server. Owns the child process, accumulates a tail of
 * its logs, and tracks status transitions.
 *
 * Phase 0 PoC-3: local spawn only — no Docker, no resource limits.
 * See ADR-0008.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

import { classifySandboxFailure, detectReady, type SandboxFailureDiagnostic } from './log-matcher';
import { buildSandboxChildEnv } from './policy';

export type SessionStatus = 'starting' | 'ready' | 'failed' | 'stopped';

export interface SessionInfo {
  id: string;
  workspacePath: string;
  command: string;
  args: string[];
  port: number;
  status: SessionStatus;
  previewUrl: string | null;
  logsTail: string[];
  startedAt: number;
  readyAt: number | null;
  errorMessage: string | null;
  diagnostics: SandboxFailureDiagnostic | null;
}

const LOG_TAIL_LIMIT = 200;

export class Session {
  readonly id = randomUUID();
  readonly startedAt = Date.now();
  status: SessionStatus = 'starting';
  previewUrl: string | null = null;
  readyAt: number | null = null;
  errorMessage: string | null = null;
  diagnostics: SandboxFailureDiagnostic | null = null;
  private readonly logTail: string[] = [];
  private child: ChildProcess | null = null;

  constructor(
    readonly workspacePath: string,
    readonly command: string,
    readonly args: string[],
    readonly port: number,
  ) {}

  start(): void {
    const child = spawn(this.command, this.args, {
      cwd: this.workspacePath,
      // 0136 R05 — an allowlist, not `...process.env`. The connected
      // project's dev-script used to inherit every auth, service and
      // provider secret the controller was started with.
      //
      // SBER_DESIGNER_SANDBOX lets the project's Storybook config disable HMR
      // full-reload for the embedded preview (task 9999 — the HMR blank-canvas
      // trap). See docs/how-it-works/project-requirements.md.
      env: buildSandboxChildEnv(process.env, {
        PORT: String(this.port),
        BROWSER: 'none',
        SBER_DESIGNER_SANDBOX: '1',
      }),
      stdio: ['ignore', 'pipe', 'pipe'],
      // detached:false so the OS reaps the child when our process exits.
      shell: false,
    });
    this.child = child;

    const handleLine = (line: string, channel: 'stdout' | 'stderr') => {
      this.appendLog(`[${channel}] ${line}`);
      if (this.status === 'starting') {
        const sig = detectReady(line);
        if (sig) {
          this.status = 'ready';
          this.readyAt = Date.now();
          // The framework's reported port wins if it differs from our request.
          const finalPort = sig.port ?? this.port;
          this.previewUrl = `http://localhost:${finalPort}`;
        }
      }
    };

    pipeLines(child.stdout!, (l) => handleLine(l, 'stdout'));
    pipeLines(child.stderr!, (l) => handleLine(l, 'stderr'));

    child.on('error', (err) => {
      this.status = 'failed';
      this.errorMessage = err.message;
      this.appendLog(`[error] ${err.message}`);
      this.diagnostics = classifySandboxFailure({
        command: this.command,
        args: this.args,
        exitCode: null,
        signal: null,
        logsTail: this.logTail,
      });
    });
    child.on('exit', (code, signal) => {
      if (this.status !== 'stopped') {
        this.status = code === 0 ? 'stopped' : 'failed';
        this.errorMessage = `Process exited with code=${code} signal=${signal ?? 'null'}`;
        if (this.status === 'failed') {
          this.diagnostics = classifySandboxFailure({
            command: this.command,
            args: this.args,
            exitCode: code,
            signal,
            logsTail: this.logTail,
          });
        }
      }
    });
  }

  stop(): void {
    if (!this.child || this.status === 'stopped') return;
    this.status = 'stopped';
    try {
      this.child.kill('SIGTERM');
    } catch {
      // ignore — process may have already exited.
    }
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
      diagnostics: this.diagnostics,
    };
  }

  private appendLog(line: string) {
    this.logTail.push(line);
    if (this.logTail.length > LOG_TAIL_LIMIT) {
      this.logTail.shift();
    }
  }
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

/**
 * Reserve a free port by briefly binding to :0 and reading what the OS
 * assigned. We then close the listener and pass the port to the child.
 * This is racy in theory; in practice good enough for a single-developer PoC.
 */
export async function pickFreePort(): Promise<number> {
  return new Promise<number>((res, rej) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', rej);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (typeof addr === 'object' && addr) {
        const port = addr.port;
        srv.close(() => res(port));
      } else {
        srv.close();
        rej(new Error('Could not determine free port'));
      }
    });
  });
}

export function resolveWorkspace(input: string): string {
  return resolve(input);
}
