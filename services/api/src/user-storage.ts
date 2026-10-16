import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import type { Context } from 'hono';
import { z } from 'zod';
import {
  parseDeploymentMode,
  type GenerationPipelinePreferences,
} from '@sber-designer/shared-types';

import { readContextSessionUser, readContextUser } from './auth/middleware';
import { resolveAuthMode } from './auth/mode';
import type { AdminUser, SessionUser } from './auth/types';

export interface UserStorageIdentity {
  kind: 'local' | 'user' | 'service';
  key: string;
  principal: string;
  userId?: string;
  email?: string;
  displayName?: string;
  isAdmin: boolean;
}

const ScreenReadinessCategoriesSchema = z
  .object({
    sourceIntegrity: z.boolean(),
    renderHealth: z.boolean(),
    designSystemFit: z.boolean(),
    dataHonesty: z.boolean(),
    operationalUxStates: z.boolean(),
    accessibilityBasics: z.boolean(),
    responsiveVisualSanity: z.boolean(),
    designModeCompatibility: z.boolean(),
  })
  .strict();

const ScreenReadinessProfileSchema = z
  .object({
    enabled: z.boolean(),
    profile: z.enum(['standard', 'strict', 'custom']),
    categories: ScreenReadinessCategoriesSchema,
  })
  .strict();

const GenerationPipelinePreferencesSchema: z.ZodType<GenerationPipelinePreferences> = z
  .object({
    generationDefaults: z
      .object({
        directionPicker: z.boolean().optional(),
        wireframe: z.boolean().optional(),
        designJury: z.boolean().optional(),
      })
      .strict()
      .optional(),
    screenReadiness: ScreenReadinessProfileSchema.optional(),
  })
  .strict();

export const UserGenerationPipelinePatchSchema = GenerationPipelinePreferencesSchema;
export const UserGenerativeThumbnailPatchSchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict();

const UserSettingsSchema = z
  .object({
    version: z.literal(1),
    lastFolder: z.string().optional(),
    activeWorkspace: z.string().optional(),
    generationPipeline: GenerationPipelinePreferencesSchema.optional(),
    generativeThumbnailEnabled: z.boolean().optional(),
  })
  .strict();

export type UserSettings = z.infer<typeof UserSettingsSchema>;

export function requestStorageIdentity(c: Context): UserStorageIdentity {
  const mode = resolveAuthMode();
  if (mode === 'local') return localStorageIdentity(readContextUser(c, mode));
  const session = readContextSessionUser(c);
  if (session) return storageIdentityForUser(session);
  const principal = readContextUser(c, mode);
  return {
    kind: 'service',
    key: safePrincipalKey(principal),
    principal,
    isAdmin: false,
  };
}

export function storageIdentityForUser(
  user: Pick<AdminUser | SessionUser, 'id' | 'email' | 'displayName' | 'role'>,
): UserStorageIdentity {
  return {
    kind: 'user',
    key: safeUserId(user.id),
    principal: user.email,
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    isAdmin: user.role === 'admin',
  };
}

export function localStorageIdentity(principal = 'local'): UserStorageIdentity {
  return { kind: 'local', key: 'local', principal, isAdmin: true };
}

export function userDataRoot(): string {
  return resolve(
    process.env.SBER_DESIGNER_USERS_ROOT ?? resolve(homedir(), '.sber-designer', 'users'),
  );
}

export function userDataDirectory(identity: UserStorageIdentity): string | null {
  return identity.kind === 'local' ? null : resolve(userDataRoot(), identity.key);
}

export function configuredProjectsRoot(): string | null {
  if (parseDeploymentMode(process.env.SBER_DESIGNER_DEPLOYMENT_MODE) !== 'server') return null;
  const configured = process.env.SBER_DESIGNER_PROJECTS_ROOT?.trim();
  if (!configured) return null;
  const resolved = resolve(configured);
  try {
    return realpathSync(resolved);
  } catch {
    return resolved;
  }
}

export async function userProjectsRoot(identity: UserStorageIdentity): Promise<string | null> {
  const root = configuredProjectsRoot();
  if (!root || identity.kind === 'local') return null;
  const scoped = resolve(root, identity.key);
  await mkdir(scoped, { recursive: true });
  return realpath(scoped);
}

export async function assertWorkspacePathForIdentity(
  identity: UserStorageIdentity,
  requestedPath: string,
  options: { mustExist?: boolean } = {},
): Promise<string> {
  const requested = resolve(requestedPath);
  const root = await userProjectsRoot(identity);
  if (!root) return requested;

  if (!isPathInside(root, requested)) throw projectsFolderError();
  const mustExist = options.mustExist !== false;
  if (mustExist) {
    const canonical = await realpath(requested);
    if (!isPathInside(root, canonical)) throw projectsFolderError();
    return canonical;
  }

  let ancestor = requested;
  while (!(await pathExists(ancestor))) {
    const parent = dirname(ancestor);
    if (parent === ancestor) throw projectsFolderError();
    ancestor = parent;
  }
  const canonicalAncestor = await realpath(ancestor);
  if (!isPathInside(root, canonicalAncestor)) throw projectsFolderError();
  return requested;
}

export function projectsFolderError(): Error {
  return new Error('Projects must live under your folder on this server.');
}

export async function readUserSettings(identity: UserStorageIdentity): Promise<UserSettings> {
  const directory = userSettingsDirectory(identity);
  try {
    return UserSettingsSchema.parse(
      JSON.parse(await readFile(resolve(directory, 'settings.json'), 'utf8')),
    );
  } catch {
    return { version: 1 };
  }
}

export async function updateUserGenerationPipeline(
  identity: UserStorageIdentity,
  generationPipeline: GenerationPipelinePreferences,
): Promise<UserSettings> {
  const directory = userSettingsDirectory(identity);
  const current = await readUserSettings(identity);
  const next: UserSettings = {
    ...current,
    generationPipeline: { ...current.generationPipeline, ...generationPipeline },
  };
  await writeUserSettings(directory, next);
  return next;
}

export async function updateUserGenerativeThumbnail(
  identity: UserStorageIdentity,
  enabled: boolean,
): Promise<UserSettings> {
  const directory = userSettingsDirectory(identity);
  const next: UserSettings = {
    ...(await readUserSettings(identity)),
    generativeThumbnailEnabled: enabled,
  };
  await writeUserSettings(directory, next);
  return next;
}

export async function updateUserLastFolder(
  identity: UserStorageIdentity,
  lastFolder: string,
): Promise<UserSettings> {
  const directory = userDataDirectory(identity);
  if (!directory) return { version: 1 };
  const canonical = await assertWorkspacePathForIdentity(identity, lastFolder);
  const next: UserSettings = { ...(await readUserSettings(identity)), lastFolder: canonical };
  await writeUserSettings(directory, next);
  return next;
}

export async function updateUserActiveWorkspace(
  identity: UserStorageIdentity,
  workspacePath: string,
): Promise<UserSettings> {
  const directory = userDataDirectory(identity);
  if (!directory) return { version: 1 };
  const canonical = await assertWorkspacePathForIdentity(identity, workspacePath);
  const current = await readUserSettings(identity);
  if (current.activeWorkspace === canonical) return current;
  const next: UserSettings = { ...current, activeWorkspace: canonical };
  await writeUserSettings(directory, next);
  return next;
}

export function isPathInside(root: string, candidate: string): boolean {
  const rel = relative(resolve(root), resolve(candidate));
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function safeUserId(value: string): string {
  if (/^[A-Za-z0-9_-]{1,128}$/u.test(value)) return value;
  return `user-${digest(value)}`;
}

function safePrincipalKey(value: string): string {
  const prefix = value.startsWith('svc:') ? 'svc' : 'principal';
  return `${prefix}-${digest(value)}`;
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 20);
}

async function pathExists(path: string): Promise<boolean> {
  return stat(path)
    .then(() => true)
    .catch(() => false);
}

function userSettingsDirectory(identity: UserStorageIdentity): string {
  return userDataDirectory(identity) ?? resolve(userDataRoot(), identity.key);
}

async function writeUserSettings(directory: string, settings: UserSettings): Promise<void> {
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'settings.json'), JSON.stringify(settings, null, 2), 'utf8');
}
