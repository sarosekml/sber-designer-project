/**
 * Generated Home cover storage (0135).
 *
 * Covers are small project-owned files committed under
 * `.sber-designer/previews/`; full-size per-screen flow captures remain
 * gitignored. This module owns image validation, canonical path confinement,
 * atomic writes and content ETags.
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';

import { canonicalizeInside, WorkspaceEscape } from '@sber-designer/ast-bridge';

import {
  findStoredProjectEntryById,
  resetProjectThumbnailAfterCoverWithinMutation,
  withProjectRegistryMutation,
} from './projects-registry';
import type { UserStorageIdentity } from './user-storage';

const MAX_COVER_BYTES = 1024 * 1024;
const PREVIEWS_DIR_REL_PATH = '.sber-designer/previews';
const COVER_MIME_EXT: Record<string, string> = {
  'image/webp': '.webp',
  'image/png': '.png',
};
const COVER_EXTENSIONS = [...new Set(Object.values(COVER_MIME_EXT))];
const COVER_CONTENT_TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
};
const SBER_DESIGNER_GITIGNORE_REL_PATH = '.sber-designer/.gitignore';
const SBER_DESIGNER_GITIGNORE_ENTRY = 'previews/screens/';

export interface ProjectCoverBytes {
  bytes: Buffer;
  contentType: string;
  etag: string;
}

export interface ProjectCoverWriteResult {
  bytes: number;
  capturedAt: number;
}

/**
 * Persist a generated cover and drop the temporary manual thumbnail choice as
 * one serialized registry operation. A manual pick or pin that arrives later
 * waits for this operation, then wins instead of being overwritten by a stale
 * projects.json snapshot.
 */
export async function writeProjectCoverAndResetThumbnail(
  input: { id: string; dataUrl: string; screenId?: string },
  identity?: UserStorageIdentity,
): Promise<ProjectCoverWriteResult | null> {
  return withProjectRegistryMutation(identity, async () => {
    const result = await writeProjectCover(input, identity);
    if (!result) return null;
    const entry = await resetProjectThumbnailAfterCoverWithinMutation(input.id, identity);
    if (!entry) {
      throw new Error(`Unknown project ${input.id} after writing its cover.`);
    }
    return result;
  });
}

export async function readProjectCover(
  id: string,
  identity?: UserStorageIdentity,
): Promise<ProjectCoverBytes | null> {
  const entry = await findStoredProjectEntryById(id, identity);
  if (!entry) return null;
  let storage: ProjectCoverStorage;
  try {
    storage = await resolveProjectCoverStorage(entry.workspacePath);
  } catch {
    return null;
  }
  for (const ext of COVER_EXTENSIONS) {
    try {
      const coverPath = await realpath(resolve(storage.directory, `cover${ext}`));
      if (!isSameOrChildPath(storage.root, coverPath)) continue;
      const info = await stat(coverPath);
      if (!info.isFile() || info.size > MAX_COVER_BYTES) continue;
      const contentType = COVER_CONTENT_TYPES[ext];
      if (!contentType) continue;
      const bytes = await readFile(coverPath);
      if (bytes.length > MAX_COVER_BYTES || !hasExpectedCoverSignature(bytes, contentType))
        continue;
      const digest = createHash('sha256').update(bytes).digest('base64url');
      return {
        bytes,
        contentType,
        etag: `"cover-sha256-${digest}"`,
      };
    } catch {
      // Keep probing the remaining supported extensions.
    }
  }
  return null;
}

export async function writeProjectCover(
  input: { id: string; dataUrl: string; screenId?: string },
  identity?: UserStorageIdentity,
): Promise<ProjectCoverWriteResult | null> {
  const entry = await findStoredProjectEntryById(input.id, identity);
  if (!entry) return null;
  if (entry.coverScreenId && entry.coverScreenId !== input.screenId) {
    throw new Error('Cover source changed while the screenshot was being captured.');
  }

  const parsed = parseCoverDataUrl(input.dataUrl);
  const storage = await resolveProjectCoverStorage(entry.workspacePath, { create: true });
  await ensureSberDesignerGitignore(entry.workspacePath);
  const coverPath = resolve(storage.directory, `cover${parsed.ext}`);
  // Replace atomically so Home never reads a partially-written image. Keep the
  // previous encoding until the new file is in place, then remove it.
  await writeFileAtomic(coverPath, parsed.bytes);
  await removeStoredCover(storage.directory, parsed.ext);
  return { bytes: parsed.bytes.length, capturedAt: Date.now() };
}

/**
 * Keep the per-screen flow captures (`previews/screens/`) out of git via a
 * nested `.sber-designer/.gitignore`, so we never touch the connected project's
 * own root `.gitignore`. The cover itself is intentionally NOT ignored.
 */
export async function ensureSberDesignerGitignore(workspacePath: string): Promise<void> {
  try {
    const workspaceRoot = await realpath(resolve(workspacePath));
    const managedDirectory = canonicalizeInside(
      workspaceRoot,
      dirname(SBER_DESIGNER_GITIGNORE_REL_PATH),
    ).canonicalPath;
    await mkdir(managedDirectory, { recursive: true });
    const canonicalManagedDirectory = await realpath(managedDirectory);
    if (!isSameOrChildPath(workspaceRoot, canonicalManagedDirectory)) return;
    const gitignorePath = resolve(canonicalManagedDirectory, '.gitignore');
    let current = '';
    try {
      const canonicalGitignorePath = await realpath(gitignorePath);
      if (!isSameOrChildPath(workspaceRoot, canonicalGitignorePath)) return;
      current = await readFile(canonicalGitignorePath, 'utf8');
    } catch (err) {
      // A missing file (including a dangling symlink) is safely replaced by the
      // atomic writer below. Other read failures stay best-effort.
      if (!isNotFoundError(err)) return;
    }
    const sourceLines = current === '' ? [] : current.split(/\r?\n/);
    if (sourceLines.at(-1) === '') sourceLines.pop();
    const rewrittenLines: string[] = [];
    let managedEntryAdded = false;
    for (const line of sourceLines) {
      const normalized = line.trim();
      if (normalized === 'previews/' || normalized === SBER_DESIGNER_GITIGNORE_ENTRY) {
        if (!managedEntryAdded) {
          rewrittenLines.push(SBER_DESIGNER_GITIGNORE_ENTRY);
          managedEntryAdded = true;
        }
        continue;
      }
      rewrittenLines.push(line);
    }
    if (!managedEntryAdded) rewrittenLines.push(SBER_DESIGNER_GITIGNORE_ENTRY);
    const rewritten = `${rewrittenLines.join('\n')}\n`;
    if (rewritten !== current) await writeFileAtomic(gitignorePath, rewritten);
  } catch {
    // Best-effort: never block project open or a cover write on maintenance.
  }
}

interface ProjectCoverStorage {
  root: string;
  directory: string;
}

async function resolveProjectCoverStorage(
  workspacePath: string,
  options: { create?: boolean } = {},
): Promise<ProjectCoverStorage> {
  const root = await realpath(resolve(workspacePath));
  // 0136 R02 — one canonical boundary. It refuses a `previews` symlink that
  // leaves the workspace *before* we mkdir, so an escaping link no longer
  // gets a directory created behind it.
  const directory = canonicalizeOrRefuse(root, PREVIEWS_DIR_REL_PATH);
  if (options.create) {
    await mkdir(directory, { recursive: true });
    // Re-check: `create` is the step that could have followed a link.
    return { root, directory: canonicalizeOrRefuse(root, PREVIEWS_DIR_REL_PATH) };
  }
  return { root, directory };
}

function canonicalizeOrRefuse(root: string, relPath: string): string {
  try {
    return canonicalizeInside(root, relPath).canonicalPath;
  } catch (err) {
    if (err instanceof WorkspaceEscape) {
      throw new Error('Project cover directory resolves outside the workspace.');
    }
    throw err;
  }
}

async function removeStoredCover(directory: string, keepExt?: string): Promise<void> {
  await Promise.all(
    COVER_EXTENSIONS.filter((ext) => ext !== keepExt).map((ext) =>
      unlink(resolve(directory, `cover${ext}`)).catch(() => undefined),
    ),
  );
}

function parseCoverDataUrl(dataUrl: string): { bytes: Buffer; ext: string } {
  const match = /^data:(image\/(?:webp|png));base64,([A-Za-z0-9+/=]+)$/u.exec(dataUrl);
  if (!match) {
    throw new Error('Cover must be a WebP or PNG data URL.');
  }
  const ext = COVER_MIME_EXT[match[1] ?? ''];
  if (!ext) {
    throw new Error('Unsupported cover type.');
  }
  const bytes = Buffer.from(match[2] ?? '', 'base64');
  if (bytes.length === 0) {
    throw new Error('Cover is empty.');
  }
  if (bytes.length > MAX_COVER_BYTES) {
    throw new Error('Cover is larger than 1MB.');
  }
  const contentType = match[1] ?? '';
  if (!hasExpectedCoverSignature(bytes, contentType)) {
    throw new Error(`Cover bytes do not match ${contentType || 'the declared image type'}.`);
  }
  return { bytes, ext };
}

function hasExpectedCoverSignature(bytes: Buffer, contentType: string): boolean {
  if (contentType === 'image/png') {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  if (contentType === 'image/webp') {
    return (
      bytes.length >= 12 &&
      bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
      bytes.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  return false;
}

async function writeFileAtomic(path: string, data: string | Uint8Array): Promise<void> {
  const temporaryPath = resolve(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporaryPath, data);
    await rename(temporaryPath, path);
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
}

function isSameOrChildPath(parentPath: string, childPath: string): boolean {
  const relativePath = relative(parentPath, childPath);
  return (
    relativePath === '' ||
    (relativePath !== '..' && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath))
  );
}

function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'ENOENT'
  );
}
