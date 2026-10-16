export type AgentRuntimeKind = 'opencode' | 'claude-code' | 'codex' | 'kimi' | 'gigacode';

export type AgentRuntimeAuthParser =
  | 'opencode-auth-list'
  | 'claude-auth-status'
  | 'codex-login-status'
  | 'kimi-doctor'
  | 'gigacode-auth-status';

export type AgentRuntimeModelParser = 'provider-model-lines' | 'codex-debug-models';

export type AgentRuntimeMcpParser = 'table-or-lines';

export type AgentRuntimePromptDeliveryMode = 'stdin' | 'file' | 'argv';

export interface AgentRuntimePromptDelivery {
  mode: AgentRuntimePromptDeliveryMode;
  maxBytes: number;
}

export type AgentRuntimeHelpCapabilityFlag =
  | 'includePartialMessages'
  | 'sessionId'
  | 'sessionResume'
  | 'execResume';

export type AgentRuntimeSessionStyle = 'specify' | 'capture';

export interface AgentRuntimeSessionDef {
  style: AgentRuntimeSessionStyle;
  captureEvent?: string;
  newArgs(sessionId: string): string[];
  resumeArgs(sessionId: string): string[];
}

export interface AgentRuntimeRunSession {
  mode: 'new' | 'resume';
  sessionId?: string;
  usageBaseline?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    costUsd?: number;
  };
}

export type AgentRuntimeExternalSmokeCheck = 'codex';

export interface AgentRuntimeExternalDispatchDef {
  provider: string;
  contextRuntimeLabel?: string;
  promptRuntimeLabel?: string;
  streamRuntimeLabel?: string;
  notConnectedDetail?: string;
  smokeCheck?: AgentRuntimeExternalSmokeCheck;
}

export type AgentRuntimeExternalMcpInjectionMode =
  | 'claude-mcp-json'
  | 'opencode-env-content'
  | 'codex-config-args';

export interface AgentRuntimeExternalMcpInjectionDef {
  mode: AgentRuntimeExternalMcpInjectionMode;
  serverName?: string;
}

export interface AgentRuntimeDef {
  kind: AgentRuntimeKind;
  displayName: string;
  primaryBin: string;
  fallbackBins: string[];
  versionArgs: string[];
  versionFallbackArgs?: string[][];
  versionProbeTimeoutMs?: number;
  helpArgs?: string[];
  helpCapabilityFlags?: Partial<Record<AgentRuntimeHelpCapabilityFlag, string[]>>;
  authStatus?: {
    args: string[];
    timeoutMs: number;
    parser: AgentRuntimeAuthParser;
  };
  listModels?: {
    args: string[];
    timeoutMs: number;
    parser: AgentRuntimeModelParser;
  };
  fallbackModels?: AgentRuntimeModel[];
  listMcp?: {
    args: string[];
    timeoutMs: number;
    parser: AgentRuntimeMcpParser;
  };
  promptViaStdin: boolean;
  promptDelivery?: AgentRuntimePromptDelivery;
  streamFormat: 'json-event-stream' | 'stream-json' | 'jsonl';
  eventParser: 'opencode' | 'claude-code' | 'codex' | 'kimi' | 'gigacode';
  chatHandoff: boolean;
  session?: AgentRuntimeSessionDef;
  externalDispatch?: AgentRuntimeExternalDispatchDef;
  externalMcpInjection?: AgentRuntimeExternalMcpInjectionDef;
  attachmentCapabilities: AgentRuntimeAttachmentCapabilities;
}

export type AgentRuntimeImageInputMode = 'cli-native' | 'cli-files-warning' | 'none';
export type AgentRuntimeImageDeliveryMode =
  | 'none'
  | 'prompt_path'
  | 'cli_native_arg'
  | 'cli_native_file'
  | 'mcp_resource';

export interface AgentRuntimeAttachmentCapabilities {
  imageInputMode: AgentRuntimeImageInputMode;
  imageDeliveryMode: AgentRuntimeImageDeliveryMode;
  rasterImageInput: boolean;
  svgSourceInput: boolean;
  nativeFileInput: boolean;
}

export interface AgentRuntimeModel {
  runtime: AgentRuntimeKind;
  id: string;
  provider: string;
  model: string;
  label: string;
  description?: string;
  contextWindowSize?: number;
}

export interface RuntimeDiagnostic {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  phase?: 'auth' | 'models' | 'mcp' | 'version' | 'help' | 'run';
  retryHint?: 'login' | 'reduce_prompt' | 'retry_later' | 'check_config' | 'reinstall_cli' | 'none';
  terminal?: boolean;
}

export interface AgentRuntimeMcpServer {
  runtime: AgentRuntimeKind;
  name: string;
  status: 'enabled' | 'disabled' | 'connected' | 'failed' | 'unknown';
  transport: 'stdio' | 'http' | 'unknown';
  detail?: string;
}

export type RuntimeLaunchSource = 'profile' | 'env' | 'path';

export interface AgentRuntimeLaunchStatus {
  command: string;
  selectedBin: string;
  launchPath?: string;
  source?: RuntimeLaunchSource;
  probeCwd?: string | null;
}

export interface AgentRuntimeStatus {
  kind: AgentRuntimeKind;
  displayName: string;
  installed: boolean;
  connected: boolean;
  command: string | null;
  version: string | null;
  launch?: AgentRuntimeLaunchStatus | undefined;
  selectedModel?: string;
  auth: {
    status: 'unknown' | 'none' | 'ready' | 'failed';
    providers: string[];
    message?: string;
    action?: 'sign-in';
  };
  models: AgentRuntimeModel[];
  mcpServers: AgentRuntimeMcpServer[];
  capabilities: {
    modelList: boolean;
    mcpList: boolean;
    runJson: boolean;
    modelFlag: boolean;
    promptViaStdin: boolean;
    jsonEventStream: boolean;
    cancel: boolean;
    usesOwnMcpConfig: boolean;
    supportsProjectMcpHandoff: boolean;
    chatHandoff: boolean;
    includePartialMessages: boolean;
    sessionSpecify: boolean;
    sessionResume: boolean;
    sessionCapture: boolean;
    imageInputMode: AgentRuntimeImageInputMode;
    imageDeliveryMode: AgentRuntimeImageDeliveryMode;
    rasterImageInput: boolean;
    svgSourceInput: boolean;
    nativeFileInput: boolean;
  };
  diagnostics: RuntimeDiagnostic[];
}

export interface ResolvedRuntimeCommand {
  command: string;
  selectedBin: string;
  launchPath?: string;
  source?: RuntimeLaunchSource;
  diagnostics?: RuntimeDiagnostic[];
}

export interface RuntimeCommandResult {
  stdout: string;
  stderr: string;
}
