import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  DESIGN_INDEX_PATHS,
  loadDesignIndex,
  type AssetRecord,
  type ComponentAgentNote,
  type ComponentGroupRecord,
  type IconCandidateRecord,
  type IconIndexFile,
  type IndexedComponentRecord,
  type ProjectAgentNote,
  type ProjectProfileFile,
  type RouteRecord,
  type ScreenIndexRecord,
  type StorybookIndexFile,
  type TokenRecord,
  type UsageExampleRecord,
} from '@sber-designer/design-indexer';
import {
  isHtmlDesignSystemCanonical,
  isHtmlDesignSystemMissing,
  type ComponentDescriptionLayer,
} from '@sber-designer/shared-types';

import { readComponentDescriptionSource } from './component-description-source';

export interface ProjectSetupQuestion {
  id: string;
  label: string;
  answer: string | null;
  detectedAnswer: string | null;
  confirmedAnswer: string | null;
  status: 'confirmed' | 'detected' | 'missing';
  reason: string;
  updatedAt?: number;
}

export interface ProjectProfileAnswer {
  id: string;
  answer: string;
  updatedAt: number;
}

export interface ProjectProfileAnswersFile {
  version: 1;
  answers: ProjectProfileAnswer[];
}

export interface SaveProjectSetupAnswerInput {
  id: string;
  answer: string | null;
}

export interface SaveProjectSetupAnswersResult {
  changedFiles: string[];
  browser: DesignSystemBrowserPayload;
}

export interface DesignSystemBrowserComponentDescriptionSource {
  provenance: 'sidecar' | 'projection' | 'indexed' | 'mined';
  path?: string;
  status: ComponentDescriptionLayer['status'] | null;
  updatedAt: string | null;
  fresh: boolean;
  diagnostics: string[];
  projections: {
    source: 'storybook' | 'design-system';
    path: string;
    fresh: boolean;
    diagnostics: string[];
  }[];
}

export interface DesignSystemBrowserComponentRecord extends IndexedComponentRecord {
  descriptionSource?: DesignSystemBrowserComponentDescriptionSource;
}

export interface DesignSystemBrowserPayload {
  context: Awaited<ReturnType<typeof loadDesignIndex>>;
  projectProfile: ProjectProfileFile | null;
  storybook: StorybookIndexFile | null;
  setupQuestions: ProjectSetupQuestion[];
  components: DesignSystemBrowserComponentRecord[];
  componentGroups: ComponentGroupRecord[];
  tokens: TokenRecord[];
  icons: IconIndexFile | null;
  iconCandidates: IconCandidateRecord[];
  assets: AssetRecord[];
  screens: ScreenIndexRecord[];
  routes: RouteRecord[];
  usageExamples: UsageExampleRecord[];
  agentNotes: ProjectAgentNote[];
}

const MAX_RECORDS = 500;
export const PROJECT_PROFILE_ANSWERS_PATH =
  '.sber-designer/design-index/project-profile.answers.json';

export async function loadProjectDesignSystemBrowser(
  workspaceRoot: string,
): Promise<DesignSystemBrowserPayload> {
  const [
    context,
    projectProfile,
    profileAnswers,
    storybook,
    components,
    componentGroups,
    tokens,
    icons,
    iconCandidates,
    assets,
    screens,
    routes,
    usageExamples,
    agentNotes,
  ] = await Promise.all([
    loadDesignIndex(workspaceRoot),
    readJson<ProjectProfileFile>(workspaceRoot, DESIGN_INDEX_PATHS.projectProfile),
    readProfileAnswers(workspaceRoot),
    readJson<StorybookIndexFile>(workspaceRoot, DESIGN_INDEX_PATHS.storybook),
    readJsonl<IndexedComponentRecord>(workspaceRoot, DESIGN_INDEX_PATHS.components),
    readJson<{ groups?: ComponentGroupRecord[] }>(
      workspaceRoot,
      DESIGN_INDEX_PATHS.componentGroups,
    ),
    readJson<{ tokens?: TokenRecord[] }>(workspaceRoot, DESIGN_INDEX_PATHS.tokens),
    readJson<IconIndexFile>(workspaceRoot, DESIGN_INDEX_PATHS.icons),
    readJsonl<IconCandidateRecord>(workspaceRoot, DESIGN_INDEX_PATHS.iconCandidates),
    readJsonl<AssetRecord>(workspaceRoot, DESIGN_INDEX_PATHS.assets),
    readJsonl<ScreenIndexRecord>(workspaceRoot, DESIGN_INDEX_PATHS.screens),
    readJson<{ routes?: RouteRecord[] }>(workspaceRoot, DESIGN_INDEX_PATHS.routes),
    readJsonl<UsageExampleRecord>(workspaceRoot, DESIGN_INDEX_PATHS.usageExamples),
    readProjectAgentNotes(workspaceRoot),
  ]);
  const browserComponents = await enrichComponentDescriptionSources(
    workspaceRoot,
    components.slice(0, MAX_RECORDS),
  );

  return {
    context,
    projectProfile,
    storybook,
    setupQuestions: buildSetupQuestions(projectProfile, storybook, profileAnswers),
    components: browserComponents,
    componentGroups: (componentGroups?.groups ?? []).slice(0, MAX_RECORDS),
    tokens: (tokens?.tokens ?? []).slice(0, MAX_RECORDS),
    icons,
    iconCandidates: iconCandidates.slice(0, MAX_RECORDS),
    assets: assets.slice(0, MAX_RECORDS),
    screens: screens.slice(0, MAX_RECORDS),
    routes: (routes?.routes ?? []).slice(0, MAX_RECORDS),
    usageExamples: usageExamples.slice(0, MAX_RECORDS),
    agentNotes: agentNotes.slice(0, MAX_RECORDS),
  };
}

async function enrichComponentDescriptionSources(
  workspaceRoot: string,
  components: IndexedComponentRecord[],
): Promise<DesignSystemBrowserComponentRecord[]> {
  return Promise.all(
    components.map(async (component): Promise<DesignSystemBrowserComponentRecord> => {
      try {
        const source = await readComponentDescriptionSource(workspaceRoot, component);
        const layer = source.descriptionLayer;
        if (!layer) return component;
        const projectionWithLayer = source.projections.find((projection) =>
          Boolean(projection.descriptionLayer),
        );
        const activeSurface = source.canonical ?? source.indexed ?? projectionWithLayer ?? null;
        const provenance: DesignSystemBrowserComponentDescriptionSource['provenance'] =
          source.canonical
            ? 'sidecar'
            : projectionWithLayer
              ? 'projection'
              : layer.status === 'confirmed'
                ? 'indexed'
                : 'mined';
        const projections = source.projections
          .filter(
            (
              projection,
            ): projection is typeof projection & { source: 'storybook' | 'design-system' } =>
              projection.source === 'storybook' || projection.source === 'design-system',
          )
          .map((projection) => ({
            source: projection.source,
            path: projection.path,
            fresh: projection.fresh,
            diagnostics: projection.diagnostics,
          }));
        return {
          ...component,
          descriptionLayer: layer,
          descriptionSource: {
            provenance,
            status: layer.status ?? null,
            updatedAt: layer.updatedAt ?? null,
            fresh: source.diagnostics.length === 0,
            diagnostics: source.diagnostics,
            projections,
            ...(activeSurface?.path ? { path: activeSurface.path } : {}),
          },
        };
      } catch {
        return component;
      }
    }),
  );
}

export async function saveProjectSetupAnswers(
  workspaceRoot: string,
  updates: SaveProjectSetupAnswerInput[],
): Promise<SaveProjectSetupAnswersResult> {
  const [projectProfile, profileAnswers, storybook] = await Promise.all([
    readJson<ProjectProfileFile>(workspaceRoot, DESIGN_INDEX_PATHS.projectProfile),
    readProfileAnswers(workspaceRoot),
    readJson<StorybookIndexFile>(workspaceRoot, DESIGN_INDEX_PATHS.storybook),
  ]);
  const knownQuestionIds = new Set(
    buildSetupQuestions(projectProfile, storybook, { version: 1, answers: [] }).map(
      (question) => question.id,
    ),
  );
  const nextById = new Map(profileAnswers.answers.map((answer) => [answer.id, answer]));
  const now = Date.now();

  for (const update of updates) {
    if (!knownQuestionIds.has(update.id)) {
      throw new Error(`Unknown setup question: ${update.id}`);
    }
    const answer = update.answer?.trim() ?? '';
    if (!answer) {
      nextById.delete(update.id);
      continue;
    }
    nextById.set(update.id, { id: update.id, answer, updatedAt: now });
  }

  const next: ProjectProfileAnswersFile = {
    version: 1,
    answers: Array.from(nextById.values()).sort((a, b) => a.id.localeCompare(b.id)),
  };
  const nextContents = `${JSON.stringify(next, null, 2)}\n`;
  const previousContents = await readText(workspaceRoot, PROJECT_PROFILE_ANSWERS_PATH);
  const changedFiles = previousContents === nextContents ? [] : [PROJECT_PROFILE_ANSWERS_PATH];

  if (changedFiles.length > 0) {
    await writeWorkspaceText(workspaceRoot, PROJECT_PROFILE_ANSWERS_PATH, nextContents);
  }

  return {
    changedFiles,
    browser: await loadProjectDesignSystemBrowser(workspaceRoot),
  };
}

function buildSetupQuestions(
  profile: ProjectProfileFile | null,
  storybook: StorybookIndexFile | null,
  answers: ProjectProfileAnswersFile,
): ProjectSetupQuestion[] {
  const scripts = profile?.packageScripts ?? {};
  const frameworks = profile?.frameworks ?? [];
  const sourceRoots = profile?.sourceRoots ?? [];
  const htmlDesignSystem = profile?.htmlDesignSystem ?? null;
  const answerById = new Map(answers.answers.map((answer) => [answer.id, answer]));
  const withAnswer = (
    question: Omit<ProjectSetupQuestion, 'answer' | 'confirmedAnswer' | 'updatedAt'>,
  ): ProjectSetupQuestion => {
    const confirmed = answerById.get(question.id);
    if (!confirmed) {
      return { ...question, answer: question.detectedAnswer, confirmedAnswer: null };
    }
    return {
      ...question,
      answer: confirmed.answer,
      confirmedAnswer: confirmed.answer,
      status: 'confirmed',
      updatedAt: confirmed.updatedAt,
    };
  };
  return [
    withAnswer({
      id: 'package-manager',
      label: 'Package manager',
      detectedAnswer:
        profile?.packageManager && profile.packageManager !== 'unknown'
          ? profile.packageManager
          : null,
      status:
        profile?.packageManager && profile.packageManager !== 'unknown' ? 'detected' : 'missing',
      reason: 'Used to suggest repeatable project commands.',
    }),
    withAnswer({
      id: 'frameworks',
      label: 'Frameworks',
      detectedAnswer: frameworks.length > 0 ? frameworks.join(', ') : null,
      status: frameworks.length > 0 ? 'detected' : 'missing',
      reason: 'Helps Assistant pick compatible routing, rendering, and component patterns.',
    }),
    withAnswer({
      id: 'commands.dev',
      label: 'Preview command',
      detectedAnswer: scripts.dev ?? scripts.start ?? null,
      status: scripts.dev || scripts.start ? 'detected' : 'missing',
      reason: 'Used by preview, sandbox startup, and visual validation.',
    }),
    withAnswer({
      id: 'commands.typecheck',
      label: 'Typecheck command',
      detectedAnswer: scripts.typecheck ?? null,
      status: scripts.typecheck ? 'detected' : 'missing',
      reason: 'Used before handoff and PR-ready validation.',
    }),
    withAnswer({
      id: 'commands.test',
      label: 'Test command',
      detectedAnswer: scripts.test ?? null,
      status: scripts.test ? 'detected' : 'missing',
      reason: 'Used to verify generated screens and agent edits.',
    }),
    withAnswer({
      id: 'storybook.availability',
      label: 'Storybook',
      detectedAnswer: storybook?.exists ? storybook.configPaths.join(', ') || 'detected' : null,
      status: storybook?.exists ? 'detected' : 'missing',
      reason: 'Storybook is a preview source when present; the browser also works without it.',
    }),
    ...(profile?.kind === 'html-css'
      ? [
          withAnswer({
            id: 'html.design-system',
            label: 'HTML design-system sources',
            detectedAnswer: isHtmlDesignSystemCanonical(htmlDesignSystem?.status)
              ? htmlDesignSystem.sources
                  .filter((source) => source.required && source.foundPath)
                  .map((source) => source.foundPath)
                  .join(', ')
              : null,
            status: isHtmlDesignSystemCanonical(htmlDesignSystem?.status) ? 'detected' : 'missing',
            reason: isHtmlDesignSystemMissing(htmlDesignSystem?.status)
              ? `Missing ${htmlDesignSystem?.missingRequired.join(', ') ?? 'design-system sources'}. Add design-system/Design.md, design-system/tokens.css, and design-system/components.css.`
              : htmlDesignSystem?.status === 'non-canonical'
                ? 'Legacy design-system sources were found. Restructure the project before authoring reusable components.'
                : 'The design-system folder defines the static HTML design system.',
          }),
        ]
      : []),
    withAnswer({
      id: 'source-roots',
      label: 'Source roots',
      detectedAnswer: sourceRoots.length > 0 ? sourceRoots.join(', ') : null,
      status: sourceRoots.length > 0 ? 'detected' : 'missing',
      reason: 'Narrows static scanning before broad source reads.',
    }),
  ];
}

async function readProfileAnswers(workspaceRoot: string): Promise<ProjectProfileAnswersFile> {
  const parsed = await readJson<ProjectProfileAnswersFile>(
    workspaceRoot,
    PROJECT_PROFILE_ANSWERS_PATH,
  );
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.answers)) {
    return { version: 1, answers: [] };
  }
  return {
    version: 1,
    answers: parsed.answers
      .filter(
        (answer) =>
          typeof answer.id === 'string' &&
          typeof answer.answer === 'string' &&
          answer.answer.trim(),
      )
      .map((answer) => ({
        id: answer.id,
        answer: answer.answer.trim(),
        updatedAt: Number.isFinite(answer.updatedAt) ? answer.updatedAt : 0,
      })),
  };
}

async function readProjectAgentNotes(workspaceRoot: string): Promise<ProjectAgentNote[]> {
  return normalizeProjectAgentNotes(
    await readJsonl<ProjectAgentNote | ComponentAgentNote>(
      workspaceRoot,
      DESIGN_INDEX_PATHS.agentNotes,
    ),
  );
}

function normalizeProjectAgentNotes(
  records: Array<ProjectAgentNote | ComponentAgentNote>,
): ProjectAgentNote[] {
  return records.flatMap((record) => {
    const candidate = record as Partial<ProjectAgentNote & ComponentAgentNote>;
    if (!candidate.id || !candidate.note) return [];
    if (candidate.targetType) {
      return [
        {
          id: candidate.id,
          targetType: candidate.targetType,
          ...(candidate.targetId ? { targetId: candidate.targetId } : {}),
          note: candidate.note,
          intent: normalizeIntent(candidate.intent),
          source: candidate.source ?? 'manual',
          createdAt: candidate.createdAt ?? Date.now(),
          updatedAt: candidate.updatedAt ?? candidate.createdAt ?? Date.now(),
        },
      ];
    }
    if (candidate.componentId) {
      return [
        {
          id: candidate.id,
          targetType: 'component' as const,
          targetId: candidate.componentId,
          note: candidate.note,
          intent: normalizeIntent(candidate.intent),
          source: 'component-note' as const,
          createdAt: candidate.createdAt ?? Date.now(),
          updatedAt: candidate.updatedAt ?? candidate.createdAt ?? Date.now(),
        },
      ];
    }
    return [];
  });
}

function normalizeIntent(value: unknown): ComponentAgentNote['intent'] {
  if (
    value === 'prefer' ||
    value === 'avoid' ||
    value === 'requirement' ||
    value === 'deprecated' ||
    value === 'usage' ||
    value === 'other'
  ) {
    return value;
  }
  return 'usage';
}

async function readJson<T>(workspaceRoot: string, filePath: string): Promise<T | null> {
  const contents = await readText(workspaceRoot, filePath);
  if (!contents) return null;
  try {
    return JSON.parse(contents) as T;
  } catch {
    return null;
  }
}

async function readJsonl<T>(workspaceRoot: string, filePath: string): Promise<T[]> {
  const contents = await readText(workspaceRoot, filePath);
  if (!contents) return [];
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as T];
      } catch {
        return [];
      }
    });
}

async function readText(workspaceRoot: string, filePath: string): Promise<string> {
  try {
    return await readFile(resolve(workspaceRoot, filePath), 'utf8');
  } catch {
    return '';
  }
}

async function writeWorkspaceText(
  workspaceRoot: string,
  filePath: string,
  contents: string,
): Promise<void> {
  const absolutePath = resolve(workspaceRoot, filePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents, 'utf8');
}
