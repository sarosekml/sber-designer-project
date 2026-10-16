import { publish } from './event-bus';
import { patchState } from './state-store';

const RELOAD_PATH_PATTERNS = [
  /\.stories\.[jt]sx?$/i,
  /^\.storybook\//i,
  /(^|\/)vite\.config\.[jt]s$/i,
  /(^|\/)tailwind\.config\.[jt]s$/i,
  /(^|\/)package\.json$/i,
];

export function shouldMarkStorybookReloadPending(path: string, isNewFile: boolean): boolean {
  if (isNewFile) return true;
  const normalized = path.replace(/\\/g, '/').replace(/^\.\/+/, '');
  return RELOAD_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function markStorybookReloadPendingForPath(path: string, isNewFile: boolean): void {
  if (!shouldMarkStorybookReloadPending(path, isNewFile)) return;
  patchState({ storybookReloadPending: true });
  publish({ type: 'storybook.reload-pending', path });
}

export function clearStorybookReloadPending(): void {
  patchState({ storybookReloadPending: false });
  publish({ type: 'storybook.reload-cleared' });
}
