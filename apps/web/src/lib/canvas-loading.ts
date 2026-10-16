import type { SandboxSessionInfo } from '@/stores/sandbox-store';

export function shouldRenderCanvasIframe(
  status: SandboxSessionInfo['status'] | null | undefined,
): boolean {
  return status === null || status === undefined || status === 'ready';
}
