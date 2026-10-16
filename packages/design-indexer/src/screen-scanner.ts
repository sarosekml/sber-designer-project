import {
  isHtmlDesignSystemPath,
  type ComponentCatalog,
  type ProjectScreen,
} from '@sber-designer/shared-types';
import type { RouteRecord, ScreenIndexRecord } from './types';

export function buildScreenIndex(input: {
  routes: readonly RouteRecord[];
  catalog: ComponentCatalog | null;
  projectScreens?: readonly ProjectScreen[] | null;
  htmlPages?: readonly string[] | null;
}): ScreenIndexRecord[] {
  const screens = new Map<string, ScreenIndexRecord>();
  for (const route of input.routes) {
    screens.set(`impl:${route.filePath}`, {
      id: `screen-${slug(route.filePath)}`,
      name: screenName(route.filePath, route.routePath),
      implementationPath: route.filePath,
      routePath: route.routePath,
      designReadableStatus: 'candidate',
      source: 'route',
    });
  }

  const projectStoryIds = new Set(
    (input.projectScreens ?? [])
      .map((screen) => screen.storyId)
      .filter((storyId): storyId is string => Boolean(storyId)),
  );
  for (const component of input.catalog?.components ?? []) {
    for (const story of component.stories) {
      if (projectStoryIds.has(story.id)) continue;
      const key = `story:${component.filePath}:${story.id}`;
      if (screens.has(`impl:${component.filePath}`)) continue;
      screens.set(key, {
        id: `screen-${slug(key)}`,
        name: story.name || component.shortName || component.title,
        implementationPath: component.filePath,
        storyPath: component.filePath,
        designReadableStatus: 'unknown',
        source: 'catalog-story',
      });
    }
  }

  for (const projectScreen of input.projectScreens ?? []) {
    const implementationPath = normalizePath(
      projectScreen.implementationFilePath ?? projectScreen.filePath ?? '',
    );
    if (!implementationPath) continue;
    const storyPath = normalizePath(projectScreen.filePath ?? '');
    if (projectScreen.storyId) screens.delete(`story:${storyPath}:${projectScreen.storyId}`);
    screens.delete(`impl:${implementationPath}`);
    screens.set(`project:${projectScreen.id}`, {
      id: projectScreen.id,
      name: projectScreen.name,
      implementationPath,
      ...(storyPath && storyPath !== implementationPath ? { storyPath } : {}),
      designReadableStatus: 'candidate',
      source: 'project-file',
    });
  }

  for (const htmlPage of input.htmlPages ?? []) {
    const implementationPath = normalizePath(htmlPage);
    if (
      !implementationPath ||
      implementationPath === 'index.html' ||
      isHtmlCatalogFile(implementationPath) ||
      isHtmlDesignSystemPath(implementationPath) ||
      Array.from(screens.values()).some(
        (screen) => screen.implementationPath === implementationPath,
      )
    )
      continue;
    screens.set(`html:${implementationPath}`, {
      id: `screen-${slug(implementationPath)}`,
      name: screenNameFromHtmlPath(implementationPath),
      implementationPath,
      routePath: `/${implementationPath}`,
      designReadableStatus: 'candidate',
      source: 'file-system',
    });
  }

  return Array.from(screens.values()).sort((a, b) => a.id.localeCompare(b.id));
}

function screenName(filePath: string, routePath: string): string {
  if (routePath !== '/') {
    return routePath
      .split('/')
      .filter(Boolean)
      .map((part) => part.replace(/^:/, ''))
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
  const parts = filePath.split('/').filter(Boolean);
  return parts.at(-2) ?? parts.at(-1)?.replace(/\.(tsx|jsx)$/, '') ?? 'Screen';
}

function slug(value: string): string {
  return (
    value
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'root'
  );
}

function normalizePath(path: string): string {
  return path.trim().split('\\').join('/');
}

function isHtmlCatalogFile(path: string): boolean {
  return /(^|\/)(components|ui)\.html$/iu.test(path);
}

function screenNameFromHtmlPath(path: string): string {
  const fileName =
    path
      .split('/')
      .pop()
      ?.replace(/\.html?$/iu, '') || 'Page';
  return fileName
    .split(/[^A-Za-z0-9]+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
