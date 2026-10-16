/**
 * Screens panel shell: list/groups rendering and the screen/folder
 * action handlers (sync, move, delete, rename, duplicate, export wiring).
 * Sub-views and dialogs live in ./screens/*, pure plan helpers in
 * @/lib/screen-panel-actions (task 0078, KT3c).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Folder,
  GitCompare,
  Image,
  Layers,
  PanelLeftClose,
  Pencil,
  Plus,
  RefreshCw,
  X,
  Trash2,
} from 'lucide-react';
import type { HtmlDesignSystemStatus, ProjectScreen } from '@sber-designer/shared-types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  groupProjectScreens,
  normalizeScreenFolder,
  UNGROUPED_SCREEN_FOLDER,
} from '@/lib/screen-folders';
import {
  assistantRunsProposalRefreshKey,
  buildHtmlDesignSystemDistillationNudge,
  distillableHtmlPagePaths,
  normalizeScreensPanelSettings,
  shouldShowHtmlDesignSystemApplyAction,
  shouldShowHtmlDesignSystemDistillAction,
  shouldShowDesignSystemReferenceAction,
  toggleCollapsedScreenFolder,
} from '@/lib/screens-panel-state';
import {
  isScreenHiddenInFlow,
  normalizeFlowView,
  toggleFlowFolderHidden,
  toggleFlowScreenHidden,
} from '@/lib/flow-view';
import { dispatchHtmlDesignSystemReferenceDraft } from '@/lib/html-design-system-reference';
import {
  createHtmlDesignSystemApplyDraftDetail,
  createHtmlDesignSystemDistillationDraftDetail,
  dispatchHtmlDesignSystemDistillationDraft,
} from '@/lib/html-design-system-distillation';
import { useCatalogStore } from '@/stores/catalog-store';
import { selectAssistantRunsList, useAssistantRunStore } from '@/stores/assistant-run-store';
import { useEditorStore } from '@/stores/editor-store';
import { useProjectStore } from '@/stores/project-store';
import { useSandboxStore } from '@/stores/sandbox-store';
import { tasksForScreen, useTasksStore } from '@/stores/tasks-store';
import { useThemeStore } from '@/stores/theme-store';
import {
  clearCoverScreenPinForDeletedScreen,
  toggleCoverScreenPin,
} from '@/lib/project-cover-capture';
import { catalogStories } from '@/lib/screen-panel-actions';
import { useStartProjectRestructure } from '@/lib/use-start-project-restructure';
import {
  acceptHtmlDesignSystemProposal,
  fetchProjectDesignSystemBrowser,
  fetchHtmlDesignSystemProposals,
  rejectHtmlDesignSystemProposal,
  type HtmlDesignSystemProposal,
} from '@/lib/api/project-index';
import { AddDesignSystemDialog } from './screens/AddDesignSystemDialog';
import { DesignSystemProposalCard } from './screens/DesignSystemProposalCard';
import { EmptyScreensState } from './screens/EmptyScreensState';
import { ScreenRow, isActiveAssistantRunStatus } from './screens/ScreenRow';
import { DeleteFolderDialog, RenameFolderDialog } from './screens/folder-dialogs';
import { MoveScreenDialog, RenameScreenDialog } from './screens/screen-dialogs';
import { ExportScreenDialog } from './screens/ExportScreenDialog';
import { ExtractReferenceDialog } from './screens/ExtractReferenceDialog';
import { NewScreenDialog, type NewScreenDialogEntry } from './screens/NewScreenDialog';
import { useScreenActions } from './screens/useScreenActions';

export function ScreensPanel({ onRequestClose }: { onRequestClose?: () => void } = {}) {
  const project = useProjectStore((s) => s.project);
  const setProject = useProjectStore((s) => s.setProject);
  const setBaseline = useProjectStore((s) => s.setBaseline);
  const view = useEditorStore((s) => s.view);
  const activeScreenId = useEditorStore((s) => s.activeScreenId);
  const coverScreenId = useEditorStore((s) => s.coverScreenId);
  const setActiveScreenId = useEditorStore((s) => s.setActiveScreenId);
  const setCanvasView = useEditorStore((s) => s.setCanvasView);
  const setAssistantTaskIntent = useEditorStore((s) => s.setAssistantTaskIntent);
  const setStorybookReloadPending = useEditorStore((s) => s.setStorybookReloadPending);
  const catalog = useCatalogStore((s) => s.catalog);
  const catalogLoading = useCatalogStore((s) => s.loading);
  const catalogError = useCatalogStore((s) => s.error);
  const refreshCatalog = useCatalogStore((s) => s.refresh);
  const session = useSandboxStore((s) => s.session);
  const tasks = useTasksStore((s) => s.tasks);
  const syncTasks = useTasksStore((s) => s.sync);
  const assistantRuns = useAssistantRunStore(selectAssistantRunsList);
  const generativeThumbnailEnabled = useThemeStore((s) => s.generativeThumbnailEnabled);
  const assistantRunsRefreshKey = assistantRunsProposalRefreshKey(assistantRuns);
  const startProjectRestructure = useStartProjectRestructure();

  const [newOpen, setNewOpen] = useState(false);
  const [newScreenEntry, setNewScreenEntry] = useState<NewScreenDialogEntry>('blank');
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<string | null>(null);
  const [renamingScreen, setRenamingScreen] = useState<ProjectScreen | null>(null);
  const [movingScreen, setMovingScreen] = useState<ProjectScreen | null>(null);
  const [exportingScreen, setExportingScreen] = useState<ProjectScreen | null>(null);
  const [addDesignSystemOpen, setAddDesignSystemOpen] = useState(false);
  const [extractReferenceOpen, setExtractReferenceOpen] = useState(false);
  const [designSystemProposals, setDesignSystemProposals] = useState<HtmlDesignSystemProposal[]>(
    [],
  );
  const [designSystemProposalsLoading, setDesignSystemProposalsLoading] = useState(false);
  const [designSystemProposalsError, setDesignSystemProposalsError] = useState<string | null>(null);
  const [htmlDesignSystemStatus, setHtmlDesignSystemStatus] =
    useState<HtmlDesignSystemStatus | null>(null);
  const [busyDesignSystemProposalId, setBusyDesignSystemProposalId] = useState<string | null>(null);
  const [openScreenMenuId, setOpenScreenMenuId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const screensScrollRef = useRef<HTMLDivElement>(null);
  const revealedActiveScreenKeyRef = useRef<string | null>(null);

  const openNewScreenDialog = (entry: NewScreenDialogEntry = 'blank') => {
    setNewScreenEntry(entry);
    setNewOpen(true);
  };

  const handleNewScreenOpenChange = (open: boolean) => {
    setNewOpen(open);
    if (!open) setNewScreenEntry('blank');
  };

  const screens: ProjectScreen[] = project?.screens ?? [];
  const stories = catalogStories(catalog);
  const screenGroups = useMemo(() => groupProjectScreens(screens), [screens]);
  const folderNames = screenGroups.map((group) => group.name);
  const screensPanel = useMemo(
    () => normalizeScreensPanelSettings(project?.screensPanel),
    [project?.screensPanel],
  );
  const collapsedFolderNames = useMemo(
    () => new Set(screensPanel.collapsedFolderNames),
    [screensPanel.collapsedFolderNames],
  );

  useEffect(() => {
    if (!project || !activeScreenId) return;
    const activeScreen = screens.find((screen) => screen.id === activeScreenId);
    if (!activeScreen) return;

    const folder = normalizeScreenFolder(activeScreen.folder);
    const revealKey = `${project.workspacePath ?? project.name}:${activeScreenId}:${folder}`;
    if (revealedActiveScreenKeyRef.current === revealKey) return;
    revealedActiveScreenKeyRef.current = revealKey;

    if (collapsedFolderNames.has(folder)) {
      setProject({
        ...project,
        screensPanel: toggleCollapsedScreenFolder(project.screensPanel, folder),
      });
    }
  }, [activeScreenId, collapsedFolderNames, project, screens, setProject]);

  useEffect(() => {
    if (!activeScreenId) return;
    const frame = window.requestAnimationFrame(() => {
      screensScrollRef.current
        ?.querySelector<HTMLElement>('[data-active-screen="true"]')
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeScreenId, screensPanel.collapsedFolderNames]);
  const flowView = normalizeFlowView(project?.flowView);
  const showFlowVisibilityControls = view === 'flow';
  const showDesignSystemReferenceAction = shouldShowDesignSystemReferenceAction(
    project?.projectKind,
  );
  const showHtmlDesignSystemDistillAction = shouldShowHtmlDesignSystemDistillAction(
    project?.projectKind,
    screens,
    htmlDesignSystemStatus,
  );
  const showHtmlDesignSystemApplyAction = shouldShowHtmlDesignSystemApplyAction(
    project?.projectKind,
    screens,
    htmlDesignSystemStatus,
  );
  const distillationNudge = buildHtmlDesignSystemDistillationNudge({
    projectKind: project?.projectKind,
    screens,
    htmlDesignSystemStatus,
    proposalCount: designSystemProposals.length,
    proposalLoading: designSystemProposalsLoading,
    dismissedKey: screensPanel.htmlDesignSystemDistillNudgeDismissedKey,
  });

  useEffect(() => {
    if (!syncMessage) return;
    const timer = window.setTimeout(() => setSyncMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [syncMessage]);

  useEffect(() => {
    if (!project?.workspacePath) {
      setDesignSystemProposals([]);
      setDesignSystemProposalsLoading(false);
      setDesignSystemProposalsError(null);
      setHtmlDesignSystemStatus(null);
      return;
    }
    const controller = new AbortController();
    setDesignSystemProposalsLoading(true);
    setDesignSystemProposalsError(null);
    void fetchHtmlDesignSystemProposals({ workspacePath: project.workspacePath }, controller.signal)
      .then((result) => setDesignSystemProposals(result.proposals))
      .catch((err) => {
        if (controller.signal.aborted) return;
        setDesignSystemProposalsError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setDesignSystemProposalsLoading(false);
      });
    if (project.projectKind === 'html-first') {
      void fetchProjectDesignSystemBrowser(
        { workspacePath: project.workspacePath },
        controller.signal,
      )
        .then((browser) =>
          setHtmlDesignSystemStatus(browser.projectProfile?.htmlDesignSystem?.status ?? null),
        )
        .catch(() => {
          if (!controller.signal.aborted) setHtmlDesignSystemStatus(null);
        });
    } else {
      setHtmlDesignSystemStatus(null);
    }
    return () => controller.abort();
  }, [assistantRunsRefreshKey, project?.projectKind, project?.workspacePath]);

  const screenActions = useScreenActions({
    project,
    activeScreenId,
    stories,
    catalog,
    ...(refreshCatalog ? { refreshCatalog } : {}),
    setProject,
    setBaseline,
    setActiveScreenId,
    setCanvasView,
    setAssistantTaskIntent,
    setStorybookReloadPending,
    setSyncMessage,
    setExportingScreen,
    syncTasks,
  });

  const handleToggleFolderVisibility = (folder: string) => {
    if (!project) return;
    setProject({
      ...project,
      flowView: toggleFlowFolderHidden(project.flowView, folder),
    });
  };

  const handleToggleScreenVisibility = (screenId: string) => {
    if (!project) return;
    setProject({
      ...project,
      flowView: toggleFlowScreenHidden(project.flowView, screenId),
    });
  };

  const handleToggleFolderCollapsed = (folder: string) => {
    if (!project) return;
    setProject({
      ...project,
      screensPanel: toggleCollapsedScreenFolder(project.screensPanel, folder),
    });
  };

  const handleAcceptDesignSystemProposal = async (proposal: HtmlDesignSystemProposal) => {
    if (!project?.workspacePath) return;
    setBusyDesignSystemProposalId(proposal.id);
    setDesignSystemProposalsError(null);
    try {
      const result = await acceptHtmlDesignSystemProposal({
        workspacePath: project.workspacePath,
        proposalId: proposal.id,
      });
      setDesignSystemProposals(result.proposals);
      const status = result.browser.projectProfile?.htmlDesignSystem?.status ?? 'indexed';
      setHtmlDesignSystemStatus(result.browser.projectProfile?.htmlDesignSystem?.status ?? null);
      setSyncMessage(
        project.projectKind === 'html-first'
          ? `Design system ${status}. Use Apply design system to update existing pages.`
          : 'Project style contract accepted. Project index refreshed.',
      );
    } catch (err) {
      setDesignSystemProposalsError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyDesignSystemProposalId(null);
    }
  };

  const handleRejectDesignSystemProposal = async (proposal: HtmlDesignSystemProposal) => {
    if (!project?.workspacePath) return;
    setBusyDesignSystemProposalId(proposal.id);
    setDesignSystemProposalsError(null);
    try {
      const result = await rejectHtmlDesignSystemProposal({
        workspacePath: project.workspacePath,
        proposalId: proposal.id,
      });
      setDesignSystemProposals(result.proposals);
      setSyncMessage(`Rejected ${result.deletedProposalPath}.`);
    } catch (err) {
      setDesignSystemProposalsError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyDesignSystemProposalId(null);
    }
  };

  const handleExtractDesignSystemReference = () => {
    setExtractReferenceOpen(true);
  };

  const handleDistillDesignSystem = () => {
    const pages = distillableHtmlPagePaths(screens);
    if (pages.length === 0) return;
    dispatchHtmlDesignSystemDistillationDraft(
      createHtmlDesignSystemDistillationDraftDetail({ pages, autoSend: true }),
    );
    setSyncMessage('Design-system distillation run started in Assistant.');
  };

  const handleApplyDesignSystem = () => {
    const pages = distillableHtmlPagePaths(screens);
    if (pages.length === 0) return;
    dispatchHtmlDesignSystemDistillationDraft(
      createHtmlDesignSystemApplyDraftDetail({ pages, autoSend: true }),
    );
    setSyncMessage('Design-system apply run started in Assistant.');
  };

  const handleDismissDistillationNudge = () => {
    if (!project) return;
    setProject({
      ...project,
      screensPanel: {
        ...screensPanel,
        htmlDesignSystemDistillNudgeDismissedKey: distillationNudge.dismissKey,
      },
    });
  };

  return (
    <aside className="flex min-h-0 min-w-0 flex-col border-r border-border bg-sidebar">
      <div className="flex h-9 min-w-0 shrink-0 items-center justify-between border-b border-border px-3 text-xs">
        <div className="flex min-w-0 items-center gap-2 font-medium">
          <Layers className="size-3.5 text-primary" />
          <span>Screens</span>
          <span className="text-muted-foreground">({screens.length})</span>
        </div>
        <div className="flex items-center gap-0.5">
          {showHtmlDesignSystemDistillAction && (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={handleDistillDesignSystem}
              disabled={!project}
              title="Distill design system from pages"
              className="h-6 w-6"
            >
              <GitCompare className="size-3" />
            </Button>
          )}
          {showHtmlDesignSystemApplyAction && (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={handleApplyDesignSystem}
              disabled={!project}
              title="Apply design system to pages"
              className="h-6 w-6"
            >
              <RefreshCw className="size-3" />
            </Button>
          )}
          {showDesignSystemReferenceAction ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleExtractDesignSystemReference}
              disabled={!project}
              title="Extract from reference"
              className="h-6 px-2 text-[11px]"
            >
              <Image className="size-3" />
              Extract
            </Button>
          ) : (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => void screenActions.syncScreens()}
              disabled={!project || !catalog || catalog.source !== 'storybook'}
              title="Sync screens from Storybook"
              className="h-6 w-6"
            >
              <RefreshCw className="size-3" />
            </Button>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => openNewScreenDialog('blank')}
            disabled={!project}
            title="Add a screen"
            className="h-6 w-6"
          >
            <Plus className="size-3" />
          </Button>
          {onRequestClose && (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={onRequestClose}
              title="Hide screens panel"
              className="h-6 w-6"
            >
              <PanelLeftClose className="size-3" />
            </Button>
          )}
        </div>
      </div>

      <div
        ref={screensScrollRef}
        className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-2 py-2"
      >
        {!project && <p className="px-2 py-3 text-xs text-muted-foreground">Loading project…</p>}
        {project?.workspacePath && (
          <DesignSystemProposalCard
            proposals={designSystemProposals}
            loading={designSystemProposalsLoading}
            error={designSystemProposalsError}
            busyProposalId={busyDesignSystemProposalId}
            onAccept={(proposal) => void handleAcceptDesignSystemProposal(proposal)}
            onReject={(proposal) => void handleRejectDesignSystemProposal(proposal)}
          />
        )}
        {project?.projectKind === 'html-first' && htmlDesignSystemStatus === 'non-canonical' && (
          <section className="mb-2 rounded-md border border-warning/40 bg-warning/10 px-2.5 py-2.5 text-xs">
            <div className="mb-1.5 flex items-center gap-2 font-medium text-foreground">
              <GitCompare className="size-3.5 text-warning" />
              Project structure needs review
            </div>
            <p className="leading-relaxed text-muted-foreground">
              Design-system files are outside the canonical design-system/ package. Review a
              complete move and link-rewrite plan before authoring reusable components.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 h-7 w-full justify-start px-2"
              onClick={() => void startProjectRestructure()}
            >
              <GitCompare className="size-3.5" />
              Restructure into sber-designer layout
            </Button>
          </section>
        )}
        {project?.projectKind === 'html-first' && distillationNudge.visible && (
          <section className="mb-2 rounded-md border border-primary/30 bg-card px-2.5 py-2.5 text-xs">
            <div className="mb-1.5 flex min-w-0 items-center gap-2 font-medium text-foreground">
              <GitCompare className="size-3.5 text-primary" />
              <span className="min-w-0 flex-1 truncate">{distillationNudge.title}</span>
              <button
                type="button"
                onClick={handleDismissDistillationNudge}
                title={distillationNudge.dismissLabel}
                className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </div>
            <p className="leading-relaxed text-muted-foreground">{distillationNudge.message}</p>
            <Button
              size="sm"
              className="mt-2 h-7 w-full justify-start px-2"
              onClick={handleDistillDesignSystem}
            >
              <GitCompare className="size-3.5" />
              {distillationNudge.primaryLabel}
            </Button>
          </section>
        )}
        {project && screens.length === 0 && (
          <EmptyScreensState
            projectKind={project.projectKind}
            sessionStatus={session?.status ?? null}
            catalogLoading={catalogLoading}
            catalogError={catalogError}
            storyCount={stories.length}
            onAdd={() => openNewScreenDialog('blank')}
            onAddDesignSystem={() => setAddDesignSystemOpen(true)}
            onExtractReference={handleExtractDesignSystemReference}
            onStartGreybox={() => openNewScreenDialog('greybox')}
            onGeneratePrototype={() => openNewScreenDialog('prototype')}
            onUseFirst={stories[0] ? () => void screenActions.pinStory(stories[0]!) : null}
            onRefresh={refreshCatalog}
          />
        )}
        {syncMessage && (
          <div className="mb-2 rounded-md border border-border bg-card px-2 py-1.5 text-[11px] text-muted-foreground">
            {syncMessage}
          </div>
        )}
        <div className="grid min-w-0 gap-2">
          {screenGroups.map((group) => {
            const collapsed = collapsedFolderNames.has(group.id);
            const folderHidden = flowView.hiddenFolderNames.includes(group.id);
            return (
              <section key={group.id} className="grid min-w-0 gap-1">
                <div
                  className={cn(
                    'group flex h-7 min-w-0 items-center gap-1 rounded-md px-1 text-[11px] text-muted-foreground',
                    folderHidden && 'opacity-55',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleFolderCollapsed(group.id)}
                    title={collapsed ? 'Expand folder' : 'Collapse folder'}
                    className="grid size-5 shrink-0 place-items-center rounded hover:bg-muted hover:text-foreground"
                  >
                    {collapsed ? (
                      <ChevronRight className="size-3" />
                    ) : (
                      <ChevronDown className="size-3" />
                    )}
                  </button>
                  <Folder className="size-3 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                    {group.name}
                  </span>
                  <span className="shrink-0">({group.screens.length})</span>
                  {showFlowVisibilityControls && (
                    <button
                      type="button"
                      onClick={() => handleToggleFolderVisibility(group.name)}
                      title={folderHidden ? 'Show folder in Flow' : 'Hide folder in Flow'}
                      className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      {folderHidden ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setRenamingFolder(group.name)}
                    title="Rename folder"
                    className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="size-3" />
                  </button>
                  {group.name !== UNGROUPED_SCREEN_FOLDER && (
                    <button
                      type="button"
                      onClick={() => setDeletingFolder(group.name)}
                      title="Delete folder"
                      className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </div>
                {!collapsed && (
                  <ul className="grid min-w-0 gap-1">
                    {group.screens.map((s) => {
                      const assistantRun =
                        assistantRuns.find(
                          (run) => run.screenId === s.id && isActiveAssistantRunStatus(run.status),
                        ) ?? null;
                      return (
                        <ScreenRow
                          key={s.id}
                          screen={s}
                          active={activeScreenId === s.id}
                          assistantRun={assistantRun}
                          onSelect={() => {
                            setActiveScreenId(s.id, { source: 'user' });
                            setCanvasView('screen');
                            setAssistantTaskIntent(null);
                          }}
                          menuOpen={openScreenMenuId === s.id}
                          onMenuOpenChange={(open) => setOpenScreenMenuId(open ? s.id : null)}
                          onRename={() => setRenamingScreen(s)}
                          onMove={() => setMovingScreen(s)}
                          onExport={() => screenActions.exportScreen(s)}
                          onDuplicate={() => void screenActions.duplicateScreen(s)}
                          onRemove={() => {
                            void clearCoverScreenPinForDeletedScreen(s.id);
                            void screenActions.removeScreen(s.id);
                          }}
                          onSetHealth={(status) => void screenActions.setScreenHealth(s.id, status)}
                          taskCount={tasksForScreen(tasks, s.id).length}
                          showVisibilityControl={showFlowVisibilityControls}
                          hiddenInFlow={folderHidden || isScreenHiddenInFlow(s, flowView)}
                          onToggleHidden={() => handleToggleScreenVisibility(s.id)}
                          thumbnailPinned={coverScreenId === s.id}
                          thumbnailFeatureEnabled={generativeThumbnailEnabled}
                          onToggleThumbnailPinned={(pinned) =>
                            void toggleCoverScreenPin(s.id, pinned)
                          }
                        />
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </div>

      <NewScreenDialog
        open={newOpen}
        initialEntry={newScreenEntry}
        onOpenChange={handleNewScreenOpenChange}
      />
      <AddDesignSystemDialog
        open={addDesignSystemOpen}
        workspacePath={project?.workspacePath}
        onOpenChange={setAddDesignSystemOpen}
        onConnected={(browser) => {
          const status = browser.projectProfile?.htmlDesignSystem?.status ?? 'indexed';
          setHtmlDesignSystemStatus(browser.projectProfile?.htmlDesignSystem?.status ?? null);
          setSyncMessage(`Design system ${status}. Project index refreshed.`);
        }}
      />
      <ExtractReferenceDialog
        open={extractReferenceOpen}
        onOpenChange={setExtractReferenceOpen}
        onCreate={(detail) => {
          dispatchHtmlDesignSystemReferenceDraft(detail);
          setSyncMessage('Reference proposal run started in Assistant.');
        }}
      />
      <RenameFolderDialog
        folder={renamingFolder}
        existingFolders={folderNames}
        onOpenChange={(open) => {
          if (!open) setRenamingFolder(null);
        }}
        onRename={screenActions.renameFolder}
      />
      <DeleteFolderDialog
        folder={deletingFolder}
        screenCount={
          deletingFolder
            ? (screenGroups.find((group) => group.name === deletingFolder)?.screens.length ?? 0)
            : 0
        }
        onOpenChange={(open) => {
          if (!open) setDeletingFolder(null);
        }}
        onDelete={screenActions.deleteFolder}
      />
      <RenameScreenDialog
        screen={renamingScreen}
        onOpenChange={(open) => {
          if (!open) setRenamingScreen(null);
        }}
        onRename={screenActions.renameScreen}
      />
      <MoveScreenDialog
        screen={movingScreen}
        existingFolders={folderNames}
        onOpenChange={(open) => {
          if (!open) setMovingScreen(null);
        }}
        onMove={screenActions.moveScreen}
      />
      <ExportScreenDialog
        screen={exportingScreen}
        project={project}
        activeScreenId={activeScreenId}
        onOpenChange={(open) => {
          if (!open) setExportingScreen(null);
        }}
      />
    </aside>
  );
}
