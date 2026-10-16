/**
 * Scaffold a fresh React + Vite + TypeScript project on disk
 * (Phase 5.4). Optionally adds Storybook 8 in non-interactive mode.
 *
 * Uses `bun create vite@latest <dir> --template react-ts` (or
 * `npm create vite@latest <dir> -- --template react-ts` as a fallback)
 * + `bun install` + `git init`.
 *
 * Auth / network: relies on the host's npm / bun cache. In an
 * air-gapped on-prem deploy this needs a Nexus mirror — that
 * configuration lives outside this code (`.npmrc`, `BUN_INSTALL_*`
 * env vars).
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  DEFAULT_HTML_DESIGN_SYSTEM_PRESET_ID,
  HTML_DESIGN_SYSTEM_PATHS,
  type HtmlDesignSystemPresetId,
  type SberDesignerProject,
  type SberDesignerProjectKind,
} from '@sber-designer/shared-types';

import { materializeHtmlDesignSystemPreset } from './html-design-system-presets';
import { regenerateHtmlDesignSystemPreview } from './html-design-system-preview';
import { buildHtmlScreenIndex } from './html-screen-index';

export interface BootstrapInput {
  /** Absolute path of the selected directory. It is either the workspace or the parent folder. */
  parentDir: string;
  /** Project folder name; sanitized to [A-Za-z0-9_-]. */
  name: string;
  /** When true, create <parentDir>/<name>. When false, write directly into parentDir. */
  createProjectSubfolder?: boolean;
  /** Project creation kind. Existing callers default to React + Vite. */
  projectKind?: SberDesignerProjectKind;
  /** When true, run `storybook@latest init --type react --yes` afterwards. */
  withStorybook?: boolean;
  /** HTML-first only: write index.html + design-system source placeholders. */
  createStarterFiles?: boolean;
  /** HTML-first only: project-owned Design.md and CSS starter bundle. */
  htmlDesignSystemPresetId?: HtmlDesignSystemPresetId;
}

export interface BootstrapResult {
  workspacePath: string;
  steps: { name: string; ok: boolean; durationMs: number; detail?: string }[];
}

const BUN = process.env.SBER_DESIGNER_BUN_PATH ?? 'bun';
const NPM = 'npm';

export async function bootstrapProject(input: BootstrapInput): Promise<BootstrapResult> {
  const cleaned = sanitiseName(input.name);
  const targetParent = resolve(input.parentDir);
  const createProjectSubfolder = input.createProjectSubfolder ?? true;
  const workspacePath = await prepareWorkspaceTarget({
    targetParent,
    name: cleaned,
    createProjectSubfolder,
  });

  const steps: BootstrapResult['steps'] = [];
  const projectKind = input.projectKind ?? 'react-vite';

  if (projectKind === 'html-first') {
    return bootstrapHtmlFirstProject({
      workspacePath,
      name: cleaned,
      createStarterFiles: input.createStarterFiles ?? false,
      htmlDesignSystemPresetId:
        input.htmlDesignSystemPresetId ?? DEFAULT_HTML_DESIGN_SYSTEM_PRESET_ID,
      steps,
    });
  }

  // 1. create-vite. Bun's create-vite passes templates after `--`.
  const viteRes = await tryCreateVite({
    parent: targetParent,
    name: cleaned,
    workspacePath,
    createProjectSubfolder,
  });
  steps.push({ name: 'create-vite', ...viteRes });
  if (!viteRes.ok) {
    throw new Error(`create-vite failed: ${viteRes.detail ?? 'unknown error'}`);
  }
  await ensureScaffoldGitignore(workspacePath);

  // 2. install deps.
  const installRes = await runStep(['install'], {
    cwd: workspacePath,
    command: BUN,
    timeoutMs: 180_000,
  });
  steps.push({ name: 'install', ...installRes });

  // 3. git init.
  const gitRes = await runStep(['init', '-q'], {
    cwd: workspacePath,
    command: 'git',
    timeoutMs: 10_000,
  });
  steps.push({ name: 'git-init', ...gitRes });

  // 4. optional Storybook bootstrap.
  if (input.withStorybook) {
    const sbRes = await runStep(
      ['storybook@latest', 'init', '--type', 'react', '--yes', '--no-dev'],
      {
        cwd: workspacePath,
        command: 'bunx',
        timeoutMs: 300_000,
      },
    );
    steps.push({ name: 'storybook-init', ...sbRes });
  }

  return { workspacePath, steps };
}

async function prepareWorkspaceTarget(input: {
  targetParent: string;
  name: string;
  createProjectSubfolder: boolean;
}): Promise<string> {
  if (input.createProjectSubfolder) {
    const workspacePath = join(input.targetParent, input.name);
    if (existsSync(workspacePath)) {
      throw new Error(`Refusing to scaffold: ${workspacePath} already exists.`);
    }
    await mkdir(input.targetParent, { recursive: true });
    return workspacePath;
  }

  await mkdir(input.targetParent, { recursive: true });
  const entries = (await readdir(input.targetParent)).filter((entry) => entry !== '.DS_Store');
  if (entries.length > 0) {
    throw new Error(
      `Refusing to scaffold directly into non-empty selected folder: ${input.targetParent}.`,
    );
  }
  return input.targetParent;
}

async function bootstrapHtmlFirstProject(input: {
  workspacePath: string;
  name: string;
  createStarterFiles: boolean;
  htmlDesignSystemPresetId: HtmlDesignSystemPresetId;
  steps: BootstrapResult['steps'];
}): Promise<BootstrapResult> {
  const createStartedAt = Date.now();
  await Promise.all([
    mkdir(join(input.workspacePath, '.sber-designer'), { recursive: true }),
    mkdir(join(input.workspacePath, 'pages'), { recursive: true }),
    mkdir(join(input.workspacePath, HTML_DESIGN_SYSTEM_PATHS.refsDir), { recursive: true }),
  ]);
  input.steps.push({
    name: 'create-html-first',
    ok: true,
    durationMs: Date.now() - createStartedAt,
  });

  const screens = input.createStarterFiles
    ? [
        {
          id: 'index',
          name: 'Index',
          createdAt: createStartedAt,
          updatedAt: createStartedAt,
          kind: 'page' as const,
          filePath: 'index.html',
          implementationFilePath: 'index.html',
          description: 'Starter static HTML page',
        },
      ]
    : [];
  const project: SberDesignerProject = {
    version: 1,
    name: input.name,
    workspacePath: input.workspacePath,
    projectKind: 'html-first',
    screens,
    flow: [],
  };
  await writeProjectFile(input.workspacePath, project);
  await writeFile(join(input.workspacePath, '.gitignore'), '.DS_Store\n', 'utf8');
  await ensureScaffoldGitignore(input.workspacePath);

  if (input.createStarterFiles) {
    const startedAt = Date.now();
    const preset = materializeHtmlDesignSystemPreset(input.htmlDesignSystemPresetId, input.name);
    await Promise.all([
      writeFile(join(input.workspacePath, 'index.html'), buildHtmlScreenIndex(project), 'utf8'),
      writeFile(
        join(input.workspacePath, HTML_DESIGN_SYSTEM_PATHS.tokensCss),
        preset.tokensCss,
        'utf8',
      ),
      writeFile(
        join(input.workspacePath, HTML_DESIGN_SYSTEM_PATHS.componentsCss),
        preset.componentsCss,
        'utf8',
      ),
      writeFile(
        join(input.workspacePath, HTML_DESIGN_SYSTEM_PATHS.designMd),
        preset.designMd,
        'utf8',
      ),
      writeFile(
        join(input.workspacePath, HTML_DESIGN_SYSTEM_PATHS.refsDir, 'README.md'),
        buildHtmlDesignSystemRefsReadme(),
        'utf8',
      ),
      writeFile(
        join(input.workspacePath, HTML_DESIGN_SYSTEM_PATHS.refsDir, 'starter-components.html'),
        buildHtmlDesignSystemStarterReference(input.name),
        'utf8',
      ),
    ]);
    await regenerateHtmlDesignSystemPreview(input.workspacePath, input.name);
    input.steps.push({
      name: 'starter-files',
      ok: true,
      durationMs: Date.now() - startedAt,
      detail: `preset=${preset.id}`,
    });
  }

  const gitRes = await runStep(['init', '-q'], {
    cwd: input.workspacePath,
    command: 'git',
    timeoutMs: 10_000,
  });
  input.steps.push({ name: 'git-init', ...gitRes });

  return { workspacePath: input.workspacePath, steps: input.steps };
}

function buildHtmlDesignSystemRefsReadme(): string {
  return `# Design system references

Place project-owned HTML, CSS, and JavaScript reference files in this folder.
They are indexed as design-system evidence and never treated as product screens.
`;
}

function buildHtmlDesignSystemStarterReference(projectName: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${projectName} starter components</title>
    <link rel="stylesheet" href="../tokens.css" />
    <link rel="stylesheet" href="../components.css" />
  </head>
  <body>
    <main style="padding: 32px">
      <button class="button button--primary" type="button">Primary action</button>
    </main>
  </body>
</html>
`;
}

async function writeProjectFile(workspacePath: string, project: SberDesignerProject) {
  await writeFile(
    join(workspacePath, '.sber-designer/project.sdproj'),
    `${JSON.stringify(project, null, 2)}\n`,
    'utf8',
  );
}

export async function ensureScaffoldGitignore(workspacePath: string): Promise<void> {
  const path = join(workspacePath, '.gitignore');
  const existing = await readFile(path, 'utf8').catch(() => '');
  const lines = existing.split(/\r?\n/u).map((line) => line.trim());
  if (lines.includes('.sber-designer/runs/')) return;
  const separator = existing.length === 0 || existing.endsWith('\n') ? '' : '\n';
  await writeFile(path, `${existing}${separator}.sber-designer/runs/\n`, 'utf8');
}

interface RunOptions {
  cwd: string;
  command: string;
  timeoutMs: number;
}

interface StepResult {
  ok: boolean;
  durationMs: number;
  detail?: string;
}

async function runStep(args: string[], opts: RunOptions): Promise<StepResult> {
  const startedAt = Date.now();
  return new Promise<StepResult>((resolveFn) => {
    const child = spawn(opts.command, args, {
      cwd: opts.cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    let stdout = '';
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (c) => (stdout += c));
    child.stderr?.on('data', (c) => (stderr += c));
    const timer = setTimeout(() => {
      try {
        child.kill('SIGTERM');
      } catch {
        // ignore
      }
    }, opts.timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      resolveFn({
        ok: false,
        durationMs: Date.now() - startedAt,
        detail: err.message,
      });
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      const detail = code === 0 ? undefined : (stderr || stdout || `exit ${code}`).slice(0, 500);
      resolveFn({
        ok: code === 0,
        durationMs: Date.now() - startedAt,
        ...(detail ? { detail } : {}),
      });
    });
  });
}

async function tryCreateVite(input: {
  parent: string;
  name: string;
  workspacePath: string;
  createProjectSubfolder: boolean;
}): Promise<StepResult> {
  if (!input.createProjectSubfolder) {
    const bunDirectTry = await runStep(['create', 'vite@latest', '.', '--template', 'react-ts'], {
      cwd: input.workspacePath,
      command: BUN,
      timeoutMs: 180_000,
    });
    if (bunDirectTry.ok) return bunDirectTry;
    return runStep(['create', 'vite@latest', '.', '--', '--template', 'react-ts'], {
      cwd: input.workspacePath,
      command: NPM,
      timeoutMs: 180_000,
    });
  }

  // First try `bun create vite@latest <name> --template react-ts`.
  const bunTry = await runStep(['create', 'vite@latest', input.name, '--template', 'react-ts'], {
    cwd: input.parent,
    command: BUN,
    timeoutMs: 180_000,
  });
  if (bunTry.ok) return bunTry;
  // Fallback to npm: `npm create vite@latest <name> -- --template react-ts`.
  return runStep(['create', 'vite@latest', input.name, '--', '--template', 'react-ts'], {
    cwd: input.parent,
    command: NPM,
    timeoutMs: 180_000,
  });
}

function sanitiseName(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!cleaned) throw new Error('Project name must contain at least one alphanumeric character.');
  return cleaned;
}
