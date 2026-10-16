import {
  buildDesignIndex,
  loadDesignIndex,
  DESIGN_INDEX_PATHS,
  scanProjectProfile,
  type ComponentAgentNote,
  type DesignIndexContext,
  type DesignIndexDiagnostic,
  type ProjectAgentNote,
  type ScreenTemplatePatternInput,
} from '@sber-designer/design-indexer';
import {
  descriptionLayerFromMarkdown,
  extractStructuredLayerBlock,
} from '@sber-designer/storybook-indexer';
import type {
  AgentKitDiagnostic,
  ComponentCatalog,
  ComponentDescriptionLayer,
  ProjectIconSource,
  ProjectScreen,
  ScreenTemplate,
} from '@sber-designer/shared-types';
import { HTML_DESIGN_SYSTEM_PATHS } from '@sber-designer/shared-types';
import { readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import { readWorkspaceFile, writeWorkspaceFile } from './safe-fs';
import { ProjectSchema } from './project-store';
import { resolveScreenTemplates, validateScreenTemplate } from './screen-templates';
import { htmlDescriptionSectionToMarkdown } from './html-description-section';

const COMPONENT_SIDECAR_DIR = '.sber-designer/components';
const MAX_COMPONENT_SIDECAR_BYTES = 200_000;
const MAX_HTML_DESCRIPTION_BYTES = 200_000;
const HTML_DESCRIPTION_SURFACE_FILES = [HTML_DESIGN_SYSTEM_PATHS.previewHtml];

export interface GenerateProjectDesignIndexOptions {
  projectName: string;
  catalog: ComponentCatalog | null;
}

export interface GenerateProjectDesignIndexResult {
  changedFiles: string[];
  context: DesignIndexContext;
}

export interface AddProjectComponentNoteInput {
  componentId: string;
  note: string;
  intent: ComponentAgentNote['intent'];
  storybookTitle?: string;
  sourcePath?: string;
}

export interface AddProjectComponentNoteResult {
  note: ProjectAgentNote;
}

export interface UpdateProjectComponentNoteInput {
  id: string;
  note: string;
  intent: ComponentAgentNote['intent'];
}

export interface UpdateProjectComponentNoteResult {
  note: ProjectAgentNote;
}

export interface DeleteProjectComponentNoteResult {
  deleted: boolean;
}

export async function loadProjectDesignIndex(workspaceRoot: string): Promise<DesignIndexContext> {
  return loadDesignIndex(workspaceRoot);
}

export async function addProjectComponentNote(
  workspaceRoot: string,
  input: AddProjectComponentNoteInput,
): Promise<AddProjectComponentNoteResult> {
  const existingComponentNotes = await readOptionalWorkspaceFile(
    workspaceRoot,
    DESIGN_INDEX_PATHS.agentNotes,
  );
  const notes = parseProjectAgentNotes(existingComponentNotes);
  const now = Date.now();
  const note: ProjectAgentNote = {
    id: `note-${randomUUID()}`,
    targetType: 'component',
    targetId: input.componentId,
    note: input.note.trim(),
    intent: input.intent,
    source: 'component-note',
    createdAt: now,
    updatedAt: now,
  };
  const contents = [...notes, note].map((item) => JSON.stringify(item)).join('\n');
  await writeWorkspaceFile(
    workspaceRoot,
    DESIGN_INDEX_PATHS.agentNotes,
    contents ? `${contents}\n` : '',
  );
  return { note };
}

export async function updateProjectComponentNote(
  workspaceRoot: string,
  input: UpdateProjectComponentNoteInput,
): Promise<UpdateProjectComponentNoteResult> {
  const existingComponentNotes = await readOptionalWorkspaceFile(
    workspaceRoot,
    DESIGN_INDEX_PATHS.agentNotes,
  );
  const notes = parseProjectAgentNotes(existingComponentNotes);
  const existing = notes.find((note) => note.id === input.id);
  if (!existing) throw new Error('Component note not found.');
  const updated: ProjectAgentNote = {
    ...existing,
    note: input.note.trim(),
    intent: input.intent,
    updatedAt: Date.now(),
  };
  await writeProjectAgentNotes(
    workspaceRoot,
    notes.map((note) => (note.id === input.id ? updated : note)),
  );
  return { note: updated };
}

export async function deleteProjectComponentNote(
  workspaceRoot: string,
  id: string,
): Promise<DeleteProjectComponentNoteResult> {
  const existingComponentNotes = await readOptionalWorkspaceFile(
    workspaceRoot,
    DESIGN_INDEX_PATHS.agentNotes,
  );
  const notes = parseProjectAgentNotes(existingComponentNotes);
  const next = notes.filter((note) => note.id !== id);
  if (next.length === notes.length) throw new Error('Component note not found.');
  await writeProjectAgentNotes(workspaceRoot, next);
  return { deleted: true };
}

export async function generateProjectDesignIndexFiles(
  workspaceRoot: string,
  options: GenerateProjectDesignIndexOptions,
): Promise<GenerateProjectDesignIndexResult> {
  const [
    designMdFile,
    designBriefContents,
    existingComponentNotes,
    legacyComponentNotes,
    legacyMap,
    legacyMapFallback,
    projectFile,
    existingUsageCards,
    workspaceConfig,
  ] = await Promise.all([
    readOptionalDesignMdFile(workspaceRoot),
    readOptionalWorkspaceFile(workspaceRoot, DESIGN_INDEX_PATHS.designBrief),
    readOptionalWorkspaceFile(workspaceRoot, DESIGN_INDEX_PATHS.agentNotes),
    readOptionalWorkspaceFile(workspaceRoot, DESIGN_INDEX_PATHS.legacyComponentNotes),
    readOptionalWorkspaceFile(workspaceRoot, 'component-selection-map.md'),
    readOptionalWorkspaceFile(workspaceRoot, '.sber-designer/component-selection-map.md'),
    readOptionalWorkspaceFile(workspaceRoot, '.sber-designer/project.sdproj'),
    readOptionalWorkspaceFile(workspaceRoot, DESIGN_INDEX_PATHS.usageCards),
    readOptionalWorkspaceFile(workspaceRoot, 'sber-designer.json'),
  ]);
  const [screenTemplates, componentSidecarLayers, componentSurfaceLayers] = await Promise.all([
    resolveScreenTemplatesForIndex(workspaceRoot, options.catalog),
    readComponentSidecarLayers(workspaceRoot),
    readHtmlDescriptionSectionLayers(workspaceRoot),
  ]);
  const built = await buildDesignIndex({
    workspaceRoot,
    projectName: options.projectName,
    catalog: options.catalog,
    projectScreens: parseProjectScreens(projectFile),
    iconSources: parseProjectIconSources(projectFile),
    designMdContents: designMdFile?.contents ?? null,
    designMdPath: designMdFile?.filePath ?? null,
    designBriefContents,
    existingComponentNotes: existingComponentNotes ?? legacyComponentNotes,
    legacyComponentSelectionMapContents: legacyMap ?? legacyMapFallback,
    existingUsageCardsContents: existingUsageCards,
    componentSidecarLayers,
    componentSurfaceLayers,
    usageCorpusPaths: parseUsageCorpus(workspaceConfig),
    screenTemplates,
  });
  const changedFiles: string[] = [];

  for (const file of built.files) {
    const existing = await readOptionalWorkspaceFile(workspaceRoot, file.filePath);
    if (existing === file.contents) continue;
    await writeWorkspaceFile(workspaceRoot, file.filePath, file.contents);
    changedFiles.push(file.filePath);
  }

  return {
    changedFiles,
    context: await loadProjectDesignIndex(workspaceRoot),
  };
}

async function readComponentSidecarLayers(
  workspaceRoot: string,
): Promise<Record<string, ComponentDescriptionLayer>> {
  const entries = await readdir(join(workspaceRoot, COMPONENT_SIDECAR_DIR), {
    withFileTypes: true,
  }).catch(() => []);
  const layers: Record<string, ComponentDescriptionLayer> = {};
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const componentId = entry.name.slice(0, -'.md'.length);
    const raw = await readOptionalWorkspaceFile(
      workspaceRoot,
      `${COMPONENT_SIDECAR_DIR}/${entry.name}`,
    );
    if (!raw || raw.length > MAX_COMPONENT_SIDECAR_BYTES) continue;
    const layer = extractStructuredLayerBlock(raw) ?? descriptionLayerFromMarkdown(raw);
    if (layer) layers[componentId] = layer;
  }
  return layers;
}

async function readHtmlDescriptionSectionLayers(
  workspaceRoot: string,
): Promise<Record<string, ComponentDescriptionLayer>> {
  const files = await collectHtmlDescriptionFiles(workspaceRoot);
  const layers: Record<string, ComponentDescriptionLayer> = {};
  for (const filePath of files) {
    const raw = await readOptionalWorkspaceFile(workspaceRoot, filePath);
    if (!raw || raw.length > MAX_HTML_DESCRIPTION_BYTES) continue;
    for (const section of extractHtmlDescriptionSections(raw)) {
      const componentId = cssCatalogComponentIdForBlock(section.block);
      if (!componentId || layers[componentId]) continue;
      const markdown = htmlDescriptionSectionToMarkdown(section.html);
      const layer = descriptionLayerFromMarkdown(markdown, { status: 'confirmed' });
      if (layer) layers[componentId] = layer;
    }
  }
  return layers;
}

async function collectHtmlDescriptionFiles(workspaceRoot: string): Promise<string[]> {
  const files: string[] = [];
  for (const filePath of HTML_DESCRIPTION_SURFACE_FILES) {
    const raw = await readOptionalWorkspaceFile(workspaceRoot, filePath);
    if (raw !== null) files.push(filePath);
  }
  return files;
}

function extractHtmlDescriptionSections(contents: string): Array<{ block: string; html: string }> {
  const sections: Array<{ block: string; html: string }> = [];
  const sectionRe = /<section\b([^>]*)>([\s\S]*?)<\/section>/giu;
  let match: RegExpExecArray | null;
  while ((match = sectionRe.exec(contents)) !== null) {
    const attrs = match[1] ?? '';
    const block = /\bdata-sd-description-for\s*=\s*(["'])(.*?)\1/iu.exec(attrs)?.[2]?.trim();
    if (!block) continue;
    sections.push({ block, html: match[2] ?? '' });
  }
  return sections;
}

function cssCatalogComponentIdForBlock(block: string): string {
  const slug = block
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  return slug ? `css-catalog-${slug}` : '';
}

async function readOptionalWorkspaceFile(
  workspaceRoot: string,
  filePath: string,
): Promise<string | null> {
  try {
    return await readWorkspaceFile(workspaceRoot, filePath);
  } catch {
    return null;
  }
}

async function readOptionalDesignMdFile(
  workspaceRoot: string,
): Promise<{ filePath: string; contents: string } | null> {
  const profile = await scanProjectProfile(workspaceRoot);
  const candidates =
    profile.componentModel === 'css-catalog'
      ? [HTML_DESIGN_SYSTEM_PATHS.designMd]
      : ['DESIGN.md', 'Design.md', 'design.md'];
  for (const filePath of candidates) {
    const contents = await readOptionalWorkspaceFile(workspaceRoot, filePath);
    if (contents !== null) return { filePath, contents };
  }
  return null;
}

/**
 * Resolve project screen templates, run the 0080 quality gate, and map them
 * to the builder's pattern-compile input. Validation diagnostics land in the
 * index diagnostics so the Project System panel surfaces them.
 */
async function resolveScreenTemplatesForIndex(
  workspaceRoot: string,
  catalog: ComponentCatalog | null,
): Promise<{ templates: ScreenTemplatePatternInput[]; diagnostics: DesignIndexDiagnostic[] }> {
  const resolved = await resolveScreenTemplates(workspaceRoot);
  const components = (catalog?.components ?? []).map((component) => ({
    id: component.id,
    shortName: component.shortName,
  }));
  const diagnostics: DesignIndexDiagnostic[] = resolved.diagnostics.map(toIndexDiagnostic);
  for (const template of resolved.templates) {
    for (const finding of validateScreenTemplate(template, { components })) {
      diagnostics.push(toIndexDiagnostic(finding));
    }
  }
  return {
    templates: resolved.templates.map(toPatternInput),
    diagnostics,
  };
}

function toPatternInput(template: ScreenTemplate): ScreenTemplatePatternInput {
  return {
    id: template.id,
    source: template.source,
    name: template.name,
    description: template.description,
    kind: template.kind ?? 'custom',
    ...(template.componentRoles ? { componentRoles: template.componentRoles } : {}),
    ...(template.componentBindings ? { componentBindings: template.componentBindings } : {}),
    ...(template.evidence ? { evidence: template.evidence } : {}),
    ...(template.filePath ? { filePath: template.filePath } : {}),
  };
}

function toIndexDiagnostic(finding: AgentKitDiagnostic): DesignIndexDiagnostic {
  return {
    level: finding.level === 'error' ? 'error' : finding.level === 'warning' ? 'warning' : 'info',
    filePath: finding.path ?? DESIGN_INDEX_PATHS.patterns,
    message: `[${finding.code}] ${finding.message}`,
  };
}

function parseUsageCorpus(workspaceConfig: string | null): string[] {
  if (!workspaceConfig) return [];
  try {
    const parsed = JSON.parse(workspaceConfig) as { usageCorpus?: unknown };
    if (!Array.isArray(parsed.usageCorpus)) return [];
    return parsed.usageCorpus.filter(
      (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
    );
  } catch {
    return [];
  }
}

function parseProjectAgentNotes(contents: string | null): ProjectAgentNote[] {
  if (!contents) return [];
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const parsed = JSON.parse(line) as Partial<ComponentAgentNote & ProjectAgentNote>;
        if (!parsed.id || !parsed.note) return [];
        if (parsed.targetType) {
          return [
            {
              id: parsed.id,
              targetType: parsed.targetType,
              ...(parsed.targetId ? { targetId: parsed.targetId } : {}),
              note: parsed.note,
              intent: normalizeIntent(parsed.intent),
              source: parsed.source ?? 'manual',
              createdAt: parsed.createdAt ?? Date.now(),
              updatedAt: parsed.updatedAt ?? parsed.createdAt ?? Date.now(),
            },
          ];
        }
        if (parsed.componentId) {
          return [
            {
              id: parsed.id,
              targetType: 'component' as const,
              targetId: parsed.componentId,
              note: parsed.note,
              intent: normalizeIntent(parsed.intent),
              source: 'component-note' as const,
              createdAt: parsed.createdAt ?? Date.now(),
              updatedAt: parsed.updatedAt ?? parsed.createdAt ?? Date.now(),
            },
          ];
        }
        return [];
      } catch {
        return [];
      }
    });
}

async function writeProjectAgentNotes(
  workspaceRoot: string,
  notes: ProjectAgentNote[],
): Promise<void> {
  const contents = notes
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((item) => JSON.stringify(item))
    .join('\n');
  await writeWorkspaceFile(
    workspaceRoot,
    DESIGN_INDEX_PATHS.agentNotes,
    contents ? `${contents}\n` : '',
  );
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

function parseProjectScreens(contents: string | null): ProjectScreen[] {
  if (!contents) return [];
  try {
    const parsed = ProjectSchema.safeParse(JSON.parse(contents));
    if (!parsed.success) return [];
    return parsed.data.screens as ProjectScreen[];
  } catch {
    return [];
  }
}

function parseProjectIconSources(contents: string | null): ProjectIconSource[] {
  if (!contents) return [];
  try {
    const parsed = ProjectSchema.safeParse(JSON.parse(contents));
    if (!parsed.success) return [];
    return (parsed.data.externalAssetSources?.icons ?? []) as ProjectIconSource[];
  } catch {
    return [];
  }
}
