import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { delimiter, join } from 'node:path';

import type {
  AgentRuntimeDef,
  AgentRuntimeKind,
  ResolvedRuntimeCommand,
  RuntimeDiagnostic,
} from './types';

export type RuntimeLaunchSource = 'profile' | 'env' | 'path';

export interface RuntimeLocalProfile {
  name: string;
  runtime: AgentRuntimeKind;
  launchPath: string;
  selectedBin?: string;
}

export interface ResolvedRuntimeLaunch extends ResolvedRuntimeCommand {
  launchPath: string;
  source: RuntimeLaunchSource;
  diagnostics: RuntimeDiagnostic[];
}

export interface RuntimeLaunchHost {
  env?: Record<string, string | undefined>;
  profile?: RuntimeLocalProfile | null;
  canExecute?: (path: string) => Promise<boolean>;
  findOnPath?: (bin: string) => Promise<string | null>;
}

export async function resolveRuntimeLaunch(
  def: AgentRuntimeDef,
  host: RuntimeLaunchHost = {},
): Promise<ResolvedRuntimeLaunch | null> {
  const env = host.env ?? process.env;
  const canExecuteFn = host.canExecute ?? canExecute;
  const findOnPathFn = host.findOnPath ?? findOnPath;
  const diagnostics: RuntimeDiagnostic[] = [];
  const envName = runtimeEnvOverrideName(def.kind);
  const profile = host.profile;

  if (profile && profile.runtime === def.kind) {
    if (await canExecuteFn(profile.launchPath)) {
      return {
        command: profile.launchPath,
        selectedBin: profile.selectedBin ?? def.primaryBin,
        launchPath: profile.launchPath,
        source: 'profile',
        diagnostics: [
          {
            code: 'launch_local_profile',
            message: `Using local runtime profile "${profile.name}" for ${def.displayName} launch path.`,
            severity: 'info',
          },
        ],
      };
    }
    diagnostics.push({
      code: 'launch_local_profile_not_executable',
      message: `Local runtime profile "${profile.name}" points to a non-executable path: ${profile.launchPath}`,
      severity: 'warning',
    });
  }

  const envOverride = env[envName]?.trim();

  if (envOverride) {
    if (await canExecuteFn(envOverride)) {
      return {
        command: envOverride,
        selectedBin: def.primaryBin,
        launchPath: envOverride,
        source: 'env',
        diagnostics: [
          {
            code: 'launch_env_override',
            message: `Using ${envName} for ${def.displayName} launch path.`,
            severity: 'info',
          },
        ],
      };
    }
    diagnostics.push({
      code: 'launch_env_override_not_executable',
      message: `${envName} points to a non-executable path: ${envOverride}`,
      severity: 'warning',
    });
  }

  for (const candidate of [def.primaryBin, ...def.fallbackBins]) {
    const resolved = await findOnPathFn(candidate);
    if (!resolved) continue;
    return {
      command: resolved,
      selectedBin: candidate,
      launchPath: resolved,
      source: 'path',
      diagnostics,
    };
  }

  return null;
}

export function runtimeEnvOverrideName(kind: AgentRuntimeKind): string {
  switch (kind) {
    case 'opencode':
      return 'SBER_DESIGNER_OPENCODE_BIN';
    case 'codex':
      return 'SBER_DESIGNER_CODEX_BIN';
    case 'claude-code':
      return 'SBER_DESIGNER_CLAUDE_CODE_BIN';
    case 'kimi':
      return 'SBER_DESIGNER_KIMI_BIN';
    case 'gigacode':
      return 'SBER_DESIGNER_GIGACODE_BIN';
  }
}

async function findOnPath(bin: string): Promise<string | null> {
  const pathValue = process.env.PATH ?? '';
  for (const dir of pathValue.split(delimiter)) {
    if (!dir) continue;
    const full = join(dir, bin);
    if (await canExecute(full)) return full;
  }
  return null;
}

async function canExecute(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
