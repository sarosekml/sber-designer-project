import { HTML_DESIGN_SYSTEM_PATHS } from '@sber-designer/shared-types';

import { fingerprintDesignIndex } from './fingerprint';
import { scanProjectAssets } from './asset-scanner';
import { scanProjectIconContracts } from './icon-contract-scanner';
import { scanConfiguredIconSources } from './icon-source-scanner';
import { emptyHtmlCssCatalogManifest, scanHtmlCssCatalog } from './html-css-catalog';
import { parseHtmlDesignSystemDesignMd } from './design-md-parser';
import { compileScreenTemplatePatterns } from './pattern-compile';
import { scanProjectProfile } from './project-profile-scanner';
import { parseProjectStyleContract } from './project-style-contract';
import { scanRoutes } from './route-scanner';
import { buildScreenIndex } from './screen-scanner';
import { scanStorybook } from './storybook-scanner';
import { scanProjectTokens } from './token-scanner';
import { buildDescriptionMap, countDescribedComponents } from './description-map';
import { buildComponentSelectionMap } from './component-selection-map';
import {
  applyCssCatalogDescriptionLayers,
  buildDescriptionLayerDivergenceDiagnostics,
} from './description-adoption';
import { buildUsageCards } from './usage-cards';
import { scanComponentUsage } from './usage-scanner';
import { scanComponentVariants } from './variant-scanner';
import {
  CANONICAL_DESIGN_INDEX_PATHS,
  DESIGN_INDEX_PATHS,
  ICON_SOURCE_MANIFEST_PATH,
  type BuildDesignIndexInput,
  type BuiltDesignIndex,
  type DesignIndexManifest,
} from './types';
import { buildComponents, buildGroups, buildUsageExamples, dedupeById } from './builder-components';
import { buildIconCandidates, buildIconCatalog, buildIcons } from './builder-icons';
import {
  buildAgentNotes,
  buildDesignBrief,
  buildPromptSummary,
  exportDesignMd,
  parseExistingAgentNotes,
} from './builder-notes';
import { buildDesignIndexQuality, buildDiagnostics } from './builder-quality';

export async function buildDesignIndex(input: BuildDesignIndexInput): Promise<BuiltDesignIndex> {
  const existingNotes = parseExistingAgentNotes(input.existingComponentNotes);
  const componentNotes = existingNotes.componentNotes;
  const projectProfile = await scanProjectProfile(input.workspaceRoot);
  const storybook = await scanStorybook(input.workspaceRoot);
  const routes = await scanRoutes(input.workspaceRoot, { frameworks: projectProfile.frameworks });
  const htmlCssCatalog =
    projectProfile.componentModel === 'css-catalog'
      ? await scanHtmlCssCatalog(input.workspaceRoot)
      : null;
  const projectStyleContract = parseProjectStyleContract(
    input.designMdContents,
    input.designMdPath ??
      (projectProfile.componentModel === 'css-catalog'
        ? HTML_DESIGN_SYSTEM_PATHS.designMd
        : 'DESIGN.md'),
  );
  const parsedDesignMd =
    projectProfile.componentModel === 'css-catalog' && !projectStyleContract
      ? parseHtmlDesignSystemDesignMd(
          input.designMdContents,
          input.designMdPath ?? HTML_DESIGN_SYSTEM_PATHS.designMd,
        )
      : null;
  const components = applyCssCatalogDescriptionLayers(
    buildComponents(input, componentNotes, htmlCssCatalog?.components ?? []),
    input.componentSidecarLayers ?? null,
    input.componentSurfaceLayers ?? null,
  );
  const agentNotes = buildAgentNotes(
    componentNotes,
    input.legacyComponentSelectionMapContents ?? null,
    components,
    existingNotes.projectNotes,
  );
  const groups = buildGroups(components);
  const tokens = await scanProjectTokens(
    input.workspaceRoot,
    input.designMdContents,
    input.designBriefContents ?? null,
  );
  const examples = buildUsageExamples(input);
  const generatedAt = Date.now();
  const iconSourceScan = await scanConfiguredIconSources(
    input.workspaceRoot,
    input.iconSources,
    generatedAt,
  );
  const icons = await buildIcons(input.workspaceRoot, iconSourceScan.workspaceProjectIcons);
  const assets = dedupeById([
    ...(await scanProjectAssets(input.workspaceRoot)),
    ...iconSourceScan.workspaceAssets,
  ]);
  const iconCandidates = buildIconCandidates(
    await scanProjectIconContracts(input.workspaceRoot),
    icons,
    assets,
    iconSourceScan.externalIcons,
  );
  const screens = buildScreenIndex({
    routes,
    catalog: input.catalog,
    ...(input.projectScreens ? { projectScreens: input.projectScreens } : {}),
    ...(htmlCssCatalog ? { htmlPages: htmlCssCatalog.htmlFiles } : {}),
  });
  const usage = await scanComponentUsage({
    workspaceRoot: input.workspaceRoot,
    components,
    corpusRoots: input.usageCorpusPaths ?? null,
  });
  const variants = await scanComponentVariants({ workspaceRoot: input.workspaceRoot, components });
  const usageCards = buildUsageCards({
    components,
    snippets: usage.snippets,
    stats: usage.stats,
    variants,
    agentNotes,
    existingCardsContents: input.existingUsageCardsContents ?? null,
    generatedAt,
  });
  const descriptionMap = buildDescriptionMap({
    components,
    usageCards,
    catalogSource: input.catalog?.source ?? null,
    previewUrl: input.catalog?.previewUrl ?? null,
  });
  const compiledPatterns = compileScreenTemplatePatterns(
    input.screenTemplates?.templates ?? [],
    components,
  );
  const fingerprint = await fingerprintDesignIndex(input.workspaceRoot);
  const diagnostics = [
    ...buildDiagnostics(
      input,
      components,
      tokens,
      agentNotes,
      projectProfile,
      parsedDesignMd,
      projectStyleContract,
    ),
    ...buildDescriptionLayerDivergenceDiagnostics(input, components),
    ...usage.diagnostics,
    ...compiledPatterns.diagnostics,
    ...(input.screenTemplates?.diagnostics ?? []),
    ...iconSourceScan.diagnostics,
    ...(htmlCssCatalog?.diagnostics ?? []),
  ];
  const componentSelectionMap = buildComponentSelectionMap({
    components,
    usageCards,
    descriptionMap,
    diagnostics,
    generatedAt,
    indexFingerprint: fingerprint.value,
  });
  const designBrief = buildDesignBrief(input.projectName, components, groups, tokens);
  const htmlCssCatalogManifest = htmlCssCatalog?.manifest ?? emptyHtmlCssCatalogManifest();

  const profileSnapshot = projectProfileSnapshot(projectProfile);
  const manifest: DesignIndexManifest = {
    version: 3,
    generatedAt,
    projectName: input.projectName,
    ...(profileSnapshot ? { projectProfile: profileSnapshot } : {}),
    sources: {
      storybookCatalog: input.catalog?.source === 'storybook',
      staticScan:
        input.catalog?.source === 'static' || (htmlCssCatalog?.components.length ?? 0) > 0,
      designMd: Boolean(input.designMdContents?.trim()),
      componentNotes: componentNotes.length > 0,
      legacyComponentSelectionMap: Boolean(input.legacyComponentSelectionMapContents?.trim()),
      lucideFallback: icons.fallback.count > 0,
      assetPacks: assets.length > 0,
      iconSources: iconSourceScan.sourceManifest.sources.length > 0,
      externalIconSources: iconSourceScan.externalIcons.length > 0,
      usageScan: usage.snippets.length > 0,
      screenTemplates: compiledPatterns.patterns.length > 0,
    },
    counts: {
      components: components.length,
      componentGroups: groups.length,
      tokens: tokens.length,
      icons:
        icons.projectIcons.length +
        assets.filter((asset) => asset.kind === 'icon').length +
        iconSourceScan.externalIcons.length +
        icons.fallback.count,
      iconCandidates: iconCandidates.length,
      iconSources: iconSourceScan.sourceManifest.sources.length,
      workspaceIconSources: iconSourceScan.sourceManifest.sources.filter(
        (source) => source.mode === 'workspace',
      ).length,
      externalIconSources: iconSourceScan.sourceManifest.sources.filter(
        (source) => source.mode === 'external',
      ).length,
      externalIcons: iconSourceScan.externalIcons.length,
      projectIconContracts: iconCandidates.filter((icon) => icon.source === 'project-icon-prop')
        .length,
      fallbackIcons: icons.fallback.count,
      assets: assets.length,
      illustrations: assets.filter((asset) => asset.kind === 'illustration').length,
      routes: routes.length,
      screens: screens.length,
      examples: examples.length,
      usageSnippets: usage.snippets.length,
      usageCards: usageCards.length,
      describedComponents: countDescribedComponents(descriptionMap),
      patterns: compiledPatterns.patterns.length,
      notes: agentNotes.length,
      agentNotes: agentNotes.length,
      diagnostics: diagnostics.length,
    },
    fingerprint: fingerprint.value,
    artifacts: CANONICAL_DESIGN_INDEX_PATHS,
  };
  manifest.quality = buildDesignIndexQuality({
    manifest,
    components,
    usageCards,
    descriptionMap,
    diagnostics,
    htmlCssCatalogManifest,
    projectProfile,
    parsedDesignMd,
    projectStyleContract,
  });

  const promptSummary = buildPromptSummary(
    input.projectName,
    manifest,
    groups,
    components,
    tokens,
    iconCandidates,
    assets,
    agentNotes,
    htmlCssCatalogManifest,
    parsedDesignMd,
    projectStyleContract,
  );
  const fingerprintState = {
    version: 1,
    fingerprint: fingerprint.value,
    trackedFiles: fingerprint.trackedFiles,
    checkedAt: manifest.generatedAt,
    files: fingerprint.files,
  };
  const shouldExportLegacyDesignMd =
    projectProfile.kind !== 'html-css' && projectStyleContract === null;

  return {
    manifest,
    diagnostics,
    projectProfile,
    routes,
    screens,
    storybook,
    files: [
      ...(shouldExportLegacyDesignMd
        ? [{ filePath: 'DESIGN.md', contents: exportDesignMd(input.projectName, designBrief) }]
        : []),
      jsonFile(DESIGN_INDEX_PATHS.manifest, manifest),
      { filePath: DESIGN_INDEX_PATHS.promptSummary, contents: promptSummary },
      jsonFile(DESIGN_INDEX_PATHS.projectProfile, projectProfile),
      { filePath: DESIGN_INDEX_PATHS.designBrief, contents: designBrief },
      jsonlFile(DESIGN_INDEX_PATHS.components, components),
      jsonFile(DESIGN_INDEX_PATHS.htmlCssCatalogManifest, htmlCssCatalogManifest),
      jsonFile(DESIGN_INDEX_PATHS.componentGroups, { groups }),
      jsonFile(DESIGN_INDEX_PATHS.tokens, { tokens }),
      jsonFile(DESIGN_INDEX_PATHS.icons, icons),
      jsonlFile(DESIGN_INDEX_PATHS.iconCandidates, iconCandidates),
      jsonlFile(DESIGN_INDEX_PATHS.externalIcons, iconSourceScan.externalIcons),
      { filePath: DESIGN_INDEX_PATHS.iconCatalog, contents: buildIconCatalog(iconCandidates) },
      jsonFile(ICON_SOURCE_MANIFEST_PATH, iconSourceScan.sourceManifest),
      jsonlFile(DESIGN_INDEX_PATHS.assets, assets),
      jsonFile(DESIGN_INDEX_PATHS.routes, { routes }),
      jsonlFile(DESIGN_INDEX_PATHS.screens, screens),
      jsonFile(DESIGN_INDEX_PATHS.storybook, storybook),
      jsonlFile(DESIGN_INDEX_PATHS.usageExamples, examples),
      jsonlFile(DESIGN_INDEX_PATHS.usageSnippets, usage.snippets),
      jsonlFile(DESIGN_INDEX_PATHS.usageCards, usageCards),
      jsonFile(DESIGN_INDEX_PATHS.descriptionMap, { entries: descriptionMap }),
      jsonFile(DESIGN_INDEX_PATHS.componentSelectionMap, componentSelectionMap),
      jsonlFile(DESIGN_INDEX_PATHS.patterns, compiledPatterns.patterns),
      jsonlFile(DESIGN_INDEX_PATHS.agentNotes, agentNotes),
      jsonFile(DESIGN_INDEX_PATHS.diagnostics, { diagnostics }),
      jsonFile(DESIGN_INDEX_PATHS.fingerprints, fingerprintState),
    ],
  };
}

function projectProfileSnapshot(input: DesignIndexManifest['projectProfile']) {
  if (!input) return undefined;
  return {
    kind: input.kind,
    screenUnit: input.screenUnit,
    componentModel: input.componentModel,
    renderProbe: input.renderProbe,
    ...(input.allowedUiPackages?.length ? { allowedUiPackages: input.allowedUiPackages } : {}),
    ...(input.htmlDesignSystem ? { htmlDesignSystem: input.htmlDesignSystem } : {}),
  };
}

function jsonFile(filePath: string, value: unknown) {
  return { filePath, contents: `${JSON.stringify(value, null, 2)}\n` };
}

function jsonlFile(filePath: string, records: unknown[]) {
  return {
    filePath,
    contents:
      records.length > 0 ? `${records.map((record) => JSON.stringify(record)).join('\n')}\n` : '',
  };
}

export function compactLine(value: string, max: number): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 3).trim()}...`;
}
