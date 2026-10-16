#!/usr/bin/env bun

import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface BuildInfo {
  version: string;
  gitSha: string;
  buildTime: string;
  productName?: string;
  author?: string;
}

type GitReader = (args: string[]) => string | undefined;

export interface WriteBuildInfoOptions {
  outputPath?: string;
  env?: NodeJS.ProcessEnv;
  now?: Date;
  git?: GitReader;
}

const REPOSITORY_ROOT = fileURLToPath(new URL('../', import.meta.url));
export const BUILD_INFO_PATH = fileURLToPath(new URL('../BUILD_INFO.json', import.meta.url));

function readGit(args: string[]): string | undefined {
  try {
    return execFileSync('git', args, {
      cwd: REPOSITORY_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) return normalized;
  }
  return undefined;
}

// npm allows `author` as "Name <email> (url)" or { name, email, url }.
function packageAuthor(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const { name, email } = value as { name?: unknown; email?: unknown };
  if (typeof name !== 'string' || !name.trim()) return undefined;
  return typeof email === 'string' && email.trim()
    ? `${name.trim()} <${email.trim()}>`
    : name.trim();
}

function resolveBuildTime(env: NodeJS.ProcessEnv, now: Date): string {
  const explicit = env.SBER_DESIGNER_BUILD_TIME?.trim();
  if (explicit) {
    const parsed = new Date(explicit);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error('SBER_DESIGNER_BUILD_TIME must be an ISO-8601 timestamp');
    }
    return parsed.toISOString();
  }

  const sourceDateEpoch = env.SOURCE_DATE_EPOCH?.trim();
  if (sourceDateEpoch) {
    const seconds = Number(sourceDateEpoch);
    if (!Number.isFinite(seconds) || seconds < 0) {
      throw new Error('SOURCE_DATE_EPOCH must be a non-negative number');
    }
    return new Date(seconds * 1_000).toISOString();
  }

  return now.toISOString();
}

export async function createBuildInfo(
  options: Omit<WriteBuildInfoOptions, 'outputPath'> = {},
): Promise<BuildInfo> {
  const env = options.env ?? process.env;
  const git = options.git ?? readGit;
  const packageJson = JSON.parse(
    await readFile(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
  ) as { name?: unknown; version?: unknown; author?: unknown };
  const packageVersion =
    typeof packageJson.version === 'string' ? packageJson.version.trim() : undefined;

  const gitSha = firstNonEmpty(
    env.SBER_DESIGNER_BUILD_SHA,
    env.GITHUB_SHA,
    env.CI_COMMIT_SHA,
    git(['rev-parse', '--verify', 'HEAD']),
  );
  if (!gitSha) {
    throw new Error(
      'Cannot determine build git SHA; build from a git checkout or set SBER_DESIGNER_BUILD_SHA',
    );
  }

  const version = firstNonEmpty(
    env.SBER_DESIGNER_BUILD_VERSION,
    git(['describe', '--tags', '--exact-match', '--match', 'v[0-9]*', 'HEAD']),
    packageVersion,
  );
  if (!version) throw new Error('Cannot determine build version');

  const productName = typeof packageJson.name === 'string' ? packageJson.name.trim() : '';
  const author = packageAuthor(packageJson.author);

  return {
    version,
    gitSha,
    buildTime: resolveBuildTime(env, options.now ?? new Date()),
    ...(productName ? { productName } : {}),
    ...(author ? { author } : {}),
  };
}

export async function writeBuildInfo(options: WriteBuildInfoOptions = {}): Promise<BuildInfo> {
  const outputPath = options.outputPath ?? BUILD_INFO_PATH;
  const info = await createBuildInfo(options);
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify(info, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, outputPath);
  return info;
}

if (import.meta.main) {
  const info = await writeBuildInfo();
  process.stdout.write(
    `[build-info] ${info.version} ${info.gitSha} ${info.buildTime} -> ${BUILD_INFO_PATH}\n`,
  );
}
