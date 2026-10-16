/**
 * Unified project index: design context artifacts, design-index manifest
 * and jobs, setup answers, component agent notes, asset packs, and the
 * Design System Browser feed.
 *
 * 0136 R12 — the wire shapes live in ./project-index-types and are
 * re-exported here, so '@/lib/api/project-index' stays the import path.
 */
import { API_URL, ApiError, authHeaders, safeJson, withSignal } from './http';
import type {
  AcceptHtmlDesignSystemProposalResult,
  AddProjectComponentNoteResult,
  AssetPackKind,
  AssetRecord,
  ComponentGroupRecord,
  DesignContextArtifact,
  DesignContextDiagnostic,
  DesignContextValidation,
  GenerateDesignContextResult,
  GenerateProjectDesignIndexResult,
  HtmlDesignSystemProposal,
  HtmlDesignSystemProposalFile,
  HtmlDesignSystemProposalsResult,
  IconCandidateRecord,
  IconIndexFile,
  ImportAssetPackInput,
  ImportAssetPackResult,
  ImportHtmlDesignSystemFilesResult,
  IndexedComponentRecord,
  ProjectAgentNote,
  ProjectComponentAgentNote,
  ProjectDesignContext,
  ProjectDesignIndexArtifact,
  ProjectDesignIndexContext,
  ProjectDesignIndexDiagnostic,
  ProjectDesignIndexManifest,
  ProjectDesignIndexQualityCheck,
  ProjectDesignIndexQualityScore,
  ProjectDesignIndexQualityViolation,
  ProjectDesignSystemBrowser,
  ProjectIndexJob,
  ProjectIndexJobProgressEvent,
  ProjectIndexJobResponse,
  ProjectIndexJobStage,
  ProjectProfileFile,
  ProjectSetupQuestion,
  ProjectSystemContextItem,
  ProjectSystemOverview,
  RejectHtmlDesignSystemProposalResult,
  RouteRecord,
  SaveHtmlDesignSystemSourcesInput,
  SaveHtmlDesignSystemSourcesResult,
  SaveProjectSetupAnswersResult,
  ScreenIndexRecord,
  StorybookIndexFile,
  TokenRecord,
  UsageExampleRecord,
} from './project-index-types';

export type {
  AcceptHtmlDesignSystemProposalResult,
  AddProjectComponentNoteResult,
  AssetPackKind,
  AssetRecord,
  ComponentGroupRecord,
  DesignContextArtifact,
  DesignContextDiagnostic,
  DesignContextValidation,
  GenerateDesignContextResult,
  GenerateProjectDesignIndexResult,
  HtmlDesignSystemProposal,
  HtmlDesignSystemProposalFile,
  HtmlDesignSystemProposalsResult,
  IconCandidateRecord,
  IconIndexFile,
  ImportAssetPackInput,
  ImportAssetPackResult,
  ImportHtmlDesignSystemFilesResult,
  IndexedComponentRecord,
  ProjectAgentNote,
  ProjectComponentAgentNote,
  ProjectDesignContext,
  ProjectDesignIndexArtifact,
  ProjectDesignIndexContext,
  ProjectDesignIndexDiagnostic,
  ProjectDesignIndexManifest,
  ProjectDesignIndexQualityCheck,
  ProjectDesignIndexQualityScore,
  ProjectDesignIndexQualityViolation,
  ProjectDesignSystemBrowser,
  ProjectIndexJob,
  ProjectIndexJobProgressEvent,
  ProjectIndexJobResponse,
  ProjectIndexJobStage,
  ProjectProfileFile,
  ProjectSetupQuestion,
  ProjectSystemContextItem,
  ProjectSystemOverview,
  RejectHtmlDesignSystemProposalResult,
  RouteRecord,
  SaveHtmlDesignSystemSourcesInput,
  SaveHtmlDesignSystemSourcesResult,
  SaveProjectSetupAnswersResult,
  ScreenIndexRecord,
  StorybookIndexFile,
  TokenRecord,
  UsageExampleRecord,
} from './project-index-types';

export async function importAssetPack(
  input: ImportAssetPackInput,
  signal?: AbortSignal,
): Promise<ImportAssetPackResult> {
  const res = await fetch(
    `${API_URL}/api/assets/import-pack`,
    withSignal(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify(input),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as ImportAssetPackResult;
}

export interface MaterializeIndexedIconInput {
  workspacePath?: string;
  iconId: string;
}

export interface MaterializeIndexedIconResult {
  ok: true;
  asset: AssetRecord;
  changedFiles: string[];
  assetChangedFiles: string[];
  indexChangedFiles: string[];
  projectIndex: {
    status: ProjectDesignIndexContext['status'];
    stale: boolean;
    counts: ProjectDesignIndexManifest['counts'] | null;
  };
}

export async function materializeIndexedIcon(
  input: MaterializeIndexedIconInput,
  signal?: AbortSignal,
): Promise<MaterializeIndexedIconResult> {
  const res = await fetch(
    `${API_URL}/api/assets/materialize-indexed-icon`,
    withSignal(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify(input),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as MaterializeIndexedIconResult;
}

export async function fetchProjectDesignContext(
  signal?: AbortSignal,
): Promise<ProjectDesignContext> {
  const res = await fetch(
    `${API_URL}/api/project/design-context`,
    withSignal({ headers: authHeaders() }, signal),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as ProjectDesignContext;
}

export async function validateProjectDesignContext(
  signal?: AbortSignal,
): Promise<ProjectDesignContext> {
  const res = await fetch(
    `${API_URL}/api/project/design-context/validate`,
    withSignal({ method: 'POST', headers: authHeaders() }, signal),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as ProjectDesignContext;
}

export async function generateProjectDesignContext(
  input: { include?: 'design' | 'component-map' | 'both'; overwrite?: boolean } = {},
  signal?: AbortSignal,
): Promise<GenerateDesignContextResult> {
  const res = await fetch(
    `${API_URL}/api/project/design-context/generate`,
    withSignal(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify(input),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as GenerateDesignContextResult;
}

export async function fetchProjectDesignIndex(
  signal?: AbortSignal,
): Promise<ProjectDesignIndexContext> {
  const res = await fetch(
    `${API_URL}/api/project/design-index`,
    withSignal({ headers: authHeaders() }, signal),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as ProjectDesignIndexContext;
}

export async function generateProjectDesignIndex(
  signal?: AbortSignal,
): Promise<GenerateProjectDesignIndexResult> {
  const res = await fetch(
    `${API_URL}/api/project/design-index/generate`,
    withSignal(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify({}),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as GenerateProjectDesignIndexResult;
}

export async function startProjectDesignIndexJob(
  input: { enrich?: boolean; workspacePath?: string } = {},
  signal?: AbortSignal,
): Promise<ProjectIndexJobResponse> {
  const url = new URL(`${API_URL}/api/project/design-index/jobs`);
  if (input.workspacePath) url.searchParams.set('workspacePath', input.workspacePath);
  const body: { enrich?: boolean } = {};
  if (input.enrich !== undefined) body.enrich = input.enrich;
  const res = await fetch(
    url,
    withSignal(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as ProjectIndexJobResponse;
}

export async function fetchProjectDesignIndexJob(
  id: string,
  signal?: AbortSignal,
): Promise<ProjectIndexJobResponse> {
  const res = await fetch(
    `${API_URL}/api/project/design-index/jobs/${encodeURIComponent(id)}`,
    withSignal({ headers: authHeaders() }, signal),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as ProjectIndexJobResponse;
}

export async function fetchProjectDesignSystemBrowser(
  input: { workspacePath?: string } = {},
  signal?: AbortSignal,
): Promise<ProjectDesignSystemBrowser> {
  const url = new URL(`${API_URL}/api/project/design-index/browser`);
  if (input.workspacePath) url.searchParams.set('workspacePath', input.workspacePath);
  const res = await fetch(url, withSignal({ headers: authHeaders() }, signal));
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as ProjectDesignSystemBrowser;
}

export async function saveProjectSetupAnswers(
  input: { answers: { id: string; answer: string | null }[]; workspacePath?: string },
  signal?: AbortSignal,
): Promise<SaveProjectSetupAnswersResult> {
  const url = new URL(`${API_URL}/api/project/design-index/profile-answers`);
  if (input.workspacePath) url.searchParams.set('workspacePath', input.workspacePath);
  const res = await fetch(
    url,
    withSignal(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ answers: input.answers }),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as SaveProjectSetupAnswersResult;
}

export async function saveHtmlDesignSystemSources(
  input: SaveHtmlDesignSystemSourcesInput,
  signal?: AbortSignal,
): Promise<SaveHtmlDesignSystemSourcesResult> {
  const url = new URL(`${API_URL}/api/project/design-index/html-design-system-sources`);
  if (input.workspacePath) url.searchParams.set('workspacePath', input.workspacePath);
  const res = await fetch(
    url,
    withSignal(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify(
          input.presetId ? { presetId: input.presetId } : { sources: input.sources },
        ),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as SaveHtmlDesignSystemSourcesResult;
}

export async function importHtmlDesignSystemFiles(
  input: { files: File[]; workspacePath?: string },
  signal?: AbortSignal,
): Promise<ImportHtmlDesignSystemFilesResult> {
  const url = new URL(`${API_URL}/api/project/html-design-system/import`);
  if (input.workspacePath) url.searchParams.set('workspacePath', input.workspacePath);
  const form = new FormData();
  for (const file of input.files) form.append('files', file, file.name);
  const res = await fetch(
    url,
    withSignal(
      {
        method: 'POST',
        headers: authHeaders(),
        body: form,
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as ImportHtmlDesignSystemFilesResult;
}

export interface RegenerateDesignSystemPreviewResult {
  changedFiles: string[];
  tokenCount: number;
  componentClassCount: number;
  descriptionSections: {
    keepDescriptions: boolean;
    restored: number;
    changedFiles: string[];
    diagnostics: string[];
    layerCount: number;
  };
}

export async function regenerateHtmlDesignSystemPreview(
  input: { workspacePath?: string; keepDescriptions?: boolean } = {},
  signal?: AbortSignal,
): Promise<RegenerateDesignSystemPreviewResult> {
  const url = new URL(`${API_URL}/api/project/design-index/html-design-system-preview`);
  if (input.workspacePath) url.searchParams.set('workspacePath', input.workspacePath);
  const res = await fetch(
    url,
    withSignal(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ keepDescriptions: input.keepDescriptions ?? true }),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as RegenerateDesignSystemPreviewResult;
}

export async function fetchHtmlDesignSystemProposals(
  input: { workspacePath?: string } = {},
  signal?: AbortSignal,
): Promise<HtmlDesignSystemProposalsResult> {
  const url = new URL(`${API_URL}/api/project/design-index/html-design-system-proposals`);
  if (input.workspacePath) url.searchParams.set('workspacePath', input.workspacePath);
  const res = await fetch(url, withSignal({ headers: authHeaders() }, signal));
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as HtmlDesignSystemProposalsResult;
}

export async function acceptHtmlDesignSystemProposal(
  input: { workspacePath?: string; proposalId: string },
  signal?: AbortSignal,
): Promise<AcceptHtmlDesignSystemProposalResult> {
  const url = new URL(
    `${API_URL}/api/project/design-index/html-design-system-proposals/${encodeURIComponent(input.proposalId)}/accept`,
  );
  if (input.workspacePath) url.searchParams.set('workspacePath', input.workspacePath);
  const res = await fetch(url, withSignal({ method: 'POST', headers: authHeaders() }, signal));
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as AcceptHtmlDesignSystemProposalResult;
}

export async function rejectHtmlDesignSystemProposal(
  input: { workspacePath?: string; proposalId: string },
  signal?: AbortSignal,
): Promise<RejectHtmlDesignSystemProposalResult> {
  const url = new URL(
    `${API_URL}/api/project/design-index/html-design-system-proposals/${encodeURIComponent(input.proposalId)}`,
  );
  if (input.workspacePath) url.searchParams.set('workspacePath', input.workspacePath);
  const res = await fetch(url, withSignal({ method: 'DELETE', headers: authHeaders() }, signal));
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as RejectHtmlDesignSystemProposalResult;
}

export async function addProjectComponentNote(
  input: {
    workspacePath?: string;
    componentId: string;
    note: string;
    intent?: ProjectComponentAgentNote['intent'];
    storybookTitle?: string;
    sourcePath?: string;
  },
  signal?: AbortSignal,
): Promise<AddProjectComponentNoteResult> {
  const url = new URL(`${API_URL}/api/project/design-index/component-notes`);
  if (input.workspacePath) url.searchParams.set('workspacePath', input.workspacePath);
  const { workspacePath: _workspacePath, ...body } = input;
  const res = await fetch(
    url,
    withSignal(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as AddProjectComponentNoteResult;
}

export async function updateProjectComponentNote(
  id: string,
  input: {
    workspacePath?: string;
    note: string;
    intent?: ProjectComponentAgentNote['intent'];
  },
  signal?: AbortSignal,
): Promise<AddProjectComponentNoteResult> {
  const url = new URL(
    `${API_URL}/api/project/design-index/component-notes/${encodeURIComponent(id)}`,
  );
  if (input.workspacePath) url.searchParams.set('workspacePath', input.workspacePath);
  const { workspacePath: _workspacePath, ...body } = input;
  const res = await fetch(
    url,
    withSignal(
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as AddProjectComponentNoteResult;
}

export async function deleteProjectComponentNote(
  id: string,
  input: { workspacePath?: string } = {},
  signal?: AbortSignal,
): Promise<{ deleted: boolean; changedFiles: string[]; context: ProjectDesignIndexContext }> {
  const url = new URL(
    `${API_URL}/api/project/design-index/component-notes/${encodeURIComponent(id)}`,
  );
  if (input.workspacePath) url.searchParams.set('workspacePath', input.workspacePath);
  const res = await fetch(url, withSignal({ method: 'DELETE', headers: authHeaders() }, signal));
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as {
    deleted: boolean;
    changedFiles: string[];
    context: ProjectDesignIndexContext;
  };
}
