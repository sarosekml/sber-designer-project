import type { AgentRuntimeDef } from './types';

const DEFAULT_OPENCODE_MODELS = [
  {
    runtime: 'opencode',
    id: 'default',
    provider: 'opencode',
    model: 'default',
    label: 'OpenCode · default',
  },
] satisfies AgentRuntimeDef['fallbackModels'];

const DEFAULT_KIMI_MODELS = [
  {
    runtime: 'kimi',
    id: 'kimi-k3',
    provider: 'kimi',
    model: 'kimi-k3',
    label: 'Kimi Code CLI · Kimi K3',
  },
  {
    runtime: 'kimi',
    id: 'default',
    provider: 'kimi',
    model: 'default',
    label: 'Kimi Code CLI · default',
  },
] satisfies AgentRuntimeDef['fallbackModels'];

export const OPENCODE_RUNTIME_DEF: AgentRuntimeDef = {
  kind: 'opencode',
  displayName: 'OpenCode',
  primaryBin: 'opencode-cli',
  fallbackBins: ['opencode'],
  versionArgs: ['--version'],
  helpArgs: ['--help'],
  authStatus: {
    args: ['auth', 'list'],
    timeoutMs: 5000,
    parser: 'opencode-auth-list',
  },
  listModels: {
    args: ['models'],
    timeoutMs: 8000,
    parser: 'provider-model-lines',
  },
  fallbackModels: DEFAULT_OPENCODE_MODELS,
  listMcp: {
    args: ['mcp', 'list'],
    timeoutMs: 8000,
    parser: 'table-or-lines',
  },
  promptViaStdin: true,
  promptDelivery: {
    mode: 'stdin',
    maxBytes: 200_000,
  },
  streamFormat: 'json-event-stream',
  eventParser: 'opencode',
  chatHandoff: true,
  externalDispatch: {
    provider: 'opencode-runtime',
    contextRuntimeLabel: 'OpenCode',
    promptRuntimeLabel: 'OpenCode',
    streamRuntimeLabel: 'OpenCode',
    notConnectedDetail: 'Connect OpenCode in Settings -> LLM providers before using this model.',
  },
  externalMcpInjection: {
    mode: 'opencode-env-content',
    serverName: 'sber-designer',
  },
  attachmentCapabilities: {
    imageInputMode: 'cli-files-warning',
    imageDeliveryMode: 'none',
    rasterImageInput: false,
    svgSourceInput: true,
    nativeFileInput: false,
  },
};

const DEFAULT_CLAUDE_MODELS = [
  {
    runtime: 'claude-code',
    id: 'default',
    provider: 'claude-code',
    model: 'default',
    label: 'Claude Code · default',
  },
  {
    runtime: 'claude-code',
    id: 'sonnet',
    provider: 'claude-code',
    model: 'sonnet',
    label: 'Claude Code · Sonnet (alias)',
  },
  {
    runtime: 'claude-code',
    id: 'opus',
    provider: 'claude-code',
    model: 'opus',
    label: 'Claude Code · Opus (alias)',
  },
  {
    runtime: 'claude-code',
    id: 'haiku',
    provider: 'claude-code',
    model: 'haiku',
    label: 'Claude Code · Haiku (alias)',
  },
  {
    runtime: 'claude-code',
    id: 'claude-opus-4-5',
    provider: 'claude-code',
    model: 'claude-opus-4-5',
    label: 'Claude Code · claude-opus-4-5',
  },
  {
    runtime: 'claude-code',
    id: 'claude-sonnet-4-5',
    provider: 'claude-code',
    model: 'claude-sonnet-4-5',
    label: 'Claude Code · claude-sonnet-4-5',
  },
  {
    runtime: 'claude-code',
    id: 'claude-haiku-4-5',
    provider: 'claude-code',
    model: 'claude-haiku-4-5',
    label: 'Claude Code · claude-haiku-4-5',
  },
] satisfies AgentRuntimeDef['fallbackModels'];

const DEFAULT_CODEX_MODELS = [
  {
    runtime: 'codex',
    id: 'default',
    provider: 'codex',
    model: 'default',
    label: 'Codex CLI · default',
  },
  {
    runtime: 'codex',
    id: 'gpt-5.5',
    provider: 'codex',
    model: 'gpt-5.5',
    label: 'Codex CLI · gpt-5.5',
  },
  {
    runtime: 'codex',
    id: 'gpt-5.4',
    provider: 'codex',
    model: 'gpt-5.4',
    label: 'Codex CLI · gpt-5.4',
  },
  {
    runtime: 'codex',
    id: 'gpt-5.4-mini',
    provider: 'codex',
    model: 'gpt-5.4-mini',
    label: 'Codex CLI · gpt-5.4-mini',
  },
  {
    runtime: 'codex',
    id: 'gpt-5.3-codex',
    provider: 'codex',
    model: 'gpt-5.3-codex',
    label: 'Codex CLI · gpt-5.3-codex',
  },
  {
    runtime: 'codex',
    id: 'gpt-5.1',
    provider: 'codex',
    model: 'gpt-5.1',
    label: 'Codex CLI · gpt-5.1',
  },
  {
    runtime: 'codex',
    id: 'gpt-5.1-codex-mini',
    provider: 'codex',
    model: 'gpt-5.1-codex-mini',
    label: 'Codex CLI · gpt-5.1-codex-mini',
  },
  {
    runtime: 'codex',
    id: 'gpt-5-codex',
    provider: 'codex',
    model: 'gpt-5-codex',
    label: 'Codex CLI · gpt-5-codex',
  },
  {
    runtime: 'codex',
    id: 'gpt-5',
    provider: 'codex',
    model: 'gpt-5',
    label: 'Codex CLI · gpt-5',
  },
  {
    runtime: 'codex',
    id: 'o3',
    provider: 'codex',
    model: 'o3',
    label: 'Codex CLI · o3',
  },
  {
    runtime: 'codex',
    id: 'o4-mini',
    provider: 'codex',
    model: 'o4-mini',
    label: 'Codex CLI · o4-mini',
  },
] satisfies AgentRuntimeDef['fallbackModels'];

export const CLAUDE_CODE_RUNTIME_DEF: AgentRuntimeDef = {
  kind: 'claude-code',
  displayName: 'Claude Code',
  primaryBin: 'claude',
  fallbackBins: [],
  versionArgs: ['--version'],
  versionFallbackArgs: [['-v']],
  versionProbeTimeoutMs: 5000,
  helpArgs: ['--help'],
  helpCapabilityFlags: {
    includePartialMessages: ['--include-partial-messages'],
    sessionId: ['--session-id'],
    sessionResume: ['--resume'],
  },
  authStatus: {
    args: ['auth', 'status'],
    timeoutMs: 5000,
    parser: 'claude-auth-status',
  },
  fallbackModels: DEFAULT_CLAUDE_MODELS,
  listMcp: {
    args: ['mcp', 'list'],
    timeoutMs: 12_000,
    parser: 'table-or-lines',
  },
  promptViaStdin: true,
  promptDelivery: {
    mode: 'stdin',
    maxBytes: 200_000,
  },
  streamFormat: 'stream-json',
  eventParser: 'claude-code',
  chatHandoff: true,
  externalDispatch: {
    provider: 'claude-code-runtime',
    contextRuntimeLabel: 'Claude Code CLI',
    promptRuntimeLabel: 'Claude Code CLI',
    streamRuntimeLabel: 'Claude Code CLI',
    notConnectedDetail:
      'Connect Claude Code CLI in Settings -> LLM providers before using this model.',
  },
  externalMcpInjection: {
    mode: 'claude-mcp-json',
    serverName: 'sber-designer',
  },
  session: {
    style: 'specify',
    newArgs: (sessionId) => ['--session-id', sessionId],
    resumeArgs: (sessionId) => ['--resume', sessionId],
  },
  attachmentCapabilities: {
    imageInputMode: 'cli-files-warning',
    imageDeliveryMode: 'prompt_path',
    rasterImageInput: false,
    svgSourceInput: true,
    nativeFileInput: false,
  },
};

export const CODEX_RUNTIME_DEF: AgentRuntimeDef = {
  kind: 'codex',
  displayName: 'Codex CLI',
  primaryBin: 'codex',
  fallbackBins: [],
  versionArgs: ['--version'],
  versionProbeTimeoutMs: 5000,
  helpArgs: ['exec', '--help'],
  helpCapabilityFlags: {
    execResume: ['resume a previous session by id', 'resume [SESSION_ID]', 'resume <SESSION_ID>'],
  },
  authStatus: {
    args: ['login', 'status'],
    timeoutMs: 5000,
    parser: 'codex-login-status',
  },
  listModels: {
    args: ['debug', 'models'],
    timeoutMs: 8000,
    parser: 'codex-debug-models',
  },
  fallbackModels: DEFAULT_CODEX_MODELS,
  listMcp: {
    args: ['mcp', 'list'],
    timeoutMs: 8000,
    parser: 'table-or-lines',
  },
  promptViaStdin: true,
  promptDelivery: {
    mode: 'stdin',
    maxBytes: 200_000,
  },
  streamFormat: 'jsonl',
  eventParser: 'codex',
  chatHandoff: false,
  externalDispatch: {
    provider: 'codex-runtime',
    contextRuntimeLabel: 'Codex CLI',
    promptRuntimeLabel: 'Codex CLI',
    streamRuntimeLabel: 'Codex',
    notConnectedDetail: 'Connect Codex CLI in Settings -> LLM providers before using this model.',
    smokeCheck: 'codex',
  },
  externalMcpInjection: {
    mode: 'codex-config-args',
    serverName: 'sber-designer',
  },
  session: {
    style: 'capture',
    captureEvent: 'thread.started',
    newArgs: () => [],
    resumeArgs: (sessionId) => ['resume', sessionId],
  },
  attachmentCapabilities: {
    imageInputMode: 'cli-native',
    imageDeliveryMode: 'cli_native_arg',
    rasterImageInput: true,
    svgSourceInput: true,
    nativeFileInput: true,
  },
};

export const KIMI_RUNTIME_DEF: AgentRuntimeDef = {
  kind: 'kimi',
  displayName: 'Kimi Code CLI',
  primaryBin: 'kimi',
  fallbackBins: [],
  versionArgs: ['--version'],
  versionProbeTimeoutMs: 5000,
  helpArgs: ['--help'],
  helpCapabilityFlags: {
    sessionResume: ['--session'],
  },
  authStatus: {
    args: ['doctor', 'config'],
    timeoutMs: 5000,
    parser: 'kimi-doctor',
  },
  fallbackModels: DEFAULT_KIMI_MODELS,
  promptViaStdin: false,
  promptDelivery: {
    mode: 'argv',
    maxBytes: 200_000,
  },
  streamFormat: 'stream-json',
  eventParser: 'kimi',
  chatHandoff: true,
  externalDispatch: {
    provider: 'kimi-runtime',
    contextRuntimeLabel: 'Kimi Code CLI',
    promptRuntimeLabel: 'Kimi Code CLI',
    streamRuntimeLabel: 'Kimi Code',
    notConnectedDetail:
      'Connect Kimi Code CLI in Settings -> LLM providers before using this model.',
  },
  session: {
    style: 'capture',
    captureEvent: 'session.resume_hint',
    newArgs: () => [],
    resumeArgs: (sessionId) => ['--session', sessionId],
  },
  attachmentCapabilities: {
    imageInputMode: 'cli-files-warning',
    imageDeliveryMode: 'prompt_path',
    rasterImageInput: false,
    svgSourceInput: true,
    nativeFileInput: false,
  },
};

/**
 * GigaCode CLI is a closed fork of Qwen Code (0131 §2.2): the stream-json frame
 * is Claude-shaped, but tool traffic arrives as `{type:'message',action:…}`, so
 * it needs its own parser. There is no `models` subcommand. Current builds expose
 * their model catalogue in the sanitized local state reader; `default` remains a
 * compatibility fallback for older builds whose auth output is authoritative.
 */
const DEFAULT_GIGACODE_MODELS = [
  {
    runtime: 'gigacode',
    id: 'default',
    provider: 'gigacode',
    model: 'default',
    label: 'GigaCode · default',
  },
] satisfies AgentRuntimeDef['fallbackModels'];

export const GIGACODE_RUNTIME_DEF: AgentRuntimeDef = {
  kind: 'gigacode',
  displayName: 'GigaCode',
  primaryBin: 'gigacode',
  fallbackBins: [],
  versionArgs: ['--version'],
  versionProbeTimeoutMs: 5000,
  helpArgs: ['--help'],
  helpCapabilityFlags: {
    includePartialMessages: ['--include-partial-messages'],
    sessionId: ['--session-id'],
    sessionResume: ['--resume'],
  },
  authStatus: {
    args: ['auth', 'status'],
    timeoutMs: 5000,
    parser: 'gigacode-auth-status',
  },
  fallbackModels: DEFAULT_GIGACODE_MODELS,
  listMcp: {
    args: ['mcp', 'list'],
    timeoutMs: 8000,
    parser: 'table-or-lines',
  },
  promptViaStdin: true,
  promptDelivery: {
    mode: 'stdin',
    maxBytes: 200_000,
  },
  streamFormat: 'stream-json',
  eventParser: 'gigacode',
  chatHandoff: true,
  externalDispatch: {
    provider: 'gigacode-runtime',
    contextRuntimeLabel: 'GigaCode CLI',
    promptRuntimeLabel: 'GigaCode CLI',
    streamRuntimeLabel: 'GigaCode',
    notConnectedDetail:
      'Connect GigaCode CLI in Settings -> LLM providers before using this model.',
  },
  session: {
    // system.init always reports the CLI-owned session id. Capture it instead
    // of assuming that every installed GigaCode build accepts an arbitrary
    // caller-generated --session-id, then use the documented --resume path.
    style: 'capture',
    captureEvent: 'runtime.session',
    newArgs: () => [],
    resumeArgs: (sessionId) => ['--resume', sessionId],
  },
  attachmentCapabilities: {
    imageInputMode: 'cli-files-warning',
    imageDeliveryMode: 'prompt_path',
    rasterImageInput: false,
    svgSourceInput: true,
    nativeFileInput: false,
  },
};

export const AGENT_RUNTIME_DEFS = [
  OPENCODE_RUNTIME_DEF,
  CLAUDE_CODE_RUNTIME_DEF,
  CODEX_RUNTIME_DEF,
  KIMI_RUNTIME_DEF,
  GIGACODE_RUNTIME_DEF,
] as const;

export function getAgentRuntimeDef(kind: string): AgentRuntimeDef | null {
  return AGENT_RUNTIME_DEFS.find((def) => def.kind === kind) ?? null;
}
