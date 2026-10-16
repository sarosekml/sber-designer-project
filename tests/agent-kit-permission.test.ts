import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { expect, test } from 'bun:test';
import { z } from 'zod';
import type { ChatRequest, ChatResponse, LlmGateway } from '@sber-designer/llm-gateway';

import { AgentKitConfigSchema, parseAgentFrontmatter } from '../services/api/src/agent-kit/schema';
import { loadAgentKit, resetAgentKitCache } from '../services/api/src/agent-kit/loader';
import { resolveAgentToolPermission } from '../services/api/src/agent-kit/permissions';
import { applyRunPermissionScope } from '../services/api/src/agent/tool-permission-scope';
import { runAgent } from '../services/api/src/agent/loop';
import {
  registerAgentPermissionRequest,
  resolveAgentPermissionRequest,
  resolveRememberedAgentPermission,
} from '../services/api/src/agent/permission-requests';
import { runAgentStream } from '../services/api/src/agent/stream';
import type { AgentPermissionRequest } from '../services/api/src/agent/stream';
import type { ServerTool, ToolContext } from '../services/api/src/agent/types';

test('agent kit config accepts permission grammar', () => {
  const parsed = AgentKitConfigSchema.parse({
    defaultAgent: 'ai-product-designer',
    permission: {
      '*': 'ask',
      read: 'allow',
      edit: {
        '*': 'ask',
        'src/generated/**': 'allow',
      },
      run_script: 'deny',
      load_skill: {
        '*': 'allow',
        'git-pr-workflow': 'ask',
      },
      send_pr: 'ask',
      set_mode: 'allow',
    },
  });

  expect(parsed.permission?.edit).toEqual({
    '*': 'ask',
    'src/generated/**': 'allow',
  });
  expect(() =>
    AgentKitConfigSchema.parse({
      defaultAgent: 'ai-product-designer',
      permission: { edit: 'maybe' },
    }),
  ).toThrow();
  expect(() =>
    AgentKitConfigSchema.parse({
      defaultAgent: 'ai-product-designer',
      permission: { bash: 'allow' },
    }),
  ).toThrow();
});

test('post_message is a read-safe tool and does not require approval by default', () => {
  const decision = resolveAgentToolPermission({
    toolName: 'post_message',
    input: { text: 'Working on it.' },
  });

  expect(decision.category).toBe('read');
  expect(decision.action).toBe('allow');
});

test('description interview tools are auto-allowed (scoped to .sber-designer/components, D2)', () => {
  for (const toolName of [
    'list_undescribed_components',
    'write_component_description',
    'get_component_description_source',
    // 0083 follow-up: get_usage_card (the per-component mined draft) is read-only;
    // without this the interview re-prompted before analysing every component.
    'get_usage_card',
  ]) {
    const decision = resolveAgentToolPermission({
      toolName,
      input: { componentId: 'atoms-badge' },
    });
    expect(decision.category).toBe('read');
    expect(decision.action).toBe('allow');
  }
});

test('rebuild_design_system_preview is auto-allowed for managed html-first preview output', () => {
  const decision = resolveAgentToolPermission({
    toolName: 'rebuild_design_system_preview',
    input: { keepDescriptions: true },
  });

  expect(decision.category).toBe('read');
  expect(decision.action).toBe('allow');
  expect(decision.resource).toBe('design-system/index.html');
});

test('write_component_description target:storybook requires edit approval (0083 R1)', () => {
  const sidecar = resolveAgentToolPermission({
    toolName: 'write_component_description',
    input: { componentId: 'atoms-badge' },
  });
  expect(sidecar.category).toBe('read');
  expect(sidecar.action).toBe('allow');

  for (const target of ['storybook', 'auto']) {
    const decision = resolveAgentToolPermission({
      toolName: 'write_component_description',
      input: { componentId: 'atoms-badge', target },
    });
    // Writing into Storybook source is a real edit — gated, not auto-allowed.
    expect(decision.category).toBe('edit');
    expect(decision.action).toBe('ask'); // default edit policy
    expect(decision.resource).toBe('storybook-source:atoms-badge');
  }
});

test('write_component_description target:design-system is auto-allowed for managed preview projection (0112 P-1a)', () => {
  const decision = resolveAgentToolPermission({
    toolName: 'write_component_description',
    input: { componentId: 'css-catalog-card', target: 'design-system' },
  });

  expect(decision.category).toBe('read');
  expect(decision.action).toBe('allow');
  expect(decision.resource).toBe('design-system/index.html');
});

test('agent frontmatter accepts permission grammar', () => {
  const parsed = parseAgentFrontmatter(
    [
      '---',
      'name: ai-product-designer',
      'description: Permission-aware product designer.',
      'permission:',
      '  "*": ask',
      '  edit:',
      '    "*": ask',
      '    src/generated/**: allow',
      '  send_pr: ask',
      '---',
      '',
      'Body.',
    ].join('\n'),
  );

  expect(parsed.frontmatter.permission?.edit).toEqual({
    '*': 'ask',
    'src/generated/**': 'allow',
  });
  expect(parsed.frontmatter.permission?.send_pr).toBe('ask');
});

test('loader merges config instruction and agent permissions', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-agent-permission-'));
  const root = join(workspace, '.agents');
  await mkdir(join(root, 'agents'), { recursive: true });
  await mkdir(join(root, 'instructions'), { recursive: true });
  await writeFile(
    join(root, 'config.json'),
    JSON.stringify(
      {
        defaultAgent: 'ai-product-designer',
        instructions: ['instructions/permission.md'],
        permission: {
          '*': 'ask',
          read: 'allow',
          edit: {
            '*': 'ask',
            'src/generated/**': 'allow',
          },
          run_script: 'deny',
        },
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    join(root, 'instructions', 'permission.md'),
    [
      '---',
      'permission:',
      '  edit:',
      '    src/generated/**: deny',
      '    src/screens/**: ask',
      '  load_skill: allow',
      '---',
      '',
      'Instruction text.',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'agents', 'ai-product-designer.md'),
    [
      '---',
      'name: ai-product-designer',
      'description: Permission-aware product designer.',
      'permission:',
      '  edit:',
      '    src/generated/**: allow',
      '  send_pr: ask',
      '---',
      '',
      'Workspace prompt.',
    ].join('\n'),
    'utf8',
  );

  resetAgentKitCache();
  const kit = await loadAgentKit({ workspacePath: workspace, defaultAgentsDir: root });

  expect(kit.defaultAgent.permission).toEqual({
    '*': 'ask',
    read: 'allow',
    edit: {
      '*': 'ask',
      'src/generated/**': 'allow',
      'src/screens/**': 'ask',
    },
    run_script: 'deny',
    load_skill: 'allow',
    send_pr: 'ask',
    set_mode: 'allow',
  });
});

test('tool permission resolver maps tools to categories and path rules', () => {
  const allowed = resolveAgentToolPermission({
    toolName: 'apply_patch',
    input: { ops: [{ kind: 'set-prop', file: 'src/generated/Card.tsx' }] },
    permission: {
      '*': 'ask',
      edit: {
        '*': 'ask',
        'src/generated/**': 'allow',
        'src/secret/**': 'deny',
      },
    },
  });
  expect(allowed.action).toBe('allow');
  expect(allowed.category).toBe('edit');
  expect(allowed.resource).toBe('src/generated/Card.tsx');
  expect(allowed.pattern).toBe('src/generated/**');

  const asked = resolveAgentToolPermission({
    toolName: 'apply_patch',
    input: { ops: [{ kind: 'set-prop', file: 'src/screens/Card.tsx' }] },
    permission: {
      '*': 'ask',
      edit: {
        '*': 'ask',
        'src/generated/**': 'allow',
      },
    },
  });
  expect(asked.action).toBe('ask');
  expect(asked.resource).toBe('src/screens/Card.tsx');
  expect(asked.pattern).toBe('*');

  const denied = resolveAgentToolPermission({
    toolName: 'run_agent_script',
    input: { name: 'validate-design-context' },
    permission: { run_script: 'deny' },
  });
  expect(denied.action).toBe('deny');
  expect(denied.category).toBe('run_script');
  expect(denied.resource).toBe('validate-design-context');

  const templateRead = resolveAgentToolPermission({
    toolName: 'read_screen_template',
    input: { id: 'detail', source: 'builtin' },
    permission: { read: 'allow' },
  });
  expect(templateRead.action).toBe('allow');
  expect(templateRead.category).toBe('read');
  expect(templateRead.resource).toBe('detail');

  const assetImport = resolveAgentToolPermission({
    toolName: 'import_asset_pack',
    input: { sourcePath: '/Users/me/product-assets' },
    permission: { edit: 'ask' },
  });
  expect(assetImport.action).toBe('ask');
  expect(assetImport.category).toBe('edit');
  expect(assetImport.resource).toBe('asset-pack:/Users/me/product-assets');
});

test('non-streaming agent loop gates tool handlers by permission', async () => {
  let calls = 0;
  const tool: ServerTool = {
    name: 'apply_patch',
    description: 'Patch source.',
    inputSchema: z
      .object({
        ops: z.array(z.object({ file: z.string() }).passthrough()),
      })
      .strict(),
    handler: async () => {
      calls += 1;
      return { ok: true };
    },
  };

  const result = await runAgent({
    gateway: fakeGateway([
      {
        text: '',
        provider: 'mock',
        model: 'mock',
        toolCalls: [
          {
            id: 'call-1',
            name: 'apply_patch',
            arguments: JSON.stringify({ ops: [{ file: 'src/screens/Demo.tsx' }] }),
          },
        ],
      },
      { text: 'Done', provider: 'mock', model: 'mock' },
    ]),
    messages: [{ role: 'user', content: 'Change it' }],
    tools: [tool],
    permission: {
      '*': 'allow',
      edit: {
        '*': 'ask',
      },
    },
    toolContext: toolContext(),
    maxIterations: 2,
  });

  expect(calls).toBe(0);
  const toolResult = result.transcript.find((message) => message.role === 'tool');
  expect(toolResult?.content).toContain('permission_required');
  expect(toolResult?.content).toContain('src/screens/Demo.tsx');
});

test('non-streaming agent loop returns deterministic deny errors', async () => {
  let calls = 0;
  const tool: ServerTool = {
    name: 'write_file',
    description: 'Write source.',
    inputSchema: z.object({ path: z.string(), contents: z.string() }).strict(),
    handler: async () => {
      calls += 1;
      return { ok: true };
    },
  };

  const result = await runAgent({
    gateway: fakeGateway([
      {
        text: '',
        provider: 'mock',
        model: 'mock',
        toolCalls: [
          {
            id: 'call-1',
            name: 'write_file',
            arguments: JSON.stringify({ path: 'src/secret/Demo.tsx', contents: '' }),
          },
        ],
      },
      { text: 'Blocked', provider: 'mock', model: 'mock' },
    ]),
    messages: [{ role: 'user', content: 'Write it' }],
    tools: [tool],
    permission: {
      '*': 'allow',
      edit: {
        '*': 'allow',
        'src/secret/**': 'deny',
      },
    },
    toolContext: toolContext(),
    maxIterations: 2,
  });

  expect(calls).toBe(0);
  const toolResult = result.transcript.find((message) => message.role === 'tool');
  expect(toolResult?.content).toContain('agent_permission_denied');
  expect(toolResult?.content).toContain('src/secret/Demo.tsx');
});

test('streaming agent loop gates tool handlers by permission', async () => {
  let calls = 0;
  const tool: ServerTool = {
    name: 'send_pr',
    description: 'Send PR.',
    inputSchema: z.object({ title: z.string() }).strict(),
    handler: async () => {
      calls += 1;
      return { ok: true };
    },
  };

  const events = [];
  for await (const event of runAgentStream({
    gateway: fakeGateway([
      {
        text: '',
        provider: 'mock',
        model: 'mock',
        toolCalls: [
          {
            id: 'call-1',
            name: 'send_pr',
            arguments: JSON.stringify({ title: 'Open PR' }),
          },
        ],
      },
      { text: 'Need approval', provider: 'mock', model: 'mock' },
    ]),
    messages: [{ role: 'user', content: 'Open a PR' }],
    tools: [tool],
    permission: { send_pr: 'ask' },
    toolContext: toolContext(),
    maxIterations: 2,
  })) {
    events.push(event);
  }

  expect(calls).toBe(0);
  const result = events.find((event) => event.type === 'tool-result');
  expect(result?.content).toContain('permission_required');
  expect(result?.isError).toBe(false);
});

test('streaming agent loop pauses ask permissions until approval', async () => {
  let calls = 0;
  let resolvePermission!: (value: { decision: 'allow' | 'deny' }) => void;
  const permissionResponse = new Promise<{ decision: 'allow' | 'deny' }>((resolve) => {
    resolvePermission = resolve;
  });
  const tool: ServerTool = {
    name: 'apply_patch',
    description: 'Patch source.',
    inputSchema: z
      .object({
        ops: z.array(z.object({ file: z.string() }).passthrough()),
      })
      .strict(),
    handler: async () => {
      calls += 1;
      return { ok: true };
    },
  };

  const stream = runAgentStream({
    gateway: fakeGateway([
      {
        text: '',
        provider: 'mock',
        model: 'mock',
        toolCalls: [
          {
            id: 'call-1',
            name: 'apply_patch',
            arguments: JSON.stringify({ ops: [{ file: 'src/screens/Demo.tsx' }] }),
          },
        ],
      },
      { text: 'Done', provider: 'mock', model: 'mock' },
    ]),
    messages: [{ role: 'user', content: 'Change it' }],
    tools: [tool],
    permission: {
      '*': 'allow',
      edit: {
        '*': 'ask',
      },
    },
    requestPermission: async () => permissionResponse,
    toolContext: toolContext(),
    maxIterations: 2,
  });

  const iterator = stream[Symbol.asyncIterator]();
  expect((await iterator.next()).value?.type).toBe('iteration-start');
  expect((await iterator.next()).value?.type).toBe('tool-call');
  expect((await iterator.next()).value?.type).toBe('iteration-end');
  const permissionEvent = await iterator.next();
  expect(permissionEvent.value?.type).toBe('permission-request');
  if (permissionEvent.value?.type !== 'permission-request') throw new Error('expected request');
  expect(permissionEvent.value.request.toolName).toBe('apply_patch');
  expect(permissionEvent.value.request.resource).toBe('src/screens/Demo.tsx');
  expect(calls).toBe(0);

  const pendingNext = iterator.next();
  const blocked = await Promise.race([
    pendingNext.then(() => 'advanced' as const),
    sleep(20).then(() => 'paused' as const),
  ]);
  expect(blocked).toBe('paused');
  expect(calls).toBe(0);

  resolvePermission({ decision: 'allow' });
  const toolResult = await pendingNext;
  expect(toolResult.value?.type).toBe('tool-result');
  expect(calls).toBe(1);
  if (toolResult.value?.type !== 'tool-result') throw new Error('expected tool result');
  expect(toolResult.value.content).toContain('"ok":true');
});

test('streaming agent loop does not invoke an approved tool after cancellation at the permission boundary', async () => {
  let calls = 0;
  const controller = new AbortController();
  const tool: ServerTool = {
    name: 'write_file',
    description: 'Write source.',
    inputSchema: z.object({ path: z.string(), contents: z.string() }).strict(),
    handler: async () => {
      calls += 1;
      return { ok: true };
    },
  };

  const consume = async () => {
    for await (const _event of runAgentStream({
      gateway: fakeGateway([
        {
          text: '',
          provider: 'mock',
          model: 'mock',
          toolCalls: [
            {
              id: 'call-1',
              name: 'write_file',
              arguments: JSON.stringify({
                path: 'src/screens/Cancelled.tsx',
                contents: 'export {};',
              }),
            },
          ],
        },
      ]),
      messages: [{ role: 'user', content: 'Write it' }],
      tools: [tool],
      permission: { '*': 'allow', edit: { '*': 'ask' } },
      requestPermission: async () => {
        controller.abort(new Error('Cancelled by user.'));
        return { decision: 'allow' };
      },
      signal: controller.signal,
      toolContext: toolContext(),
      maxIterations: 2,
    })) {
      // Consume until the cancellation escapes the stream.
    }
  };

  await expect(consume()).rejects.toThrow('Cancelled by user.');
  expect(calls).toBe(0);
});

test('streaming agent loop auto-allows writes to the active screen target', async () => {
  let calls = 0;
  const tool: ServerTool = {
    name: 'write_file',
    description: 'Write source.',
    inputSchema: z.object({ path: z.string(), contents: z.string() }).strict(),
    handler: async () => {
      calls += 1;
      return { ok: true, path: 'src/screens/Demo.tsx' };
    },
  };

  const events = [];
  for await (const event of runAgentStream({
    gateway: fakeGateway([
      {
        text: '',
        provider: 'mock',
        model: 'mock',
        toolCalls: [
          {
            id: 'call-1',
            name: 'write_file',
            arguments: JSON.stringify({ path: 'src/screens/Demo.tsx', contents: 'export {};' }),
          },
        ],
      },
      { text: 'Done', provider: 'mock', model: 'mock' },
    ]),
    messages: [{ role: 'user', content: 'Write it' }],
    tools: [tool],
    permission: {
      '*': 'allow',
      edit: {
        '*': 'ask',
      },
    },
    requestPermission: async () => ({ decision: 'deny' }),
    toolContext: toolContext({
      activeScreen: {
        id: 'demo',
        name: 'Demo',
        kind: 'story',
        filePath: 'src/stories/Demo.stories.tsx',
        implementationFilePath: 'src/screens/Demo.tsx',
      },
    }),
    maxIterations: 2,
  })) {
    events.push(event);
  }

  expect(calls).toBe(1);
  expect(events.some((event) => event.type === 'permission-request')).toBe(false);
  const result = events.find((event) => event.type === 'tool-result');
  expect(result?.content).toContain('"ok":true');
});

test('run permission scope auto-allows canonical html design-system targets only', () => {
  const decision = resolveAgentToolPermission({
    toolName: 'write_file',
    input: { path: 'design-system/Design.md', contents: '# Design\n' },
    permission: {
      '*': 'allow',
      edit: { '*': 'ask' },
    },
  });

  const scoped = applyRunPermissionScope({
    decision,
    toolName: 'write_file',
    input: { path: 'design-system/Design.md', contents: '# Design\n' },
    toolContext: toolContext({
      runAllowedWriteTargets: [
        'design-system/Design.md',
        'design-system/tokens.css',
        'design-system/components.css',
        'design-system/refs/**',
      ],
    } as Partial<ToolContext>),
  });

  expect(scoped.action).toBe('allow');
  expect(scoped.pattern).toBe('run-target');

  const alias = applyRunPermissionScope({
    decision: resolveAgentToolPermission({
      toolName: 'write_file',
      input: { path: 'DESIGN.md', contents: '# Design\n' },
      permission: {
        '*': 'allow',
        edit: { '*': 'ask' },
      },
    }),
    toolName: 'write_file',
    input: { path: 'DESIGN.md', contents: '# Design\n' },
    toolContext: toolContext({
      runAllowedWriteTargets: ['design-system/Design.md'],
    } as Partial<ToolContext>),
  });

  expect(alias.action).toBe('ask');

  const other = applyRunPermissionScope({
    decision: resolveAgentToolPermission({
      toolName: 'write_file',
      input: { path: 'pages/other.html', contents: '<main></main>' },
      permission: {
        '*': 'allow',
        edit: { '*': 'ask' },
      },
    }),
    toolName: 'write_file',
    input: { path: 'pages/other.html', contents: '<main></main>' },
    toolContext: toolContext({
      runAllowedWriteTargets: [
        'design-system/Design.md',
        'design-system/tokens.css',
        'design-system/components.css',
        'design-system/refs/**',
      ],
    } as Partial<ToolContext>),
  });

  expect(other.action).toBe('ask');
});

test('streaming agent loop prompts for out-of-scope active screen writes and denies explicitly', async () => {
  let calls = 0;
  let permissionRequests = 0;
  const tool: ServerTool = {
    name: 'write_file',
    description: 'Write source.',
    inputSchema: z.object({ path: z.string(), contents: z.string() }).strict(),
    handler: async () => {
      calls += 1;
      return { ok: true };
    },
  };

  const events = [];
  for await (const event of runAgentStream({
    gateway: fakeGateway([
      {
        text: '',
        provider: 'mock',
        model: 'mock',
        toolCalls: [
          {
            id: 'call-1',
            name: 'write_file',
            arguments: JSON.stringify({ path: 'src/screens/Other.tsx', contents: 'export {};' }),
          },
        ],
      },
      { text: 'Blocked', provider: 'mock', model: 'mock' },
    ]),
    messages: [{ role: 'user', content: 'Write it' }],
    tools: [tool],
    permission: {
      '*': 'allow',
      edit: {
        '*': 'ask',
      },
    },
    requestPermission: async () => {
      permissionRequests += 1;
      return { decision: 'deny' };
    },
    toolContext: toolContext({
      activeScreen: {
        id: 'demo',
        name: 'Demo',
        kind: 'story',
        filePath: 'src/stories/Demo.stories.tsx',
        implementationFilePath: 'src/screens/Demo.tsx',
      },
    }),
    maxIterations: 2,
  })) {
    events.push(event);
  }

  expect(calls).toBe(0);
  expect(permissionRequests).toBe(1);
  expect(events.some((event) => event.type === 'permission-request')).toBe(true);
  const result = events.find((event) => event.type === 'tool-result');
  expect(result?.content).toContain('permission_denied');
  expect(result?.content).toContain('src/screens/Other.tsx');
  expect(result?.isError).toBe(true);
});

test('streaming agent loop stops repeated non-blocking craft validation cycles', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-local-edit-loop-'));
  await mkdir(join(workspace, 'src/screens'), { recursive: true });
  await writeFile(
    join(workspace, 'src/screens/Demo.tsx'),
    'export function Demo() { return null; }',
  );
  let patchCalls = 0;
  const tools: ServerTool[] = [
    {
      name: 'apply_patch',
      description: 'Patch source.',
      inputSchema: z.object({ path: z.string().optional() }).passthrough(),
      handler: async () => {
        patchCalls += 1;
        return { ok: true, changedFiles: ['src/screens/Demo.tsx'] };
      },
    },
    {
      name: 'validate_screen_craft',
      description: 'Validate craft.',
      inputSchema: z.object({}).passthrough(),
      handler: async () => ({
        status: 'findings',
        checkedFiles: ['src/screens/Demo.tsx'],
        blocking: 0,
        shouldFix: 1,
        advisory: 0,
        findings: [
          {
            severity: 'should-fix',
            ruleId: 'craft.raw-hex',
            message: 'Use a token color.',
            filePath: 'src/screens/Demo.tsx',
          },
        ],
      }),
    },
  ];
  const events = [];

  for await (const event of runAgentStream({
    gateway: fakeGateway([
      {
        text: '',
        provider: 'mock',
        model: 'mock',
        toolCalls: [
          { id: 'patch-1', name: 'apply_patch', arguments: JSON.stringify({}) },
          { id: 'validate-1', name: 'validate_screen_craft', arguments: JSON.stringify({}) },
        ],
      },
      {
        text: '',
        provider: 'mock',
        model: 'mock',
        toolCalls: [
          { id: 'patch-2', name: 'apply_patch', arguments: JSON.stringify({}) },
          { id: 'validate-2', name: 'validate_screen_craft', arguments: JSON.stringify({}) },
        ],
      },
      {
        text: '',
        provider: 'mock',
        model: 'mock',
        toolCalls: [{ id: 'patch-3', name: 'apply_patch', arguments: JSON.stringify({}) }],
      },
    ]),
    messages: [{ role: 'user', content: 'Make the selected button primary.' }],
    tools,
    permission: { '*': 'allow', edit: { '*': 'allow' } },
    toolContext: toolContext({
      workspacePath: workspace,
      activeScreen: {
        id: 'demo',
        name: 'Demo',
        kind: 'story',
        filePath: 'src/stories/Demo.stories.tsx',
        implementationFilePath: 'src/screens/Demo.tsx',
      },
    }),
    maxIterations: 6,
  })) {
    events.push(event);
  }

  expect(patchCalls).toBe(2);
  expect(events.at(-1)).toMatchObject({ type: 'done', iterations: 2, truncated: false });
  const done = events.at(-1);
  expect(done?.type).toBe('done');
  if (done?.type === 'done') {
    expect(done.finalResponse.text).toContain('non-blocking validation findings');
    expect(done.finalResponse.text).not.toContain('Finish now with a concise summary');
    expect(done.finalResponse.text).not.toContain('[sber-designer · auto]');
  }
});

test('streaming agent loop also fingerprints craft bundled by write tools', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-local-edit-bundled-craft-'));
  await mkdir(join(workspace, 'src/screens'), { recursive: true });
  await writeFile(
    join(workspace, 'src/screens/Demo.tsx'),
    'export function Demo() { return null; }',
  );
  let patchCalls = 0;
  const tool: ServerTool = {
    name: 'apply_patch',
    description: 'Patch source and return its automatic craft post-check.',
    inputSchema: z.object({}).passthrough(),
    handler: async () => {
      patchCalls += 1;
      return {
        ok: true,
        changedFiles: ['src/screens/Demo.tsx'],
        craft: {
          status: 'findings',
          checkedFiles: ['src/screens/Demo.tsx'],
          blocking: 0,
          shouldFix: 1,
          advisory: 0,
          findings: [
            {
              severity: 'should-fix',
              ruleId: 'craft.raw-hex',
              message: 'Use a token color.',
              filePath: 'src/screens/Demo.tsx',
            },
          ],
        },
      };
    },
  };
  const events = [];

  for await (const event of runAgentStream({
    gateway: fakeGateway([
      {
        text: '',
        provider: 'mock',
        model: 'mock',
        toolCalls: [{ id: 'patch-1', name: 'apply_patch', arguments: '{}' }],
      },
      {
        text: '',
        provider: 'mock',
        model: 'mock',
        toolCalls: [{ id: 'patch-2', name: 'apply_patch', arguments: '{}' }],
      },
      {
        text: '',
        provider: 'mock',
        model: 'mock',
        toolCalls: [{ id: 'patch-3', name: 'apply_patch', arguments: '{}' }],
      },
    ]),
    messages: [{ role: 'user', content: 'Make the selected button primary.' }],
    tools: [tool],
    permission: { '*': 'allow', edit: { '*': 'allow' } },
    toolContext: toolContext({
      workspacePath: workspace,
      activeScreen: {
        id: 'demo',
        name: 'Demo',
        kind: 'story',
        filePath: 'src/stories/Demo.stories.tsx',
        implementationFilePath: 'src/screens/Demo.tsx',
      },
    }),
    maxIterations: 6,
  })) {
    events.push(event);
  }

  expect(patchCalls).toBe(2);
  expect(events.at(-1)).toMatchObject({ type: 'done', iterations: 2, truncated: false });
});

test('permission requests timeout when a prompt is lost', async () => {
  const request: AgentPermissionRequest = {
    id: 'perm-timeout',
    toolCallId: 'call-timeout',
    toolName: 'write_file',
    category: 'edit',
    resource: 'src/screens/Deal.tsx',
    pattern: '*',
    arguments: '{}',
    runId: 'run-timeout',
  };

  const waiting = registerAgentPermissionRequest(request, {
    user: 'test-user',
    workspacePath: '/tmp/workspace',
    runId: 'run-timeout',
    timeoutMs: 5,
  } as Parameters<typeof registerAgentPermissionRequest>[1]);
  const outcome = await Promise.race([
    waiting,
    sleep(30).then(() => ({ decision: 'still-pending' as const })),
  ]);
  if (outcome.decision === 'still-pending') {
    resolveAgentPermissionRequest({
      id: request.id,
      user: 'test-user',
      decision: 'deny',
    });
  }

  expect(outcome).toEqual({ decision: 'deny', reason: 'timeout' });
});

test('streaming agent loop skips permission prompts for remembered approvals', async () => {
  let calls = 0;
  const tool: ServerTool = {
    name: 'apply_patch',
    description: 'Patch source.',
    inputSchema: z
      .object({
        ops: z.array(z.object({ file: z.string() }).passthrough()),
      })
      .strict(),
    handler: async () => {
      calls += 1;
      return { ok: true };
    },
  };

  const events = [];
  for await (const event of runAgentStream({
    gateway: fakeGateway([
      {
        text: '',
        provider: 'mock',
        model: 'mock',
        toolCalls: [
          {
            id: 'call-1',
            name: 'apply_patch',
            arguments: JSON.stringify({ ops: [{ file: 'src/screens/Demo.tsx' }] }),
          },
        ],
      },
      { text: 'Done', provider: 'mock', model: 'mock' },
    ]),
    messages: [{ role: 'user', content: 'Change it' }],
    tools: [tool],
    permission: {
      '*': 'allow',
      edit: {
        '*': 'ask',
      },
    },
    requestPermission: () => ({ decision: 'allow' }),
    toolContext: toolContext(),
    maxIterations: 2,
  })) {
    events.push(event);
  }

  expect(calls).toBe(1);
  expect(events.some((event) => event.type === 'permission-request')).toBe(false);
  const result = events.find((event) => event.type === 'tool-result');
  expect(result?.content).toContain('"ok":true');
});

test('remembered edit approvals are scoped to a single agent run', async () => {
  const firstRequest: AgentPermissionRequest = {
    id: 'perm-write-file',
    toolCallId: 'call-write',
    toolName: 'write_file',
    category: 'edit',
    resource: 'src/screens/Deal.tsx',
    pattern: '*',
    arguments: '{}',
    runId: 'run-current',
  };

  const waiting = registerAgentPermissionRequest(firstRequest, {
    user: 'test-user',
    workspacePath: '/tmp/workspace',
    runId: 'run-current',
  });
  const resolved = resolveAgentPermissionRequest({
    id: firstRequest.id,
    user: 'test-user',
    decision: 'allow',
    remember: true,
  });

  expect(resolved.ok).toBe(true);
  await expect(waiting).resolves.toEqual({ decision: 'allow', remember: true });

  const secondRequest: AgentPermissionRequest = {
    id: 'perm-screen-create',
    toolCallId: 'call-create',
    toolName: 'screen_create',
    category: 'edit',
    resource: 'src/screens/Deal.tsx',
    pattern: '*',
    arguments: '{}',
    runId: 'run-current',
  };

  expect(
    resolveRememberedAgentPermission(secondRequest, {
      user: 'test-user',
      workspacePath: '/tmp/workspace',
      runId: 'run-current',
    }),
  ).toEqual({ decision: 'allow' });
  expect(
    resolveRememberedAgentPermission(secondRequest, {
      user: 'test-user',
      workspacePath: '/tmp/workspace',
      runId: 'run-next',
    }),
  ).toBeNull();
});

function fakeGateway(responses: ChatResponse[]): LlmGateway {
  let index = 0;
  return {
    active: { provider: 'mock', model: 'mock' },
    listVisibleModels: () => [],
    async chat(_req: ChatRequest): Promise<ChatResponse> {
      return responses[index++] ?? responses.at(-1)!;
    },
    async *chatStream(_req: ChatRequest) {
      const response = responses[index++] ?? responses.at(-1)!;
      for (const call of response.toolCalls ?? []) {
        yield { type: 'tool-call' as const, call };
      }
      yield { type: 'done' as const, final: response };
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toolContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    user: 'test-user',
    projectName: 'Permission Project',
    activeScreen: null,
    workspacePath: '/tmp/workspace',
    canvasUrl: null,
    ...overrides,
  };
}
