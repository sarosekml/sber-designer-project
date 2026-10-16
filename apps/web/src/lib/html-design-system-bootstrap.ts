import type { HtmlDesignSystemStatus } from '@sber-designer/shared-types';

type CanvasView = 'screen' | 'storybook' | 'design-system';

export function shouldShowDesignSystemBootstrap(
  canvasView: CanvasView,
  status: HtmlDesignSystemStatus | null,
): boolean {
  return canvasView === 'design-system' && (status === 'missing' || status === 'bootstrap');
}
