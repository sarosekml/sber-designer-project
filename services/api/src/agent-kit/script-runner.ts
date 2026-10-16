import { spawn } from 'node:child_process';
import { basename, resolve } from 'node:path';
import type { AgentKitScript } from '@sber-designer/shared-types';

export type AgentScriptRunStatus = 'completed' | 'failed' | 'timed_out' | 'denied';

export interface AgentScriptRunResult {
  status: AgentScriptRunStatus;
  name: string;
  command: string;
  args: string[];
  cwd: 'workspace' | 'agents';
  cwdPath: string | null;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  truncated: boolean;
  durationMs: number;
  detail: string;
}

export interface RunAgentScriptManifestOptions {
  workspacePath?: string | null;
  agentsRoot: string;
  env?: NodeJS.ProcessEnv;
  outputLimitBytes?: number;
}

const DEFAULT_OUTPUT_LIMIT_BYTES = 64_000;
const REDACT_VALUE = '[redacted]';

export async function runAgentScriptManifest(
  script: AgentKitScript,
  options: RunAgentScriptManifestOptions,
): Promise<AgentScriptRunResult> {
  const startedAt = Date.now();
  const env = options.env ?? process.env;
  const denied = deniedByPolicy(script, env, options.workspacePath);
  if (denied) {
    return {
      status: 'denied',
      name: script.name,
      command: script.command,
      args: script.args,
      cwd: script.cwd,
      cwdPath: null,
      exitCode: null,
      stdout: '',
      stderr: '',
      truncated: false,
      durationMs: Date.now() - startedAt,
      detail: denied,
    };
  }

  const cwdPath = resolveScriptCwd(script, options);
  const outputLimitBytes = options.outputLimitBytes ?? DEFAULT_OUTPUT_LIMIT_BYTES;

  return new Promise((resolveResult) => {
    let stdout = '';
    let stderr = '';
    let outputBytes = 0;
    let truncated = false;
    let settled = false;

    const child = spawn(script.command, script.args, {
      cwd: cwdPath,
      env: { ...process.env, ...env },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      resolveResult({
        status: 'timed_out',
        name: script.name,
        command: script.command,
        args: script.args,
        cwd: script.cwd,
        cwdPath,
        exitCode: null,
        stdout: redact(stdout),
        stderr: redact(stderr),
        truncated,
        durationMs: Date.now() - startedAt,
        detail: `Script timed out after ${script.timeoutMs}ms.`,
      });
    }, script.timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      const captured = captureChunk(chunk, outputBytes, outputLimitBytes);
      outputBytes = captured.nextBytes;
      truncated ||= captured.truncated;
      stdout += captured.text;
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      const captured = captureChunk(chunk, outputBytes, outputLimitBytes);
      outputBytes = captured.nextBytes;
      truncated ||= captured.truncated;
      stderr += captured.text;
    });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveResult({
        status: 'failed',
        name: script.name,
        command: script.command,
        args: script.args,
        cwd: script.cwd,
        cwdPath,
        exitCode: null,
        stdout: redact(stdout),
        stderr: redact(`${stderr}${stderr ? '\n' : ''}${err.message}`),
        truncated,
        durationMs: Date.now() - startedAt,
        detail: `Script failed to start: ${err.message}`,
      });
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const status = code === 0 ? 'completed' : 'failed';
      resolveResult({
        status,
        name: script.name,
        command: script.command,
        args: script.args,
        cwd: script.cwd,
        cwdPath,
        exitCode: code,
        stdout: redact(stdout),
        stderr: redact(stderr),
        truncated,
        durationMs: Date.now() - startedAt,
        detail: resultDetail(status, code, truncated),
      });
    });
  });
}

function deniedByPolicy(
  script: AgentKitScript,
  env: NodeJS.ProcessEnv,
  workspacePath?: string | null,
): string | null {
  if (env.SBER_DESIGNER_AGENT_SCRIPTS === 'disabled') {
    return 'Agent script execution is disabled by SBER_DESIGNER_AGENT_SCRIPTS=disabled.';
  }
  if (script.cwd === 'workspace' && !workspacePath) {
    return 'This script requires a connected workspace.';
  }
  const allowlist = parseAllowlist(env.SBER_DESIGNER_AGENT_SCRIPT_ALLOWLIST);
  if (allowlist && !allowlist.has(commandName(script.command))) {
    return `Command "${commandName(script.command)}" is not in the allowlist.`;
  }
  return null;
}

function resolveScriptCwd(script: AgentKitScript, options: RunAgentScriptManifestOptions): string {
  if (script.cwd === 'agents') return resolve(options.agentsRoot);
  if (!options.workspacePath) throw new Error('Workspace path is required for workspace scripts.');
  return resolve(options.workspacePath);
}

function parseAllowlist(value: string | undefined): Set<string> | null {
  if (!value?.trim()) return null;
  return new Set(
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function commandName(command: string): string {
  return basename(command).replace(/\.(exe|cmd|bat)$/i, '');
}

function captureChunk(
  chunk: Buffer,
  currentBytes: number,
  limitBytes: number,
): { text: string; nextBytes: number; truncated: boolean } {
  if (currentBytes >= limitBytes) return { text: '', nextBytes: currentBytes, truncated: true };
  const remaining = limitBytes - currentBytes;
  const slice = chunk.byteLength > remaining ? chunk.subarray(0, remaining) : chunk;
  return {
    text: slice.toString('utf8'),
    nextBytes: currentBytes + slice.byteLength,
    truncated: chunk.byteLength > remaining,
  };
}

function resultDetail(
  status: Exclude<AgentScriptRunStatus, 'denied' | 'timed_out'>,
  code: number | null,
  truncated: boolean,
): string {
  const detail =
    status === 'completed'
      ? 'Script completed successfully.'
      : `Script exited with code ${code ?? 'unknown'}.`;
  return truncated ? `${detail} Output was truncated.` : detail;
}

function redact(value: string): string {
  return value.replace(
    /\b([A-Za-z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)[A-Za-z0-9_]*)=([^\s\r\n]+)/g,
    (_match, key: string) => `${key}=${REDACT_VALUE}`,
  );
}
