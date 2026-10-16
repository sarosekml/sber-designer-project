import { randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

import { CLI_RUNTIME_KINDS } from './system-settings';
import {
  DEFAULT_SYSTEM_SETTINGS,
  type AuthSessionRecord,
  type AuthUserRecord,
  type SessionsFile,
  type SystemSettings,
  type UsersFile,
} from './types';

const UserSchema = z.object({
  id: z.string().min(1),
  email: z.string().min(1),
  displayName: z.string().min(1),
  passwordHash: z.string().min(1),
  role: z.enum(['admin', 'member']),
  status: z.enum(['active', 'disabled']),
  mustChangePassword: z.boolean(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  lastLoginAt: z.string().nullable(),
});

const SessionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  tokenHash: z.string().min(1),
  createdAt: z.string().min(1),
  expiresAt: z.string().min(1),
  lastSeenAt: z.string().min(1),
  userAgent: z.string(),
  ip: z.string(),
});

const UsersFileSchema = z.object({ version: z.literal(1), users: z.array(UserSchema) });
const SessionsFileSchema = z.object({ version: z.literal(1), sessions: z.array(SessionSchema) });
const SystemSettingsSchema = z.object({
  version: z.literal(1),
  registration: z.enum(['open', 'closed']),
  dsBrowser: z.object({ defaultEnabled: z.boolean() }),
  agents: z.object({
    enabledCliRuntimes: z.array(z.enum(CLI_RUNTIME_KINDS)),
  }),
});

interface DecodeResult<T> {
  value: T;
  migrated: boolean;
}

export interface StoreMutation<T, TResult> {
  value: T;
  result: TResult;
  write?: boolean;
}

interface CacheEntry<T> {
  mtimeMs: number;
  value: T;
}

class CachedJsonFile<T> {
  private cache: CacheEntry<T> | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    readonly path: string,
    private readonly createDefault: () => T,
    private readonly decode: (value: unknown) => DecodeResult<T>,
  ) {}

  async read(): Promise<T> {
    await this.writeQueue;
    return structuredClone(await this.loadUnlocked());
  }

  async mutate<TResult>(
    mutator: (current: T) => StoreMutation<T, TResult> | Promise<StoreMutation<T, TResult>>,
  ): Promise<TResult> {
    const operation = this.writeQueue.then(async () => {
      const current = structuredClone(await this.loadUnlocked());
      const mutation = await mutator(current);
      if (mutation.write !== false) await this.writeUnlocked(mutation.value);
      return mutation.result;
    });
    this.writeQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  resetCache(): void {
    this.cache = null;
  }

  private async loadUnlocked(): Promise<T> {
    let stats;
    try {
      stats = await stat(this.path);
    } catch (error) {
      if (isMissingFile(error)) return this.createDefault();
      throw error;
    }

    if (this.cache?.mtimeMs === stats.mtimeMs) return this.cache.value;
    const raw = JSON.parse(await readFile(this.path, 'utf8')) as unknown;
    const decoded = this.decode(raw);
    if (decoded.migrated) {
      await this.writeUnlocked(decoded.value);
      return decoded.value;
    }
    this.cache = { mtimeMs: stats.mtimeMs, value: decoded.value };
    return decoded.value;
  }

  private async writeUnlocked(value: T): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.path}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    await chmod(temporaryPath, 0o600);
    await rename(temporaryPath, this.path);
    await chmod(this.path, 0o600);
    const stats = await stat(this.path);
    this.cache = { mtimeMs: stats.mtimeMs, value: structuredClone(value) };
  }
}

export interface AuthStorePaths {
  dataRoot: string;
  users: string;
  sessions: string;
  system: string;
}

export class AuthStore {
  readonly paths: AuthStorePaths;
  private readonly usersFile: CachedJsonFile<UsersFile>;
  private readonly sessionsFile: CachedJsonFile<SessionsFile>;
  private readonly systemFile: CachedJsonFile<SystemSettings>;

  constructor(options: { dataRoot?: string } = {}) {
    const dataRoot =
      options.dataRoot ??
      process.env.SBER_DESIGNER_DATA_ROOT ??
      resolve(homedir(), '.sber-designer');
    this.paths = {
      dataRoot,
      users: resolve(dataRoot, 'auth', 'users.json'),
      sessions: resolve(dataRoot, 'auth', 'sessions.json'),
      system: resolve(dataRoot, 'system.json'),
    };
    this.usersFile = new CachedJsonFile(this.paths.users, emptyUsersFile, decodeUsersFile);
    this.sessionsFile = new CachedJsonFile(
      this.paths.sessions,
      emptySessionsFile,
      decodeSessionsFile,
    );
    this.systemFile = new CachedJsonFile(
      this.paths.system,
      defaultSystemSettings,
      decodeSystemSettings,
    );
  }

  readUsers(): Promise<UsersFile> {
    return this.usersFile.read();
  }

  mutateUsers<TResult>(
    mutator: (
      current: UsersFile,
    ) => StoreMutation<UsersFile, TResult> | Promise<StoreMutation<UsersFile, TResult>>,
  ): Promise<TResult> {
    return this.usersFile.mutate(mutator);
  }

  readSessions(): Promise<SessionsFile> {
    return this.sessionsFile.read();
  }

  mutateSessions<TResult>(
    mutator: (
      current: SessionsFile,
    ) => StoreMutation<SessionsFile, TResult> | Promise<StoreMutation<SessionsFile, TResult>>,
  ): Promise<TResult> {
    return this.sessionsFile.mutate(mutator);
  }

  readSystemSettings(): Promise<SystemSettings> {
    return this.systemFile.read();
  }

  mutateSystemSettings<TResult>(
    mutator: (
      current: SystemSettings,
    ) => StoreMutation<SystemSettings, TResult> | Promise<StoreMutation<SystemSettings, TResult>>,
  ): Promise<TResult> {
    return this.systemFile.mutate(mutator);
  }

  resetCaches(): void {
    this.usersFile.resetCache();
    this.sessionsFile.resetCache();
    this.systemFile.resetCache();
  }
}

function emptyUsersFile(): UsersFile {
  return { version: 1, users: [] };
}

function emptySessionsFile(): SessionsFile {
  return { version: 1, sessions: [] };
}

function defaultSystemSettings(): SystemSettings {
  return structuredClone(DEFAULT_SYSTEM_SETTINGS);
}

function decodeUsersFile(value: unknown): DecodeResult<UsersFile> {
  if (Array.isArray(value)) {
    return {
      value: { version: 1, users: z.array(UserSchema).parse(value) as AuthUserRecord[] },
      migrated: true,
    };
  }
  if (isRecord(value) && value['version'] === undefined && Array.isArray(value['users'])) {
    return {
      value: {
        version: 1,
        users: z.array(UserSchema).parse(value['users']) as AuthUserRecord[],
      },
      migrated: true,
    };
  }
  return { value: UsersFileSchema.parse(value) as UsersFile, migrated: false };
}

function decodeSessionsFile(value: unknown): DecodeResult<SessionsFile> {
  if (Array.isArray(value)) {
    return {
      value: {
        version: 1,
        sessions: z.array(SessionSchema).parse(value) as AuthSessionRecord[],
      },
      migrated: true,
    };
  }
  if (isRecord(value) && value['version'] === undefined && Array.isArray(value['sessions'])) {
    return {
      value: {
        version: 1,
        sessions: z.array(SessionSchema).parse(value['sessions']) as AuthSessionRecord[],
      },
      migrated: true,
    };
  }
  return { value: SessionsFileSchema.parse(value) as SessionsFile, migrated: false };
}

function decodeSystemSettings(value: unknown): DecodeResult<SystemSettings> {
  if (isRecord(value) && value['version'] === undefined) {
    const dsBrowser = isRecord(value['dsBrowser']) ? value['dsBrowser'] : {};
    const agents = isRecord(value['agents']) ? value['agents'] : {};
    return {
      value: SystemSettingsSchema.parse({
        ...DEFAULT_SYSTEM_SETTINGS,
        ...value,
        version: 1,
        dsBrowser: { ...DEFAULT_SYSTEM_SETTINGS.dsBrowser, ...dsBrowser },
        agents: { ...DEFAULT_SYSTEM_SETTINGS.agents, ...agents },
      }) as SystemSettings,
      migrated: true,
    };
  }
  return {
    value: SystemSettingsSchema.parse(value) as SystemSettings,
    migrated: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isMissingFile(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
}
