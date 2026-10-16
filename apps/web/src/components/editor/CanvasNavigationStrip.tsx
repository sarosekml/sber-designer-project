import { useEffect, useMemo, useRef, useState } from 'react';
import {
  screenSurface,
  type ComponentEntry,
  type ProjectScreen,
} from '@sber-designer/shared-types';
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  FileCode2,
  FilePlus2,
  Folder,
  Layers,
  Loader2,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  SquareStack,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { groupCatalogComponents } from '@/lib/component-groups';
import { fetchProjectDesignSystemBrowser } from '@/lib/api/project-index';
import { catalogStories } from '@/lib/screen-panel-actions';
import { groupProjectScreens, normalizeScreenFolder } from '@/lib/screen-folders';
import { nextActiveScreenTabId } from '@/lib/screen-tabs';
import {
  normalizeScreensPanelSettings,
  toggleCollapsedScreenFolder,
} from '@/lib/screens-panel-state';
import { cn } from '@/lib/utils';
import { selectAssistantRunsList, useAssistantRunStore } from '@/stores/assistant-run-store';
import { useCatalogStore } from '@/stores/catalog-store';
import { useChatStore } from '@/stores/chat-store';
import { useEditorStore } from '@/stores/editor-store';
import { useProjectStore } from '@/stores/project-store';
import { useTasksStore } from '@/stores/tasks-store';
import { NewComponentDialog } from './ComponentsPanel';
import { NewScreenDialog } from './screens/NewScreenDialog';
import {
  SCREEN_TREE_CHILD_INDENT,
  SCREEN_TREE_META_SLOT,
  SCREEN_TREE_NAME_SLOT,
  SCREEN_TREE_TRAILING_SLOT,
} from './screens/screen-tree-layout';
import { useScreenActions } from './screens/useScreenActions';

export function CanvasNavigationStrip({
  onShowResourcePanel,
  resourceKind,
  showResourcePanelDisabled = false,
  onPickerOpenChange,
}: {
  onShowResourcePanel: () => void;
  resourceKind?: 'screens' | 'components';
  showResourcePanelDisabled?: boolean;
  onPickerOpenChange?: (open: boolean) => void;
}) {
  const canvasView = useEditorStore((state) => state.canvasView);
  const resolvedResourceKind = resourceKind ?? (canvasView === 'screen' ? 'screens' : 'components');

  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-card px-2">
      {resolvedResourceKind === 'components' ? (
        <StorybookComponentPicker
          onShowResourcePanel={onShowResourcePanel}
          {...(onPickerOpenChange ? { onPickerOpenChange } : {})}
        />
      ) : (
        <ScreenNavigation
          onShowResourcePanel={onShowResourcePanel}
          showResourcePanelDisabled={showResourcePanelDisabled}
          {...(onPickerOpenChange ? { onPickerOpenChange } : {})}
        />
      )}
    </div>
  );
}

function ScreenNavigation({
  onShowResourcePanel,
  showResourcePanelDisabled,
  onPickerOpenChange,
}: {
  onShowResourcePanel: () => void;
  showResourcePanelDisabled: boolean;
  onPickerOpenChange?: (open: boolean) => void;
}) {
  const project = useProjectStore((state) => state.project);
  const setProject = useProjectStore((state) => state.setProject);
  const setBaseline = useProjectStore((state) => state.setBaseline);
  const projectKey = useProjectStore(
    (state) => state.project?.workspacePath ?? state.project?.name ?? null,
  );
  const screens = useProjectStore((state) => state.project?.screens ?? EMPTY_SCREENS);
  const activeScreenId = useEditorStore((state) => state.activeScreenId);
  const openTabIds = useEditorStore((state) => state.openScreenTabIds);
  const openScreenTab = useEditorStore((state) => state.openScreenTab);
  const closeScreenTab = useEditorStore((state) => state.closeScreenTab);
  const pruneScreenTabs = useEditorStore((state) => state.pruneScreenTabs);
  const resetScreenTabs = useEditorStore((state) => state.resetScreenTabs);
  const setActiveScreenId = useEditorStore((state) => state.setActiveScreenId);
  const setCanvasView = useEditorStore((state) => state.setCanvasView);
  const setAssistantTaskIntent = useEditorStore((state) => state.setAssistantTaskIntent);
  const setStorybookReloadPending = useEditorStore((state) => state.setStorybookReloadPending);
  const catalog = useCatalogStore((state) => state.catalog);
  const refreshCatalog = useCatalogStore((state) => state.refresh);
  const syncTasks = useTasksStore((state) => state.sync);
  const assistantRuns = useAssistantRunStore(selectAssistantRunsList);
  const permissions = useChatStore((state) => state.pendingPermissionsByRunId);
  const previousProjectKey = useRef(projectKey);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const [menuOpen, setMenuOpen] = useState(false);
  const [newScreenOpen, setNewScreenOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    const ids = screens.map((screen) => screen.id);
    if (previousProjectKey.current !== projectKey) {
      previousProjectKey.current = projectKey;
      resetScreenTabs();
    } else {
      pruneScreenTabs(ids);
    }
    if (activeScreenId && ids.includes(activeScreenId)) openScreenTab(activeScreenId);
  }, [activeScreenId, openScreenTab, projectKey, pruneScreenTabs, resetScreenTabs, screens]);

  const activeScreen = screens.find((screen) => screen.id === activeScreenId) ?? null;
  const openScreens = openTabIds
    .map((id) => screens.find((screen) => screen.id === id))
    .filter((screen): screen is (typeof screens)[number] => Boolean(screen));
  const groups = useMemo(() => groupProjectScreens(screens), [screens]);
  const stories = useMemo(() => catalogStories(catalog), [catalog]);
  const screensPanel = useMemo(
    () => normalizeScreensPanelSettings(project?.screensPanel),
    [project?.screensPanel],
  );
  const collapsedFolderNames = useMemo(
    () => new Set(screensPanel.collapsedFolderNames),
    [screensPanel.collapsedFolderNames],
  );

  const toggleFolder = (folderName: string) => {
    if (!project) return;
    setProject({
      ...project,
      screensPanel: toggleCollapsedScreenFolder(project.screensPanel, folderName),
    });
  };

  const revealFolder = (folderName: string) => {
    const folder = normalizeScreenFolder(folderName);
    if (!collapsedFolderNames.has(folder)) return;
    toggleFolder(folder);
  };

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
    setExportingScreen: ignoreExportScreen,
    syncTasks,
  });

  useEffect(() => {
    if (!syncMessage) return;
    const timer = window.setTimeout(() => setSyncMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [syncMessage]);

  const syncScreens = async () => {
    setSyncing(true);
    try {
      await screenActions.syncScreens();
    } finally {
      setSyncing(false);
    }
  };

  const activate = (screenId: string) => {
    const screen = screens.find((item) => item.id === screenId);
    if (screen) revealFolder(screen.folder ?? '');
    openScreenTab(screenId);
    setActiveScreenId(screenId, { source: 'user' });
  };

  const focusTab = (screenId: string | null) => {
    if (!screenId) return;
    window.requestAnimationFrame(() => tabRefs.current.get(screenId)?.focus());
  };

  return (
    <>
      <DropdownMenu
        open={menuOpen}
        onOpenChange={(open) => {
          setMenuOpen(open);
          onPickerOpenChange?.(open);
          if (open && activeScreen) revealFolder(activeScreen.folder ?? '');
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 w-[220px] shrink-0 justify-start gap-1.5 px-2 text-[11px]"
          >
            <Layers className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">
              Screens · {activeScreen?.name ?? 'Select screen'}
            </span>
            <ChevronDown className="ml-auto size-3.5 shrink-0 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="flex max-h-[var(--radix-dropdown-menu-content-available-height)] w-72 flex-col overflow-hidden p-0"
        >
          <div className="flex h-9 min-w-0 shrink-0 items-center justify-between border-b border-border px-3 text-xs">
            <div className="flex min-w-0 items-center gap-2 font-medium">
              <Layers className="size-3.5 text-primary" />
              <span>Screens</span>
              <span className="text-muted-foreground">({screens.length})</span>
            </div>
            <div className="flex items-center gap-0.5">
              <DropdownMenuItem
                aria-label="Sync screens from Storybook"
                title="Sync screens from Storybook"
                disabled={!project || !catalog || catalog.source !== 'storybook' || syncing}
                onSelect={(event) => {
                  event.preventDefault();
                  void syncScreens();
                }}
                className="grid size-6 place-items-center p-0"
              >
                <RefreshCw className={cn('size-3.5', syncing && 'animate-spin')} />
              </DropdownMenuItem>
              <DropdownMenuItem
                aria-label="Add a screen"
                title="Add a screen"
                disabled={!project}
                onSelect={() => setNewScreenOpen(true)}
                className="grid size-6 place-items-center p-0"
              >
                <Plus className="size-3.5" />
              </DropdownMenuItem>
              <DropdownMenuItem
                aria-label="Show screens panel"
                title={
                  showResourcePanelDisabled
                    ? 'Exit fullscreen to show screens panel'
                    : 'Show screens panel'
                }
                disabled={showResourcePanelDisabled}
                onSelect={() => {
                  if (activeScreen) revealFolder(activeScreen.folder ?? '');
                  onShowResourcePanel();
                }}
                className="grid size-6 place-items-center p-0"
              >
                <PanelLeftOpen className="size-3.5" />
              </DropdownMenuItem>
            </div>
          </div>
          {syncMessage && (
            <div className="shrink-0 border-b border-border px-3 py-1.5 text-[10px] text-muted-foreground">
              {syncMessage}
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            {groups.length === 0 && (
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                No screens in this project
              </DropdownMenuLabel>
            )}
            {groups.map((group, groupIndex) => (
              <div key={group.id}>
                {groupIndex > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  aria-expanded={!collapsedFolderNames.has(group.id)}
                  onSelect={(event) => {
                    event.preventDefault();
                    toggleFolder(group.id);
                  }}
                  className="gap-1.5 text-xs font-medium"
                >
                  {collapsedFolderNames.has(group.id) ? (
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-3.5 text-muted-foreground" />
                  )}
                  <Folder className="size-3.5 text-primary" />
                  <span className="min-w-0 flex-1 truncate">{group.name}</span>
                  <span className="text-[10px] font-normal text-muted-foreground">
                    {group.screens.length}
                  </span>
                </DropdownMenuItem>
                {!collapsedFolderNames.has(group.id) &&
                  group.screens.map((screen) => (
                    <DropdownMenuItem
                      key={screen.id}
                      onSelect={() => activate(screen.id)}
                      className={cn(SCREEN_TREE_CHILD_INDENT, 'text-xs')}
                    >
                      <span className={SCREEN_TREE_NAME_SLOT}>{screen.name}</span>
                      <RunIndicator
                        screenId={screen.id}
                        runs={assistantRuns}
                        pendingPermissionsByRunId={permissions}
                      />
                      {screenSurface(screen) === 'modal' && (
                        <SquareStack
                          className={cn(SCREEN_TREE_META_SLOT, 'size-3 text-muted-foreground')}
                          aria-label="Modal"
                        />
                      )}
                      <span className={SCREEN_TREE_TRAILING_SLOT}>
                        {screen.id === activeScreenId && (
                          <Check className="size-3.5 text-primary" />
                        )}
                      </span>
                    </DropdownMenuItem>
                  ))}
              </div>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <div
        role="tablist"
        aria-label="Open screens"
        className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onWheel={(event) => {
          if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
          event.currentTarget.scrollLeft += event.deltaY;
        }}
      >
        {openScreens.map((screen, index) => {
          const active = screen.id === activeScreenId;
          return (
            <div
              key={screen.id}
              className={cn(
                'group inline-flex h-6 max-w-[190px] shrink-0 items-center rounded-[5px] text-[11px]',
                active
                  ? 'bg-secondary font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    ref={(node) => {
                      if (node) tabRefs.current.set(screen.id, node);
                      else tabRefs.current.delete(screen.id);
                    }}
                    role="tab"
                    tabIndex={active ? 0 : -1}
                    aria-selected={active}
                    onClick={() => activate(screen.id)}
                    onKeyDown={(event) => {
                      const last = openScreens.length - 1;
                      const nextIndex =
                        event.key === 'ArrowRight'
                          ? Math.min(last, index + 1)
                          : event.key === 'ArrowLeft'
                            ? Math.max(0, index - 1)
                            : event.key === 'Home'
                              ? 0
                              : event.key === 'End'
                                ? last
                                : -1;
                      if (nextIndex >= 0) {
                        event.preventDefault();
                        focusTab(openScreens[nextIndex]?.id ?? null);
                      } else if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        activate(screen.id);
                      } else if (event.key === 'Delete' && openScreens.length > 1) {
                        event.preventDefault();
                        const nextId = nextActiveScreenTabId(openTabIds, screen.id);
                        closeScreenTab(screen.id);
                        focusTab(nextId);
                      }
                    }}
                    className="inline-flex h-6 min-w-0 items-center gap-1 rounded-[5px] py-0 pl-2 pr-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  >
                    <RunIndicator
                      screenId={screen.id}
                      runs={assistantRuns}
                      pendingPermissionsByRunId={permissions}
                    />
                    {screenSurface(screen) === 'modal' && (
                      <SquareStack
                        className="size-3 shrink-0 text-muted-foreground"
                        aria-label="Modal"
                      />
                    )}
                    <span className="max-w-[140px] truncate">{screen.name}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{screen.name}</TooltipContent>
              </Tooltip>
              {openScreens.length > 1 && (
                <button
                  type="button"
                  aria-label={`Close ${screen.name}`}
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  onClick={() => {
                    const nextId = nextActiveScreenTabId(openTabIds, screen.id);
                    closeScreenTab(screen.id);
                    focusTab(nextId);
                  }}
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <NewScreenDialog open={newScreenOpen} onOpenChange={setNewScreenOpen} />
    </>
  );
}

function ignoreExportScreen(_screen: ProjectScreen | null) {
  // The compact navigator exposes sync and create actions only.
}

function StorybookComponentPicker({
  onShowResourcePanel,
  onPickerOpenChange,
}: {
  onShowResourcePanel: () => void;
  onPickerOpenChange?: (open: boolean) => void;
}) {
  const catalog = useCatalogStore((state) => state.catalog);
  const loading = useCatalogStore((state) => state.loading);
  const error = useCatalogStore((state) => state.error);
  const refresh = useCatalogStore((state) => state.refresh);
  const canvasView = useEditorStore((state) => state.canvasView);
  const activeComponentId = useEditorStore((state) => state.activeComponentId);
  const setActiveComponentId = useEditorStore((state) => state.setActiveComponentId);
  const activeReferencePath = useEditorStore((state) => state.activeDesignSystemReferencePath);
  const setActiveReferencePath = useEditorStore(
    (state) => state.setActiveDesignSystemReferencePath,
  );
  const workspacePath = useProjectStore((state) => state.project?.workspacePath ?? null);
  const [createOpen, setCreateOpen] = useState(false);
  const [referencePages, setReferencePages] = useState<string[]>([]);
  const [referencesLoading, setReferencesLoading] = useState(false);
  const components = catalog?.components ?? EMPTY_COMPONENTS;
  const groups = useMemo(() => groupCatalogComponents(components), [components]);
  const active = components.find((component) => component.id === activeComponentId) ?? null;
  const hint = loading ? 'indexing...' : catalog ? `${components.length}` : 'not connected';
  const designSystemView = canvasView === 'design-system';

  useEffect(() => {
    if (!designSystemView || !workspacePath) {
      setReferencePages([]);
      setReferencesLoading(false);
      return;
    }
    const controller = new AbortController();
    setReferencesLoading(true);
    void fetchProjectDesignSystemBrowser({ workspacePath }, controller.signal)
      .then((browser) => {
        const next = browser.projectProfile?.htmlDesignSystem?.referencePages ?? [];
        setReferencePages(next);
        if (activeReferencePath && !next.includes(activeReferencePath)) {
          setActiveReferencePath(null);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setReferencePages([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setReferencesLoading(false);
      });
    return () => controller.abort();
  }, [activeReferencePath, designSystemView, setActiveReferencePath, workspacePath]);

  const activeReferenceLabel = activeReferencePath
    ? (activeReferencePath.split('/').pop() ?? activeReferencePath)
    : null;

  const selectComponent = (component: ComponentEntry) => {
    setActiveReferencePath(null);
    setActiveComponentId(component.id === activeComponentId ? null : component.id);
  };

  return (
    <>
      <DropdownMenu {...(onPickerOpenChange ? { onOpenChange: onPickerOpenChange } : {})}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 max-w-[300px] gap-1.5 px-2 text-[11px]"
          >
            {designSystemView ? (
              <FileCode2 className="size-3.5" />
            ) : (
              <BookOpen className="size-3.5" />
            )}
            <span className="truncate">
              {designSystemView ? 'Design system' : 'Components'} ·{' '}
              {activeReferenceLabel ??
                active?.shortName ??
                (designSystemView ? 'Catalog' : 'Select component')}
            </span>
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="flex max-h-[var(--radix-dropdown-menu-content-available-height)] w-80 flex-col overflow-hidden p-0"
        >
          <div className="flex h-9 min-w-0 shrink-0 items-center justify-between border-b border-border px-3 text-xs">
            <div className="flex min-w-0 items-center gap-2 font-medium">
              <BookOpen className="size-3.5 shrink-0 text-primary" />
              <span className="truncate">Components</span>
              <span className="text-muted-foreground">({hint})</span>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <DropdownMenuItem
                aria-label="Refresh component catalog"
                title="Refresh component catalog"
                disabled={!refresh || loading}
                onSelect={(event) => {
                  event.preventDefault();
                  void refresh?.();
                }}
                className="grid size-6 place-items-center p-0"
              >
                <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
              </DropdownMenuItem>
              <DropdownMenuItem
                aria-label="Create component"
                title="Create component"
                onSelect={() => setCreateOpen(true)}
                className="grid size-6 place-items-center p-0"
              >
                <FilePlus2 className="size-3.5" />
              </DropdownMenuItem>
              <DropdownMenuItem
                aria-label="Show components panel"
                title="Show components panel"
                onSelect={onShowResourcePanel}
                className="grid size-6 place-items-center p-0"
              >
                <PanelLeftOpen className="size-3.5" />
              </DropdownMenuItem>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            {loading && (
              <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Indexing components…
              </DropdownMenuLabel>
            )}
            {error && (
              <DropdownMenuLabel className="whitespace-normal text-xs text-destructive">
                Catalog failed: {error}
              </DropdownMenuLabel>
            )}
            {!loading && !error && components.length === 0 && (
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                No indexed components
              </DropdownMenuLabel>
            )}
            {groups.map((group, groupIndex) => (
              <div key={group.name}>
                {groupIndex > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {group.name}
                </DropdownMenuLabel>
                {group.components.map((component) => (
                  <DropdownMenuItem
                    key={component.id}
                    onSelect={() => selectComponent(component)}
                    className="text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate">{component.shortName}</span>
                    {component.id === activeComponentId && (
                      <Check className="size-3.5 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
              </div>
            ))}
            {designSystemView && <DropdownMenuSeparator />}
            {designSystemView && (
              <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Reference pages
              </DropdownMenuLabel>
            )}
            {designSystemView && referencesLoading && (
              <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Loading references…
              </DropdownMenuLabel>
            )}
            {designSystemView && !referencesLoading && referencePages.length === 0 && (
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                No reference pages in design-system/refs
              </DropdownMenuLabel>
            )}
            {designSystemView &&
              referencePages.map((path) => (
                <DropdownMenuItem
                  key={path}
                  onSelect={() => setActiveReferencePath(path)}
                  className="text-xs"
                >
                  <FileCode2 className="size-3.5 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">
                    {path.replace(/^design-system\//, '')}
                  </span>
                  {path === activeReferencePath && <Check className="size-3.5 text-primary" />}
                </DropdownMenuItem>
              ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      <NewComponentDialog
        open={createOpen}
        basedOn={null}
        components={components}
        onOpenChange={setCreateOpen}
      />
    </>
  );
}

function RunIndicator({
  screenId,
  runs,
  pendingPermissionsByRunId,
}: {
  screenId: string;
  runs: ReturnType<typeof selectAssistantRunsList>;
  pendingPermissionsByRunId: ReturnType<typeof useChatStore.getState>['pendingPermissionsByRunId'];
}) {
  const run = runs.find(
    (candidate) => candidate.screenId === screenId && ACTIVE_RUN_STATUSES.has(candidate.status),
  );
  if (!run) return null;
  const waiting = Boolean(
    (run.runId ? pendingPermissionsByRunId[run.runId] : null) ??
    pendingPermissionsByRunId[run.clientRunId],
  );
  const label = waiting
    ? 'Waiting for permission'
    : run.status === 'stopping'
      ? 'Stopping assistant'
      : 'Assistant running';
  return (
    <span title={label} aria-label={label} className="inline-flex shrink-0">
      {waiting ? (
        <AlertCircle className="size-3 text-warning" />
      ) : (
        <Loader2 className="size-3 animate-spin text-primary" />
      )}
    </span>
  );
}

const ACTIVE_RUN_STATUSES = new Set(['queued', 'running', 'stopping']);
const EMPTY_SCREENS: readonly ProjectScreen[] = Object.freeze([]);
const EMPTY_COMPONENTS: readonly ComponentEntry[] = Object.freeze([]);
