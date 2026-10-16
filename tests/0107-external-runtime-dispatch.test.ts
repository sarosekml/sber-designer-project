import { expect, test } from 'bun:test';

import type { PromptAttachmentEvidence } from '@sber-designer/shared-types';
import {
  CLAUDE_CODE_RUNTIME_PROVIDER,
  normalizeClaudeCodeAuthProbeFailure,
} from '../services/api/src/agent-runtimes/claude-runner';
import { CODEX_RUNTIME_PROVIDER } from '../services/api/src/agent-runtimes/codex-runner';
import { OPENCODE_RUNTIME_PROVIDER } from '../services/api/src/agent-runtimes/opencode-runner';
import { AGENT_RUNTIME_DEFS } from '../services/api/src/agent-runtimes/registry';
import {
  buildExternalRuntimeAdapterRunInput,
  classifyRuntimeMcpToolHealthFromEvent,
  externalRuntimeDispatchForProvider,
  formatRuntimeMcpHealthNotice,
  mergeRuntimeMcpToolHealth,
  resolveExternalRuntimeImageDelivery,
  runExternalRuntimeAuthPreflight,
} from '../services/api/src/routes/chat-stream/external-dispatch';

const attachment: PromptAttachmentEvidence = {
  id: 'att-reference',
  name: 'reference.png',
  mimeType: 'image/png',
  size: 123,
  sha256: 'a'.repeat(64),
  width: 400,
  height: 300,
  runPath: '.sber-designer/runs/run-1/attachments/01-reference.png',
};

test('external runtime dispatch maps provider ids to adapter runtime metadata', () => {
  expect(externalRuntimeDispatchForProvider(OPENCODE_RUNTIME_PROVIDER)).toMatchObject({
    runtime: 'opencode',
    contextRuntimeLabel: 'OpenCode',
    promptRuntimeLabel: 'OpenCode',
    streamRuntimeLabel: 'OpenCode',
  });

  expect(externalRuntimeDispatchForProvider(CODEX_RUNTIME_PROVIDER)).toMatchObject({
    runtime: 'codex',
    contextRuntimeLabel: 'Codex CLI',
    promptRuntimeLabel: 'Codex CLI',
    streamRuntimeLabel: 'Codex',
    smokeCheck: 'codex',
  });
});

test('external runtime dispatch is derived from runtime definitions', () => {
  for (const def of AGENT_RUNTIME_DEFS) {
    expect(def.externalDispatch?.provider).toBeTruthy();
    expect(externalRuntimeDispatchForProvider(def.externalDispatch?.provider ?? '')).toMatchObject({
      runtime: def.kind,
      contextRuntimeLabel: def.externalDispatch?.contextRuntimeLabel,
    });
  }
});

test('external runtime adapter input preserves Codex images, stdout noise and runtime events', () => {
  const dispatch = externalRuntimeDispatchForProvider(CODEX_RUNTIME_PROVIDER);
  if (!dispatch) throw new Error('missing codex dispatch');
  const stdoutReasons: string[] = [];
  const runtimeEvents: string[] = [];

  const input = buildExternalRuntimeAdapterRunInput({
    dispatch,
    command: '/usr/local/bin/codex',
    model: 'default',
    cwd: '/work/project',
    prompt: 'Generate the active screen.',
    promptAttachments: [attachment],
    onRuntimeStdoutNoise: (reason) => stdoutReasons.push(reason),
    onRuntimeEvent: (event) => runtimeEvents.push(event),
  });

  input.onRuntimeStdoutNoise?.('status-line');
  input.onRuntimeEvent?.('codex.spawn', {});

  expect(input).toMatchObject({
    command: '/usr/local/bin/codex',
    model: 'default',
    cwd: '/work/project',
    prompt: 'Generate the active screen.',
    imagePaths: ['.sber-designer/runs/run-1/attachments/01-reference.png'],
  });
  expect(stdoutReasons).toEqual(['status-line']);
  expect(runtimeEvents).toEqual(['codex.spawn']);
});

test('external runtime adapter input passes screenshot paths to Claude as prompt-path image delivery', () => {
  const dispatch = externalRuntimeDispatchForProvider(CLAUDE_CODE_RUNTIME_PROVIDER);
  if (!dispatch) throw new Error('missing claude dispatch');

  const input = buildExternalRuntimeAdapterRunInput({
    dispatch,
    command: '/usr/local/bin/claude',
    model: 'opus',
    cwd: '/work/project',
    prompt: 'Fix the active screen from the screenshot.',
    promptAttachments: [attachment],
    onRuntimeStdoutNoise: () => undefined,
    onRuntimeEvent: () => undefined,
  });

  expect(input.imagePaths).toEqual(['.sber-designer/runs/run-1/attachments/01-reference.png']);
});

test('external runtime image delivery reports native args for Codex and prompt paths for Claude', () => {
  const codex = externalRuntimeDispatchForProvider(CODEX_RUNTIME_PROVIDER);
  const claude = externalRuntimeDispatchForProvider(CLAUDE_CODE_RUNTIME_PROVIDER);
  const opencode = externalRuntimeDispatchForProvider(OPENCODE_RUNTIME_PROVIDER);
  if (!codex || !claude || !opencode) throw new Error('missing dispatch');

  expect(resolveExternalRuntimeImageDelivery(codex, [attachment])).toEqual({
    mode: 'cli_native_arg',
    imagePaths: ['.sber-designer/runs/run-1/attachments/01-reference.png'],
  });
  expect(resolveExternalRuntimeImageDelivery(claude, [attachment])).toEqual({
    mode: 'prompt_path',
    imagePaths: ['.sber-designer/runs/run-1/attachments/01-reference.png'],
  });
  expect(resolveExternalRuntimeImageDelivery(opencode, [attachment])).toEqual({
    mode: 'none',
    imagePaths: [],
  });
});

test('external runtime auth preflight classifies stale Claude credentials before dispatch', async () => {
  const dispatch = externalRuntimeDispatchForProvider(CLAUDE_CODE_RUNTIME_PROVIDER);
  if (!dispatch) throw new Error('missing claude dispatch');

  const result = await runExternalRuntimeAuthPreflight({
    dispatch,
    command: '/usr/local/bin/claude',
    cwd: '/work/project',
    probeCwd: '/tmp/sber-designer-runtime-probe',
    detectRuntimeImpl: async () => ({
      kind: 'claude-code',
      displayName: 'Claude Code',
      installed: true,
      connected: false,
      command: '/usr/local/bin/claude',
      version: '2.1.158',
      auth: { status: 'failed', providers: [] },
      models: [],
      mcpServers: [],
      capabilities: {
        modelList: false,
        mcpList: false,
        runJson: true,
        modelFlag: true,
        promptViaStdin: true,
        jsonEventStream: false,
        cancel: true,
        usesOwnMcpConfig: true,
        supportsProjectMcpHandoff: true,
        chatHandoff: true,
        imageInputMode: 'cli-files-warning',
        imageDeliveryMode: 'prompt_path',
        rasterImageInput: false,
        svgSourceInput: true,
        nativeFileInput: false,
      },
      diagnostics: [
        {
          code: 'auth_expired',
          message: 'API Error: 401 Invalid authentication credentials',
          severity: 'warning',
        },
      ],
    }),
  });

  expect(result).toMatchObject({
    ok: false,
    code: 'auth_expired',
    detail: 'API Error: 401 Invalid authentication credentials',
    diagnostics: {
      runtimeLaunch: {
        runtime: 'claude-code',
        command: '/usr/local/bin/claude',
        cwd: '/tmp/sber-designer-runtime-probe',
        workspaceCwd: '/work/project',
        probeCwd: '/tmp/sber-designer-runtime-probe',
        version: '2.1.158',
        authStatus: 'failed',
        probe: {
          kind: 'launch',
          ok: false,
          code: 'auth_expired',
        },
      },
    },
  });
});

test('external runtime auth preflight probes Claude print-mode model credentials', async () => {
  const dispatch = externalRuntimeDispatchForProvider(CLAUDE_CODE_RUNTIME_PROVIDER);
  if (!dispatch) throw new Error('missing claude dispatch');

  const result = await runExternalRuntimeAuthPreflight({
    dispatch,
    command: '/usr/local/bin/claude',
    model: 'opus',
    cwd: '/work/project',
    probeCwd: '/tmp/sber-designer-runtime-probe',
    detectRuntimeImpl: async () => ({
      kind: 'claude-code',
      displayName: 'Claude Code',
      installed: true,
      connected: true,
      command: '/usr/local/bin/claude',
      version: '2.1.158',
      auth: { status: 'ready', providers: ['anthropic'] },
      models: [],
      mcpServers: [],
      capabilities: {
        modelList: false,
        mcpList: false,
        runJson: true,
        modelFlag: true,
        promptViaStdin: true,
        jsonEventStream: false,
        cancel: true,
        usesOwnMcpConfig: true,
        supportsProjectMcpHandoff: true,
        chatHandoff: true,
        imageInputMode: 'cli-files-warning',
        imageDeliveryMode: 'prompt_path',
        rasterImageInput: false,
        svgSourceInput: true,
        nativeFileInput: false,
      },
      diagnostics: [],
    }),
    claudeInvocationProbeImpl: async (input) => {
      expect(input.cwd).toBe('/tmp/sber-designer-runtime-probe');
      expect(input.workspaceCwd).toBe('/work/project');
      return {
        ok: false,
        code: 'auth_expired',
        detail:
          'Claude Code print-mode authentication failed for model "opus" (401 authentication_failed). Re-authenticate or remove stale Anthropic env overrides from the backend process.',
        diagnostics: {
          runtimeLaunch: {
            runtime: 'claude-code',
            command: '/usr/local/bin/claude',
            args: ['-p', '--model', 'opus'],
            cwd: '/tmp/sber-designer-runtime-probe',
            workspaceCwd: '/work/project',
            probeCwd: '/tmp/sber-designer-runtime-probe',
            model: 'opus',
            version: null,
            authStatus: 'unknown',
            env: {
              home: '/Users/tester',
              pathEntries: 3,
              authOverrideNames: ['ANTHROPIC_API_KEY'],
            },
            probe: {
              kind: 'print-mode-auth',
              ok: false,
              code: 'auth_expired',
              detail:
                'Claude Code print-mode authentication failed for model "opus" (401 authentication_failed). Re-authenticate or remove stale Anthropic env overrides from the backend process.',
              rawTail:
                '{"type":"system","subtype":"error","error":{"type":"authentication_failed"}}',
            },
          },
        },
      };
    },
  });

  expect(result).toMatchObject({
    ok: false,
    code: 'auth_expired',
    detail:
      'Claude Code print-mode authentication failed for model "opus" (401 authentication_failed). Re-authenticate or remove stale Anthropic env overrides from the backend process.',
    diagnostics: {
      runtimeLaunch: {
        runtime: 'claude-code',
        command: '/usr/local/bin/claude',
        cwd: '/tmp/sber-designer-runtime-probe',
        workspaceCwd: '/work/project',
        probeCwd: '/tmp/sber-designer-runtime-probe',
        model: 'opus',
        version: '2.1.158',
        authStatus: 'ready',
        probe: {
          kind: 'print-mode-auth',
          ok: false,
          code: 'auth_expired',
        },
      },
    },
  });
  expect(result.detail).not.toContain('"type":"system"');
});

test('D4 normalizes Claude stream-json auth failures without leaking raw JSON into chat detail', () => {
  const raw =
    '{"type":"system","subtype":"api_retry","error_status":401,"error":"authentication_failed","message":"Invalid authentication credentials"}';

  const result = normalizeClaudeCodeAuthProbeFailure({
    detail: raw,
    model: 'opus',
  });

  expect(result).toMatchObject({
    code: 'auth_expired',
    detail:
      'Claude Code print-mode authentication failed for model "opus" (401 authentication_failed). Re-authenticate or remove stale Anthropic env overrides from the backend process.',
  });
  expect(result.detail).not.toContain('api_retry');
  expect(result.rawTail).toContain('authentication_failed');
});

test('D4 classifies CLI MCP auth stderr as degraded tool health even when process exits cleanly', () => {
  const health = classifyRuntimeMcpToolHealthFromEvent({
    runtime: 'codex',
    event: 'codex.stderr',
    data: {
      chunk:
        'rmcp::transport::worker: server fetch failed: Auth(AuthorizationRequired) for project MCP',
    },
    targetCapabilities: {
      targetKind: 'cli',
      runtimeKind: 'codex',
      imageInputMode: 'cli-native',
      imageDeliveryMode: 'cli_native_arg',
      rasterImageInput: true,
      svgSourceInput: true,
      nativeFileInput: true,
      projectMcpTools: false,
      ownMcpConfig: true,
    },
  });

  expect(health).toEqual({
    runtime: 'codex',
    status: 'auth_failed',
    source: 'stderr',
    event: 'codex.stderr',
    mcpServer: 'project MCP',
    mcpTool: null,
    detail: 'Project MCP authentication failed for project MCP.',
  });
});

test('D4 extracts MCP server and tool from runtime auth failures when present', () => {
  const health = classifyRuntimeMcpToolHealthFromEvent({
    runtime: 'codex',
    event: 'codex.stderr',
    data: {
      chunk:
        'ERROR rmcp::transport::worker: server="pixso-desktop" tool="get_image" failed: Auth(AuthorizationRequired)',
    },
    targetCapabilities: {
      targetKind: 'cli',
      runtimeKind: 'codex',
      imageInputMode: 'cli-native',
      imageDeliveryMode: 'cli_native_arg',
      rasterImageInput: true,
      svgSourceInput: true,
      nativeFileInput: true,
      projectMcpTools: false,
      ownMcpConfig: true,
    },
  });

  expect(health).toMatchObject({
    runtime: 'codex',
    status: 'auth_failed',
    source: 'stderr',
    event: 'codex.stderr',
    mcpServer: 'pixso-desktop',
    mcpTool: 'get_image',
    detail: 'Project MCP authentication failed for pixso-desktop.get_image.',
  });
});

test('D4 names expected MCP target when runtime auth stderr is anonymous', () => {
  const health = classifyRuntimeMcpToolHealthFromEvent({
    runtime: 'codex',
    event: 'codex.stderr',
    data: {
      chunk: 'rmcp::transport::worker: server fetch failed: Auth(AuthorizationRequired)',
    },
    targetCapabilities: {
      targetKind: 'cli',
      runtimeKind: 'codex',
      imageInputMode: 'cli-native',
      imageDeliveryMode: 'cli_native_arg',
      rasterImageInput: true,
      svgSourceInput: true,
      nativeFileInput: true,
      projectMcpTools: false,
      ownMcpConfig: true,
      mcpExpectedTargets: [
        {
          server: 'pixso-desktop',
          transport: 'streamable-http',
          tools: ['get_image'],
          configPath: 'sber-designer.json#mcpServers.pixso-desktop',
        },
      ],
    },
  });

  expect(health).toMatchObject({
    runtime: 'codex',
    status: 'auth_failed',
    source: 'stderr',
    event: 'codex.stderr',
    mcpServer: 'pixso-desktop',
    mcpTool: null,
    expectedTargets: [
      {
        server: 'pixso-desktop',
        transport: 'streamable-http',
        tools: ['get_image'],
        configPath: 'sber-designer.json#mcpServers.pixso-desktop',
      },
    ],
    detail:
      'Project MCP authentication failed for expected target pixso-desktop; runtime stderr did not name a server or tool.',
  });
});

test('verified managed MCP forwarding survives unrelated anonymous auth stderr', () => {
  const verified = {
    runtime: 'codex',
    status: 'forwarded_verified' as const,
    source: 'runtime-event' as const,
    event: 'runtime.mcp_injection',
    mcpServer: 'sber-designer',
    mcpTool: null,
    detail: 'Project MCP server "sber-designer" is visible in Codex CLI MCP list (enabled).',
  };
  const anonymousAuthFailure = {
    runtime: 'codex',
    status: 'auth_failed' as const,
    source: 'stderr' as const,
    event: 'codex.exit',
    mcpServer: 'pixso-desktop',
    mcpTool: null,
    detail:
      'Project MCP authentication failed for expected target pixso-desktop; runtime stderr did not name a server or tool.',
  };

  expect(mergeRuntimeMcpToolHealth(verified, anonymousAuthFailure)).toBe(verified);
});

test('D10 reports runtime MCP injection as forwarded but not yet verified', () => {
  const health = classifyRuntimeMcpToolHealthFromEvent({
    runtime: 'claude-code',
    event: 'runtime.mcp_injection',
    data: {
      status: 'applied',
      mode: 'claude-mcp-json',
      serverName: 'sber-designer',
      detail: 'Injected project MCP server "sber-designer" into workspace .mcp.json.',
    },
    targetCapabilities: {
      targetKind: 'cli',
      runtimeKind: 'claude-code',
      imageInputMode: 'none',
      rasterImageInput: false,
      svgSourceInput: true,
      nativeFileInput: false,
      projectMcpTools: false,
      ownMcpConfig: true,
    },
  });

  expect(health).toMatchObject({
    runtime: 'claude-code',
    status: 'forwarded_unverified',
    source: 'runtime-event',
    event: 'runtime.mcp_injection',
    mcpServer: 'sber-designer',
  });
});

test('D10 upgrades MCP health after a successful expected Claude project tool result', () => {
  const health = classifyRuntimeMcpToolHealthFromEvent({
    runtime: 'claude-code',
    event: 'runtime.mcp_tool_result',
    data: {
      serverName: 'sber-designer',
      toolName: 'get_project_index_status',
      success: true,
    },
    targetCapabilities: {
      targetKind: 'cli',
      runtimeKind: 'claude-code',
      imageInputMode: 'cli-files-warning',
      imageDeliveryMode: 'prompt_path',
      rasterImageInput: false,
      svgSourceInput: true,
      nativeFileInput: false,
      projectMcpTools: true,
      ownMcpConfig: true,
      mcpExpectedTargets: [
        {
          server: 'sber-designer',
          transport: 'stdio',
          configPath: '.mcp.json#mcpServers.sber-designer',
        },
      ],
    },
  });

  expect(health).toEqual({
    runtime: 'claude-code',
    status: 'forwarded_verified',
    source: 'runtime-event',
    event: 'runtime.mcp_tool_result',
    mcpServer: 'sber-designer',
    mcpTool: 'get_project_index_status',
    expectedTargets: [
      {
        server: 'sber-designer',
        transport: 'stdio',
        configPath: '.mcp.json#mcpServers.sber-designer',
      },
    ],
    detail:
      'Project MCP forwarding was verified by a successful sber-designer.get_project_index_status tool result.',
  });
});

test('L11 classifies OpenCode legacy MCP env config as config_invalid', () => {
  const health = classifyRuntimeMcpToolHealthFromEvent({
    runtime: 'opencode',
    event: 'runtime.mcp_injection',
    data: {
      status: 'failed',
      mode: 'opencode-env-content',
      detail:
        'runtime_config_invalid: OPENCODE_CONFIG_CONTENT contains unsupported legacy key "mcpServers"; use OPENCODE_CONFIG_CONTENT#mcp.<name>.',
    },
    targetCapabilities: {
      targetKind: 'cli',
      runtimeKind: 'opencode',
      imageInputMode: 'none',
      rasterImageInput: false,
      svgSourceInput: true,
      nativeFileInput: false,
      projectMcpTools: false,
      ownMcpConfig: true,
    },
  });

  expect(health).toMatchObject({
    runtime: 'opencode',
    status: 'config_invalid',
    source: 'runtime-event',
    event: 'runtime.mcp_injection',
    detail:
      'runtime_config_invalid: OPENCODE_CONFIG_CONTENT contains unsupported legacy key "mcpServers"; use OPENCODE_CONFIG_CONTENT#mcp.<name>.',
  });
});

test('L11 formats config-invalid MCP health with OpenCode mcp target path', () => {
  const notice = formatRuntimeMcpHealthNotice({
    health: {
      runtime: 'opencode',
      status: 'config_invalid',
      source: 'runtime-event',
      event: 'runtime.mcp_injection',
      mcpServer: 'sber-designer',
      mcpTool: null,
      expectedTargets: [
        {
          server: 'sber-designer',
          transport: 'stdio',
          configPath: 'OPENCODE_CONFIG_CONTENT#mcp.sber-designer',
        },
      ],
      detail:
        'runtime_config_invalid: OPENCODE_CONFIG_CONTENT contains unsupported legacy key "mcpServers"; use OPENCODE_CONFIG_CONTENT#mcp.<name>.',
    },
    runManifestPath: '.sber-designer/runs/run-123/run-manifest.json',
  });

  expect(notice).toContain('sber-designer: Project MCP configuration is invalid.');
  expect(notice).toContain('Runtime: opencode.');
  expect(notice).toContain('OPENCODE_CONFIG_CONTENT#mcp.sber-designer');
  expect(notice).toContain('runtime_config_invalid');
});

test('D4 formats MCP health warnings with target and evidence pointers', () => {
  const notice = formatRuntimeMcpHealthNotice({
    health: {
      runtime: 'codex',
      status: 'auth_failed',
      source: 'stderr',
      event: 'codex.stderr',
      mcpServer: null,
      mcpTool: null,
      detail: 'Project MCP authentication failed; runtime stderr did not name a server or tool.',
    },
    runManifestPath: '.sber-designer/runs/run-123/run-manifest.json',
  });

  expect(notice).toContain('sber-designer: Project MCP tools were unavailable.');
  expect(notice).toContain('Runtime: codex.');
  expect(notice).toContain('MCP target: unknown');
  expect(notice).toContain('.sber-designer/runs/run-123/run-manifest.json');
  expect(notice).toContain('.sber-designer/runs/run-123/external-runtime/events.jsonl');
  expect(notice).not.toContain('Auth(AuthorizationRequired)');
});

test('D4 formats MCP health warnings with expected target config paths', () => {
  const notice = formatRuntimeMcpHealthNotice({
    health: {
      runtime: 'codex',
      status: 'auth_failed',
      source: 'stderr',
      event: 'codex.stderr',
      mcpServer: 'pixso-desktop',
      mcpTool: null,
      expectedTargets: [
        {
          server: 'pixso-desktop',
          transport: 'streamable-http',
          tools: ['get_image'],
          configPath: 'sber-designer.json#mcpServers.pixso-desktop',
        },
      ],
      detail:
        'Project MCP authentication failed for expected target pixso-desktop; runtime stderr did not name a server or tool.',
    },
    runManifestPath: '.sber-designer/runs/run-123/run-manifest.json',
  });

  expect(notice).toContain('MCP target: pixso-desktop');
  expect(notice).toContain('Expected targets: pixso-desktop');
  expect(notice).toContain('streamable-http');
  expect(notice).toContain('sber-designer.json#mcpServers.pixso-desktop');
  expect(notice).toContain('diagnostics.runtimeMcp');
});

test('external runtime adapter input only passes image paths to supported runtimes', () => {
  const dispatch = externalRuntimeDispatchForProvider(OPENCODE_RUNTIME_PROVIDER);
  if (!dispatch) throw new Error('missing opencode dispatch');

  const input = buildExternalRuntimeAdapterRunInput({
    dispatch,
    command: '/usr/local/bin/opencode',
    model: 'default',
    cwd: '/work/project',
    prompt: 'Generate the active screen.',
    promptAttachments: [attachment],
    onRuntimeStdoutNoise: () => undefined,
  });

  expect(input.imagePaths).toBeUndefined();
  expect(input.onRuntimeEvent).toBeUndefined();
});
