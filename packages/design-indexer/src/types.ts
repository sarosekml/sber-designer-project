import type {
  ComponentCatalog,
  ComponentDescriptionLayer,
  HtmlDesignSystemSources,
  ProjectIconSource,
  ProjectProfileContract,
  ProjectScreen,
} from '@sber-designer/shared-types';
export type {
  ProjectComponentModel,
  ProjectProfileContract,
  ProjectProfileKind,
  ProjectRenderProbe,
  ProjectScreenUnit,
} from '@sber-designer/shared-types';

export const DESIGN_INDEX_DIR = '.sber-designer/design-index';
export const DESIGN_ASSETS_DIR = '.sber-designer/assets';
export const ICON_SOURCE_MANIFEST_PATH = `${DESIGN_ASSETS_DIR}/icon-sources.json`;
export const MATERIALIZED_ASSETS_MANIFEST_PATH = `${DESIGN_ASSETS_DIR}/materialized-assets.json`;

export const CANONICAL_DESIGN_INDEX_PATHS = {
  manifest: `${DESIGN_INDEX_DIR}/manifest.json`,
  promptSummary: `${DESIGN_INDEX_DIR}/prompt-summary.md`,
  projectProfile: `${DESIGN_INDEX_DIR}/project-profile.json`,
  designBrief: `${DESIGN_INDEX_DIR}/design-brief.md`,
  components: `${DESIGN_INDEX_DIR}/components.jsonl`,
  htmlCssCatalogManifest: `${DESIGN_INDEX_DIR}/html-css-catalog-manifest.json`,
  componentGroups: `${DESIGN_INDEX_DIR}/component-groups.json`,
  tokens: `${DESIGN_INDEX_DIR}/tokens.json`,
  icons: `${DESIGN_INDEX_DIR}/icons.json`,
  iconCandidates: `${DESIGN_INDEX_DIR}/icon-candidates.jsonl`,
  externalIcons: `${DESIGN_INDEX_DIR}/external-icons.jsonl`,
  iconCatalog: `${DESIGN_INDEX_DIR}/icon-catalog.md`,
  assets: `${DESIGN_INDEX_DIR}/assets.jsonl`,
  routes: `${DESIGN_INDEX_DIR}/routes.json`,
  screens: `${DESIGN_INDEX_DIR}/screens.jsonl`,
  storybook: `${DESIGN_INDEX_DIR}/storybook.json`,
  usageExamples: `${DESIGN_INDEX_DIR}/usage-examples.jsonl`,
  usageSnippets: `${DESIGN_INDEX_DIR}/usage-snippets.jsonl`,
  usageCards: `${DESIGN_INDEX_DIR}/usage-cards.jsonl`,
  descriptionMap: `${DESIGN_INDEX_DIR}/description-map.json`,
  componentSelectionMap: `${DESIGN_INDEX_DIR}/component-selection-map.json`,
  patterns: `${DESIGN_INDEX_DIR}/patterns.jsonl`,
  agentNotes: `${DESIGN_INDEX_DIR}/agent-notes.jsonl`,
  diagnostics: `${DESIGN_INDEX_DIR}/diagnostics.json`,
  fingerprints: `${DESIGN_INDEX_DIR}/fingerprints.json`,
} as const;

export const DESIGN_INDEX_PATHS = {
  ...CANONICAL_DESIGN_INDEX_PATHS,
  legacyManifest: `${DESIGN_INDEX_DIR}/index.json`,
  legacyComponentNotes: `${DESIGN_INDEX_DIR}/component-notes.jsonl`,
  /**
   * Kept for old call sites while 0026 migrates component notes to
   * `agent-notes.jsonl`.
   */
  componentNotes: CANONICAL_DESIGN_INDEX_PATHS.agentNotes,
} as const;

export type DesignIndexStatus = 'missing' | 'valid' | 'stale' | 'warning' | 'error';

export interface DesignIndexDiagnostic {
  level: 'info' | 'warning' | 'error';
  filePath: string;
  message: string;
}

export interface DesignIndexArtifact {
  filePath: string;
  exists: boolean;
  sizeBytes?: number;
}

export interface DesignIndexCounts {
  components: number;
  componentGroups: number;
  tokens: number;
  icons: number;
  iconCandidates: number;
  iconSources: number;
  workspaceIconSources: number;
  externalIconSources: number;
  externalIcons: number;
  projectIconContracts: number;
  fallbackIcons: number;
  assets: number;
  illustrations: number;
  routes: number;
  screens: number;
  examples: number;
  usageSnippets: number;
  usageCards: number;
  /** Components with an authored `Description for AI` layer (0083 coverage). */
  describedComponents: number;
  patterns: number;
  notes: number;
  agentNotes: number;
  diagnostics: number;
}

export type DesignIndexQualityStatus = 'passed' | 'warning' | 'failed';

export interface DesignIndexQualityCheck {
  id: string;
  label: string;
  score: number;
  status: DesignIndexQualityStatus;
  detail: string;
  recommendation?: string;
}

export interface DesignIndexQualityViolation {
  id: string;
  severity: 'warning' | 'error';
  message: string;
  recommendation: string;
}

export interface DesignIndexQualityScore {
  score: number;
  checks: DesignIndexQualityCheck[];
  violations: DesignIndexQualityViolation[];
}

export interface DesignIndexManifest {
  /** 2 = pre-0080 indexes (no usage scan); 3 = adds usage snippets/cards/patterns. */
  version: 2 | 3;
  generatedAt: number;
  projectName: string;
  projectProfile?: ProjectProfileContract;
  sources: {
    storybookCatalog: boolean;
    staticScan: boolean;
    designMd: boolean;
    componentNotes: boolean;
    legacyComponentSelectionMap: boolean;
    lucideFallback: boolean;
    assetPacks: boolean;
    iconSources: boolean;
    externalIconSources: boolean;
    usageScan: boolean;
    screenTemplates: boolean;
  };
  counts: DesignIndexCounts;
  quality?: DesignIndexQualityScore;
  fingerprint: string;
  artifacts: Record<keyof typeof CANONICAL_DESIGN_INDEX_PATHS, string>;
}

export interface DesignIndexFingerprintState {
  version: 1;
  fingerprint: string;
  trackedFiles: number;
  checkedAt: number;
  files: string[];
}

export interface DesignIndexContext {
  status: DesignIndexStatus;
  stale: boolean;
  manifest: DesignIndexManifest | null;
  artifacts: DesignIndexArtifact[];
  diagnostics: DesignIndexDiagnostic[];
  fingerprint: string;
  trackedFiles: number;
  checkedAt?: number;
  promptSummary: string;
  descriptionMap?: ComponentDescriptionMapEntry[];
  componentSelectionMap?: ComponentSelectionMap;
  projectSystem?: ProjectSystemOverview;
}

export type ProjectSystemFreshness = 'missing' | 'ready' | 'stale' | 'needs-attention' | 'error';

export type ProjectSystemNextAction =
  | 'index-project'
  | 'reindex-project'
  | 'review-diagnostics'
  | 'ready';

export interface ProjectSystemContextItem {
  id:
    | 'components'
    | 'tokens'
    | 'icons'
    | 'assets'
    | 'screens'
    | 'routes'
    | 'examples'
    | 'agent-notes';
  label: string;
  description: string;
  count: number;
  status: 'ready' | 'empty' | 'missing' | 'warning';
  artifactPath: string;
}

export interface ProjectSystemOverview {
  projectName: string | null;
  status: DesignIndexStatus;
  freshness: ProjectSystemFreshness;
  nextAction: ProjectSystemNextAction;
  generatedAt: number | null;
  summary: string;
  counts: DesignIndexCounts;
  quality?: DesignIndexQualityScore;
  sources: DesignIndexManifest['sources'] | null;
  htmlDesignSystem?: HtmlDesignSystemSources;
  contextItems: ProjectSystemContextItem[];
  warnings: DesignIndexDiagnostic[];
}

export interface ComponentAgentNote {
  id: string;
  componentId: string;
  storybookTitle?: string;
  sourcePath?: string;
  note: string;
  intent: 'prefer' | 'avoid' | 'requirement' | 'deprecated' | 'usage' | 'other';
  createdAt: number;
  updatedAt: number;
}

export interface ProjectAgentNote {
  id: string;
  targetType: 'project' | 'component' | 'screen' | 'token' | 'icon' | 'asset';
  targetId?: string;
  note: string;
  intent: ComponentAgentNote['intent'];
  source: 'component-note' | 'legacy-component-selection-map' | 'agent' | 'manual';
  createdAt: number;
  updatedAt: number;
}

export interface IndexedComponentRecord {
  id: string;
  title: string;
  shortName: string;
  filePath: string;
  source?: 'react-index' | 'css-catalog';
  storyCount: number;
  stories: {
    id: string;
    name: string;
  }[];
  description?: string;
  descriptionLayer?: ComponentDescriptionLayer;
  requiredClasses?: string[];
  modifiers?: string[];
  canonicalHtml?: string;
  docsAnchor?: string;
  tags: string[];
  groupIds: string[];
  noteCount: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface HtmlCssCatalogManifestComponent {
  id: string;
  block: string;
  sourcePath: string;
  docsAnchor?: string;
  requiredClasses: string[];
  modifiers: string[];
}

export type HtmlCssDistillationValueCategory =
  | 'color'
  | 'spacing'
  | 'radius'
  | 'typography'
  | 'shadow'
  | 'unknown';

export interface HtmlCssDistillationValueFrequency {
  category: HtmlCssDistillationValueCategory;
  value: string;
  count: number;
  properties: string[];
  filePaths: string[];
}

export interface HtmlCssDistillationClassFrequency {
  className: string;
  count: number;
  filePaths: string[];
}

export interface HtmlCssDistillationInlineStyleViolation {
  filePath: string;
  tagName: string;
  classes: string[];
  property: string;
  value: string;
  category: HtmlCssDistillationValueCategory;
}

export interface HtmlCssDistillationSummary {
  values: HtmlCssDistillationValueFrequency[];
  classFrequencies: HtmlCssDistillationClassFrequency[];
  inlineStyleViolations: HtmlCssDistillationInlineStyleViolation[];
}

/**
 * Machine-prepared health signals for the HTML design-system package
 * (0108.5.2). Deterministic from the scanned CSS/HTML sources so the design
 * index quality score can grade `:root` tokens, dark-theme overrides,
 * component classes, and per-page token discipline without re-reading source.
 */
export interface HtmlDesignSystemSignals {
  /** Custom properties declared inside a `:root { ... }` block. */
  rootTokenCount: number;
  /** Custom properties declared anywhere (superset of rootTokenCount). */
  declaredTokenCount: number;
  /** True when a dark-theme override selector/media query is present. */
  themeOverride: boolean;
  /** Which dark-override selectors matched (e.g. `[data-theme="dark"]`). */
  themeOverrideSelectors: string[];
  /** Reusable class names declared in a components stylesheet (or CSS fallback). */
  componentClassCount: number;
  /** True when a file named `components.css` exists in the workspace. */
  hasComponentsStylesheet: boolean;
  /** Static HTML pages considered for token-discipline scoring. */
  pagesTotal: number;
  /** Pages that reference `var(--…)` or avoid raw inline color/spacing values. */
  pagesOnTokens: number;
  /** Pages with raw inline color/spacing values that should be tokens/classes. */
  pagesWithInlineHardcodes: number;
}

export interface HtmlCssCatalogManifest {
  version: 1;
  source: 'html-css-catalog';
  htmlFiles: string[];
  cssFiles: string[];
  classes: string[];
  selectors: string[];
  tokenNames: string[];
  customElements: string[];
  components: HtmlCssCatalogManifestComponent[];
  distillation: HtmlCssDistillationSummary;
  designSystemSignals: HtmlDesignSystemSignals;
  counts: {
    components: number;
    classes: number;
    selectors: number;
    tokensDeclared: number;
    customElements: number;
    htmlFiles: number;
    cssFiles: number;
    distillationValues: number;
    distillationClasses: number;
    inlineStyleViolations: number;
  };
}

export interface ComponentGroupRecord {
  id: string;
  name: string;
  guidance: string;
  componentIds: string[];
}

/**
 * 0083 — thin catalog projection for cheap "what exists + how it's named"
 * prompting. Strictly a projection: thick fields (purpose, variantGuidance,
 * requiredProps, canonical snippets) live only in usage-cards, never here.
 * Always compiled from source/usage-cards; never hand-edited.
 */
export interface ComponentDescriptionMapEntry {
  componentId: string;
  shortName: string;
  /** 2–3 retrieval keywords (authored `keywords`, else derived from the name). */
  keywords: string[];
  status: 'authored' | 'mined-draft' | 'missing';
  docsRef: {
    /** Storybook docs deep link, when the catalog came from Storybook. */
    storybookUrl?: string;
    /** Workspace-relative source file (story/component or sidecar). */
    sourcePath: string;
    anchor?: string;
  };
  /** 0..1 — how complete the authored layer is (manifest/progress signal). */
  coverageScore?: number;
}

/**
 * 0114 B6.2 — complete, compact planning projection of the project design
 * system. Unlike description-map.json this carries selection semantics, but it
 * still excludes full props, source excerpts, and canonical snippets. Those
 * heavy contracts remain in usage-cards/source and are hydrated only after a
 * component is selected.
 */
export interface ComponentSelectionMapEntry {
  componentId: string;
  publicName: string;
  title: string;
  sourcePath: string;
  source: 'react-index' | 'css-catalog';
  purpose?: string;
  roles: string[];
  capabilities: string[];
  keywords: string[];
  whenToUse: string[];
  whenNotToUse: string[];
  descriptionStatus: 'authored' | 'mined-draft' | 'missing' | 'diverged';
  evidenceConfidence: IndexedComponentRecord['confidence'];
  variantAxes: {
    prop: string;
    values: string[];
  }[];
}

export interface ComponentSelectionMap {
  version: 1;
  generatedAt: number;
  indexFingerprint: string;
  counts: {
    indexed: number;
    described: number;
    diverged: number;
  };
  entries: ComponentSelectionMapEntry[];
}

export interface TokenRecord {
  id: string;
  name: string;
  value: string;
  source: 'design-md' | 'css' | 'tailwind' | 'theme' | 'design-brief';
  filePath: string;
  kind: 'color' | 'spacing' | 'radius' | 'typography' | 'unknown';
  theme?: string;
}

export type AssetKind = 'icon' | 'illustration' | 'image';
export type AssetUsageMode = 'asset-url' | 'react-component' | 'public-url';

export interface AssetRecord {
  id: string;
  kind: AssetKind;
  name: string;
  filePath: string;
  usageMode: AssetUsageMode;
  importName?: string;
  importSource?: string;
  storybookTitle?: string;
  storybookStory?: string;
  tags: string[];
  packId?: string;
}

export interface ProjectProfileFile extends ProjectProfileContract {
  packageManager: 'bun' | 'pnpm' | 'yarn' | 'npm' | 'unknown';
  frameworks: string[];
  sourceRoots: string[];
  styling: string[];
  aliases: Record<string, string[]>;
  packageScripts: Record<string, string>;
  allowedUiPackages?: string[];
}

export interface RouteRecord {
  id: string;
  routePath: string;
  filePath: string;
  source: 'next-app' | 'next-pages' | 'react-router' | 'file-system' | 'unknown';
}

export interface RoutesIndexFile {
  routes: RouteRecord[];
}

export interface ScreenIndexRecord {
  id: string;
  name: string;
  implementationPath: string;
  storyPath?: string;
  routePath?: string;
  designReadableStatus: 'unknown' | 'candidate' | 'compatible' | 'needs-review';
  source: 'route' | 'catalog-story' | 'project-file' | 'file-system';
}

export interface StorybookIndexFile {
  exists: boolean;
  configPaths: string[];
  storiesGlobs: string[];
  source: 'detected' | 'not-found';
}

export interface UsageExampleRecord {
  id: string;
  componentId: string;
  title: string;
  when: string;
  source: 'description-layer' | 'storybook';
}

/** Where a usage fact / snippet / pattern evidence came from (0080). */
export type UsageFactSource =
  | 'description-layer'
  | 'css-catalog'
  | 'agent-note'
  | 'mined-usage'
  | 'mined-types'
  | 'interview'
  | 'reference-screen'
  | 'run-feedback';

export type UsageFactStatus = 'draft' | 'confirmed' | 'rejected';

export interface UsageFact {
  id: string;
  text: string;
  source: UsageFactSource;
  status: UsageFactStatus;
  evidence?: string;
  createdAt: number;
  updatedAt: number;
}

/** One mined JSX usage cluster for a catalog component (0080 Track A1). */
export interface UsageSnippetRecord {
  id: string;
  componentId: string;
  sourcePath: string;
  line: number;
  code: string;
  propNames: string[];
  /** Literal prop values readable from the opening tag, e.g. { variant: 'outlined' }. */
  propsPreview: Record<string, string>;
  /** Usages sharing this prop shape. */
  count: number;
  /** Share of this cluster among all mined usages of the component (0..1). */
  share: number;
  origin: 'story' | 'screen' | 'app' | 'internal' | 'corpus';
}

export interface ComponentUsageStats {
  componentId: string;
  totalCount: number;
  fileCount: number;
  pairsWith: { componentId: string; count: number }[];
}

export interface UsageCardVariantGuidance {
  prop: string;
  values: { value: string; meaning: string }[];
  source: 'ts-union' | 'argtypes' | 'description-layer' | 'css-catalog';
}

export interface UsageCardSnippet {
  code: string;
  sourcePath: string;
  label: string;
  source: UsageFactSource;
}

/**
 * Compiled, consumption-ready usage profile of one catalog component (0080).
 * Compiled from descriptionLayer + agent notes + mining + interview facts;
 * human fact statuses survive re-index by fact id.
 */
export interface ComponentUsageCard {
  componentId: string;
  publicImport: { name: string; module: string };
  /** HTML-first css-catalog contract: classes that should appear in canonical markup. */
  requiredClasses?: string[];
  /** HTML-first css-catalog contract: optional modifier classes for this block. */
  modifiers?: string[];
  purpose?: string;
  whenToUse: string[];
  whenNotToUse: string[];
  variantGuidance: UsageCardVariantGuidance[];
  propsThatMatter: { name: string; note: string }[];
  snippets: UsageCardSnippet[];
  pairsWith: string[];
  usageCount: number;
  visualRefs: string[];
  /** Used but carries no instantiation guidance — prioritize in the interview queue (0082). */
  incomplete?: boolean;
  facts: UsageFact[];
}

export type PatternEvidenceSource = UsageFactSource | 'screen-template';

/**
 * Composition pattern (0080): screen-kind records are compiled from project
 * screen templates; region-kind records come from mining/ingestion evidence.
 */
export interface CompositionPatternRecord {
  id: string;
  kind: 'screen' | 'region';
  name: string;
  description: string;
  slots: {
    role: string;
    required: boolean;
    componentIds: string[];
    preset?: string;
    notes?: string[];
  }[];
  skeleton?: { code: string; sourcePath?: string };
  evidence: { source: PatternEvidenceSource; ref: string }[];
  status: 'draft' | 'confirmed';
}

/** Parsed screen template handed to the index builder for pattern compile. */
export interface ScreenTemplatePatternInput {
  id: string;
  source: 'built-in' | 'project';
  name: string;
  description: string;
  kind: string;
  componentRoles?: { role: string; intent?: string }[];
  componentBindings?: { role: string; components: string[]; preset?: string }[];
  evidence?: string[];
  filePath?: string;
}

export interface IconIndexFile {
  projectIcons: {
    id: string;
    name: string;
    importName: string;
    filePath: string;
  }[];
  fallback: {
    provider: 'lucide';
    packageName: 'lucide-react';
    packageVersion: string;
    count: number;
    icons: {
      id: string;
      name: string;
      importName: string;
      tags: string[];
    }[];
  };
}

export interface IconSourceManifestEntry {
  id: string;
  name: string;
  kind: 'local-folder';
  mode: 'workspace' | 'external';
  families: ('icons' | 'illustrations')[];
  workspacePath?: string;
  /** Only the basename is stored for external sources; absolute local paths stay out of index files. */
  sourceLabel?: string;
  status: 'ready' | 'missing' | 'blocked';
  count: number;
  updatedAt?: number;
}

export interface IconSourceManifestFile {
  version: 1;
  generatedAt: number;
  sources: IconSourceManifestEntry[];
}

export interface ExternalIconRecord {
  id: string;
  name: string;
  source: 'external-icon-reference';
  sourceId: string;
  sourceName: string;
  sourceRelPath: string;
  extension: string;
  bytes?: number;
  hash?: string;
  tags: string[];
}

export type IconCandidateSource =
  | 'project-icon-prop'
  | 'project-asset'
  | 'project-file'
  | 'external-icon-reference'
  | 'lucide-fallback';

export type IconCandidateUsage =
  | 'project-icon-prop'
  | 'asset-import'
  | 'project-file-import'
  | 'materialize-asset'
  | 'lucide-import';

export interface IconCandidateRecord {
  id: string;
  name: string;
  source: IconCandidateSource;
  validFor: IconCandidateUsage[];
  confidence: 'high' | 'medium' | 'low' | 'fallback';
  componentName?: string;
  propName?: string;
  importName?: string;
  importSource?: string;
  filePath?: string;
  externalIconId?: string;
  sourceId?: string;
  sourceRelPath?: string;
  tags: string[];
}

export interface BuildDesignIndexInput {
  projectName: string;
  workspaceRoot: string;
  catalog: ComponentCatalog | null;
  projectScreens?: ProjectScreen[] | null;
  designMdContents: string | null;
  designMdPath?: string | null;
  designBriefContents?: string | null;
  existingComponentNotes: string | null;
  legacyComponentSelectionMapContents?: string | null;
  /** Raw usage-cards.jsonl from the previous index, to preserve fact statuses. */
  existingUsageCardsContents?: string | null;
  /** Confirmed component description sidecars keyed by component id. */
  componentSidecarLayers?: Record<string, ComponentDescriptionLayer> | null;
  /** Authored component description sections from visible design-system surfaces. */
  componentSurfaceLayers?: Record<string, ComponentDescriptionLayer> | null;
  /** Extra local roots (consumer repos) to mine for component usage. */
  usageCorpusPaths?: string[] | null;
  /** Parsed screen templates + their parse/validate diagnostics (0080 1.5). */
  screenTemplates?: {
    templates: ScreenTemplatePatternInput[];
    diagnostics: DesignIndexDiagnostic[];
  } | null;
  /** Project-owned icon/illustration source folders configured in Settings. */
  iconSources?: ProjectIconSource[] | null;
}

export interface BuiltDesignIndex {
  manifest: DesignIndexManifest;
  diagnostics: DesignIndexDiagnostic[];
  projectProfile: ProjectProfileFile;
  routes: RouteRecord[];
  screens: ScreenIndexRecord[];
  storybook: StorybookIndexFile;
  files: {
    filePath: string;
    contents: string;
  }[];
}
