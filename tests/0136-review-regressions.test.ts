import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorkspaceEscape } from '@sber-designer/ast-bridge';
import { writeWorkspaceFile } from '../services/api/src/safe-fs';
import { readStaticHtmlPreviewResponse } from '../services/sandbox/src/static-html-session';
import {
  getProject,
  loadProjectForWorkspace,
  saveProject,
  resetProject,
  ProjectConflictError,
} from '../services/api/src/project-store';
import { buildRuntimeChildEnv } from '../services/api/src/agent-runtimes/child-env';
import {
  assertExternalRuntimePolicy,
  resolveMcpPolicy,
  validateMcpServerPolicy,
} from '../services/api/src/mcp/security';
import { normalizeMcpServers } from '../services/api/src/mcp/config';
import { parseConfig } from '@sber-designer/llm-gateway';
import { buildResponseHeaders } from '../services/api/src/routes/preview-proxy-policy';
import { definedJson } from '../services/api/src/defined-json';
import { projectRouter } from '../services/api/src/routes/project';

const roots: string[] = [];
afterEach(async () => {
  resetProject();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function stage() {
  const root = await mkdtemp(join(tmpdir(), 'sd-review-0136-'));
  roots.push(root);
  const workspace = join(root, 'workspace');
  await mkdir(workspace);
  return { root, workspace };
}
const project = (workspacePath: string) => ({
  version: 1 as const,
  name: 'Fixture',
  workspacePath,
  screens: [],
  flow: [],
});

test('a dangling symlink must not create its external destination', async () => {
  const { root, workspace } = await stage();
  const outside = join(root, 'not-created.txt');
  await symlink(outside, join(workspace, 'alias.txt'));
  await expect(writeWorkspaceFile(workspace, 'alias.txt', 'escaped')).rejects.toThrow(
    WorkspaceEscape,
  );
  expect(await Bun.file(outside).exists()).toBe(false);
});

test('a damaged file discovered at save time is preserved', async () => {
  const { workspace } = await stage();
  const saved = await saveProject(project(workspace));
  const path = join(workspace, '.sber-designer/project.sdproj');
  await writeFile(path, '{damaged after load');
  await expect(saveProject({ ...saved, name: 'Stale' })).rejects.toThrow(/could not be read/);
  expect(await readFile(path, 'utf8')).toBe('{damaged after load');
});

test('a stale server draft cannot erase a newer screen, even when saved later', async () => {
  const { workspace } = await stage();
  const original = await saveProject(project(workspace));
  const first = { ...original, screens: [{ id: 'one', name: 'One', kind: 'page' as const }] };
  const stale = {
    ...original,
    flow: [
      { id: 'edge', fromScreenId: 'one', toScreenId: 'two', trigger: { kind: 'manual' as const } },
    ],
  };
  await saveProject(first);
  await expect(saveProject(stale)).rejects.toThrow(ProjectConflictError);
  expect(getProject(workspace).screens.map((screen) => screen.id)).toEqual(['one']);
});

test('project metadata cannot be written through a linked state directory', async () => {
  const { root, workspace } = await stage();
  const outside = join(root, 'private');
  await mkdir(outside);
  await symlink(outside, join(workspace, '.sber-designer'));
  await expect(saveProject(project(workspace))).rejects.toThrow(WorkspaceEscape);
});

test('GET reports a damaged project instead of displaying an editable empty project', async () => {
  const { workspace } = await stage();
  await mkdir(join(workspace, '.sber-designer'));
  await writeFile(join(workspace, '.sber-designer/project.sdproj'), '{damaged');
  await loadProjectForWorkspace(workspace);
  const response = await projectRouter.request('http://localhost/');
  expect(response.status).toBe(409);
  expect((await response.json()).error).toBe('project_file_corrupt');
});

test('malformed preview URL is a 404; internal symlink cannot publish secret bytes', async () => {
  const { workspace } = await stage();
  await writeFile(join(workspace, '.env'), 'PRIVATE');
  await symlink(join(workspace, '.env'), join(workspace, 'public.js'));
  expect((await readStaticHtmlPreviewResponse(workspace, '/%zz')).status).toBe(404);
  expect((await readStaticHtmlPreviewResponse(workspace, '/public.js')).status).toBe(404);
});

test('CLI child receives explicit provider credentials but no service secrets', async () => {
  const env = buildRuntimeChildEnv({
    PATH: process.env.PATH,
    ANTHROPIC_API_KEY: 'provider-fixture',
    SBER_DESIGNER_SANDBOX_TOKEN: 'controller-fixture',
    OIDC_CLIENT_SECRET: 'oidc-fixture',
    RANDOM_SECRET: 'other-fixture',
  });
  const child = Bun.spawn([process.execPath, '-e', 'console.log(JSON.stringify(process.env))'], {
    env,
    stdout: 'pipe',
  });
  const output = await new Response(child.stdout).text();
  expect(await child.exited).toBe(0);
  expect(output).toContain('provider-fixture');
  expect(output).not.toContain('controller-fixture');
  expect(output).not.toContain('oidc-fixture');
  expect(output).not.toContain('other-fixture');
});

test('restricted MCP covers private endpoints and refuses unmanaged external CLI configs', () => {
  const policy = resolveMcpPolicy({ SBER_DESIGNER_DEPLOYMENT_MODE: 'server' });
  const config = parseConfig({
    agent: { default: { provider: 'mock', model: 'echo' } },
    provider: { mock: { type: 'mock', name: 'Mock' } },
    mcpServers: { private: { type: 'streamable-http', url: 'http://10.1.2.3/mcp', enabled: true } },
  });
  const server = normalizeMcpServers(config)[0]!;
  expect(validateMcpServerPolicy(server, { policy }).allowed).toBe(false);
  expect(
    validateMcpServerPolicy(server, { policy: { ...policy, allowedRemoteHosts: ['10.1.2.3'] } })
      .allowed,
  ).toBe(true);
  expect(() => assertExternalRuntimePolicy(policy)).toThrow('external_runtime_policy_unsupported');
});

test('upstream cannot set editor cookies; public documents have an opaque origin', () => {
  for (const publicShare of [true, false]) {
    const headers = buildResponseHeaders(
      new Headers({ 'set-cookie': 'session=forged', 'clear-site-data': '"*"' }),
      { publicShare },
    );
    expect(headers.has('set-cookie')).toBe(false);
    expect(headers.has('clear-site-data')).toBe(false);
    if (publicShare) {
      expect(headers.get('content-security-policy')).toContain('sandbox');
      expect(headers.get('content-security-policy')).not.toContain('allow-same-origin');
    }
  }
});

test('schema optional fields are omitted recursively without changing null or false', () => {
  expect(
    definedJson({ nested: [{ a: undefined, b: false, c: null }], optional: undefined }),
  ).toEqual({ nested: [{ b: false, c: null }] });
});
