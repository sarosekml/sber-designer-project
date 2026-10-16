/**
 * `.sdproj` persistence boundary (0136 R08).
 *
 * Three defects lived in one `writeFile` call:
 *
 *   1. no atomic replace — an interrupted write leaves a truncated file
 *      where the project used to be;
 *   2. no distinction between "missing" and "corrupt" — every read error,
 *      including a JSON or schema failure, produced a fresh empty project,
 *      and the next save wrote that emptiness over the damaged file, so a
 *      recoverable problem became permanent data loss;
 *   3. no serialization or revision — an agent run and an editor autosave
 *      could interleave, and a stale full PUT from a second tab could
 *      overwrite screens and flow it had never seen.
 *
 * This module owns all three. `project-store.ts` keeps the domain logic
 * (schema, merges, timestamps) and calls in here to touch the disk.
 *
 * The queue is per absolute path and in-process, which is what the current
 * single-api deployment needs; the revision check is what protects against
 * a writer this process does not own.
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, stat, unlink } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

/** Content-addressed revision of a stored project file. */
export type ProjectRevision = string;

export type ProjectReadResult<T> =
  | { kind: 'missing' }
  | { kind: 'ok'; project: T; revision: ProjectRevision }
  | { kind: 'corrupt'; detail: string; revision: ProjectRevision };

export class ProjectConflictError extends Error {
  constructor(
    readonly expected: ProjectRevision | null,
    readonly actual: ProjectRevision | null,
  ) {
    super(
      'This project changed on disk since it was loaded. Reload the project before saving again.',
    );
    this.name = 'ProjectConflictError';
  }
}

export class ProjectCorruptError extends Error {
  constructor(
    readonly path: string,
    readonly detail: string,
  ) {
    super(
      `Project file at ${path} could not be read (${detail}). It was left untouched — fix or move it before saving.`,
    );
    this.name = 'ProjectCorruptError';
  }
}

export function projectRevision(contents: string): ProjectRevision {
  return `sha256:${createHash('sha256').update(contents).digest('hex')}`;
}

/**
 * Read a project file, telling the three outcomes apart. `decode` throws for
 * content that is syntactically fine but not a project we support.
 */
export async function readProjectFile<T>(
  path: string,
  decode: (raw: unknown) => T,
): Promise<ProjectReadResult<T>> {
  let contents: string;
  try {
    contents = await readFile(path, 'utf8');
  } catch (error) {
    if (isMissingFile(error)) return { kind: 'missing' };
    // A permission or I/O error is not "there is no project here".
    return {
      kind: 'corrupt',
      detail: error instanceof Error ? error.message : String(error),
      revision: projectRevision(''),
    };
  }
  const revision = projectRevision(contents);
  // A zero-length file is what an interrupted non-atomic write leaves behind.
  if (contents.trim() === '') {
    return { kind: 'corrupt', detail: 'file is empty', revision };
  }
  try {
    return { kind: 'ok', project: decode(JSON.parse(contents)), revision };
  } catch (error) {
    return {
      kind: 'corrupt',
      detail: error instanceof Error ? error.message.split('\n')[0]! : String(error),
      revision,
    };
  }
}

/** Current on-disk revision, or null when the file is not there. */
export async function currentRevision(path: string): Promise<ProjectRevision | null> {
  try {
    return projectRevision(await readFile(path, 'utf8'));
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
}

/**
 * Write to a sibling temp file, flush it, then rename over the target.
 * `rename` within a directory is atomic, so a reader sees either the whole
 * old file or the whole new one — never a half-written project.
 */
export async function writeProjectFileAtomic(path: string, contents: string): Promise<void> {
  const directory = dirname(path);
  await mkdir(directory, { recursive: true });
  const temporaryPath = resolve(directory, `.${basename(path)}.${randomUUID()}.tmp`);
  try {
    const handle = await open(temporaryPath, 'w');
    try {
      await handle.writeFile(contents, 'utf8');
      // Without the flush, the rename can land before the bytes do and a
      // crash leaves an empty file under the real name.
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporaryPath, path);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

export interface ProjectWriteInput {
  path: string;
  contents: string;
  /**
   * Revision the caller based its edit on. When supplied and the file has
   * moved on since, the write is refused instead of clobbering the newer
   * state. `null` means "the caller expects no file to exist yet".
   */
  expectedRevision?: ProjectRevision | null;
  /**
   * Refuse to write over a file that exists but cannot be parsed. Recovery
   * should be a deliberate act, not a side effect of the next autosave.
   */
  refuseOverCorrupt?: (path: string) => Promise<boolean>;
}

const queues = new Map<string, Promise<unknown>>();

/**
 * Serialize every mutation of one project file. Concurrent agent-tool saves
 * and editor autosaves queue instead of interleaving read-modify-write.
 */
export function withProjectFileLock<T>(path: string, operation: () => Promise<T>): Promise<T> {
  const key = resolve(path);
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.then(operation, operation);
  const tail = next.then(
    () => undefined,
    () => undefined,
  );
  queues.set(key, tail);
  void tail.then(() => {
    if (queues.get(key) === tail) queues.delete(key);
  });
  return next;
}

/**
 * Atomic, revision-checked write. Returns the new revision.
 *
 * Call this when you already hold the file's lock (a caller that does its own
 * read-modify-write must, or the read and the write are not one step).
 * {@link saveProjectFile} is the same thing with the lock taken for you —
 * the two must never be nested, which would deadlock the queue.
 */
export async function writeProjectFileChecked(input: ProjectWriteInput): Promise<ProjectRevision> {
  if (input.expectedRevision !== undefined) {
    const actual = await currentRevision(input.path);
    if (actual !== input.expectedRevision) {
      throw new ProjectConflictError(input.expectedRevision, actual);
    }
  }
  if (input.refuseOverCorrupt && (await input.refuseOverCorrupt(input.path))) {
    throw new ProjectCorruptError(input.path, 'existing file is unreadable');
  }
  await writeProjectFileAtomic(input.path, input.contents);
  return projectRevision(input.contents);
}

/** {@link writeProjectFileChecked} under this file's write lock. */
export async function saveProjectFile(input: ProjectWriteInput): Promise<ProjectRevision> {
  return withProjectFileLock(input.path, () => writeProjectFileChecked(input));
}

/**
 * Move a damaged file aside so the next save has somewhere clean to land and
 * the original is still recoverable by hand. Returns the quarantine path.
 */
export async function quarantineProjectFile(path: string): Promise<string | null> {
  try {
    await stat(path);
  } catch {
    return null;
  }
  const stamp = new Date().toISOString().replace(/[:.]/gu, '-');
  const target = `${path}.corrupt-${stamp}`;
  await rename(path, target);
  return target;
}

export function isMissingFile(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'ENOENT';
}

/** Exposed for tests: drop queued state between cases. */
export function resetProjectFileQueues(): void {
  queues.clear();
}
