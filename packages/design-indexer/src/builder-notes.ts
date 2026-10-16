/**
 * Prompt summary, agent notes and the design brief (0136 R12 — extracted from
 * builder.ts).
 *
 * The parts of the index a model reads as prose. Existing agent notes are
 * parsed and preserved across rebuilds: a rebuild must not discard what a
 * human or an earlier run recorded about a component.
 */
import { summarizeHtmlCssCatalogForPrompt } from './html-css-catalog';
import {
  summarizeHtmlDesignSystemDesignMdForPrompt,
  type ParsedHtmlDesignSystemDesignMd,
} from './design-md-parser';
import {
  summarizeProjectStyleContractForPrompt,
  type ParsedProjectStyleContract,
} from './project-style-contract';
import {
  type ComponentAgentNote,
  type ComponentGroupRecord,
  type DesignIndexManifest,
  type IconCandidateRecord,
  type HtmlCssCatalogManifest,
  type IndexedComponentRecord,
  type ProjectAgentNote,
  type AssetRecord,
  type TokenRecord,
} from './types';
import { dedupeById } from './builder-components';
import { compactLine } from './builder';

export function buildPromptSummary(
  projectName: string,
  manifest: DesignIndexManifest,
  groups: ComponentGroupRecord[],
  components: IndexedComponentRecord[],
  tokens: TokenRecord[],
  iconCandidates: IconCandidateRecord[],
  assets: AssetRecord[],
  notes: ProjectAgentNote[],
  htmlCssCatalogManifest: HtmlCssCatalogManifest,
  parsedDesignMd: ParsedHtmlDesignSystemDesignMd | null,
  projectStyleContract: ParsedProjectStyleContract | null,
): string {
  const projectIconProps = iconCandidates.filter((icon) => icon.source === 'project-icon-prop');
  const lines = [
    '# Project index prompt summary',
    '',
    `Project: ${projectName}`,
    `Generated: ${new Date(manifest.generatedAt).toISOString()}`,
    `Components: ${manifest.counts.components}`,
    `Component groups: ${manifest.counts.componentGroups}`,
    `Tokens: ${manifest.counts.tokens}`,
    `Routes: ${manifest.counts.routes}`,
    `Screens: ${manifest.counts.screens}`,
    `Icons: ${manifest.counts.iconCandidates} candidates indexed. Resolution order: project iconName contract, project assets/files, external icon references, Lucide fallback.`,
    `Project iconName values: ${projectIconProps.length}. Use get_indexed_icon and icon-catalog.md; Lucide fallback is not valid for project Icon string props unless listed as project-icon-prop.`,
    `Assets: ${manifest.counts.assets} indexed project asset${manifest.counts.assets === 1 ? '' : 's'}, including ${manifest.counts.illustrations} illustration${manifest.counts.illustrations === 1 ? '' : 's'}.`,
    '',
    ...summarizeProjectStyleContractForPrompt(projectStyleContract),
    ...summarizeHtmlDesignSystemDesignMdForPrompt(parsedDesignMd),
    '## Component groups',
    '',
    ...groups.flatMap((group) => [
      `### ${group.name}`,
      group.guidance,
      `Components: ${group.componentIds.slice(0, 18).join(', ') || 'none'}`,
      '',
    ]),
    '## High-signal components',
    '',
    ...components
      .filter((component) => component.confidence !== 'low' || component.noteCount > 0)
      .slice(0, 24)
      .map(
        (component) =>
          `- ${component.title} (${component.filePath})${component.noteCount > 0 ? ` · ${component.noteCount} AI note(s)` : ''}`,
      ),
    '',
    '## CSS catalog manifest',
    '',
    ...summarizeHtmlCssCatalogForPrompt(htmlCssCatalogManifest).map((line) => `- ${line}`),
    '',
    '## AI component notes',
    '',
    ...(notes.length > 0
      ? notes
          .slice(0, 24)
          .map(
            (note) =>
              `- ${note.targetId ?? note.targetType} [${note.intent}]: ${compactLine(note.note, 240)}`,
          )
      : ['No component-specific AI notes yet.']),
    '',
    '## Token hints',
    '',
    ...tokens.slice(0, 24).map((token) => `- ${token.name}: ${token.value}`),
    '',
    '## Icon hints',
    '',
    ...(projectIconProps.length > 0
      ? projectIconProps
          .slice(0, 24)
          .map(
            (icon) =>
              `- ${icon.name}: <${icon.componentName ?? 'Icon'} ${icon.propName ?? 'iconName'}="${icon.name}" />`,
          )
      : [
          'No project Icon string-prop values detected yet. Use Lucide fallback as an import only.',
        ]),
    '',
    '## Asset hints',
    '',
    ...(assets.length > 0
      ? assets
          .slice(0, 24)
          .map(
            (asset) =>
              `- ${asset.name} (${asset.kind}) · ${asset.filePath}${asset.importSource && asset.importName ? ` · import ${asset.importName} from ${asset.importSource}` : ''}`,
          )
      : ['No indexed project assets yet.']),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

export function parseExistingAgentNotes(contents: string | null): {
  componentNotes: ComponentAgentNote[];
  projectNotes: ProjectAgentNote[];
} {
  const empty = { componentNotes: [], projectNotes: [] };
  if (!contents) return empty;
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce(
      (acc, line) => {
        try {
          const parsed = JSON.parse(line) as Partial<ComponentAgentNote & ProjectAgentNote>;
          if (!parsed.id || !parsed.note) return acc;
          if (parsed.targetType) {
            const projectNote: ProjectAgentNote = {
              id: parsed.id,
              targetType: parsed.targetType,
              ...(parsed.targetId ? { targetId: parsed.targetId } : {}),
              note: parsed.note,
              intent: normalizeIntent(parsed.intent),
              source: parsed.source ?? 'manual',
              createdAt: parsed.createdAt ?? Date.now(),
              updatedAt: parsed.updatedAt ?? parsed.createdAt ?? Date.now(),
            };
            acc.projectNotes.push(projectNote);
            if (projectNote.targetType === 'component' && projectNote.targetId) {
              acc.componentNotes.push({
                id: projectNote.id,
                componentId: projectNote.targetId,
                note: projectNote.note,
                intent: projectNote.intent,
                createdAt: projectNote.createdAt,
                updatedAt: projectNote.updatedAt,
              });
            }
            return acc;
          }
          if (parsed.componentId) {
            acc.componentNotes.push({
              id: parsed.id,
              componentId: parsed.componentId,
              note: parsed.note,
              intent: normalizeIntent(parsed.intent),
              createdAt: parsed.createdAt ?? Date.now(),
              updatedAt: parsed.updatedAt ?? parsed.createdAt ?? Date.now(),
            });
          }
          return acc;
        } catch {
          return acc;
        }
      },
      { componentNotes: [] as ComponentAgentNote[], projectNotes: [] as ProjectAgentNote[] },
    );
}

export function buildAgentNotes(
  componentNotes: ComponentAgentNote[],
  legacyComponentSelectionMapContents: string | null,
  components: IndexedComponentRecord[],
  existingProjectNotes: ProjectAgentNote[],
): ProjectAgentNote[] {
  const now = Date.now();
  const notes: ProjectAgentNote[] = [...existingProjectNotes];
  notes.push(
    ...componentNotes.map((note) => ({
      id: note.id,
      targetType: 'component' as const,
      targetId: note.componentId,
      note: note.note,
      intent: note.intent,
      source: 'component-note' as const,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    })),
  );
  notes.push(
    ...parseLegacyComponentSelectionMap(legacyComponentSelectionMapContents, components, now),
  );
  return dedupeById(notes).sort((a, b) => a.id.localeCompare(b.id));
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

function parseLegacyComponentSelectionMap(
  contents: string | null,
  components: IndexedComponentRecord[],
  timestamp: number,
): ProjectAgentNote[] {
  if (!contents) return [];
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('-'))
    .map((line, index) => {
      const component = components.find((candidate) =>
        line.toLowerCase().includes(candidate.shortName.toLowerCase()),
      );
      return {
        id: `legacy-component-map-${index + 1}`,
        targetType: component ? ('component' as const) : ('project' as const),
        ...(component ? { targetId: component.id } : {}),
        note: line.replace(/^-\s*/, ''),
        intent: 'usage' as const,
        source: 'legacy-component-selection-map' as const,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    });
}

export function buildDesignBrief(
  projectName: string,
  components: IndexedComponentRecord[],
  groups: ComponentGroupRecord[],
  tokens: TokenRecord[],
): string {
  const lines = [
    `# ${projectName} Design Brief`,
    '',
    '## Overview',
    '',
    `${projectName} uses this unified project index as the runtime source of truth for AI-assisted screen generation and Design mode compatibility.`,
    '',
    '## Component groups',
    '',
    ...groups.flatMap((group) => [
      `### ${group.name}`,
      group.guidance,
      `Components: ${group.componentIds.slice(0, 12).join(', ') || 'none'}`,
      '',
    ]),
    '## Components',
    '',
    ...(components.length > 0
      ? components
          .slice(0, 24)
          .map((component) => `- ${component.shortName} (${component.filePath})`)
      : ['- No indexed components yet.']),
    '',
    '## Token hints',
    '',
    ...(tokens.length > 0
      ? tokens.slice(0, 24).map((token) => `- ${token.name}: ${token.value}`)
      : ['- No indexed tokens yet.']),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

export function exportDesignMd(projectName: string, designBrief: string): string {
  return [
    '---',
    'version: alpha',
    `name: ${projectName}`,
    'description: "Portable design brief exported from the sber-designer unified project index."',
    '---',
    '',
    designBrief.trim(),
    '',
  ].join('\n');
}
