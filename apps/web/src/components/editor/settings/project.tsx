/** Project settings panel: project info, instructions, tracker, assets. */
import { useEffect, useRef, useState } from 'react';
import {
  Brain,
  FileUp,
  FileText,
  Folder,
  GitPullRequestArrow,
  Link2,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Workflow,
} from 'lucide-react';
import {
  isProjectStyleMemoryEnabled,
  type SberDesignerProject,
  type TaskTrackerConfig,
} from '@sber-designer/shared-types';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
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
import { cn } from '@/lib/utils';
import { useStartDescriptionInterview } from '@/lib/use-start-description-interview';
import { useStartProjectRestructure } from '@/lib/use-start-project-restructure';
import { useChatStore } from '@/stores/chat-store';
import { useProjectStore } from '@/stores/project-store';
import { useSandboxStore } from '@/stores/sandbox-store';
import { ConnectRepoDialog } from '../ConnectRepoDialog';
import { FolderPickerDialog } from '../FolderPickerDialog';
import {
  ASSET_PACK_SOURCE_HINT,
  DEFAULT_ASSET_PACK_NAME,
  type SettingsSection,
  normalizeAssetPackKinds,
  resolveAssetFolderPickerInitialPath,
  resolveAssetPackSourceWarning,
  resolveInitialAssetsPathState,
  resolveIconSourceMode,
  resolveNextExternalAssetSources,
  resolveNextAssetPackSettings,
} from '@/lib/settings-logic';
import { Badge, ProviderSwitch } from './shared';
import {
  DesignContextStatus,
  DesignIndexStatus,
  ScreenTemplateBadge,
  pollDesignIndexJob,
} from './indexing';
import { useProjectSettingsPanelState } from './use-project-settings-panel';

const SCREEN_DESIGN_TEMPLATE_PATH = '.sber-designer/screen.design.md';

export {
  buildComponentDescriptionSettingsModel,
  type ComponentDescriptionSettingsModel,
} from './use-project-settings-panel';

export function ProjectSettingsPanel({
  project,
  onPatchProject,
  section,
  onClose,
}: {
  project: ReturnType<typeof useProjectStore.getState>['project'];
  onPatchProject: (patch: Partial<SberDesignerProject>) => void;
  section: Exclude<SettingsSection, 'llm' | 'mcp' | 'general' | 'agent' | 'generation' | 'about'>;
  onClose?: () => void;
}) {
  const {
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
  } = useProjectSettingsPanelState({ project, onPatchProject });

  return (
    <div className="grid min-w-0 gap-4">
      {section === 'project' && (
        <>
          <div className="min-w-0">
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
              Project name
            </label>
            <input
              value={project?.name ?? ''}
              disabled={!project}
              onChange={(event) => {
                if (!project) return;
                onPatchProject({ ...project, name: event.target.value });
              }}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Stored in the project's <code>.sber-designer/project.sdproj</code> file.
            </p>
          </div>

          <div className="min-w-0">
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
              Workspace
            </label>
            <div className="min-w-0 truncate rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-muted-foreground">
              {project?.workspacePath ?? 'No workspace connected'}
            </div>
          </div>

          <div className="min-w-0">
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
              Project instructions
            </label>
            <textarea
              value={project?.projectInstructions ?? ''}
              disabled={!project}
              rows={6}
              placeholder="Example: Reuse project components first, keep operational screens dense, label mock data clearly."
              onChange={(event) => {
                if (!project) return;
                onPatchProject({ ...project, projectInstructions: event.target.value });
              }}
              className="min-h-32 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-5 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Sent to built-in and external agents before screen and task context.
            </p>
          </div>

          <div className="flex min-w-0 items-start justify-between gap-3 rounded-md border border-border bg-background p-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Brain className="size-4 text-primary" />
                Project style memory
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Apply explicit run feedback and manual preferences to future screen generation and
                redesign. Turning this off keeps the project memory files unchanged.
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Stored in <code>.sber-designer/project.sdproj</code>; rules remain in{' '}
                <code>.sber-designer/preferences/</code>.
              </p>
            </div>
            <ProviderSwitch
              enabled={isProjectStyleMemoryEnabled(project)}
              disabled={!project}
              onChange={(enabled) => {
                if (!project) return;
                onPatchProject({
                  agentMemory: {
                    ...project.agentMemory,
                    styleMemoryEnabled: enabled,
                  },
                });
              }}
              title="Use project style memory in future generation and redesign runs"
            />
          </div>

          <Separator />

          {project?.projectKind === 'html-first' &&
            designIndex?.projectSystem?.htmlDesignSystem?.status === 'non-canonical' && (
              <>
                <div className="flex min-w-0 items-start justify-between gap-3 rounded-md border border-warning/40 bg-warning/10 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Workflow className="size-4 text-warning" />
                      Restructure HTML project
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Review a complete, collision-safe plan before moving pages and design-system
                      sources into the canonical layout.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void startProjectRestructure();
                      onClose?.();
                    }}
                  >
                    Review plan
                  </Button>
                </div>
                <Separator />
              </>
            )}

          <div className="grid min-w-0 gap-3 rounded-md border border-border bg-background p-3">
            {/* 0083 D5: coverage counter at the top (next to the header); the
                action button stays alone at the bottom. */}
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MessageSquareText className="size-4 text-primary" />
                  {componentDescriptionModel.title}
                </div>
                <Badge tone={componentDescriptionModel.badgeTone}>
                  {componentDescriptionModel.badgeLabel}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {componentDescriptionModel.description}
              </p>
            </div>
            {componentDescriptionModel.showInterviewAction && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  disabled={!project}
                  onClick={() => {
                    void startInterview();
                    onClose?.();
                  }}
                >
                  <MessageSquareText className="size-3" />
                  Describe components
                </Button>
              </div>
            )}
          </div>

          <Separator />

          <div className="grid min-w-0 gap-3">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="size-4 text-primary" />
                  Screen design export template
                </div>
                <p className="text-xs text-muted-foreground">
                  Stores the future <code>screen.design.md</code> export contract in this project.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!project || screenTemplateLoading}
                onClick={() => screenTemplateInputRef.current?.click()}
              >
                {screenTemplateLoading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <FileUp className="size-3" />
                )}
                Choose template
              </Button>
              <input
                ref={screenTemplateInputRef}
                type="file"
                accept=".md,text/markdown,text/plain"
                className="hidden"
                onChange={(event) =>
                  void handleScreenTemplateFile(event.target.files?.item(0) ?? null)
                }
              />
            </div>

            <div className="grid gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {project?.screenDesignExportTemplate?.fileName ?? 'No template loaded'}
                  </div>
                  <div className="truncate font-mono text-[11px] text-muted-foreground">
                    {project?.screenDesignExportTemplate?.path ?? SCREEN_DESIGN_TEMPLATE_PATH}
                  </div>
                </div>
                <ScreenTemplateBadge
                  status={screenTemplateStatus}
                  loading={screenTemplateLoading}
                />
              </div>
              {project?.screenDesignExportTemplate?.uploadedAt && (
                <div className="text-[11px] text-muted-foreground">
                  Loaded{' '}
                  {new Date(project.screenDesignExportTemplate.uploadedAt).toLocaleString([], {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </div>
              )}
            </div>
            {screenTemplateMessage && (
              <div className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                {screenTemplateMessage}
              </div>
            )}
          </div>
        </>
      )}

      {section === 'indexing' && (
        <>
          <DesignIndexStatus
            context={designIndex}
            job={designIndexJob}
            loading={loadingDesignIndex}
            error={designIndexError}
            message={designIndexMessage}
            action={designIndexAction}
            onRefresh={() => void reloadDesignIndex()}
            onGenerate={() => void runDesignIndexGeneration()}
          />

          <Separator />

          <div className="grid min-w-0 gap-3">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileUp className="size-4 text-primary" />
                  Asset packs
                </div>
                <p className="text-xs text-muted-foreground">
                  Indexes icons and illustrations for the agent. Workspace paths can also be
                  imported into <code>src/assets</code>.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={!project?.workspacePath || !assetSourcePath.trim() || assetSourceSaving}
                  onClick={() => void runAssetSourceIndex()}
                >
                  {assetSourceSaving ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3" />
                  )}
                  Save and index
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    !project?.workspacePath ||
                    !assetSourcePath.trim() ||
                    Boolean(assetImportBlockReason) ||
                    assetImporting ||
                    assetSourceSaving
                  }
                  onClick={() => void runAssetPackImport()}
                >
                  {assetImporting ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <FileUp className="size-3" />
                  )}
                  Import and re-index
                </Button>
              </div>
            </div>

            <div className="grid min-w-0 gap-1.5">
              <div className="grid min-w-0 gap-1.5">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Path to assets
                </span>
                <div className="flex h-10 min-w-0 items-center rounded-md border border-border bg-background text-sm focus-within:ring-1 focus-within:ring-ring">
                  <button
                    type="button"
                    disabled={assetImporting || assetSourceSaving}
                    onClick={() => setAssetFolderPickerOpen(true)}
                    className="flex h-full w-10 shrink-0 items-center justify-center rounded-l-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    title="Browse for an assets folder"
                    aria-label="Browse for an assets folder"
                  >
                    <Folder className="size-3.5" />
                  </button>
                  <input
                    value={assetSourcePath}
                    disabled={assetImporting || assetSourceSaving}
                    placeholder="/Users/me/assets/product-kit"
                    spellCheck={false}
                    aria-label="Path to assets"
                    onChange={(event) => setAssetSourcePath(event.target.value)}
                    onBlur={(event) => commitAssetSourcePreferences(event.currentTarget.value)}
                    className="h-full min-w-0 flex-1 bg-transparent pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-60"
                  />
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{ASSET_PACK_SOURCE_HINT}</span>
                  {assetSourceMode ? (
                    <Badge tone={assetSourceMode === 'workspace' ? 'ok' : 'warn'}>
                      {assetSourceMode === 'workspace' ? 'Workspace' : 'External'}
                    </Badge>
                  ) : null}
                </div>
                {assetImportBlockReason ? (
                  <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning">
                    {assetImportBlockReason}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-4 text-xs">
              {(['icons', 'illustrations'] as const).map((kind) => {
                const checked = assetKinds.includes(kind);
                const locked = checked && assetKinds.length === 1;
                return (
                  <label
                    key={kind}
                    className="inline-flex items-center gap-2 text-muted-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={assetImporting || assetSourceSaving || locked}
                      onChange={(event) => setAssetKindEnabled(kind, event.target.checked)}
                      className="size-4 rounded border-border"
                    />
                    <span className="capitalize">{kind}</span>
                  </label>
                );
              })}
            </div>

            {assetSourceError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
                {assetSourceError}
              </div>
            )}
            {assetSourceMessage && (
              <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
                {assetSourceMessage}
              </div>
            )}
            {assetImportError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
                {assetImportError}
              </div>
            )}
            {assetImportMessage && (
              <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
                {assetImportMessage}
              </div>
            )}

            <FolderPickerDialog
              open={assetFolderPickerOpen}
              title="Pick an assets folder"
              description="Choose a local folder with SVG or image assets to index."
              {...(assetFolderPickerInitialPath
                ? { initialPath: assetFolderPickerInitialPath }
                : {})}
              onSelect={(path) => {
                setAssetSourcePath(path);
                commitAssetSourcePreferences(path);
              }}
              onClose={() => setAssetFolderPickerOpen(false)}
            />
          </div>

          <Separator />

          <div className="grid min-w-0 gap-3">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="size-4 text-primary" />
                  DESIGN.md compatibility
                </div>
                <p className="text-xs text-muted-foreground">
                  Validates the canonical <code>DESIGN.md</code>. Use <strong>Index project</strong>{' '}
                  above to generate agent-facing index artifacts.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void reloadDesignContext({ validate: true })}
                disabled={loadingDesignContext}
              >
                {loadingDesignContext ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RefreshCw className="size-3" />
                )}
                Refresh
              </Button>
            </div>

            {designContextError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
                {designContextError}
              </div>
            ) : (
              <DesignContextStatus context={designContext} loading={loadingDesignContext} />
            )}
            {designContextMessage && (
              <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
                {designContextMessage}
              </div>
            )}
          </div>
        </>
      )}

      {section === 'git' && (
        <>
          <div className="grid min-w-0 gap-3">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <GitPullRequestArrow className="size-4 text-primary" />
                  Git and PR
                </div>
                <p className="text-xs text-muted-foreground">
                  Auto mode can open a PR after each completed tracker task when the workspace has a
                  git session.
                </p>
              </div>
              <ProviderSwitch
                enabled={Boolean(project?.agentAutoPr)}
                disabled={!project || !session}
                onChange={(enabled) => {
                  if (!project) return;
                  onPatchProject({ ...project, agentAutoPr: enabled });
                }}
                title={
                  session
                    ? 'Create a PR after each autonomous task'
                    : 'Connect a git workspace before enabling auto PR'
                }
              />
            </div>
            <div className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
              <span className="min-w-0 truncate">
                {session
                  ? `Connected workspace: ${session.workspacePath}`
                  : 'No git workspace session is connected yet.'}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 shrink-0"
                onClick={() => setConnectRepoOpen(true)}
              >
                Change
              </Button>
            </div>
            {gitStatus && (
              <div className="grid min-w-0 gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                    {gitStatus.isGitRepo ? gitStatus.provider : 'no git'}
                  </span>
                  <span className="min-w-0 truncate text-muted-foreground">
                    {gitStatus.reason ??
                      `${gitStatus.currentBranch ?? 'no branch'} · ${gitStatus.changes.length} changed file${gitStatus.changes.length === 1 ? '' : 's'}`}
                  </span>
                </div>
                {gitStatus.remoteUrl && (
                  <div className="min-w-0 truncate font-mono text-muted-foreground">
                    {gitStatus.remoteUrl}
                  </div>
                )}
                {gitStatus.session && (
                  <div className="grid min-w-0 grid-cols-2 gap-2 text-muted-foreground">
                    <div className="min-w-0 truncate">
                      Branch:{' '}
                      <span className="text-foreground">{gitStatus.session.workingBranch}</span>
                    </div>
                    <div className="min-w-0 truncate">
                      Status:{' '}
                      <span className="text-foreground">
                        {gitStatus.session.status ?? 'branch'}
                      </span>
                    </div>
                    {(gitStatus.session.prUrl || gitStatus.session.compareUrl) && (
                      <a
                        className="col-span-2 min-w-0 truncate text-primary underline-offset-2 hover:underline"
                        href={gitStatus.session.prUrl ?? gitStatus.session.compareUrl ?? '#'}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {gitStatus.session.prUrl ?? gitStatus.session.compareUrl}
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
            {gitStatusError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
                {gitStatusError}
              </div>
            )}
            <ConnectRepoDialog
              open={connectRepoOpen}
              onOpenChange={setConnectRepoOpen}
              onConnected={(workspacePath) => {
                if (!project) return;
                onPatchProject({ ...project, workspacePath });
              }}
            />
          </div>
        </>
      )}

      {section === 'tasks' && (
        <>
          <div className="grid min-w-0 gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Link2 className="size-4 text-primary" />
                Task tracker
              </div>
              <p className="text-xs text-muted-foreground">
                Store only the project URL here. API tokens are read from server environment
                variables.
              </p>
            </div>

            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Project URL
              </span>
              <input
                value={trackerUrl}
                disabled={!project}
                placeholder="https://linear.app/acme/project/... or https://acme.atlassian.net/..."
                onChange={(event) => setTrackerUrl(event.target.value)}
                onBlur={(event) => applyTrackerUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') applyTrackerUrl(event.currentTarget.value);
                }}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </label>

            {project?.taskTracker ? (
              <div className="grid min-w-0 gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Badge tone={trackerEnv?.ok ? 'ok' : 'warn'}>{project.taskTracker.type}</Badge>
                    <span className="truncate font-mono text-muted-foreground">
                      {project.taskTracker.projectUrl}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7"
                    disabled={trackerTesting}
                    onClick={() => void runTrackerConnectionTest()}
                  >
                    {trackerTesting ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3" />
                    )}
                    Test
                  </Button>
                </div>

                {project.taskTracker.type === 'linear' && (
                  <label className="grid gap-1.5">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Linear label filter
                    </span>
                    <input
                      value={project.taskTracker.labelFilter ?? ''}
                      placeholder="Optional label name"
                      onChange={(event) => updateLinearLabelFilter(event.target.value)}
                      className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </label>
                )}

                {trackerEnv && !trackerEnv.ok && (
                  <div className="rounded-md border border-warning/30 bg-warning/10 px-2 py-1.5 text-warning">
                    <div className="font-medium">Set up your API token</div>
                    <div className="mt-0.5 text-muted-foreground">
                      Add {trackerEnv.missingEnvVars.join(', ')} to your API server{' '}
                      <code>.env</code>, then click Test again.
                    </div>
                  </div>
                )}
                {trackerResult && (
                  <div
                    className={cn(
                      'rounded-md border px-2 py-1.5',
                      trackerResult.ok
                        ? 'border-success/30 bg-success/10 text-success'
                        : 'border-destructive/40 bg-destructive/10 text-destructive-foreground',
                    )}
                  >
                    {trackerResult.message}
                  </div>
                )}
                {trackerMessage && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-destructive-foreground">
                    {trackerMessage}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                {trackerMessage ??
                  'Paste a Linear or Jira project URL to enable tracker tasks in Auto mode.'}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
