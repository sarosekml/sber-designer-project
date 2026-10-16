/** Design context contract: artifact paths, limits, and result shapes. */
import type { ComponentCatalog } from '@sber-designer/shared-types';

export const DESIGN_MD_PATH = 'DESIGN.md';

export const COMPONENT_SELECTION_MAP_PATH = 'component-selection-map.md';

export const COMPONENT_SELECTION_MAP_FALLBACK_PATH = '.sber-designer/component-selection-map.md';

export const DESIGN_CONTEXT_STATE_PATH = '.sber-designer/design-context-state.json';

export const MAX_DESIGN_SECTION_CHARS = 900;

export const MAX_MAP_CHARS = 4_000;

export const MAX_PROMPT_SUMMARY_CHARS = 7_000;

export const MAX_TRACKED_FILES = 800;

export const STALE_DIAGNOSTIC_MESSAGE =
  'Design context tracked files changed since last validation or generation.';

export const FINGERPRINT_TRACKED_PATHS = [
  DESIGN_MD_PATH,
  COMPONENT_SELECTION_MAP_PATH,
  COMPONENT_SELECTION_MAP_FALLBACK_PATH,
  '.sber-designer/descriptions',
  '.storybook',
  'src/components',
  'src/stories',
  'src/pages',
  'src/app',
  'src/styles',
  'components',
  'app',
  'stories',
  'tokens',
  'theme',
  'styles',
] as const;

export const TRACKED_FILE_EXTENSIONS = new Set([
  '.css',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.mdx',
  '.scss',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);

export const SKIPPED_FINGERPRINT_DIRS = new Set([
  '.git',
  '.next',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'storybook-static',
]);

export const COMPONENT_FAMILY_RULES = [
  {
    heading: 'data tables',
    keywords: ['table', 'grid', 'datatable', 'data table', 'list'],
    guidance: 'Use for data tables, sortable grids, bulk actions, and dense result lists.',
  },
  {
    heading: 'forms and inputs',
    keywords: ['input', 'field', 'form', 'select', 'checkbox', 'radio', 'textarea', 'search'],
    guidance: 'Use for editing data, filtering, and collecting user input.',
  },
  {
    heading: 'navigation',
    keywords: ['nav', 'menu', 'breadcrumb', 'tabs', 'sidebar', 'command'],
    guidance: 'Use for page navigation, sidebars, breadcrumbs, and command surfaces.',
  },
  {
    heading: 'actions',
    keywords: ['button', 'action', 'toolbar', 'link', 'dropdown'],
    guidance: 'Use for primary, secondary, destructive, and toolbar actions.',
  },
  {
    heading: 'status and feedback',
    keywords: ['badge', 'status', 'alert', 'toast', 'empty', 'loader', 'progress', 'priority'],
    guidance: 'Use for states, priorities, validation, progress, and user feedback.',
  },
  {
    heading: 'surfaces and layout',
    keywords: ['card', 'modal', 'dialog', 'drawer', 'sheet', 'panel', 'layout', 'section'],
    guidance: 'Use for page sections, modal overlays, detail panels, and grouped content.',
  },
  {
    heading: 'data visualization',
    keywords: ['chart', 'graph', 'metric', 'kpi', 'stat'],
    guidance: 'Use for charts, KPIs, trends, and analytical summaries.',
  },
] as const;

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

export interface GenerateDesignContextOptions {
  projectName?: string | null;
  catalog?: ComponentCatalog | null;
  include?: 'design' | 'component-map' | 'both';
  overwrite?: boolean;
}

export interface GenerateDesignContextResult {
  changedFiles: string[];
  skippedFiles: string[];
  context: ProjectDesignContext;
}

export interface DesignContextState {
  version: 1;
  fingerprint: string;
  trackedFiles: number;
  checkedAt: number;
}
