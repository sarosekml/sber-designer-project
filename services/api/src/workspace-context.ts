import { AsyncLocalStorage } from 'node:async_hooks';

interface WorkspaceRequestContext {
  /** `null` deliberately suppresses fallback to another request's active workspace. */
  workspacePath: string | null;
}

const requestWorkspace = new AsyncLocalStorage<WorkspaceRequestContext>();

export function requestWorkspacePath(): string | null | undefined {
  return requestWorkspace.getStore()?.workspacePath;
}

export function runWithRequestWorkspace<T>(workspacePath: string | null, callback: () => T): T {
  return requestWorkspace.run({ workspacePath }, callback);
}
