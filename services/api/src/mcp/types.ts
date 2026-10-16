import type { SberDesignerConfig } from '@sber-designer/llm-gateway';
import type { ProjectMcpToolOverride, ProjectMcpToolSelection } from '@sber-designer/shared-types';

export type McpServerEntry = SberDesignerConfig['mcpServers'][string];

export type NormalizedMcpTransport = 'stdio' | 'streamable-http';

export type McpTransportStatus =
  | 'disabled'
  | 'not_connected'
  | 'connecting'
  | 'connected'
  | 'failed';

export type McpUpstreamStatus =
  | 'n/a'
  | 'needs_channel'
  | 'plugin_offline'
  | 'plugin_unreachable'
  | 'ready';

export type McpDiagnosticLevel = 'info' | 'warning' | 'error';
export type McpToolSelectionMode = 'auto' | 'explicit';

export interface McpDiagnostic {
  level: McpDiagnosticLevel;
  code: string;
  message: string;
}

export interface ProductMcpRuntimeTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface ProductMcpRuntimeServerInfo {
  name?: string;
  version?: string;
  instructions?: string;
}

export interface NormalizedMcpServer {
  key: string;
  namespace: string;
  transport: NormalizedMcpTransport;
  /** Effective enabled state: config enabled and matching runtime override enabled. */
  enabled: boolean;
  configEnabled: boolean;
  runtimeEnabled: boolean;
  description?: string;
  entry: McpServerEntry;
  configHash: string;
  toolOverrides?: Record<string, ProjectMcpToolOverride>;
  toolSelection?: ProjectMcpToolSelection;
}

export interface McpSecurityOptions {
  workspaceRoot?: string | null;
  allowedFilesystemRoots?: string[];
  allowedRemoteHosts?: string[];
  allowedCommands?: string[];
  /** Injected in tests and by callers that already resolved the policy. */
  policy?: import('./security').McpPolicy;
}

export interface McpToolSummary {
  name: string;
  displayName?: string;
  description?: string;
  enabled: boolean;
  configuredDisabled?: boolean;
  runtimeDisabled?: boolean;
  hiddenByLimit?: boolean;
  blockedBySelectionLimit?: boolean;
  blockedBySelectionMinimum?: boolean;
  canToggle?: boolean;
  canonicalName?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpFrontendServerSummary {
  key: string;
  namespace: string;
  transport: NormalizedMcpTransport;
  enabled: boolean;
  configEnabled: boolean;
  runtimeEnabled: boolean;
  remote: boolean;
  description?: string;
  serverInfo?: ProductMcpRuntimeServerInfo;
  configHash: string;
  status: {
    transport: McpTransportStatus;
    upstream: McpUpstreamStatus;
    toolsReady: boolean;
    lastConnectedAt?: string;
    lastError?: string;
  };
  toolCount: number;
  selectionMode: McpToolSelectionMode;
  selectionLimit: number;
  selectedToolCount: number;
  discoveredToolCount: number;
  tools: McpToolSummary[];
  config: Record<string, unknown>;
  diagnostics: McpDiagnostic[];
}

export interface McpFrontendSummary {
  servers: McpFrontendServerSummary[];
  diagnostics: McpDiagnostic[];
}
