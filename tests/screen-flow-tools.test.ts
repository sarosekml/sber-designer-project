import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { ALL_TOOLS } from '../services/api/src/agent/toolset';
import type { ToolContext } from '../services/api/src/agent/types';
import { getProject, resetProject, saveProject } from '../services/api/src/project-store';

test('flow_add_edge wires html page screens with link triggers', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 'sd-flow-page-tools-'));
  resetProject();
  try {
    await saveProject({
      version: 1,
      name: 'HTML prototype',
      workspacePath,
      screens: [
        {
          id: 'dashboard',
          name: 'Dashboard',
          kind: 'page',
          filePath: 'pages/dashboard.html',
          implementationFilePath: 'pages/dashboard.html',
        },
        {
          id: 'checkout',
          name: 'Checkout',
          kind: 'page',
          filePath: 'pages/checkout.html',
          implementationFilePath: 'pages/checkout.html',
        },
      ],
      flow: [],
    });

    const result = (await findTool('flow_add_edge').handler(
      {
        fromScreenId: 'dashboard',
        toScreenId: 'checkout',
        trigger: { kind: 'link', href: 'pages/checkout.html' },
        label: 'Open checkout',
      },
      toolContext(workspacePath),
    )) as { ok: true; edgeCount: number };

    expect(result).toMatchObject({ ok: true, edgeCount: 1 });
    expect(getProject().flow).toContainEqual(
      expect.objectContaining({
        fromScreenId: 'dashboard',
        toScreenId: 'checkout',
        trigger: { kind: 'link', href: 'pages/checkout.html' },
        label: 'Open checkout',
      }),
    );
  } finally {
    resetProject();
  }
});

test('screen_create persists a modal surface (0132)', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 'sd-modal-create-'));
  resetProject();
  try {
    await saveProject({
      version: 1,
      name: 'Modal create',
      workspacePath,
      screens: [],
      flow: [],
    });
    const created = (await findTool('screen_create').handler(
      {
        kind: 'page',
        surface: 'modal',
        name: 'Delete confirm',
        filePath: 'pages/delete-confirm.html',
        implementationFilePath: 'pages/delete-confirm.html',
      },
      toolContext(workspacePath),
    )) as { ok: true; id: string };

    const screen = getProject().screens.find((s) => s.id === created.id);
    expect(screen?.surface).toBe('modal');
  } finally {
    resetProject();
  }
});

test('screen_update converts a screen to a modal and back (0132)', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 'sd-modal-convert-'));
  resetProject();
  try {
    await saveProject({
      version: 1,
      name: 'Convert',
      workspacePath,
      screens: [{ id: 'panel', name: 'Panel', kind: 'page', filePath: 'pages/panel.html' }],
      flow: [],
    });

    await findTool('screen_update').handler(
      { screenId: 'panel', surface: 'modal' },
      toolContext(workspacePath),
    );
    expect(getProject().screens.find((s) => s.id === 'panel')?.surface).toBe('modal');

    await findTool('screen_update').handler(
      { screenId: 'panel', surface: 'page' },
      toolContext(workspacePath),
    );
    expect(getProject().screens.find((s) => s.id === 'panel')?.surface).toBeUndefined();
  } finally {
    resetProject();
  }
});

test('flow_add_edge leaves presentation unset by default but persists explicit navigate (Р-5)', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 'sd-modal-edge-'));
  resetProject();
  try {
    await saveProject({
      version: 1,
      name: 'Modal flow',
      workspacePath,
      screens: [
        { id: 'list', name: 'List', kind: 'page', filePath: 'pages/list.html' },
        {
          id: 'confirm',
          name: 'Delete confirm',
          kind: 'page',
          surface: 'modal',
          filePath: 'pages/confirm.html',
        },
      ],
      flow: [],
    });

    await findTool('flow_add_edge').handler(
      { fromScreenId: 'list', toScreenId: 'confirm', trigger: { kind: 'click', label: 'Delete' } },
      toolContext(workspacePath),
    );
    // Unset default: the resolver derives overlay from the modal target, so the
    // stored edge must NOT pin a presentation.
    const defaultEdge = getProject().flow.at(-1);
    expect(defaultEdge?.presentation).toBeUndefined();

    await findTool('flow_add_edge').handler(
      {
        fromScreenId: 'list',
        toScreenId: 'confirm',
        trigger: { kind: 'click', label: 'Open full' },
        presentation: 'navigate',
      },
      toolContext(workspacePath),
    );
    const overrideEdge = getProject().flow.at(-1);
    expect(overrideEdge?.presentation).toBe('navigate');
  } finally {
    resetProject();
  }
});

function findTool(name: string) {
  const tool = ALL_TOOLS.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool;
}

function toolContext(workspacePath: string): ToolContext {
  return {
    user: 'test-user',
    projectName: 'HTML prototype',
    activeScreen: null,
    assistantTaskIntent: null,
    workspacePath,
    canvasUrl: null,
  };
}
