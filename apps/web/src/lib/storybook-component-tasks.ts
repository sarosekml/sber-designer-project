import type { ComponentEntry, ProjectTask } from '@sber-designer/shared-types';

interface ComponentTaskTarget {
  componentName: string;
  componentTitle: string;
  activeScreenName?: string | null;
}

export function tasksForComponent(
  tasks: ProjectTask[],
  { componentName, componentTitle, activeScreenName }: ComponentTaskTarget,
): ProjectTask[] {
  return tasksForComponentCatalog(tasks, {
    components: [
      {
        shortName: componentName,
        title: componentTitle,
      },
    ],
    screenNames: activeScreenName ? [activeScreenName] : [],
  });
}

export function tasksForComponentCatalog(
  tasks: ProjectTask[],
  {
    components,
    screenNames = [],
  }: {
    components: Array<Pick<ComponentEntry, 'shortName' | 'title'>>;
    screenNames?: string[];
  },
): ProjectTask[] {
  const componentTokens = uniqueTokens(
    components.flatMap((component) => componentMatchTokens(component.shortName, component.title)),
  );
  const screenTokens = uniqueTokens(screenNames.flatMap((name) => screenMatchTokens(name)));
  return tasks.filter((task) => {
    const text = `${task.title} ${task.description ?? ''}`;
    if (!containsAnyToken(text, componentTokens)) return false;
    if (task.screenIds.length > 0) return false;
    if (screenTokens.length > 0 && containsAnyToken(text, screenTokens)) return false;
    return true;
  });
}

function componentMatchTokens(componentName: string, componentTitle: string): string[] {
  return uniqueTokens([
    componentName,
    componentTitle,
    ...componentTitle.split('/'),
    ...splitIdentifier(componentName),
    ...splitIdentifier(componentTitle.split('/').at(-1) ?? componentTitle),
  ]);
}

function screenMatchTokens(screenName: string | null | undefined): string[] {
  if (!screenName) return [];
  return uniqueTokens([screenName, ...splitIdentifier(screenName)]);
}

function containsAnyToken(text: string, tokens: string[]): boolean {
  const normalizedText = normalize(text);
  return tokens.some((token) => normalizedText.includes(normalize(token)));
}

function uniqueTokens(tokens: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokens) {
    const normalized = normalize(token);
    if (normalized.length < 3 || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(token);
  }
  return out;
}

function splitIdentifier(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter((part) => part.length >= 3);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}
