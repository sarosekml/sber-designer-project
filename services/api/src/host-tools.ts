import { spawn, type SpawnOptions } from 'node:child_process';
import { access, constants as fsConstants } from 'node:fs/promises';
import path from 'node:path';

import type {
  HostApp,
  HostAppId,
  HostAppKind,
  HostAppsResponse,
  HostPlatform,
} from '@sber-designer/shared-types';

type Platform = HostPlatform | 'unknown';
type AccessFile = (filePath: string, mode?: number) => Promise<void>;

export interface HostAppCatalogueEntry {
  id: HostAppId;
  label: string;
  kind: HostAppKind;
  command?: string;
  commandArgs?: (workspacePath: string) => string[];
  macOpenBundle?: string | readonly string[];
  macOpenArgs?: (bundleName: string, workspacePath: string) => string[];
  platforms?: readonly HostPlatform[];
  excludedPlatforms?: readonly HostPlatform[];
}

const MAC_OPEN_COMMAND = '/usr/bin/open';

export const HOST_APP_CATALOGUE: readonly HostAppCatalogueEntry[] = [
  {
    id: 'cursor',
    label: 'Cursor',
    kind: 'editor',
    command: 'cursor',
    macOpenBundle: 'Cursor',
  },
  {
    id: 'vscode',
    label: 'VS Code',
    kind: 'editor',
    command: 'code',
    macOpenBundle: 'Visual Studio Code',
  },
  {
    id: 'windsurf',
    label: 'Windsurf',
    kind: 'editor',
    command: 'windsurf',
    macOpenBundle: 'Windsurf',
  },
  { id: 'zed', label: 'Zed', kind: 'editor', command: 'zed', macOpenBundle: 'Zed' },
  {
    id: 'qoder',
    label: 'Qoder',
    kind: 'editor',
    command: 'qoder',
    macOpenBundle: ['Qoder', 'QoderWork'],
  },
  {
    id: 'antigravity',
    label: 'Antigravity',
    kind: 'editor',
    command: 'antigravity',
    macOpenBundle: ['Antigravity', 'Google Antigravity'],
  },
  {
    id: 'webstorm',
    label: 'WebStorm',
    kind: 'editor',
    command: 'webstorm',
    macOpenBundle: 'WebStorm',
  },
  {
    id: 'idea',
    label: 'IntelliJ IDEA',
    kind: 'editor',
    command: 'idea',
    macOpenBundle: 'IntelliJ IDEA',
  },
  {
    id: 'xcode',
    label: 'Xcode',
    kind: 'editor',
    macOpenBundle: ['Xcode', 'Xcode-beta', 'Xcode Beta'],
    platforms: ['darwin'],
  },
  {
    id: 'finder',
    label: 'Finder',
    kind: 'file-manager',
    command: MAC_OPEN_COMMAND,
    commandArgs: (workspacePath) => ['-R', workspacePath],
    platforms: ['darwin'],
  },
  {
    id: 'explorer',
    label: 'Explorer',
    kind: 'file-manager',
    command: 'explorer',
    platforms: ['win32'],
  },
  {
    id: 'file-manager',
    label: 'File Manager',
    kind: 'file-manager',
    command: 'xdg-open',
    platforms: ['linux'],
  },
  {
    id: 'terminal',
    label: 'Terminal',
    kind: 'terminal',
    macOpenBundle: 'Terminal',
    platforms: ['darwin'],
  },
  {
    id: 'warp',
    label: 'Warp',
    kind: 'terminal',
    macOpenBundle: 'Warp',
    platforms: ['darwin'],
  },
];

export interface HostProbeOptions {
  platform?: Platform;
  env?: NodeJS.ProcessEnv;
  accessFile?: AccessFile;
}

export interface HostAppLaunchPlan {
  available: boolean;
  resolvedPath?: string;
  command?: string;
  args?: string[];
}

export function currentHostPlatform(platform: NodeJS.Platform = process.platform): Platform {
  if (platform === 'darwin' || platform === 'win32' || platform === 'linux') return platform;
  return 'unknown';
}

export function hostAppCatalogueEntry(appId: HostAppId): HostAppCatalogueEntry | null {
  return HOST_APP_CATALOGUE.find((entry) => entry.id === appId) ?? null;
}

export function hostAppAppliesToPlatform(
  entry: HostAppCatalogueEntry,
  platform: Platform,
): boolean {
  if (platform === 'unknown') return false;
  if (entry.platforms && !entry.platforms.includes(platform)) return false;
  if (entry.excludedPlatforms?.includes(platform)) return false;
  return true;
}

export async function probeCommandOnPath(
  command: string,
  options: HostProbeOptions = {},
): Promise<string | null> {
  const platform = options.platform ?? currentHostPlatform();
  const env = options.env ?? process.env;
  const accessFile = options.accessFile ?? access;
  if (command.includes('/') || command.includes('\\')) {
    return canAccess(command, fsConstants.X_OK, accessFile);
  }

  const suffixes =
    platform === 'win32' && !/\.(?:exe|cmd|bat)$/iu.test(command)
      ? ['.exe', '.cmd', '.bat', '']
      : [''];
  for (const directory of hostPathDirectories(platform, env)) {
    for (const suffix of suffixes) {
      const candidate = path.join(directory, `${command}${suffix}`);
      if (await canAccess(candidate, fsConstants.X_OK, accessFile)) return candidate;
    }
  }
  return null;
}

export async function listHostApps(options: HostProbeOptions = {}): Promise<HostAppsResponse> {
  const platform = options.platform ?? currentHostPlatform();
  const definitions = HOST_APP_CATALOGUE.filter((entry) =>
    hostAppAppliesToPlatform(entry, platform),
  );
  const apps = await Promise.all(
    definitions.map(async (entry): Promise<HostApp> => {
      const plan = await resolveHostAppEntry(entry, options);
      return {
        id: entry.id,
        label: entry.label,
        kind: entry.kind,
        available: plan.available,
        ...(plan.resolvedPath ? { resolvedPath: plan.resolvedPath } : {}),
      };
    }),
  );
  return { platform, apps };
}

export async function resolveHostAppLaunchPlan(
  appId: HostAppId,
  workspacePath: string,
  options: HostProbeOptions = {},
): Promise<HostAppLaunchPlan> {
  const platform = options.platform ?? currentHostPlatform();
  const entry = hostAppCatalogueEntry(appId);
  if (!entry || !hostAppAppliesToPlatform(entry, platform)) return { available: false };
  const resolved = await resolveHostAppEntry(entry, options);
  if (!resolved.available || !resolved.command || !resolved.argsForWorkspace) {
    return {
      available: false,
      ...(resolved.resolvedPath ? { resolvedPath: resolved.resolvedPath } : {}),
    };
  }
  return {
    available: true,
    ...(resolved.resolvedPath ? { resolvedPath: resolved.resolvedPath } : {}),
    command: resolved.command,
    args: resolved.argsForWorkspace(workspacePath),
  };
}

interface ResolvedHostAppEntry {
  available: boolean;
  resolvedPath?: string;
  command?: string;
  argsForWorkspace?: (workspacePath: string) => string[];
}

async function resolveHostAppEntry(
  entry: HostAppCatalogueEntry,
  options: HostProbeOptions,
): Promise<ResolvedHostAppEntry> {
  const platform = options.platform ?? currentHostPlatform();
  const env = options.env ?? process.env;
  const accessFile = options.accessFile ?? access;
  if (entry.command) {
    const resolvedCommand = await probeCommandOnPath(entry.command, {
      platform,
      env,
      accessFile,
    });
    if (resolvedCommand) {
      return {
        available: true,
        resolvedPath: resolvedCommand,
        command: resolvedCommand,
        argsForWorkspace: entry.commandArgs ?? ((workspacePath) => [workspacePath]),
      };
    }
  }
  if (entry.macOpenBundle && platform === 'darwin') {
    const bundle = await probeMacBundle(entry.macOpenBundle, env, accessFile);
    if (bundle) {
      const openCommand =
        (await canAccess(MAC_OPEN_COMMAND, fsConstants.X_OK, accessFile)) ??
        (await probeCommandOnPath('open', { platform, env, accessFile })) ??
        MAC_OPEN_COMMAND;
      return {
        available: true,
        resolvedPath: bundle.path,
        command: openCommand,
        argsForWorkspace: entry.macOpenArgs
          ? (workspacePath) => entry.macOpenArgs!(bundle.name, workspacePath)
          : (workspacePath) => ['-a', bundle.name, workspacePath],
      };
    }
  }
  return { available: false };
}

async function probeMacBundle(
  names: string | readonly string[],
  env: NodeJS.ProcessEnv,
  accessFile: AccessFile,
): Promise<{ name: string; path: string } | null> {
  const bundleNames = typeof names === 'string' ? [names] : names;
  const home = env.HOME?.trim();
  for (const bundleName of bundleNames) {
    const candidates = [
      `/Applications/${bundleName}.app`,
      ...(home ? [`${home}/Applications/${bundleName}.app`] : []),
      `/System/Applications/${bundleName}.app`,
      `/System/Applications/Utilities/${bundleName}.app`,
      `/System/Library/CoreServices/${bundleName}.app`,
    ];
    for (const candidate of candidates) {
      if (await canAccess(candidate, fsConstants.R_OK, accessFile)) {
        return { name: bundleName, path: candidate };
      }
    }
  }
  return null;
}

function hostPathDirectories(platform: Platform, env: NodeJS.ProcessEnv): string[] {
  const separator = platform === 'win32' ? ';' : ':';
  const home = env.HOME?.trim();
  const extras =
    platform === 'darwin'
      ? ['/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin']
      : platform === 'linux'
        ? ['/usr/local/bin', '/usr/bin', '/bin']
        : [];
  if (home && platform !== 'win32') extras.push(`${home}/.local/bin`);
  return Array.from(new Set([...(env.PATH ?? '').split(separator), ...extras].filter(Boolean)));
}

async function canAccess(
  candidate: string,
  mode: number,
  accessFile: AccessFile,
): Promise<string | null> {
  try {
    await accessFile(candidate, mode);
    return candidate;
  } catch {
    return null;
  }
}

export interface HostSpawnedProcess {
  once(event: 'spawn', listener: () => void): this;
  once(event: 'error', listener: (error: Error) => void): this;
  unref(): void;
}

export type SpawnHostProcess = (
  command: string,
  args: string[],
  options: SpawnOptions,
) => HostSpawnedProcess;

export interface LaunchHostAppOptions {
  platform?: Platform;
  env?: NodeJS.ProcessEnv;
  spawnProcess?: SpawnHostProcess;
}

export function launchHostApp(
  command: string,
  args: string[],
  options: LaunchHostAppOptions = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const platform = options.platform ?? currentHostPlatform();
  const env = options.env ?? process.env;
  const spawnProcess =
    options.spawnProcess ??
    ((spawnCommand, spawnArgs, spawnOptions) =>
      spawn(spawnCommand, spawnArgs, spawnOptions) as HostSpawnedProcess);
  const invocation = createHostCommandInvocation(command, args, platform, env);
  return new Promise((resolve) => {
    let child: HostSpawnedProcess;
    try {
      child = spawnProcess(invocation.command, invocation.args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: platform === 'win32',
        windowsVerbatimArguments: invocation.windowsVerbatimArguments,
      });
    } catch (error) {
      resolve({ ok: false, error: error instanceof Error ? error.message : String(error) });
      return;
    }
    let settled = false;
    child.once('spawn', () => {
      if (settled) return;
      settled = true;
      child.unref();
      resolve({ ok: true });
    });
    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, error: error instanceof Error ? error.message : String(error) });
    });
  });
}

interface HostCommandInvocation {
  command: string;
  args: string[];
  windowsVerbatimArguments?: boolean;
}

export function createHostCommandInvocation(
  command: string,
  args: string[],
  platform: Platform,
  env: NodeJS.ProcessEnv,
): HostCommandInvocation {
  if (platform !== 'win32' || !/\.(?:bat|cmd)$/iu.test(command)) {
    return { command, args };
  }
  const inner = [command, ...args].map(quoteWindowsCommandArg).join(' ');
  return {
    command: env.ComSpec ?? 'cmd.exe',
    args: ['/d', '/s', '/c', `"${inner}"`],
    windowsVerbatimArguments: true,
  };
}

function quoteWindowsCommandArg(value: string): string {
  if (!/[\s"&<>|^%]/u.test(value)) return value;
  const escaped = value.replace(/"/gu, '""').replace(/%/gu, '"^%"');
  return `"${escaped}"`;
}
