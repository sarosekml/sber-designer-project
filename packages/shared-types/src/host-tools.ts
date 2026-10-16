export const HOST_APP_IDS = [
  'cursor',
  'vscode',
  'windsurf',
  'zed',
  'qoder',
  'antigravity',
  'webstorm',
  'idea',
  'xcode',
  'finder',
  'explorer',
  'file-manager',
  'terminal',
  'warp',
] as const;

export type HostAppId = (typeof HOST_APP_IDS)[number];
export type HostAppKind = 'editor' | 'file-manager' | 'terminal';
export type HostPlatform = 'darwin' | 'win32' | 'linux';

export interface HostApp {
  id: HostAppId;
  label: string;
  kind: HostAppKind;
  available: boolean;
  resolvedPath?: string;
}

export interface HostAppsResponse {
  platform: HostPlatform | 'unknown';
  apps: HostApp[];
}

export interface OpenInHostAppRequest {
  appId: HostAppId;
}

export interface OpenInHostAppResponse {
  ok: true;
  appId: HostAppId;
  path: string;
}
