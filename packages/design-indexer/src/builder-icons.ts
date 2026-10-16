/**
 * Icon records for the design index (0136 R12 — extracted from builder.ts).
 *
 * Turns scanned icon candidates into indexed records, ranks their sources,
 * and renders the catalog the agent reads.
 */
import { readFile } from 'node:fs/promises';
import { BUILTIN_LUCIDE_ICONS_URL, type BuiltinIconRegistry } from './builtin-icons/index';
import { scanProjectIcons } from './icon-scanner';
import {
  type ExternalIconRecord,
  type IconIndexFile,
  type IconCandidateRecord,
  type AssetRecord,
} from './types';
import { dedupeById, kebabWords, slug } from './builder-components';

export async function buildIcons(
  workspaceRoot: string,
  configuredProjectIcons: IconIndexFile['projectIcons'],
): Promise<IconIndexFile> {
  const registry = JSON.parse(
    await readFile(BUILTIN_LUCIDE_ICONS_URL, 'utf8'),
  ) as BuiltinIconRegistry;
  return {
    projectIcons: dedupeById([
      ...(await scanProjectIcons(workspaceRoot)),
      ...configuredProjectIcons,
    ]).sort((a, b) => a.filePath.localeCompare(b.filePath)),
    fallback: {
      provider: 'lucide',
      packageName: 'lucide-react',
      packageVersion: registry.packageVersion,
      count: registry.icons.length,
      icons: registry.icons.map((icon) => ({
        id: icon.id,
        name: icon.name,
        importName: icon.importName,
        tags: icon.tags,
      })),
    },
  };
}

export function buildIconCandidates(
  contractIcons: IconCandidateRecord[],
  icons: IconIndexFile,
  assets: AssetRecord[],
  externalIcons: ExternalIconRecord[],
): IconCandidateRecord[] {
  const records: IconCandidateRecord[] = [
    ...contractIcons,
    ...assets
      .filter((asset) => asset.kind === 'icon')
      .map((asset) => ({
        id: `icon-candidate-project-asset-${slug(asset.name)}`,
        name: asset.name,
        source: 'project-asset' as const,
        validFor: ['asset-import' as const],
        confidence: 'high' as const,
        filePath: asset.filePath,
        ...(asset.importName ? { importName: asset.importName } : {}),
        ...(asset.importSource ? { importSource: asset.importSource } : {}),
        tags: asset.tags,
      })),
    ...icons.projectIcons.map((icon) => ({
      id: `icon-candidate-project-file-${slug(icon.name)}`,
      name: icon.name,
      source: 'project-file' as const,
      validFor: ['project-file-import' as const],
      confidence: 'medium' as const,
      importName: icon.importName,
      filePath: icon.filePath,
      tags: Array.from(new Set([...kebabWords(icon.name), ...kebabWords(icon.filePath)])),
    })),
    ...externalIcons.map((icon) => ({
      id: `icon-candidate-external-reference-${slug(icon.sourceId)}-${slug(icon.sourceRelPath)}`,
      name: icon.name,
      source: 'external-icon-reference' as const,
      validFor: ['materialize-asset' as const],
      confidence: 'medium' as const,
      externalIconId: icon.id,
      sourceId: icon.sourceId,
      sourceRelPath: icon.sourceRelPath,
      tags: icon.tags,
    })),
    ...icons.fallback.icons.map((icon) => ({
      id: `icon-candidate-lucide-fallback-${slug(icon.name)}`,
      name: icon.name,
      source: 'lucide-fallback' as const,
      validFor: ['lucide-import' as const],
      confidence: 'fallback' as const,
      importName: icon.importName,
      importSource: icons.fallback.packageName,
      tags: icon.tags,
    })),
  ];
  return dedupeById(records).sort((a, b) => {
    const sourceDelta = iconSourceRank(a.source) - iconSourceRank(b.source);
    return sourceDelta === 0 ? a.name.localeCompare(b.name) : sourceDelta;
  });
}

export function buildIconCatalog(records: IconCandidateRecord[]): string {
  const projectProp = records.filter((record) => record.source === 'project-icon-prop');
  const projectAssets = records.filter((record) => record.source === 'project-asset');
  const projectFiles = records.filter((record) => record.source === 'project-file');
  const external = records.filter((record) => record.source === 'external-icon-reference');
  const fallback = records.filter((record) => record.source === 'lucide-fallback');
  const lines = [
    '# Icon catalog',
    '',
    '## Icon resolution order',
    '',
    '1. `project-icon-prop`: strings that are valid for the project icon component, usually `<Icon iconName="..." />`.',
    '2. `project-asset`: imported local SVG/image assets.',
    '3. `project-file`: local icon component files.',
    '4. `external-icon-reference`: configured external icon folders; materialize before use.',
    '5. `lucide-fallback`: built-in Lucide imports when no project icon fits.',
    '',
    'Always call `get_indexed_icon` before using an icon. Lucide fallback icons are valid for `lucide-react` imports, not for a project `Icon` string prop unless the same name appears as `project-icon-prop`.',
    '',
    `Project iconName values: ${projectProp.length}`,
    ...projectProp
      .slice(0, 80)
      .map(
        (record) =>
          `- ${record.name}: <${record.componentName ?? 'Icon'} ${record.propName ?? 'iconName'}="${record.name}" />`,
      ),
    '',
    `Project asset icons: ${projectAssets.length}`,
    ...projectAssets
      .slice(0, 40)
      .map((record) => `- ${record.name}: ${record.filePath ?? record.importName ?? record.id}`),
    '',
    `Project file icons: ${projectFiles.length}`,
    ...projectFiles
      .slice(0, 40)
      .map((record) => `- ${record.name}: ${record.filePath ?? record.importName ?? record.id}`),
    '',
    `External icon references: ${external.length}`,
    ...external
      .slice(0, 40)
      .map((record) => `- ${record.name}: materialize ${record.externalIconId ?? record.id}`),
    '',
    `Lucide fallback icons: ${fallback.length}`,
    ...fallback
      .slice(0, 80)
      .map(
        (record) =>
          `- ${record.name}: import { ${record.importName ?? record.name} } from '${record.importSource ?? 'lucide-react'}'`,
      ),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function iconSourceRank(source: IconCandidateRecord['source']): number {
  if (source === 'project-icon-prop') return 0;
  if (source === 'project-asset') return 1;
  if (source === 'project-file') return 2;
  if (source === 'external-icon-reference') return 3;
  return 4;
}
