#!/usr/bin/env bun
/**
 * Concurrent dev runner — spawns apps/web, services/api, services/sandbox
 * in parallel and prefixes each line of stdout/stderr with the service name.
 * Ctrl+C stops them all together.
 *
 * No `concurrently` dep — Bun spawn is enough.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

import { resolveDevPorts } from './dev-ports';

interface ServiceSpec {
  name: string;
  cwd: string;
  color: string;
  env?: NodeJS.ProcessEnv;
}

const ports = await resolveDevPorts();

const SERVICES: ServiceSpec[] = [
  { name: 'api    ', cwd: 'services/api', color: '\x1b[34m', env: ports.apiEnv }, // blue
  {
    name: 'sandbox',
    cwd: 'services/sandbox',
    color: '\x1b[35m',
    env: ports.sandboxEnv,
  }, // magenta
  { name: 'web    ', cwd: 'apps/web', color: '\x1b[32m', env: ports.webEnv }, // green
];
const RESET = '\x1b[0m';

const procs: ChildProcessWithoutNullStreams[] = [];

const pipe = (svc: ServiceSpec, channel: 'stdout' | 'stderr') => (chunk: Buffer) => {
  const sink = channel === 'stdout' ? process.stdout : process.stderr;
  const text = chunk.toString();
  for (const line of text.split('\n')) {
    if (!line) continue;
    sink.write(`${svc.color}[${svc.name}]${RESET} ${line}\n`);
  }
};

for (const svc of SERVICES) {
  const child = spawn('bun', ['run', 'dev'], {
    cwd: svc.cwd,
    env: { ...process.env, ...svc.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  }) as ChildProcessWithoutNullStreams;
  child.stdout.on('data', pipe(svc, 'stdout'));
  child.stderr.on('data', pipe(svc, 'stderr'));
  child.on('exit', (code, signal) => {
    process.stderr.write(
      `${svc.color}[${svc.name}]${RESET} exited code=${code} signal=${signal}\n`,
    );
    shutdown(code ?? 0);
  });
  procs.push(child);
}

function shutdown(code: number): void {
  for (const p of procs) {
    try {
      p.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

process.stderr.write(
  [
    `dev-all: profile=${process.env.SBER_DESIGNER_DEPLOYMENT_MODE ?? 'local'}`,
    `dev-all: api http://localhost:${ports.apiPort}`,
    `sandbox http://localhost:${ports.sandboxPort}`,
    `web http://localhost:${ports.webPort}`,
    'Ctrl+C to stop.',
  ].join(' | ') + '\n',
);
