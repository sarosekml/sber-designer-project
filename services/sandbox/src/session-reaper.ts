/**
 * One live sandbox session per workspace (task 9999 LIVE-3).
 *
 * The controller kept every session it ever started in its in-memory map and
 * never reaped them, so re-opening a project piled up zombie Storybook
 * instances on stale ports — observed live: 9 "ready" sessions, most serving
 * `index.json` 500 or stuck in a Webpack HMR 404 loop. The editor could then
 * bind `canvasUrl` to a dead one → blank canvas.
 *
 * When a new session is created for a workspace, prior sessions for that exact
 * workspace are stale and must be stopped. Pure (no I/O) so the controller can
 * unit-test the selection without spawning processes.
 */
export function idsToReapForWorkspace(
  entries: ReadonlyArray<{ id: string; workspacePath: string }>,
  workspacePath: string,
): string[] {
  return entries.filter((entry) => entry.workspacePath === workspacePath).map((entry) => entry.id);
}

/** Terminal sessions no longer consume the live-session capacity budget. */
export function idsToReapBeforeCapacity(
  entries: ReadonlyArray<{ id: string; status: string }>,
): string[] {
  return entries
    .filter((entry) => entry.status === 'failed' || entry.status === 'stopped')
    .map((entry) => entry.id);
}
