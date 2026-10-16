/**
 * Wire shapes of the unified project index (0136 R12 — extracted from
 * project-index.ts).
 *
 * Design context artifacts, the design-index manifest and its quality score,
 * index jobs, setup answers, component agent notes, asset packs, and the
 * Design System Browser feed. Types only — components and hooks import from
 * here, so adding a field is a change to one file rather than a scroll past
 * every fetch call.
 */
import type {
  ComponentDescriptionLayer,
  HtmlDesignSystemImportedFile,
  HtmlDesignSystemSkippedImportFile,
} from '@sber-designer/shared-types';

export interface DesignContextArtifact {
  filePath: string;
  exists: boolean;
  excerpt: string;
}

export interface DesignContextDiagnostic {
  level: 'info' | 'warning' | 'error';
  filePath: string;
  message: string;
}

export interface DesignContextValidation {
  status: 'valid' | 'warning' | 'error' | 'stale';
  stale: boolean;
  validator: 'sber-designer/design-md-local';
  designMdSpecVersion: string;
  googleDesignMdSourceCommit: string;
  fingerprint: string;
  trackedFiles: number;
  checkedAt?: number;
}

export interface ProjectDesignContext {
  design: DesignContextArtifact;
  componentSelectionMap: DesignContextArtifact;
  diagnostics: DesignContextDiagnostic[];
  validation: DesignContextValidation;
  promptSummary: string;
}

export interface GenerateDesignContextResult {
  changedFiles: string[];
  skippedFiles: string[];
  context: ProjectDesignContext;
}

export interface ProjectDesignIndexArtifact {
  filePath: string;
  exists: boolean;
  sizeBytes?: number;
}

export interface ProjectDesignIndexDiagnostic {
  level: 'info' | 'warning' | 'error';
  filePath: string;
  message: string;
}

export interface ProjectDesignIndexQualityCheck {
  id: string;
  label: string;
  score: number;
  status: 'passed' | 'warning' | 'failed';
  detail: string;
  recommendation?: string;
}

export interface ProjectDesignIndexQualityViolation {
  id: string;
  severity: 'warning' | 'error';
  message: string;
  recommendation: string;
}

export interface ProjectDesignIndexQualityScore {
  score: number;
  checks: ProjectDesignIndexQualityCheck[];
  violations: ProjectDesignIndexQualityViolation[];
}

export interface ProjectDesignIndexManifest {
  version: 2 | 3;
  generatedAt: number;
  projectName: string;
  sources: {
    storybookCatalog: boolean;
    staticScan: boolean;
    designMd: boolean;
    componentNotes: boolean;
    legacyComponentSelectionMap?: boolean;
    lucideFallback: boolean;
    assetPacks?: boolean;
    iconSources?: boolean;
    externalIconSources?: boolean;
    usageScan?: boolean;
    screenTemplates?: boolean;
  };
  counts: {
    components: number;
    componentGroups: number;
    tokens: number;
    icons: number;
    iconCandidates?: number;
    iconSources?: number;
    workspaceIconSources?: number;
    externalIconSources?: number;
    externalIcons?: number;
    projectIconContracts?: number;
    fallbackIcons?: number;
    assets?: number;
    illustrations?: number;
    routes?: number;
    screens?: number;
    examples: number;
    usageSnippets?: number;
    usageCards?: number;
    describedComponents?: number;
    patterns?: number;
    notes: number;
    agentNotes?: number;
    diagnostics: number;
  };
  quality?: ProjectDesignIndexQualityScore;
  fingerprint: string;
  artifacts: Record<string, string>;
}

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
  status: ProjectDesignIndexContext['status'];
  freshness: 'missing' | 'ready' | 'stale' | 'needs-attention' | 'error';
  nextAction: 'index-project' | 'reindex-project' | 'review-diagnostics' | 'ready';
  generatedAt: number | null;
  summary: string;
  counts: ProjectDesignIndexManifest['counts'];
  quality?: ProjectDesignIndexQualityScore;
  sources: ProjectDesignIndexManifest['sources'] | null;
  htmlDesignSystem?: ProjectProfileFile['htmlDesignSystem'];
  contextItems: ProjectSystemContextItem[];
  warnings: ProjectDesignIndexDiagnostic[];
}

export interface ProjectDesignIndexContext {
  status: 'missing' | 'valid' | 'stale' | 'warning' | 'error';
  stale: boolean;
  manifest: ProjectDesignIndexManifest | null;
  artifacts: ProjectDesignIndexArtifact[];
  diagnostics: ProjectDesignIndexDiagnostic[];
  fingerprint: string;
  trackedFiles: number;
  checkedAt?: number;
  promptSummary: string;
  projectSystem?: ProjectSystemOverview;
}

export interface GenerateProjectDesignIndexResult {
  changedFiles: string[];
  context: ProjectDesignIndexContext;
  job?: ProjectIndexJob;
}

export type ProjectIndexJobStage =
  | 'queued'
  | 'scanning'
  | 'enriching'
  | 'writing'
  | 'validating'
  | 'complete'
  | 'failed';

export interface ProjectIndexJobProgressEvent {
  stage: ProjectIndexJobStage;
  message: string;
  createdAt: number;
}

export interface ProjectIndexJob {
  id: string;
  workspaceRoot: string;
  projectName: string;
  status: 'queued' | 'running' | 'complete' | 'failed';
  stage: ProjectIndexJobStage;
  enrich: boolean;
  createdAt: number;
  updatedAt: number;
  progress: ProjectIndexJobProgressEvent[];
  changedFiles: string[];
  context: ProjectDesignIndexContext | null;
  error: string | null;
}

export interface ProjectIndexJobResponse {
  job: ProjectIndexJob;
}

export interface ProjectComponentAgentNote {
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
  intent: ProjectComponentAgentNote['intent'];
  source: 'component-note' | 'legacy-component-selection-map' | 'agent' | 'manual';
  createdAt: number;
  updatedAt: number;
}

export interface AddProjectComponentNoteResult {
  note: ProjectAgentNote;
  changedFiles: string[];
  context: ProjectDesignIndexContext;
}

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

export interface SaveProjectSetupAnswersResult {
  changedFiles: string[];
  browser: ProjectDesignSystemBrowser;
}

export interface SaveHtmlDesignSystemSourcesInput {
  workspacePath?: string;
  presetId?: import('@sber-designer/shared-types').HtmlDesignSystemPresetId;
  sources?: {
    designMd?: string;
    tokensCss?: string;
    componentsCss?: string;
    designSystemHtml?: string;
  };
}

export interface SaveHtmlDesignSystemSourcesResult {
  changedFiles: string[];
  browser: ProjectDesignSystemBrowser;
  job?: ProjectIndexJob;
}

export interface ImportHtmlDesignSystemFilesResult {
  imported: HtmlDesignSystemImportedFile[];
  skipped: HtmlDesignSystemSkippedImportFile[];
  changedFiles: string[];
  preview: {
    changedFile: string;
    tokenCount: number;
    componentClassCount: number;
    referencePageCount: number;
  } | null;
  reindexJobId: string | null;
  browser: ProjectDesignSystemBrowser;
}

export interface HtmlDesignSystemProposalFile {
  label: string;
  path: string;
  required: boolean;
  exists: boolean;
  excerpt: string;
}

export interface HtmlDesignSystemProposal {
  id: string;
  filePath: string;
  ready: boolean;
  updatedAt: number;
  files: HtmlDesignSystemProposalFile[];
  reportExcerpt: string;
  styleContract?: {
    required: boolean;
    recognized: boolean;
    complete: boolean;
    presentSections: number;
    totalSections: number;
    diagnostics: string[];
  };
}

export interface HtmlDesignSystemProposalsResult {
  proposals: HtmlDesignSystemProposal[];
}

export interface AcceptHtmlDesignSystemProposalResult extends HtmlDesignSystemProposalsResult {
  changedFiles: string[];
  deletedProposalPath: string;
  browser: ProjectDesignSystemBrowser;
  job?: ProjectIndexJob;
}

export interface RejectHtmlDesignSystemProposalResult extends HtmlDesignSystemProposalsResult {
  changedFiles: string[];
  deletedProposalPath: string;
}

export interface ProjectProfileFile {
  kind: 'react-storybook' | 'react' | 'html-css' | 'empty';
  screenUnit: {
    sourceGlob: string;
    storyRequired: boolean;
    rootMarker: string;
  };
  componentModel: 'react-index' | 'css-catalog';
  renderProbe: 'storybook' | 'static-html';
  packageManager: 'bun' | 'pnpm' | 'yarn' | 'npm' | 'unknown';
  frameworks: string[];
  sourceRoots: string[];
  styling: string[];
  aliases: Record<string, string[]>;
  packageScripts: Record<string, string>;
  allowedUiPackages?: string[];
  htmlDesignSystem?: {
    status: import('@sber-designer/shared-types').HtmlDesignSystemStatus;
    folderPath?: string;
    referencePages?: string[];
    foundRequired: Array<'design-md' | 'tokens-css' | 'components-css' | 'design-system-preview'>;
    missingRequired: Array<'design-md' | 'tokens-css' | 'components-css' | 'design-system-preview'>;
    sources: Array<{
      id: 'design-md' | 'tokens-css' | 'components-css' | 'design-system-preview';
      label: string;
      required: boolean;
      canonicalPath: string;
      aliases: string[];
      status: 'found' | 'missing';
      foundPath?: string;
    }>;
  };
}

export interface IndexedComponentRecord {
  id: string;
  title: string;
  shortName: string;
  filePath: string;
  source?: 'react-index' | 'css-catalog';
  storyCount: number;
  stories: { id: string; name: string }[];
  description?: string;
  descriptionLayer?: ComponentDescriptionLayer;
  descriptionSource?: {
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
  };
  requiredClasses?: string[];
  modifiers?: string[];
  canonicalHtml?: string;
  docsAnchor?: string;
  tags: string[];
  groupIds: string[];
  noteCount: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface ComponentGroupRecord {
  id: string;
  name: string;
  guidance: string;
  componentIds: string[];
}

export interface TokenRecord {
  id: string;
  name: string;
  value: string;
  source: string;
  filePath: string;
  kind: 'color' | 'spacing' | 'radius' | 'typography' | 'unknown';
  theme?: string;
}

export interface AssetRecord {
  id: string;
  kind: 'icon' | 'illustration' | 'image';
  name: string;
  filePath: string;
  usageMode: 'asset-url' | 'react-component' | 'public-url';
  importName?: string;
  importSource?: string;
  storybookTitle?: string;
  storybookStory?: string;
  tags: string[];
  packId?: string;
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

export interface RouteRecord {
  id: string;
  routePath: string;
  filePath: string;
  source: 'next-app' | 'next-pages' | 'react-router' | 'file-system' | 'unknown';
}

export interface UsageExampleRecord {
  id: string;
  componentId: string;
  title: string;
  when: string;
  source: 'description-layer' | 'storybook';
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
    packageName: string;
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

export interface IconCandidateRecord {
  id: string;
  name: string;
  source:
    | 'project-icon-prop'
    | 'project-asset'
    | 'project-file'
    | 'external-icon-reference'
    | 'lucide-fallback';
  validFor: (
    | 'project-icon-prop'
    | 'asset-import'
    | 'project-file-import'
    | 'materialize-asset'
    | 'lucide-import'
  )[];
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

export interface StorybookIndexFile {
  exists: boolean;
  configPaths: string[];
  storiesGlobs: string[];
  source: 'detected' | 'not-found';
}

export interface ProjectDesignSystemBrowser {
  context: ProjectDesignIndexContext;
  projectProfile: ProjectProfileFile | null;
  storybook: StorybookIndexFile | null;
  setupQuestions: ProjectSetupQuestion[];
  components: IndexedComponentRecord[];
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

export type AssetPackKind = 'icons' | 'illustrations';

export interface ImportAssetPackInput {
  workspacePath?: string;
  sourcePath: string;
  packName?: string;
  kinds: AssetPackKind[];
  overwrite?: boolean;
}

export interface ImportAssetPackResult {
  changedFiles: string[];
  imported: number;
  skipped: { filePath: string; reason: string }[];
  diagnostics: { level: 'info' | 'warning' | 'error'; message: string }[];
}
