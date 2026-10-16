import type { ComponentEntry, ProjectScreen } from '@sber-designer/shared-types';

export type EditorLocationCanvasView = 'screen' | 'storybook' | 'design-system';

export function screenDisplayPath(
  screen: Pick<ProjectScreen, 'filePath' | 'implementationFilePath' | 'kind' | 'storyId'> | null,
): string {
  if (!screen) return 'page';
  if (screen.implementationFilePath) return normalizeSeparators(screen.implementationFilePath);
  if (screen.filePath) return normalizeSeparators(screen.filePath);
  if (screen.storyId) return storyIdDisplayPath(screen.storyId);
  return screen.kind === 'story' ? 'storybook' : 'page';
}

export function componentDisplayPath(component: Pick<ComponentEntry, 'filePath'> | null): string {
  return component?.filePath ? normalizeSeparators(component.filePath) : 'storybook';
}

export function editorFooterLocation({
  canvasView,
  activeScreen,
  activeComponent,
  workspacePath,
}: {
  canvasView: EditorLocationCanvasView;
  activeScreen: Parameters<typeof screenDisplayPath>[0];
  activeComponent: Parameters<typeof componentDisplayPath>[0];
  workspacePath: string;
}): string {
  const activePath =
    canvasView === 'storybook'
      ? componentDisplayPath(activeComponent)
      : canvasView === 'design-system'
        ? 'design-system/index.html'
        : screenDisplayPath(activeScreen);

  return withWorkspacePath(activePath, workspacePath);
}

export function storyIdDisplayPath(storyId: string): string {
  const [base = '', variant] = storyId.split('--');
  if (!base) return storyId;

  const parts = base.split('-').filter(Boolean);
  if (parts.length >= 3 && parts[0] === 'screens') {
    return appendStoryVariant(`${parts[0]}/${parts[1]}/${parts.slice(2).join('-')}`, variant);
  }
  if (parts.length >= 2) {
    return appendStoryVariant(`${parts[0]}/${parts.slice(1).join('-')}`, variant);
  }
  return appendStoryVariant(base, variant);
}

function appendStoryVariant(path: string, variant: string | undefined): string {
  return variant ? `${path}--${variant}` : path;
}

function withWorkspacePath(displayPath: string, workspacePath: string): string {
  if (
    !displayPath ||
    !workspacePath ||
    isAbsolutePath(displayPath) ||
    !looksLikeSourcePath(displayPath)
  ) {
    return displayPath || workspacePath;
  }
  return `${workspacePath.replace(/\/+$/, '')}/${displayPath.replace(/^\/+/, '')}`;
}

function looksLikeSourcePath(path: string): boolean {
  return (
    path.startsWith('src/') ||
    path.startsWith('app/') ||
    path.startsWith('pages/') ||
    path.startsWith('components/') ||
    path.startsWith('design-system/') ||
    /\.[cm]?[tj]sx?$/.test(path)
  );
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path);
}

function normalizeSeparators(path: string): string {
  return path.replace(/\\/g, '/');
}
