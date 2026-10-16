/**
 * Heuristics that turn dev-server stdout into a state transition.
 *
 * Each tool prints its "ready" line slightly differently. Rather than
 * forcing the user to declare which framework they have, we just match
 * a few well-known phrases. If none match, the session stays in
 * `starting` until either we see the line or the user manually probes
 * the previewUrl in the browser (HMR works regardless of our match).
 *
 * Sources verified:
 *  - Storybook 8 (react-vite): "Storybook 8.x.x for react-vite started"
 *  - Vite:    "  ➜  Local:   http://localhost:5173/"
 *  - Next.js: "  ▲ Next.js 15.x   - Local:   http://localhost:3000"
 */

export interface ReadySignal {
  framework: 'storybook' | 'vite' | 'next' | 'generic';
  port?: number;
}

export type SandboxFailureReason =
  | 'binary_missing'
  | 'dependencies_missing'
  | 'package_install_blocked'
  | 'script_failed'
  | 'ready_timeout';

export interface SandboxFailureDiagnostic {
  reason: SandboxFailureReason;
  severity: 'warning' | 'error';
  message: string;
  command: string;
  evidence: string[];
  suggestedAction: string;
  registry?: string;
}

export interface SandboxFailureInput {
  command: string;
  args: string[];
  exitCode: number | null;
  signal: NodeJS.Signals | string | null;
  logsTail: string[];
}

export function detectReady(line: string): ReadySignal | null {
  const stripped = stripAnsi(line);

  // Storybook reports both "started" and a Local URL on subsequent lines.
  if (/Storybook\s+\d+\.\d+\.\d+\s+for\s+\S+\s+started/i.test(stripped)) {
    return { framework: 'storybook' };
  }

  // Vite-style "Local: http://localhost:NNNN/".
  const vite = /Local:\s+https?:\/\/[^:]+:(\d+)/i.exec(stripped);
  if (vite) {
    return { framework: 'vite', port: Number(vite[1]) };
  }

  // Next.js — both "Ready in" and the Local URL.
  if (/Next\.js\s+\d/.test(stripped) && /Local:\s+https?:\/\//i.test(stripped)) {
    const m = /Local:\s+https?:\/\/[^:]+:(\d+)/i.exec(stripped);
    return m ? { framework: 'next', port: Number(m[1]) } : { framework: 'next' };
  }

  // Generic "ready" / "listening on :PORT" fallback.
  const generic = /(?:listening on|ready on)[^\d]*(\d{2,5})/i.exec(stripped);
  if (generic) return { framework: 'generic', port: Number(generic[1]) };

  return null;
}

export function classifySandboxFailure(input: SandboxFailureInput): SandboxFailureDiagnostic {
  const evidenceLines = input.logsTail
    .map((line) => stripAnsi(line).trim())
    .filter(Boolean)
    .slice(-20);
  const command = [input.command, ...input.args].join(' ');
  const relevant = selectEvidence(evidenceLines, [
    /command not found/i,
    /not found/i,
    /node_modules/i,
    /\.bin/i,
    /403/i,
    /forbidden/i,
    /blocked/i,
  ]);
  const evidence = relevant.length > 0 ? relevant : evidenceLines.slice(-5);
  const combined = evidenceLines.join('\n');
  const registry = extractNpmRegistry(combined);

  if (input.exitCode === 127 || /command not found/i.test(combined)) {
    return {
      reason: 'binary_missing',
      severity: 'error',
      message: 'The sandbox dev-server binary is missing.',
      command,
      evidence,
      suggestedAction: 'Install dependencies, then restart the sandbox dev-server.',
      ...(registry ? { registry } : {}),
    };
  }

  if (/\b403\b/i.test(combined) && /(blocked|forbidden)/i.test(combined)) {
    return {
      reason: 'package_install_blocked',
      severity: 'error',
      message: 'Dependency installation appears to be blocked by the package registry.',
      command,
      evidence,
      suggestedAction: 'Ask the project setup owner for an approved dependency or registry remedy.',
      ...(registry ? { registry } : {}),
    };
  }

  if (/node_modules|\.bin\//i.test(combined)) {
    return {
      reason: 'dependencies_missing',
      severity: 'error',
      message: 'Project dependencies are missing or incomplete.',
      command,
      evidence,
      suggestedAction: 'Install project dependencies, then restart the sandbox dev-server.',
      ...(registry ? { registry } : {}),
    };
  }

  return {
    reason: 'script_failed',
    severity: 'error',
    message:
      input.exitCode === null
        ? `Sandbox dev-server stopped by signal ${input.signal ?? 'unknown'}.`
        : `Sandbox dev-server exited with code ${input.exitCode}.`,
    command,
    evidence,
    suggestedAction: 'Review the sandbox logs, fix the startup script, then restart.',
    ...(registry ? { registry } : {}),
  };
}

function stripAnsi(s: string): string {
  // Minimal — covers SGR escapes that Vite/Storybook emit.
  // We don't pull a dep; this keeps the package surface tiny.
  const escape = String.fromCharCode(27);
  return s.replace(new RegExp(`${escape}\\[[0-?]*[ -/]*[@-~]`, 'g'), '');
}

function selectEvidence(lines: string[], patterns: RegExp[]): string[] {
  return lines.filter((line) => patterns.some((pattern) => pattern.test(line))).slice(-8);
}

function extractNpmRegistry(text: string): string | null {
  const url = /https?:\/\/[^\s'"<>]+/iu.exec(text)?.[0];
  if (!url) return null;
  const npmRepo = /^(https?:\/\/.+?\/repo\/npm\/?)/iu.exec(url)?.[1];
  if (npmRepo) return ensureTrailingSlash(npmRepo);
  try {
    const parsed = new URL(url);
    return `${parsed.origin}/`;
  } catch {
    return null;
  }
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}
