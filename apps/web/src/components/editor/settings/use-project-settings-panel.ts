import { useEffect, useRef, useState } from 'react';
import { type SberDesignerProject, type TaskTrackerConfig } from '@sber-designer/shared-types';

import {
  fetchFile,
  getGitStatus,
  fetchProjectDesignContext,
  fetchProjectDesignIndex,
  checkTrackerEnv,
  importAssetPack,
  saveProjectToApi,
  testTrackerConnection,
  startProjectDesignIndexJob,
  validateProjectDesignContext,
  writeFile,
  type AssetPackKind,
  type ProjectDesignContext,
  type ProjectDesignIndexContext,
  type ProjectIndexJob,
  type GitStatusResponse,
  type TrackerConnectionResult,
  type TrackerEnvStatus,
} from '@/lib/api-client';
import { useStartDescriptionInterview } from '@/lib/use-start-description-interview';
import { useStartProjectRestructure } from '@/lib/use-start-project-restructure';
import { useChatStore } from '@/stores/chat-store';
import { useProjectStore } from '@/stores/project-store';
import { useSandboxStore } from '@/stores/sandbox-store';
import {
  DEFAULT_ASSET_PACK_NAME,
  normalizeAssetPackKinds,
  resolveAssetFolderPickerInitialPath,
  resolveAssetPackSourceWarning,
  resolveInitialAssetsPathState,
  resolveIconSourceMode,
  resolveNextExternalAssetSources,
  resolveNextAssetPackSettings,
} from '@/lib/settings-logic';
import { pollDesignIndexJob } from './indexing';

const SCREEN_DESIGN_TEMPLATE_PATH = '.sber-designer/screen.design.md';

export interface ComponentDescriptionSettingsModel {
  title: string;
  badgeTone: 'ok' | 'warn';
  badgeLabel: string;
  description: string;
  showInterviewAction: boolean;
}

export function buildComponentDescriptionSettingsModel(input: {
  projectKind?: SberDesignerProject['projectKind'];
  describedComponents: number;
  totalComponents: number;
}): ComponentDescriptionSettingsModel {
  if (input.projectKind === 'html-first') {
    return {
      title: 'Describe components for AI',
      badgeTone:
        input.totalComponents > 0 && input.describedComponents >= input.totalComponents
          ? 'ok'
          : 'warn',
      badgeLabel: `${input.describedComponents} / ${input.totalComponents} described`,
      description:
        'Guided chat fills the Description for AI layer for reusable CSS components, most-used first. System-level rules live in Design.md.',
      showInterviewAction: true,
    };
  }
  const allDescribed =
    input.totalComponents > 0 && input.describedComponents >= input.totalComponents;
  return {
    title: 'Describe components for AI',
    badgeTone: allDescribed ? 'ok' : 'warn',
    badgeLabel: `${input.describedComponents} / ${input.totalComponents} described`,
    description:
      'Guided chat fills the Description for AI layer, most-used components first. Stored in .sber-designer/components/ and compiled into the index.',
    showInterviewAction: true,
  };
}

export function useProjectSettingsPanelState({
  project,
  onPatchProject,
}: {
  project: ReturnType<typeof useProjectStore.getState>['project'];
  onPatchProject: (patch: Partial<SberDesignerProject>) => void;
}) {
  const session = useSandboxStore((s) => s.session);
  const startInterview = useStartDescriptionInterview();
  const startProjectRestructure = useStartProjectRestructure();
  const [designContext, setDesignContext] = useState<ProjectDesignContext | null>(null);
  const [designIndex, setDesignIndex] = useState<ProjectDesignIndexContext | null>(null);
  const [designIndexJob, setDesignIndexJob] = useState<ProjectIndexJob | null>(null);
  const [loadingDesignContext, setLoadingDesignContext] = useState(false);
  const [loadingDesignIndex, setLoadingDesignIndex] = useState(false);
  const [designIndexAction, setDesignIndexAction] = useState<'generate' | null>(null);
  const [designContextError, setDesignContextError] = useState<string | null>(null);
  const [designIndexError, setDesignIndexError] = useState<string | null>(null);
  const [designContextMessage, setDesignContextMessage] = useState<string | null>(null);
  const [designIndexMessage, setDesignIndexMessage] = useState<string | null>(null);
  const initialAssetsPathState = resolveInitialAssetsPathState({
    assetPacks: project?.assetPacks,
    externalAssetSources: project?.externalAssetSources,
  });
  const setProjectBaseline = useProjectStore((s) => s.setBaseline);
  const setProjectSaving = useProjectStore((s) => s.setSaving);
  const setProjectSaveError = useProjectStore((s) => s.setSaveError);
  const [assetSourcePath, setAssetSourcePath] = useState(initialAssetsPathState.sourcePath);
  const [assetFolderPickerOpen, setAssetFolderPickerOpen] = useState(false);
  const [assetKinds, setAssetKinds] = useState<AssetPackKind[]>(initialAssetsPathState.kinds);
  const [assetSourceSaving, setAssetSourceSaving] = useState(false);
  const [assetSourceError, setAssetSourceError] = useState<string | null>(null);
  const [assetSourceMessage, setAssetSourceMessage] = useState<string | null>(null);
  const [assetImporting, setAssetImporting] = useState(false);
  const [assetImportError, setAssetImportError] = useState<string | null>(null);
  const [assetImportMessage, setAssetImportMessage] = useState<string | null>(null);
  const screenTemplateInputRef = useRef<HTMLInputElement | null>(null);
  const [screenTemplateLoading, setScreenTemplateLoading] = useState(false);
  const [screenTemplateStatus, setScreenTemplateStatus] = useState<
    'idle' | 'found' | 'missing' | 'error'
  >('idle');
  const [screenTemplateMessage, setScreenTemplateMessage] = useState<string | null>(null);
  const [trackerUrl, setTrackerUrl] = useState(project?.taskTracker?.projectUrl ?? '');
  const [trackerEnv, setTrackerEnv] = useState<TrackerEnvStatus | null>(null);
  const [trackerTesting, setTrackerTesting] = useState(false);
  const [trackerResult, setTrackerResult] = useState<TrackerConnectionResult | null>(null);
  const [trackerMessage, setTrackerMessage] = useState<string | null>(null);
  const [connectRepoOpen, setConnectRepoOpen] = useState(false);
  const [gitStatus, setGitStatus] = useState<GitStatusResponse | null>(null);
  const [gitStatusError, setGitStatusError] = useState<string | null>(null);
  const componentDescriptionModel = buildComponentDescriptionSettingsModel({
    projectKind: project?.projectKind,
    describedComponents: designIndex?.manifest?.counts.describedComponents ?? 0,
    totalComponents: designIndex?.manifest?.counts.components ?? 0,
  });

  const reloadDesignContext = async ({
    validate = false,
    quiet = false,
  }: { validate?: boolean; quiet?: boolean } = {}) => {
    setLoadingDesignContext(true);
    setDesignContextError(null);
    if (!quiet) setDesignContextMessage(null);
    try {
      const context = validate
        ? await validateProjectDesignContext()
        : await fetchProjectDesignContext();
      setDesignContext(context);
      if (validate && !quiet) setDesignContextMessage('DESIGN.md compatibility validated.');
    } catch (err) {
      setDesignContextError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingDesignContext(false);
    }
  };

  const reloadDesignIndex = async () => {
    setLoadingDesignIndex(true);
    setDesignIndexError(null);
    try {
      setDesignIndex(await fetchProjectDesignIndex());
    } catch (err) {
      setDesignIndexError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingDesignIndex(false);
    }
  };

  const runDesignIndexGeneration = async () => {
    setDesignIndexAction('generate');
    setDesignIndexError(null);
    setDesignIndexMessage(null);
    try {
      const started = await startProjectDesignIndexJob({ enrich: false });
      setDesignIndexJob(started.job);
      const job = await pollDesignIndexJob(started.job.id, setDesignIndexJob);
      if (job.status === 'failed') throw new Error(job.error ?? 'Project index job failed.');
      setDesignIndex(job.context ?? (await fetchProjectDesignIndex()));
      setDesignIndexMessage(
        job.changedFiles.length > 0
          ? `Generated ${job.changedFiles.length} index file${job.changedFiles.length === 1 ? '' : 's'}.`
          : 'Design index is already up to date.',
      );
      void reloadDesignContext({ quiet: true });
    } catch (err) {
      setDesignIndexError(err instanceof Error ? err.message : String(err));
    } finally {
      setDesignIndexAction(null);
    }
  };

  const resolveAssetSources = (
    sourcePath: string = assetSourcePath,
    kinds: AssetPackKind[] = assetKinds,
  ) =>
    resolveNextExternalAssetSources({
      previous: project?.externalAssetSources,
      sourcePath,
      workspacePath: project?.workspacePath,
      families: kinds,
    });

  const resolveAssetPackPreferences = (
    sourcePath: string = assetSourcePath,
    kinds: AssetPackKind[] = assetKinds,
  ) =>
    resolveNextAssetPackSettings({
      previous: resolveAssetPackSourceWarning(sourcePath, project?.workspacePath)
        ? undefined
        : project?.assetPacks,
      sourcePath,
      workspacePath: project?.workspacePath,
      kinds,
    });

  const commitAssetSourcePreferences = (
    sourcePath: string = assetSourcePath,
    kinds: AssetPackKind[] = assetKinds,
  ) => {
    onPatchProject({
      externalAssetSources: resolveAssetSources(sourcePath, kinds),
      assetPacks: resolveAssetPackPreferences(sourcePath, kinds),
    });
  };

  const runAssetSourceIndex = async () => {
    const sourcePath = assetSourcePath.trim();
    if (!project?.workspacePath) {
      setAssetSourceError('Connect a workspace before indexing assets.');
      return;
    }
    if (!sourcePath) {
      setAssetSourceError('Enter a path to assets.');
      return;
    }
    const externalAssetSources = resolveAssetSources(sourcePath, assetKinds);
    const assetPacks = resolveAssetPackPreferences(sourcePath, assetKinds);
    const nextProject = { ...project, externalAssetSources, assetPacks };

    setAssetSourceSaving(true);
    setProjectSaving(true);
    setProjectSaveError(null);
    setAssetSourceError(null);
    setAssetSourceMessage(null);
    setDesignIndexError(null);
    setDesignIndexMessage(null);
    setDesignIndexAction('generate');
    onPatchProject({ externalAssetSources, assetPacks });
    try {
      const saved = await saveProjectToApi(nextProject);
      setProjectBaseline(saved);
      const started = await startProjectDesignIndexJob({ enrich: false });
      setDesignIndexJob(started.job);
      const job = await pollDesignIndexJob(started.job.id, setDesignIndexJob);
      if (job.status === 'failed') throw new Error(job.error ?? 'Project index job failed.');
      setDesignIndex(job.context ?? (await fetchProjectDesignIndex()));
      setAssetSourceMessage(
        `Saved assets path and indexed ${job.changedFiles.length} file${job.changedFiles.length === 1 ? '' : 's'}.`,
      );
      void reloadDesignContext({ quiet: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setAssetSourceError(message);
      setProjectSaveError(message);
    } finally {
      setProjectSaving(false);
      setAssetSourceSaving(false);
      setDesignIndexAction(null);
    }
  };

  const setAssetKindEnabled = (kind: AssetPackKind, enabled: boolean) => {
    const next = enabled
      ? Array.from(new Set([...assetKinds, kind]))
      : assetKinds.filter((candidate) => candidate !== kind);
    const normalized = next.length > 0 ? normalizeAssetPackKinds(next) : assetKinds;
    setAssetKinds(normalized);
    commitAssetSourcePreferences(assetSourcePath, normalized);
  };

  const runAssetPackImport = async () => {
    const sourcePath = assetSourcePath.trim();
    if (!project?.workspacePath) {
      setAssetImportError('Connect a workspace before importing assets.');
      return;
    }
    if (!sourcePath) {
      setAssetImportError('Enter a local source folder.');
      return;
    }
    const sourceWarning = resolveAssetPackSourceWarning(sourcePath, project.workspacePath);
    if (sourceWarning) {
      setAssetImportError(sourceWarning);
      return;
    }

    setAssetImporting(true);
    setAssetImportError(null);
    setAssetImportMessage(null);
    setDesignIndexMessage(null);
    commitAssetSourcePreferences(sourcePath, assetKinds);
    try {
      const result = await importAssetPack({
        workspacePath: project.workspacePath,
        sourcePath,
        packName: DEFAULT_ASSET_PACK_NAME,
        kinds: assetKinds,
      });
      const started = await startProjectDesignIndexJob({ enrich: false });
      setDesignIndexJob(started.job);
      const job = await pollDesignIndexJob(started.job.id, setDesignIndexJob);
      if (job.status === 'failed') throw new Error(job.error ?? 'Project index job failed.');
      setDesignIndex(job.context ?? (await fetchProjectDesignIndex()));
      const skipped = result.skipped.length > 0 ? `, skipped ${result.skipped.length}` : '';
      setAssetImportMessage(
        `Imported ${result.imported} asset${result.imported === 1 ? '' : 's'}${skipped}. Re-indexed ${job.changedFiles.length} file${job.changedFiles.length === 1 ? '' : 's'}.`,
      );
      void reloadDesignContext({ quiet: true });
    } catch (err) {
      setAssetImportError(err instanceof Error ? err.message : String(err));
    } finally {
      setAssetImporting(false);
    }
  };

  const assetFolderPickerInitialPath = resolveAssetFolderPickerInitialPath(
    assetSourcePath,
    project?.workspacePath,
  );
  const assetSourceMode = resolveIconSourceMode(assetSourcePath, project?.workspacePath);
  const assetImportBlockReason = resolveAssetPackSourceWarning(
    assetSourcePath,
    project?.workspacePath,
  );

  useEffect(() => {
    void reloadDesignContext();
    void reloadDesignIndex();
    const nextAssetsPathState = resolveInitialAssetsPathState({
      assetPacks: project?.assetPacks,
      externalAssetSources: project?.externalAssetSources,
    });
    setAssetSourcePath(nextAssetsPathState.sourcePath);
    setAssetKinds(nextAssetsPathState.kinds);
    setAssetSourceError(null);
    setAssetSourceMessage(null);
    setAssetImportError(null);
    setAssetImportMessage(null);
  }, [
    project?.workspacePath,
    project?.externalAssetSources?.icons?.[0]?.localPath,
    project?.externalAssetSources?.icons?.[0]?.workspacePath,
    project?.externalAssetSources?.icons?.[0]?.families?.join(','),
    project?.externalAssetSources?.icons?.[0]?.updatedAt,
    project?.assetPacks?.localSourcePath,
    project?.assetPacks?.kinds?.join(','),
    project?.assetPacks?.updatedAt,
  ]);

  // 0083 E1: a finished agent run may have recompiled the design index (e.g. the
  // description interview's reindex). Refresh the coverage badge when chat goes
  // idle so "N / M described" reflects the new sidecars without a manual refresh.
  const chatPending = useChatStore((s) => s.pending);
  const prevChatPendingRef = useRef(chatPending);
  useEffect(() => {
    const wasPending = prevChatPendingRef.current;
    prevChatPendingRef.current = chatPending;
    if (wasPending && !chatPending) void reloadDesignIndex();
  }, [chatPending]);

  useEffect(() => {
    if (!session) {
      setGitStatus(null);
      return;
    }
    let cancelled = false;
    setGitStatusError(null);
    void getGitStatus()
      .then((status) => {
        if (!cancelled) setGitStatus(status);
      })
      .catch((err) => {
        if (!cancelled) setGitStatusError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [project?.workspacePath, project?.gitSession, session]);

  useEffect(() => {
    setTrackerUrl(project?.taskTracker?.projectUrl ?? '');
    setTrackerResult(null);
    setTrackerMessage(null);
  }, [project?.workspacePath, project?.taskTracker?.projectUrl]);

  useEffect(() => {
    const type = project?.taskTracker?.type;
    if (!type) {
      setTrackerEnv(null);
      return;
    }
    let cancelled = false;
    void checkTrackerEnv(type)
      .then((result) => {
        if (!cancelled) setTrackerEnv(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setTrackerEnv({
            type,
            ok: false,
            missingEnvVars: [err instanceof Error ? err.message : String(err)],
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [project?.taskTracker?.type]);

  useEffect(() => {
    const templatePath = project?.screenDesignExportTemplate?.path;
    if (!templatePath) {
      setScreenTemplateStatus('idle');
      setScreenTemplateMessage(null);
      return;
    }
    let cancelled = false;
    setScreenTemplateLoading(true);
    void fetchFile(templatePath)
      .then(() => {
        if (cancelled) return;
        setScreenTemplateStatus('found');
        setScreenTemplateMessage(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setScreenTemplateStatus('missing');
        setScreenTemplateMessage(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setScreenTemplateLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [project?.workspacePath, project?.screenDesignExportTemplate?.path]);

  const handleScreenTemplateFile = async (file: File | null) => {
    if (!project || !file) return;
    setScreenTemplateLoading(true);
    setScreenTemplateMessage(null);
    try {
      const contents = await file.text();
      await writeFile(SCREEN_DESIGN_TEMPLATE_PATH, contents);
      onPatchProject({
        ...project,
        screenDesignExportTemplate: {
          path: SCREEN_DESIGN_TEMPLATE_PATH,
          fileName: file.name,
          uploadedAt: Date.now(),
        },
      });
      setScreenTemplateStatus('found');
      setScreenTemplateMessage('Template loaded. Use Save to persist project metadata.');
    } catch (err) {
      setScreenTemplateStatus('error');
      setScreenTemplateMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setScreenTemplateLoading(false);
      if (screenTemplateInputRef.current) screenTemplateInputRef.current.value = '';
    }
  };

  const applyTrackerUrl = (value: string) => {
    if (!project) return;
    const trimmed = value.trim();
    setTrackerUrl(trimmed);
    setTrackerResult(null);
    setTrackerMessage(null);
    const config = inferTaskTrackerConfig(trimmed);
    if (trimmed && !config) {
      setTrackerMessage('Paste a Linear or Jira project URL.');
    }
    if (config) {
      onPatchProject({
        ...project,
        taskTracker: config,
      });
      return;
    }
    const { taskTracker: _taskTracker, ...projectWithoutTracker } = project;
    onPatchProject(projectWithoutTracker);
  };

  const updateLinearLabelFilter = (value: string) => {
    if (!project?.taskTracker || project.taskTracker.type !== 'linear') return;
    const trimmed = value.trim();
    const { labelFilter: _labelFilter, ...trackerWithoutLabel } = project.taskTracker;
    onPatchProject({
      ...project,
      taskTracker: trimmed ? { ...trackerWithoutLabel, labelFilter: trimmed } : trackerWithoutLabel,
    });
  };

  const refreshTrackerEnv = async (type: TaskTrackerConfig['type']) => {
    const result = await checkTrackerEnv(type);
    setTrackerEnv(result);
    return result;
  };

  const runTrackerConnectionTest = async () => {
    if (!project?.taskTracker) return;
    setTrackerTesting(true);
    setTrackerResult(null);
    setTrackerMessage(null);
    try {
      const env = await refreshTrackerEnv(project.taskTracker.type);
      if (!env.ok) {
        setTrackerMessage(`Missing ${env.missingEnvVars.join(', ')} in the API environment.`);
        return;
      }
      setTrackerResult(await testTrackerConnection(project.taskTracker));
    } catch (err) {
      setTrackerResult(null);
      setTrackerMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setTrackerTesting(false);
    }
  };

  return {
    session,
    startInterview,
    startProjectRestructure,
    designContext,
    designIndex,
    designIndexJob,
    loadingDesignContext,
    loadingDesignIndex,
    designIndexAction,
    designContextError,
    designIndexError,
    designContextMessage,
    designIndexMessage,
    assetSourcePath,
    setAssetSourcePath,
    assetFolderPickerOpen,
    setAssetFolderPickerOpen,
    assetKinds,
    assetSourceSaving,
    assetSourceError,
    assetSourceMessage,
    assetImporting,
    assetImportError,
    assetImportMessage,
    screenTemplateInputRef,
    screenTemplateLoading,
    screenTemplateStatus,
    screenTemplateMessage,
    trackerUrl,
    setTrackerUrl,
    trackerEnv,
    trackerTesting,
    trackerResult,
    trackerMessage,
    connectRepoOpen,
    setConnectRepoOpen,
    gitStatus,
    gitStatusError,
    componentDescriptionModel,
    reloadDesignContext,
    reloadDesignIndex,
    runDesignIndexGeneration,
    commitAssetSourcePreferences,
    runAssetSourceIndex,
    setAssetKindEnabled,
    runAssetPackImport,
    assetFolderPickerInitialPath,
    assetSourceMode,
    assetImportBlockReason,
    handleScreenTemplateFile,
    applyTrackerUrl,
    updateLinearLabelFilter,
    runTrackerConnectionTest,
  };
}

function inferTaskTrackerConfig(projectUrl: string): TaskTrackerConfig | undefined {
  if (!projectUrl) return undefined;
  let url: URL;
  try {
    url = new URL(projectUrl);
  } catch {
    return undefined;
  }
  const host = url.hostname.toLowerCase();
  if (host.includes('linear.app')) {
    return {
      type: 'linear',
      projectUrl,
    };
  }
  if (host.includes('atlassian.net')) {
    const projectKey = inferJiraProjectKey(url);
    return {
      type: 'jira',
      projectUrl,
      ...(projectKey ? { projectKey } : {}),
    };
  }
  return undefined;
}

function inferJiraProjectKey(url: URL): string | undefined {
  const projectMatch = url.pathname.match(/\/jira\/software\/projects\/([^/]+)/i);
  if (projectMatch?.[1]) return projectMatch[1].toUpperCase();
  const browseMatch = url.pathname.match(/\/browse\/([A-Z][A-Z0-9]+)-\d+/i);
  if (browseMatch?.[1]) return browseMatch[1].toUpperCase();
  return undefined;
}
