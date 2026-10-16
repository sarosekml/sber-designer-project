import type { ProjectScreen } from '@sber-designer/shared-types';

import {
  buildGeneratedScreenMetadata,
  buildGeneratedScreenStoryWrapper,
  buildStorybookTemplateImplementation,
  normalizeScreenFolder,
  relativeImportPath,
} from './screen-folders';

export interface DuplicateScreenFile {
  path: string;
  contents: string;
}

export interface DuplicateScreenPlan {
  screen: ProjectScreen;
  files: DuplicateScreenFile[];
}

export interface GeneratedScreenDuplicateInput {
  original: ProjectScreen;
  screens: readonly ProjectScreen[];
  implementationContents: string;
  now?: Date;
  unique?: string;
}

export interface StorybookScreenDuplicateInput {
  original: ProjectScreen;
  screens: readonly ProjectScreen[];
  sourceStoryFilePath: string;
  now?: Date;
  unique?: string;
}

const DUPLICATE_POSITION_OFFSET = 40;

export function buildDuplicateScreenName(
  originalName: string,
  screens: readonly Pick<ProjectScreen, 'name'>[],
): string {
  const trimmed = originalName.trim() || 'Screen';
  const base = / copy(?: \d+)?$/i.test(trimmed) ? trimmed : `${trimmed} Copy`;
  const used = new Set(screens.map((screen) => screen.name.trim()).filter(Boolean));
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base} ${index}`)) index += 1;
  return `${base} ${index}`;
}

export function extractScreenComponentExportName(contents: string): string | null {
  const functionMatch = contents.match(/\bexport\s+function\s+([A-Za-z_$][\w$]*)\s*\(/);
  if (functionMatch?.[1]) return functionMatch[1];
  const constMatch = contents.match(/\bexport\s+const\s+([A-Za-z_$][\w$]*)\s*=/);
  if (constMatch?.[1]) return constMatch[1];
  return null;
}

export function buildGeneratedScreenDuplicate(
  input: GeneratedScreenDuplicateInput,
): DuplicateScreenPlan {
  const duplicateName = buildDuplicateScreenName(input.original.name, input.screens);
  const unique = safeUnique(input.unique);
  const metadata = buildGeneratedScreenMetadata({
    name: duplicateName,
    folder: normalizeScreenFolder(input.original.folder),
  });
  const componentName = extractScreenComponentExportName(input.implementationContents);
  const storyComponentName = componentName ?? metadata.componentName;
  const screen = buildDuplicateScreenRecord({
    original: input.original,
    id: `screen-${unique}-${metadata.screenSlug}`,
    name: duplicateName,
    storyId: metadata.storyId,
    filePath: metadata.filePath,
    implementationFilePath: metadata.implementationFilePath,
  });

  return {
    screen,
    files: [
      {
        path: metadata.implementationFilePath,
        contents: input.implementationContents,
      },
      {
        path: metadata.filePath,
        contents: buildGeneratedScreenStoryWrapper({
          screenName: metadata.cleanName,
          storyTitle: metadata.storyTitle,
          componentName: storyComponentName,
          componentImportPath: relativeImportPath(
            metadata.filePath,
            metadata.implementationFilePath,
          ),
        }),
      },
    ],
  };
}

export function buildStorybookScreenDuplicate(
  input: StorybookScreenDuplicateInput,
): DuplicateScreenPlan {
  if (!input.original.storyId) {
    throw new Error('Cannot duplicate a Storybook screen without a story id.');
  }

  const duplicateName = buildDuplicateScreenName(input.original.name, input.screens);
  const unique = safeUnique(input.unique);
  const metadata = buildGeneratedScreenMetadata({
    name: duplicateName,
    folder: normalizeScreenFolder(input.original.folder),
  });
  const screen = buildDuplicateScreenRecord({
    original: input.original,
    id: `screen-${unique}-${metadata.screenSlug}`,
    name: duplicateName,
    storyId: metadata.storyId,
    filePath: metadata.filePath,
    implementationFilePath: metadata.implementationFilePath,
  });

  return {
    screen,
    files: [
      {
        path: metadata.implementationFilePath,
        contents: buildStorybookTemplateImplementation({
          componentName: metadata.componentName,
          sourceStoryId: input.original.storyId,
          sourceFilePath: input.sourceStoryFilePath,
          targetFilePath: metadata.implementationFilePath,
        }),
      },
      {
        path: metadata.filePath,
        contents: buildGeneratedScreenStoryWrapper({
          screenName: metadata.cleanName,
          storyTitle: metadata.storyTitle,
          componentName: metadata.componentName,
          componentImportPath: relativeImportPath(
            metadata.filePath,
            metadata.implementationFilePath,
          ),
        }),
      },
    ],
  };
}

function buildDuplicateScreenRecord(input: {
  original: ProjectScreen;
  id: string;
  name: string;
  storyId: string;
  filePath: string;
  implementationFilePath: string;
}): ProjectScreen {
  return {
    id: input.id,
    name: input.name,
    kind: 'story',
    storyId: input.storyId,
    filePath: input.filePath,
    implementationFilePath: input.implementationFilePath,
    // 0132/0080 (Р-21): a copy is the same kind of screen, so carry the
    // surface and the template ref forward — a manual rebuild would silently
    // drop both.
    ...(input.original.surface === 'modal' ? { surface: input.original.surface } : {}),
    ...(input.original.template ? { template: input.original.template } : {}),
    ...(input.original.description ? { description: input.original.description } : {}),
    ...(input.original.thumbnail ? { thumbnail: input.original.thumbnail } : {}),
    ...(input.original.folder ? { folder: input.original.folder } : {}),
    ...(input.original.position
      ? {
          position: {
            x: input.original.position.x + DUPLICATE_POSITION_OFFSET,
            y: input.original.position.y + DUPLICATE_POSITION_OFFSET,
          },
        }
      : {}),
  };
}

function safeUnique(unique: string | undefined): string {
  return (
    (unique ?? Date.now().toString(36)).replace(/[^a-zA-Z0-9]/g, '') || Date.now().toString(36)
  );
}
