import { BookOpen, Info, Loader2, Monitor, Pen, RotateCw, SwatchBook, X } from 'lucide-react';
import { type CSSProperties, useEffect, useState } from 'react';
import type { HtmlDesignSystemStatus, SberDesignerProjectKind } from '@sber-designer/shared-types';

import { Button } from '@/components/ui/button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { useSandboxSession } from '@/hooks/useSandboxSession';
import { pushEditorState } from '@/lib/api-client';
import {
  fetchProjectDesignSystemBrowser,
  regenerateHtmlDesignSystemPreview,
} from '@/lib/api/project-index';
import {
  CANVAS_VIEWPORT_PRESETS,
  canvasViewportWidth,
  type CanvasViewportPresetId,
} from '@/lib/canvas-viewport';
import { useCatalogStore } from '@/stores/catalog-store';
import { type CanvasView, useEditorStore } from '@/stores/editor-store';
import { useProjectStore } from '@/stores/project-store';
import { useSandboxStore } from '@/stores/sandbox-store';
import { cn } from '@/lib/utils';
import { useStartProjectRestructure } from '@/lib/use-start-project-restructure';
import { shouldShowDesignSystemBootstrap } from '@/lib/html-design-system-bootstrap';
import { CanvasFrame } from './CanvasFrame';
import { CanvasNavigationStrip } from './CanvasNavigationStrip';
import { DesignSystemBootstrapCard } from './DesignSystemBootstrapCard';
import { ScreenInfoSheet } from './screen-info/ScreenInfoSheet';

/**
 * Center canvas region. Wraps CanvasFrame with a checkerboard backdrop
 * and a sub-bar showing current mode and selection.
 */
export function CanvasArea({
  resourcePanelHidden = false,
  onShowResourcePanel = () => undefined,
}: {
  resourcePanelHidden?: boolean;
  onShowResourcePanel?: () => void;
}) {
  const mode = useEditorStore((s) => s.mode);
  const selected = useEditorStore((s) => s.selected);
  const setSelected = useEditorStore((s) => s.setSelected);
  const activeComponentId = useEditorStore((s) => s.activeComponentId);
  const activeScreenId = useEditorStore((s) => s.activeScreenId);
  const canvasView = useEditorStore((s) => s.canvasView);
  const setCanvasView = useEditorStore((s) => s.setCanvasView);
  const storybookReloadPending = useEditorStore((s) => s.storybookReloadPending);
  const setStorybookReloadPending = useEditorStore((s) => s.setStorybookReloadPending);
  const globalCanvasReloadKey = useEditorStore((s) => s.canvasReloadKey);
  const bumpCanvasReloadKey = useEditorStore((s) => s.bumpCanvasReloadKey);
  const canvasViewportPresetId = useEditorStore((s) => s.canvasViewportPresetId);
  const setCanvasViewportPresetId = useEditorStore((s) => s.setCanvasViewportPresetId);
  const markActive = useEditorStore((s) => s.markActive);
  const setMarkActive = useEditorStore((s) => s.setMarkActive);
  const screenInfoOpen = useEditorStore((s) => s.screenInfoOpen);
  const setScreenInfoOpen = useEditorStore((s) => s.setScreenInfoOpen);
  const catalog = useCatalogStore((s) => s.catalog);
  const refreshCatalog = useCatalogStore((s) => s.refresh);
  const projectKind = useProjectStore((s) => s.project?.projectKind);
  const workspacePath = useProjectStore((s) => s.project?.workspacePath ?? null);
  const activeScreen = useProjectStore(
    (s) => s.project?.screens.find((screen) => screen.id === activeScreenId) ?? null,
  );
  const session = useSandboxStore((s) => s.session);
  const { createSession } = useSandboxSession();
  const [restarting, setRestarting] = useState(false);
  const [frameReloadKey, setFrameReloadKey] = useState(0);
  const [htmlDesignSystemStatus, setHtmlDesignSystemStatus] =
    useState<HtmlDesignSystemStatus | null>(null);
  const startProjectRestructure = useStartProjectRestructure();
  const canOpenStorybook = Boolean(session?.previewUrl);
  const activeComponent = activeComponentId
    ? (catalog?.components.find((component) => component.id === activeComponentId) ?? null)
    : null;
  const activeStoryMissing =
    canvasView === 'screen' &&
    session?.status === 'ready' &&
    catalog?.source === 'storybook' &&
    Boolean(activeScreen?.storyId) &&
    !catalogHasStory(catalog, activeScreen?.storyId ?? '');
  const canRestart =
    Boolean(session?.workspacePath) &&
    (session?.status === 'failed' || session?.status === 'stopped');
  const canvasChrome = buildCanvasAreaChromeModel({
    projectKind,
    canvasView,
    canOpenStorybook,
    storybookReloadPending,
    activeStoryMissing,
    canRestart,
  });
  const fixedViewportWidth =
    canvasChrome.effectiveCanvasView !== 'storybook'
      ? canvasViewportWidth(canvasViewportPresetId)
      : null;
  const frameStyle: CSSProperties = fixedViewportWidth
    ? { width: `${fixedViewportWidth}px`, minWidth: `${fixedViewportWidth}px` }
    : { width: '100%' };

  useEffect(() => {
    if (projectKind === 'html-first' && canvasView === 'storybook') {
      setCanvasView('screen');
    } else if (projectKind !== 'html-first' && canvasView === 'design-system') {
      setCanvasView('screen');
    }
  }, [canvasView, projectKind, setCanvasView]);

  useEffect(() => {
    if (projectKind !== 'html-first' || !workspacePath) {
      setHtmlDesignSystemStatus(null);
      return;
    }
    const controller = new AbortController();
    void fetchProjectDesignSystemBrowser({ workspacePath }, controller.signal)
      .then((browser) =>
        setHtmlDesignSystemStatus(browser.projectProfile?.htmlDesignSystem?.status ?? null),
      )
      .catch(() => {
        if (!controller.signal.aborted) setHtmlDesignSystemStatus(null);
      });
    return () => controller.abort();
  }, [projectKind, workspacePath]);

  const handleRestart = async () => {
    if (!session?.workspacePath) return;
    setRestarting(true);
    try {
      await createSession(session.workspacePath, { force: true });
      setCanvasView('screen');
      setStorybookReloadPending(false);
      void pushEditorState({ storybookReloadPending: false });
    } finally {
      setRestarting(false);
    }
  };

  const handleReloadStorybook = async () => {
    const targetStoryId = activeScreen?.storyId ?? null;
    await refreshCatalog?.();
    const refreshedCatalog = useCatalogStore.getState().catalog;
    if (
      targetStoryId &&
      !catalogHasStory(refreshedCatalog, targetStoryId) &&
      session?.workspacePath
    ) {
      setRestarting(true);
      try {
        await createSession(session.workspacePath, { force: true });
        setCanvasView('screen');
      } finally {
        setRestarting(false);
      }
    } else {
      bumpCanvasReloadKey();
      setFrameReloadKey((key) => key + 1);
    }
    setStorybookReloadPending(false);
    await pushEditorState({ storybookReloadPending: false });
  };

  const handleRebuildDesignSystem = async () => {
    setRestarting(true);
    try {
      await regenerateHtmlDesignSystemPreview({
        ...(session?.workspacePath ? { workspacePath: session.workspacePath } : {}),
        keepDescriptions: true,
      });
      await refreshCatalog?.();
      bumpCanvasReloadKey();
      setFrameReloadKey((key) => key + 1);
    } finally {
      setRestarting(false);
    }
  };

  return (
    <section className="flex min-w-0 flex-col bg-[var(--background)]">
      {resourcePanelHidden && <CanvasNavigationStrip onShowResourcePanel={onShowResourcePanel} />}
      <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 text-xs text-muted-foreground">
        <div className="flex min-w-0 items-center gap-3">
          <span className="capitalize text-foreground">
            {canvasChrome.effectiveCanvasView === 'storybook'
              ? 'Storybook mode'
              : canvasChrome.effectiveCanvasView === 'design-system'
                ? 'Design system mode'
                : `${mode} mode`}
          </span>
          <span>·</span>
          {canvasChrome.effectiveCanvasView !== 'screen' ? (
            <span className="min-w-0 truncate">
              {activeComponent ? (
                <>
                  <span className="text-foreground">{activeComponent.shortName}</span>{' '}
                  <span className="font-mono text-[11px] opacity-70">
                    {activeComponent.stories[0]?.id ?? activeComponent.id}
                  </span>
                </>
              ) : canvasChrome.effectiveCanvasView === 'design-system' ? (
                'managed catalog'
              ) : (
                'no component selected'
              )}
            </span>
          ) : selected ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span className="truncate font-mono text-[11px]">
                {selected.tagName.toLowerCase()}{' '}
                <span className="opacity-60">@ {selected.loc}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setSelected(null)}
                title="Clear selection"
                className="h-5 w-5 shrink-0 rounded p-0 text-muted-foreground hover:text-foreground"
              >
                <X />
              </Button>
            </span>
          ) : (
            <span>no selection</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canvasChrome.effectiveCanvasView === 'screen' && activeScreen && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[11px]"
              onClick={() => setScreenInfoOpen(true)}
              title="Screen info: creation date, generation runs, tokens, artifacts"
            >
              <Info />
              Info
            </Button>
          )}
          {canvasChrome.effectiveCanvasView === 'screen' && (
            <Button
              size="sm"
              variant={markActive ? 'secondary' : 'outline'}
              aria-pressed={markActive}
              className="h-6 px-2 text-[11px]"
              onClick={() => setMarkActive(!markActive)}
              title="Annotate: draw on the canvas and send the marked region to the assistant"
            >
              <Pen />
              Annotate
            </Button>
          )}
          {canvasChrome.shouldOfferStorybookReload && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[11px]"
              disabled={restarting}
              onClick={() => void handleReloadStorybook()}
              title="Refresh the Storybook catalog; restart Storybook if the active screen story is still missing"
            >
              {restarting ? <Loader2 className="animate-spin" /> : <RotateCw />}
              {activeStoryMissing ? 'Restart Storybook' : 'Reload Storybook'}
            </Button>
          )}
          {canvasChrome.effectiveCanvasView === 'design-system' && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[11px]"
              disabled={restarting}
              onClick={() => void handleRebuildDesignSystem()}
              title="Rebuild the managed HTML design-system preview and refresh the catalog"
            >
              {restarting ? <Loader2 className="animate-spin" /> : <RotateCw />}
              Rebuild preview
            </Button>
          )}
          {canvasChrome.canRestartStorybook && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[11px]"
              disabled={restarting}
              onClick={() => void handleRestart()}
              title="Restart the sandbox Storybook server"
            >
              {restarting ? <Loader2 className="animate-spin" /> : <RotateCw />}
              Restart Storybook
            </Button>
          )}
          <CanvasViewportSelect
            value={canvasViewportPresetId}
            disabled={canvasChrome.viewportDisabled}
            onChange={setCanvasViewportPresetId}
          />
          {canvasChrome.showCanvasViewToggle && (
            <div
              role="tablist"
              aria-label="Canvas view"
              className="inline-flex rounded-md border border-border bg-background p-0.5"
            >
              <CanvasViewButton
                active={canvasView === 'screen'}
                icon={Monitor}
                label="Screen"
                onClick={() => setCanvasView('screen')}
              />
              {canvasChrome.designSystemTabEnabled ? (
                <CanvasViewButton
                  active={canvasView === 'design-system'}
                  icon={SwatchBook}
                  label="Design system"
                  onClick={() => setCanvasView('design-system')}
                />
              ) : (
                <CanvasViewButton
                  active={canvasView === 'storybook'}
                  disabled={!canvasChrome.storybookTabEnabled}
                  icon={BookOpen}
                  label="Storybook"
                  onClick={() => setCanvasView('storybook')}
                />
              )}
            </div>
          )}
        </div>
      </div>
      {canvasChrome.effectiveCanvasView === 'design-system' &&
        htmlDesignSystemStatus === 'non-canonical' && (
          <div className="flex shrink-0 items-center gap-3 border-b border-warning/40 bg-warning/10 px-4 py-2 text-xs">
            <div className="min-w-0 flex-1">
              <span className="font-medium text-foreground">Project structure needs review.</span>{' '}
              <span className="text-muted-foreground">
                Reusable authoring is paused until the design-system/ package is canonical.
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 shrink-0"
              onClick={() => void startProjectRestructure()}
            >
              Review restructure plan
            </Button>
          </div>
        )}
      <div className="relative min-h-0 flex-1 overflow-auto bg-muted/60 p-0">
        <DesignSystemBootstrapCard
          visible={shouldShowDesignSystemBootstrap(
            canvasChrome.effectiveCanvasView,
            htmlDesignSystemStatus,
          )}
          {...(workspacePath ? { workspacePath } : {})}
          onChanged={(browser) => {
            setHtmlDesignSystemStatus(browser.projectProfile?.htmlDesignSystem?.status ?? null);
            void refreshCatalog?.();
            bumpCanvasReloadKey();
            setFrameReloadKey((key) => key + 1);
          }}
        />
        <div
          className="relative mx-auto h-full overflow-hidden rounded-md border border-[var(--canvas-frame-border)] bg-white shadow-2xl"
          style={frameStyle}
        >
          <CanvasFrame reloadKey={frameReloadKey + globalCanvasReloadKey} />
        </div>
      </div>
      {canvasChrome.effectiveCanvasView === 'screen' && activeScreen && (
        <ScreenInfoSheet
          screenId={activeScreen.id}
          workspacePath={workspacePath}
          open={screenInfoOpen}
          onOpenChange={setScreenInfoOpen}
        />
      )}
    </section>
  );
}

export interface CanvasAreaChromeModel {
  effectiveCanvasView: CanvasView;
  showCanvasViewToggle: boolean;
  storybookTabEnabled: boolean;
  designSystemTabEnabled: boolean;
  shouldOfferStorybookReload: boolean;
  canRestartStorybook: boolean;
  viewportDisabled: boolean;
}

export function buildCanvasAreaChromeModel(input: {
  projectKind: SberDesignerProjectKind | null | undefined;
  canvasView: CanvasView;
  canOpenStorybook: boolean;
  storybookReloadPending: boolean;
  activeStoryMissing: boolean;
  canRestart: boolean;
}): CanvasAreaChromeModel {
  const htmlFirst = input.projectKind === 'html-first';
  const effectiveCanvasView =
    htmlFirst && input.canvasView === 'storybook'
      ? 'screen'
      : !htmlFirst && input.canvasView === 'design-system'
        ? 'screen'
        : input.canvasView;
  return {
    effectiveCanvasView,
    showCanvasViewToggle: htmlFirst || input.canOpenStorybook,
    storybookTabEnabled: !htmlFirst && input.canOpenStorybook,
    designSystemTabEnabled: htmlFirst,
    shouldOfferStorybookReload:
      !htmlFirst && (input.storybookReloadPending || input.activeStoryMissing),
    canRestartStorybook: !htmlFirst && input.canRestart,
    viewportDisabled: effectiveCanvasView === 'storybook',
  };
}

function CanvasViewportSelect({
  value,
  disabled,
  onChange,
}: {
  value: CanvasViewportPresetId;
  disabled: boolean;
  onChange: (value: CanvasViewportPresetId) => void;
}) {
  return (
    <label className="inline-flex h-7 items-center text-[11px] text-muted-foreground">
      <span className="sr-only">Viewport width</span>
      <NativeSelect
        aria-label="Viewport width"
        value={value}
        disabled={disabled}
        title={disabled ? 'Viewport is unavailable in Storybook view' : 'Viewport width'}
        size="sm"
        onChange={(event) => onChange(event.target.value as CanvasViewportPresetId)}
        className="!h-7 w-[124px] border-border bg-background !py-0 pl-2 pr-7 text-[11px] text-foreground shadow-none hover:bg-accent/60 focus-visible:ring-1 dark:bg-background dark:hover:bg-accent/60 [&+svg]:right-2 [&+svg]:size-3.5 [&+svg]:opacity-60"
      >
        {CANVAS_VIEWPORT_PRESETS.map((preset) => (
          <NativeSelectOption key={preset.id} value={preset.id}>
            {preset.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </label>
  );
}

function catalogHasStory(
  catalog: ReturnType<typeof useCatalogStore.getState>['catalog'],
  storyId: string,
): boolean {
  return Boolean(
    storyId &&
    catalog?.components.some((component) =>
      component.stories.some((story) => story.id === storyId),
    ),
  );
}

function CanvasViewButton({
  active,
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      role="tab"
      type="button"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      variant={active ? 'secondary' : 'ghost'}
      size="sm"
      className={cn(
        'h-6 rounded-[5px] px-2.5 py-0.5 text-[11px]',
        !active && 'text-muted-foreground',
      )}
    >
      <Icon />
      {label}
    </Button>
  );
}
