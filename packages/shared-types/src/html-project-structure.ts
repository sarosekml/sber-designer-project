export type HtmlProjectStructureStatus = 'canonical' | 'non-canonical' | 'missing' | 'unsupported';

export type HtmlProjectStructureFileKind =
  | 'page'
  | 'design-system-source'
  | 'design-system-reference'
  | 'stylesheet'
  | 'script'
  | 'asset'
  | 'managed'
  | 'build-artifact'
  | 'other';

export interface HtmlProjectStructureFile {
  path: string;
  kind: HtmlProjectStructureFileKind;
  managed?: boolean;
}

export interface HtmlProjectStructureMapping {
  sourcePath: string | null;
  targetPath: string;
  action: 'keep' | 'move' | 'create' | 'rebuild' | 'remove-managed';
  reason: string;
}

export interface HtmlProjectStructureConflict {
  targetPath: string;
  sourcePaths: string[];
  reason: string;
}

export interface HtmlProjectStructureLink {
  sourcePath: string;
  reference: string;
  resolvedPath: string | null;
  status: 'ok' | 'broken' | 'external';
  proposedReference?: string;
}

export interface HtmlProjectStructureReport {
  version: 1;
  /** Digest of the scanned file snapshot and proposed plan. Apply rejects stale digests. */
  planDigest: string;
  status: HtmlProjectStructureStatus;
  supported: boolean;
  reason: string;
  alreadyCanonical: boolean;
  scannedFiles: number;
  truncated: boolean;
  files: HtmlProjectStructureFile[];
  pageCandidates: string[];
  designSystemCandidates: string[];
  stylesheets: string[];
  scripts: string[];
  assets: string[];
  buildArtifacts: string[];
  violations: string[];
  proposedMappings: HtmlProjectStructureMapping[];
  conflicts: HtmlProjectStructureConflict[];
  links: HtmlProjectStructureLink[];
  brokenLinks: HtmlProjectStructureLink[];
  manualFollowUps: string[];
}

export interface HtmlProjectRestructureReceipt {
  version: 1;
  planDigest: string;
  previousStatus: HtmlProjectStructureStatus;
  finalStatus: HtmlProjectStructureStatus;
  completed: boolean;
  movedFiles: Array<{ fromPath: string; toPath: string }>;
  createdFiles: string[];
  removedManagedFiles: string[];
  rewrittenLinks: Array<{ sourcePath: string; from: string; to: string }>;
  registeredScreenIds: string[];
  changedFiles: string[];
  previewFile: string | null;
  reindexJobId: string | null;
  postCheck: HtmlProjectStructureReport;
}
