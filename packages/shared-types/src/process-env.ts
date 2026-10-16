/** Minimal host/toolchain environment shared by spawned processes. */
const PROCESS_ENV_ALLOWLIST = [
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'TZ',
  'TMPDIR',
  'TEMP',
  'TMP',
  'SystemRoot',
  'COMSPEC',
  'PATHEXT',
  'APPDATA',
  'LOCALAPPDATA',
  'USERPROFILE',
  'NODE_ENV',
  'NODE_OPTIONS',
  'NODE_PATH',
  'NVM_DIR',
  'BUN_INSTALL',
  'XDG_CACHE_HOME',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
  'COREPACK_HOME',
  'npm_config_registry',
  'npm_config_cache',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  'no_proxy',
] as const;

export function processEnvironment(
  parent: Record<string, string | undefined>,
  additionalNames: readonly string[] = [],
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of [...PROCESS_ENV_ALLOWLIST, ...additionalNames]) {
    const value = parent[key];
    if (value !== undefined) result[key] = value;
  }
  return result;
}
