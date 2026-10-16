/**
 * Design panel shell: tab switching, selection-driven inspect requests,
 * and token prefetch. Tab contents live in ./design-panel/* (task 0078,
 * KT1); this file owns layout and data orchestration only.
 */
import { useCallback, useEffect } from 'react';
import {
  AlertTriangle,
  Blocks,
  Layers3,
  Loader2,
  MousePointer2,
  Paintbrush,
  Plus,
  Settings2,
  X,
} from 'lucide-react';

import { screenSurface } from '@sber-designer/shared-types';

import { fetchDesignTokens, inspectDesignSelection } from '@/lib/api-client';
import { designTargetId, toDesignSelection, type DesignPanelTab } from '@/lib/design-types';
import { cn } from '@/lib/utils';
import { useDesignStore } from '@/stores/design-store';
import { useEditorStore } from '@/stores/editor-store';
import { useProjectStore } from '@/stores/project-store';

import { ComponentTab } from './design-panel/ComponentTab';
import { DesignDraftFooter } from './design-panel/DesignDraftFooter';
import { ModalSurfaceSection } from './design-panel/ModalSurfaceSection';
import { InsertTab } from './design-panel/InsertTab';
import { InspectTab } from './design-panel/InspectTab';
import { LayersTab } from './design-panel/LayersTab';
import { OptionsTab } from './design-panel/OptionsTab';
import { fallbackInspect, formatError, InlineNotice } from './design-panel/shared';
import { StyleTab } from './design-panel/StyleTab';

const TABS: {
  id: DesignPanelTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'inspect', label: 'Inspect', icon: MousePointer2 },
  { id: 'component', label: 'Component', icon: Blocks },
  { id: 'options', label: 'Options', icon: Settings2 },
  { id: 'style', label: 'Style', icon: Paintbrush },
  { id: 'insert', label: 'Insert', icon: Plus },
  { id: 'layers', label: 'Layers', icon: Layers3 },
];

export function VisualDesignPanel() {
  const selected = useEditorStore((s) => s.selected);
  const setSelected = useEditorStore((s) => s.setSelected);
  const activeScreenId = useEditorStore((s) => s.activeScreenId);
  const project = useProjectStore((s) => s.project);
  const activeScreen = project?.screens.find((screen) => screen.id === activeScreenId) ?? null;
  const isModalScreen = screenSurface(activeScreen) === 'modal';
  const modalScreenFilePath = activeScreen?.implementationFilePath ?? activeScreen?.filePath;
  const activeTab = useDesignStore((s) => s.activeTab);
  const setTab = useDesignStore((s) => s.setTab);
  const targetInfo = useDesignStore((s) => s.targetInfo);
  const loadingTargetInfo = useDesignStore((s) => s.loadingTargetInfo);
  const inspectError = useDesignStore((s) => s.inspectError);
  const beginInspect = useDesignStore((s) => s.beginInspect);
  const setTargetInfo = useDesignStore((s) => s.setTargetInfo);
  const setInspectError = useDesignStore((s) => s.setInspectError);
  const clearForSelection = useDesignStore((s) => s.clearForSelection);
  const setTokens = useDesignStore((s) => s.setTokens);
  const setTokensLoading = useDesignStore((s) => s.setTokensLoading);
  const setTokensError = useDesignStore((s) => s.setTokensError);

  const selectedId = selected ? designTargetId(selected) : null;
  // Advertises the Component tab without stealing the user's current tab.
  const paramCount = targetInfo?.componentInstance?.params.length ?? 0;
  const loadInspection = useCallback(
    async (signal?: AbortSignal) => {
      if (!selected) return;
      const currentSelection = useEditorStore.getState().selected;
      if (!currentSelection || designTargetId(currentSelection) !== selectedId) return;
      beginInspect();
      try {
        const result = await inspectDesignSelection(
          {
            ...(project?.workspacePath ? { workspacePath: project.workspacePath } : {}),
            selection: selected,
            ...(activeScreen
              ? {
                  activeScreen: {
                    id: activeScreen.id,
                    ...(activeScreen.storyId ? { storyId: activeScreen.storyId } : {}),
                    ...(activeScreen.filePath ? { filePath: activeScreen.filePath } : {}),
                    ...(activeScreen.implementationFilePath
                      ? { implementationFilePath: activeScreen.implementationFilePath }
                      : {}),
                  },
                }
              : {}),
          },
          signal,
        );
        const latestSelection = useEditorStore.getState().selected;
        const latestWorkspace = useProjectStore.getState().project?.workspacePath;
        if (
          !latestSelection ||
          designTargetId(latestSelection) !== selectedId ||
          latestWorkspace !== project?.workspacePath
        ) {
          return;
        }
        setTargetInfo(result);
        if (
          result.diagnostics.some(
            (diagnostic) => diagnostic.code === 'design.generated-screen.source-recovered',
          ) &&
          result.target.loc !== selected.loc
        ) {
          setSelected(toDesignSelection(result.target));
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setInspectError(formatError(err));
      }
    },
    [
      activeScreen,
      beginInspect,
      project?.workspacePath,
      selected,
      selectedId,
      setInspectError,
      setSelected,
      setTargetInfo,
    ],
  );

  useEffect(() => {
    clearForSelection(selectedId);
    if (!selected) return;
    const ac = new AbortController();
    void loadInspection(ac.signal);
    return () => ac.abort();
  }, [clearForSelection, loadInspection, selected, selectedId]);

  useEffect(() => {
    if (!project?.workspacePath) return;
    const ac = new AbortController();
    setTokensLoading(true);
    fetchDesignTokens(project.workspacePath, ac.signal)
      .then(setTokens)
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setTokensError(formatError(err));
      });
    return () => ac.abort();
  }, [project?.workspacePath, setTokens, setTokensError, setTokensLoading]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-4 text-xs">
        <div className="flex min-w-0 items-center gap-2 font-medium">
          <MousePointer2 className="size-3.5 text-primary" />
          <span>Design</span>
          {targetInfo?.editable === false && (
            <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-warning">
              save locked
            </span>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-muted-foreground" title={selected?.loc}>
            {selected ? (selected.componentName ?? selected.tagName.toLowerCase()) : 'no selection'}
          </span>
          {selected && (
            <button
              type="button"
              onClick={() => setSelected(null)}
              title="Clear selection"
              className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      <div className="flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-b border-border px-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[11px] transition-colors',
              activeTab === id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <Icon className="size-3" />
            {label}
            {id === 'component' && paramCount > 0 && (
              <span
                className={cn(
                  'rounded-full px-1 text-[9px]',
                  activeTab === id ? 'bg-primary-foreground/20' : 'bg-muted',
                )}
              >
                {paramCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="min-w-0 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 text-sm">
        {isModalScreen && activeScreen && (
          <ModalSurfaceSection
            screenId={activeScreen.id}
            {...(project?.workspacePath ? { workspacePath: project.workspacePath } : {})}
            {...(modalScreenFilePath ? { filePath: modalScreenFilePath } : {})}
          />
        )}
        {!selected ? (
          isModalScreen ? null : (
            <EmptyState />
          )
        ) : loadingTargetInfo && !targetInfo ? (
          <InlineNotice
            icon={Loader2}
            title="Inspecting source"
            detail="Resolving JSX props, text and safe edit capabilities."
            spin
          />
        ) : inspectError ? (
          <InlineNotice
            tone="error"
            icon={AlertTriangle}
            title="Could not inspect selection"
            detail={inspectError}
          />
        ) : activeTab === 'inspect' ? (
          <InspectTab
            selectedInfo={targetInfo ?? fallbackInspect(selected)}
            selected={selected}
            {...(project?.workspacePath ? { workspacePath: project.workspacePath } : {})}
            onReload={loadInspection}
          />
        ) : activeTab === 'component' ? (
          <ComponentTab
            info={targetInfo ?? fallbackInspect(selected)}
            {...(project?.workspacePath ? { workspacePath: project.workspacePath } : {})}
            {...(activeScreen?.id ? { screenId: activeScreen.id } : {})}
            onReload={loadInspection}
          />
        ) : activeTab === 'options' ? (
          <OptionsTab info={targetInfo ?? fallbackInspect(selected)} />
        ) : activeTab === 'style' ? (
          <StyleTab info={targetInfo ?? fallbackInspect(selected)} />
        ) : activeTab === 'insert' ? (
          <InsertTab info={targetInfo ?? fallbackInspect(selected)} />
        ) : (
          <LayersTab />
        )}
      </div>

      {/* Inspect edits live styles; Component writes each param straight to source. */}
      {activeTab !== 'inspect' && activeTab !== 'component' && (
        <DesignDraftFooter
          {...(project?.workspacePath ? { workspacePath: project.workspacePath } : {})}
          onReload={loadInspection}
        />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid gap-2 text-sm text-muted-foreground">
      <div className="font-medium text-foreground">Select an element on the canvas</div>
      <p className="text-xs leading-relaxed">
        Design mode edits source-backed JSX targets through staged visual changes.
      </p>
    </div>
  );
}
