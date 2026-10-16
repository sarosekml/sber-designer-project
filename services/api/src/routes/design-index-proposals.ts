import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import {
  parseProjectStyleContract,
  projectStyleContractCoverage,
} from '@sber-designer/design-indexer';
import {
  HTML_DESIGN_SYSTEM_PATHS,
  type SberDesignerProjectKind,
} from '@sber-designer/shared-types';

interface HtmlDesignSystemProposalFile {
  label: string;
  path: string;
  required: boolean;
  exists: boolean;
  excerpt: string;
}

export interface HtmlDesignSystemProposal {
  id: string;
  filePath: string;
  absolutePath: string;
  ready: boolean;
  updatedAt: number;
  files: HtmlDesignSystemProposalFile[];
  reportExcerpt: string;
  styleContract: {
    required: boolean;
    recognized: boolean;
    complete: boolean;
    presentSections: number;
    totalSections: number;
    diagnostics: string[];
  };
}

const HTML_DESIGN_SYSTEM_PROPOSALS_ROOT = join('design', 'proposals');
export const HTML_DESIGN_SYSTEM_PROPOSAL_FILES = [
  { label: 'Design.md', targetPath: HTML_DESIGN_SYSTEM_PATHS.designMd, required: true },
  { label: 'tokens.css', targetPath: HTML_DESIGN_SYSTEM_PATHS.tokensCss, required: false },
  { label: 'components.css', targetPath: HTML_DESIGN_SYSTEM_PATHS.componentsCss, required: false },
] as const;
export const HTML_DESIGN_SYSTEM_REPORT_FILE = 'extraction-report.md';
export const HTML_DESIGN_SYSTEM_ACCEPTED_REPORT_PATH = join(
  'design',
  HTML_DESIGN_SYSTEM_REPORT_FILE,
);
const MAX_PROPOSAL_EXCERPT_CHARS = 900;

export async function listHtmlDesignSystemProposals(
  workspacePath: string,
): Promise<HtmlDesignSystemProposal[]> {
  const proposalsRoot = join(workspacePath, HTML_DESIGN_SYSTEM_PROPOSALS_ROOT);
  const entries = await readdir(proposalsRoot, { withFileTypes: true }).catch(() => []);
  const proposals = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => readHtmlDesignSystemProposal(workspacePath, entry.name)),
  );
  return proposals
    .flatMap((proposal) => (proposal ? [proposal] : []))
    .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
}

export async function readHtmlDesignSystemProposal(
  workspacePath: string,
  proposalId: string,
): Promise<HtmlDesignSystemProposal | null> {
  const absolutePath = resolveHtmlDesignSystemProposalPath(workspacePath, proposalId);
  if (!absolutePath) return null;
  const proposalStat = await stat(absolutePath).catch(() => null);
  if (!proposalStat?.isDirectory()) return null;

  const files = await Promise.all(
    HTML_DESIGN_SYSTEM_PROPOSAL_FILES.map(async (source) => {
      const path = join(HTML_DESIGN_SYSTEM_PROPOSALS_ROOT, proposalId, source.label);
      const contents = await readFile(join(workspacePath, path), 'utf8').catch(() => null);
      return {
        label: source.label,
        path,
        required: source.required,
        exists: contents !== null,
        excerpt: contents ? excerptProposalFile(contents) : '',
      };
    }),
  );
  const report = await readFile(join(absolutePath, HTML_DESIGN_SYSTEM_REPORT_FILE), 'utf8').catch(
    () => null,
  );
  const designMdContents = await readFile(join(absolutePath, 'Design.md'), 'utf8').catch(
    () => null,
  );
  const styleContract = inspectProposalStyleContract(proposalId, designMdContents);
  return {
    id: proposalId,
    filePath: join(HTML_DESIGN_SYSTEM_PROPOSALS_ROOT, proposalId),
    absolutePath,
    ready:
      files.every((file) => !file.required || file.exists) &&
      report !== null &&
      (!styleContract.required || styleContract.complete),
    updatedAt: proposalStat.mtimeMs,
    files,
    reportExcerpt: report ? excerptProposalFile(report) : '',
    styleContract,
  };
}

function inspectProposalStyleContract(proposalId: string, designMdContents: string | null) {
  const parsed = parseProjectStyleContract(designMdContents, 'Design.md');
  const coverage = projectStyleContractCoverage(parsed);
  const required = proposalId.startsWith('style-scout-') || parsed !== null;
  const complete = Boolean(
    parsed &&
    coverage.present === coverage.total &&
    parsed.sectionOrderValid &&
    parsed.duplicateSectionIds.length === 0,
  );
  return {
    required,
    recognized: parsed !== null,
    complete,
    presentSections: coverage.present,
    totalSections: coverage.total,
    diagnostics: parsed
      ? parsed.diagnostics.map((diagnostic) => diagnostic.message)
      : required
        ? ['The scout proposal must use the canonical nine-section project style contract.']
        : [],
  };
}

export async function resolveAcceptedDesignContractTargetPath(
  workspacePath: string,
  projectKind: SberDesignerProjectKind | undefined,
): Promise<string> {
  const persistedProjectKind = await readPersistedProjectKind(workspacePath);
  if ((persistedProjectKind ?? projectKind) === 'html-first') {
    return HTML_DESIGN_SYSTEM_PATHS.designMd;
  }
  const existingCandidates = [
    'DESIGN.md',
    'Design.md',
    'design.md',
    'design/DESIGN.md',
    'design/Design.md',
    'design/design.md',
  ];
  for (const candidate of existingCandidates) {
    const candidateStat = await stat(join(workspacePath, candidate)).catch(() => null);
    if (candidateStat?.isFile()) return candidate;
  }
  return 'DESIGN.md';
}

async function readPersistedProjectKind(
  workspacePath: string,
): Promise<SberDesignerProjectKind | null> {
  const raw = await readFile(join(workspacePath, '.sber-designer', 'project.sdproj'), 'utf8').catch(
    () => null,
  );
  if (!raw) return null;
  try {
    const value = (JSON.parse(raw) as { projectKind?: unknown }).projectKind;
    return value === 'html-first' || value === 'react-vite' ? value : null;
  } catch {
    return null;
  }
}

function resolveHtmlDesignSystemProposalPath(
  workspacePath: string,
  proposalId: string,
): string | null {
  if (!/^[A-Za-z0-9._-]+$/.test(proposalId)) return null;
  const proposalsRoot = resolve(workspacePath, HTML_DESIGN_SYSTEM_PROPOSALS_ROOT);
  const candidate = resolve(proposalsRoot, proposalId);
  return candidate !== proposalsRoot && candidate.startsWith(`${proposalsRoot}${sep}`)
    ? candidate
    : null;
}

function excerptProposalFile(contents: string): string {
  const trimmed = contents.trim();
  if (trimmed.length <= MAX_PROPOSAL_EXCERPT_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_PROPOSAL_EXCERPT_CHARS).trimEnd()}\n...`;
}
