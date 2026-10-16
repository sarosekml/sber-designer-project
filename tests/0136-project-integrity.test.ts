/**
 * 0136 R08 — `.sdproj` persistence: atomic replace, missing vs corrupt, a
 * serialized write queue and a revision/conflict contract.
 *
 * The defect: `saveProject` wrote straight to the final file, and every read
 * failure — JSON, schema, I/O — produced a fresh empty project, so the next
 * save turned a recoverable problem into permanent loss.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SberDesignerProject } from '@sber-designer/shared-types';

import {
  ProjectConflictError,
  currentRevision,
  projectRevision,
  quarantineProjectFile,
  readProjectFile,
  saveProjectFile,
  withProjectFileLock,
  writeProjectFileAtomic,
} from '../services/api/src/project-persistence';
import {
  loadProjectForWorkspace,
  projectCorruptionDetail,
  projectRevisionFor,
  recoverCorruptProject,
  resetProject,
  saveProject,
} from '../services/api/src/project-store';
import { projectRouter } from '../services/api/src/routes/project';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  resetProject();
  await Promise.all(
    temporaryDirectories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function workspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'sd-0136-project-'));
  temporaryDirectories.push(dir);
  return dir;
}

function projectFile(root: string): string {
  return join(root, '.sber-designer', 'project.sdproj');
}

function projectBody(workspacePath: string, name: string): SberDesignerProject {
  return { version: 1, name, workspacePath, screens: [], flow: [] };
}

function decode(raw: unknown): { name: string } {
  const value = raw as { name?: unknown };
  if (typeof value?.name !== 'string') throw new Error('not a project');
  return { name: value.name };
}

describe('0136 R08 reads tell missing from corrupt', () => {
  test('a file that is not there is "missing"', async () => {
    const root = await workspace();
    expect((await readProjectFile(join(root, 'nope.sdproj'), decode)).kind).toBe('missing');
  });

  test('truncated, invalid and empty files are "corrupt", not "missing"', async () => {
    const root = await workspace();
    for (const [name, contents] of [
      ['truncated.sdproj', '{"version":1,"name":"Half'],
      ['invalid.sdproj', 'not json at all'],
      ['empty.sdproj', ''],
      ['unsupported.sdproj', '{"unrelated":true}'],
    ] as const) {
      await writeFile(join(root, name), contents, 'utf8');
      const result = await readProjectFile(join(root, name), decode);
      expect(`${name}:${result.kind}`).toBe(`${name}:corrupt`);
    }
  });

  test('a valid file reads back with a stable revision', async () => {
    const root = await workspace();
    const path = join(root, 'ok.sdproj');
    await writeFile(path, JSON.stringify({ name: 'Fixture' }), 'utf8');
    const result = await readProjectFile(path, decode);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.project.name).toBe('Fixture');
    expect(result.revision).toBe(await currentRevision(path));
    expect(result.revision).toBe(projectRevision(JSON.stringify({ name: 'Fixture' })));
  });
});

describe('0136 R08 writes are atomic and serialized', () => {
  test('a failed write leaves the previous file intact and no temp behind', async () => {
    const root = await workspace();
    const path = join(root, 'p.sdproj');
    await writeProjectFileAtomic(path, '{"name":"first"}');
    // A directory cannot be renamed over by a file write: force the failure.
    await expect(writeProjectFileAtomic(join(root), 'x')).rejects.toThrow();
    expect(await readFile(path, 'utf8')).toBe('{"name":"first"}');
    expect((await readdir(root)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });

  test('concurrent writes to one file do not interleave', async () => {
    const root = await workspace();
    const path = join(root, 'p.sdproj');
    const order: string[] = [];
    await Promise.all(
      ['a', 'b', 'c'].map((tag) =>
        withProjectFileLock(path, async () => {
          order.push(`${tag}:start`);
          const current = await readFile(path, 'utf8').catch(() => '');
          await new Promise((resolveTimer) => setTimeout(resolveTimer, 5));
          await writeProjectFileAtomic(path, `${current}${tag}`);
          order.push(`${tag}:end`);
        }),
      ),
    );
    // Every section closes before the next opens — no read-modify-write races.
    for (let i = 0; i < order.length; i += 2) {
      expect(order[i]!.replace(':start', '')).toBe(order[i + 1]!.replace(':end', ''));
    }
    expect((await readFile(path, 'utf8')).split('').sort().join('')).toBe('abc');
  });

  test('a stale revision is refused instead of overwriting', async () => {
    const root = await workspace();
    const path = join(root, 'p.sdproj');
    const first = await saveProjectFile({ path, contents: '{"name":"one"}' });
    await saveProjectFile({ path, contents: '{"name":"two"}', expectedRevision: first });

    await expect(
      saveProjectFile({ path, contents: '{"name":"stale"}', expectedRevision: first }),
    ).rejects.toThrow(ProjectConflictError);
    expect(await readFile(path, 'utf8')).toBe('{"name":"two"}');
  });

  test('a damaged file can be quarantined instead of overwritten', async () => {
    const root = await workspace();
    const path = join(root, 'p.sdproj');
    await writeFile(path, '{"broken', 'utf8');
    const moved = await quarantineProjectFile(path);
    expect(moved).toMatch(/\.corrupt-/u);
    expect(await readFile(moved!, 'utf8')).toBe('{"broken');
    expect(await quarantineProjectFile(path)).toBeNull();
  });
});

describe('0136 R08 the store refuses to lose a damaged project', () => {
  test('a corrupt .sdproj opens on defaults but is not overwritten', async () => {
    const root = await workspace();
    await mkdir(join(root, '.sber-designer'), { recursive: true });
    await writeFile(projectFile(root), '{"version":1,"name":"Half written', 'utf8');

    const loaded = await loadProjectForWorkspace(root);
    expect(loaded.screens).toEqual([]);
    expect(projectCorruptionDetail(root)).toBeTruthy();

    await expect(saveProject(projectBody(root, 'Replacement'))).rejects.toThrow(
      /could not be read/u,
    );
    expect(await readFile(projectFile(root), 'utf8')).toBe('{"version":1,"name":"Half written');
  });

  test('recovery is deliberate: quarantine, then saving works again', async () => {
    const root = await workspace();
    await mkdir(join(root, '.sber-designer'), { recursive: true });
    await writeFile(projectFile(root), 'not json', 'utf8');
    await loadProjectForWorkspace(root);

    const moved = await recoverCorruptProject(root);
    expect(moved).toMatch(/\.corrupt-/u);
    expect(projectCorruptionDetail(root)).toBeNull();

    const saved = await saveProject(projectBody(root, 'Recovered'));
    expect(saved.name).toBe('Recovered');
    expect(JSON.parse(await readFile(projectFile(root), 'utf8')).name).toBe('Recovered');
    expect(await readFile(moved!, 'utf8')).toBe('not json');
  });

  test('a missing file still creates a fresh project on first save', async () => {
    const root = await workspace();
    const loaded = await loadProjectForWorkspace(root);
    expect(projectCorruptionDetail(root)).toBeNull();
    expect(loaded.screens).toEqual([]);
    await saveProject(projectBody(root, 'Brand new'));
    expect(JSON.parse(await readFile(projectFile(root), 'utf8')).name).toBe('Brand new');
  });

  test('concurrent full saves refuse the stale writer rather than silently losing a screen', async () => {
    const root = await workspace();
    await saveProject(projectBody(root, 'Base'));
    const outcomes = await Promise.allSettled([
      saveProject({
        ...projectBody(root, 'From agent'),
        screens: [{ id: 's1', name: 'One', kind: 'page' }],
      } as SberDesignerProject),
      saveProject({
        ...projectBody(root, 'From editor'),
        screens: [{ id: 's2', name: 'Two', kind: 'page' }],
      } as SberDesignerProject),
    ]);
    const onDisk = JSON.parse(await readFile(projectFile(root), 'utf8')) as {
      screens: { id: string }[];
    };
    expect(outcomes.map((outcome) => outcome.status)).toEqual(['fulfilled', 'rejected']);
    const rejected = outcomes[1];
    if (rejected?.status === 'rejected')
      expect(rejected.reason).toBeInstanceOf(ProjectConflictError);
    expect(onDisk.screens).toHaveLength(1);
    expect(['s1', 's2']).toContain(onDisk.screens[0]!.id);
  });
});

describe('0136 R08 the PUT surface carries the revision', () => {
  async function put(body: unknown, ifMatch?: string): Promise<Response> {
    return projectRouter.request('http://localhost/', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        ...(ifMatch ? { 'if-match': ifMatch } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  test('a save answers with the new revision', async () => {
    const root = await workspace();
    await saveProject(projectBody(root, 'Base'));
    const response = await put(projectBody(root, 'Renamed'));
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe(`"${projectRevisionFor(root)}"`);
  });

  test('a stale full PUT from a second tab is refused with 409', async () => {
    const root = await workspace();
    await saveProject(projectBody(root, 'Base'));
    const stale = projectRevisionFor(root)!;

    // Another writer advances the file.
    await saveProject({
      ...projectBody(root, 'Base'),
      screens: [{ id: 'new-screen', name: 'Added elsewhere', kind: 'page' }],
    } as SberDesignerProject);

    const response = await put(projectBody(root, 'Stale tab'), `"${stale}"`);
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe('project_revision_conflict');

    const onDisk = JSON.parse(await readFile(projectFile(root), 'utf8')) as {
      screens: { id: string }[];
    };
    expect(onDisk.screens.map((screen) => screen.id)).toEqual(['new-screen']);
  });

  test('a PUT with the current revision succeeds', async () => {
    const root = await workspace();
    await saveProject(projectBody(root, 'Base'));
    const current = projectRevisionFor(root)!;
    const response = await put(projectBody(root, 'Up to date'), `"${current}"`);
    expect(response.status).toBe(200);
  });

  test('a PUT without If-Match keeps the pre-0136 contract', async () => {
    const root = await workspace();
    await saveProject(projectBody(root, 'Base'));
    expect((await put(projectBody(root, 'No guard'))).status).toBe(200);
  });
});
