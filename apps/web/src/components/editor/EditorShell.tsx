/**
 * Top-level editor layout. Three columns:
 *   ┌─ ChatPanel ─┬─ Canvas (iframe + overlay) ─┬─ ContextPanel (Components / Selection / Code) ─┐
 * Top bar holds project info and ModeTabs.
 *
 * Layout idea borrowed loosely from openpencil's editor-layout.tsx and
 * the Caldera screenshots in refs/. Implementation is fresh.
 */
import { useEffect, useRef, useState } from 'react';

import { useCatalog } from '@/hooks/useCatalog';
import { useConfigLoader } from '@/hooks/useConfigLoader';
import { useEditorBridge } from '@/hooks/useEditorBridge';
import { useGitStatusSync } from '@/hooks/useGitStatusSync';
import { useProject } from '@/hooks/useProject';
import { useProjectAutosave } from '@/hooks/useProjectAutosave';

import { useEditorStore } from '@/stores/editor-store';
import { areAllEditorPanelsHidden, setAllEditorPanelsHidden } from '@/lib/editor-panel-visibility';
import { cn } from '@/lib/utils';

import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';
import { ChatPanel } from './ChatPanel';
import { CanvasArea } from './CanvasArea';
import { CanvasNavigationStrip } from './CanvasNavigationStrip';
import { ComponentsPanel } from './ComponentsPanel';
import { ContextPanel } from './ContextPanel';
import { DemoCanvas } from './DemoCanvas';
import { FlowCanvas } from './FlowCanvas';
import { ScreensPanel } from './ScreensPanel';
import { TransitionsPanel } from './TransitionsPanel';

const HANDLE_WIDTH = 6;

export function EditorShell() {
  useConfigLoader();
  useEditorBridge();
  useCatalog();
  useProject();
  useProjectAutosave();
  useGitStatusSync();
  const view = useEditorStore((s) => s.view);
  const mode = useEditorStore((s) => s.mode);
  const canvasView = useEditorStore((s) => s.canvasView);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const [screensWidth, setScreensWidth] = useState(() =>
    readPanelWidth('sd.screensPanelWidth', 200, clampScreensWidth),
  );
  const [transitionsWidth, setTransitionsWidth] = useState(() =>
    readPanelWidth('sd.transitionsPanelWidth', 280, clampTransitionsWidth),
  );
  const [chatWidth, setChatWidth] = useState(() =>
    readPanelWidth('sd.chatPanelWidth', 360, clampChatWidth),
  );
  const [contextWidth, setContextWidth] = useState(() =>
    readPanelWidth('sd.contextPanelWidth', 360, clampContextWidth),
  );
  const legacyLeftPanelsHidden = () => readBoolean('sd.leftPanelsHidden', false);
  const [screensPanelHidden, setScreensPanelHidden] = useState(() =>
    readBoolean('sd.screensPanelHidden', legacyLeftPanelsHidden()),
  );
  const [assistantPanelHidden, setAssistantPanelHidden] = useState(() =>
    readBoolean('sd.assistantPanelHidden', legacyLeftPanelsHidden()),
  );
  const [rightPanelHidden, setRightPanelHidden] = useState(() =>
    readBoolean('sd.rightPanelHidden', false),
  );
  const [demoFullscreen, setDemoFullscreen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem('sd.screensPanelWidth', String(screensWidth));
  }, [screensWidth]);

  useEffect(() => {
    window.localStorage.setItem('sd.transitionsPanelWidth', String(transitionsWidth));
  }, [transitionsWidth]);

  useEffect(() => {
    window.localStorage.setItem('sd.chatPanelWidth', String(chatWidth));
  }, [chatWidth]);

  useEffect(() => {
    window.localStorage.setItem('sd.contextPanelWidth', String(contextWidth));
  }, [contextWidth]);

  useEffect(() => {
    window.localStorage.setItem('sd.screensPanelHidden', String(screensPanelHidden));
  }, [screensPanelHidden]);

  useEffect(() => {
    window.localStorage.setItem('sd.assistantPanelHidden', String(assistantPanelHidden));
  }, [assistantPanelHidden]);

  useEffect(() => {
    window.localStorage.setItem('sd.rightPanelHidden', String(rightPanelHidden));
  }, [rightPanelHidden]);

  useEffect(() => {
    if (view !== 'demo') setDemoFullscreen(false);
  }, [view]);

  const minRightPanelWidth = mode === 'code' ? 360 : 280;
  const rightPanelWidth = Math.max(minRightPanelWidth, contextWidth);
  const showScreensPanel = !screensPanelHidden;
  const showAssistantPanel = !assistantPanelHidden;
  const showRightPanel = !rightPanelHidden;
  const panelVisibility = {
    screensHidden: screensPanelHidden,
    assistantHidden: assistantPanelHidden,
    componentsHidden: rightPanelHidden,
  };
  const canvasFocused = areAllEditorPanelsHidden(panelVisibility);
  const editGridColumns = [
    showAssistantPanel ? `${chatWidth}px` : null,
    showAssistantPanel ? `${HANDLE_WIDTH}px` : null,
    showScreensPanel ? `${screensWidth}px` : null,
    showScreensPanel ? `${HANDLE_WIDTH}px` : null,
    'minmax(0,1fr)',
    showRightPanel ? `${HANDLE_WIDTH}px` : null,
    showRightPanel ? `${rightPanelWidth}px` : null,
  ]
    .filter(Boolean)
    .join(' ');

  useEffect(() => {
    if (view === 'flow' && canvasFocused) {
      setScreensPanelHidden(false);
      setAssistantPanelHidden(false);
      setRightPanelHidden(false);
    }
  }, [canvasFocused, view]);

  const setCanvasFocused = (focused: boolean) => {
    const next = setAllEditorPanelsHidden(panelVisibility, focused);
    setScreensPanelHidden(next.screensHidden);
    setAssistantPanelHidden(next.assistantHidden);
    setRightPanelHidden(next.componentsHidden);
  };

  if (view === 'demo') {
    const demoScreensPanelHidden = demoFullscreen || screensPanelHidden;
    const showDemoScreensPanel = !demoScreensPanelHidden;
    const demoGridColumns = [
      showDemoScreensPanel ? `${screensWidth}px` : null,
      showDemoScreensPanel ? `${HANDLE_WIDTH}px` : null,
      'minmax(0,1fr)',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-black text-foreground">
        <DemoChrome
          fullscreen={demoFullscreen}
          onFullscreenChange={setDemoFullscreen}
          screensPanelHidden={demoScreensPanelHidden}
          onScreensPanelHiddenChange={setScreensPanelHidden}
        />
        <div
          ref={layoutRef}
          className="grid min-h-0 w-full flex-1"
          style={{ gridTemplateColumns: demoGridColumns }}
        >
          {showDemoScreensPanel && (
            <>
              <ScreensPanel onRequestClose={() => setScreensPanelHidden(true)} />
              <PanelResizeHandle
                ariaLabel="Resize screens panel"
                draggingTitle={`Screens width: ${screensWidth}px`}
                onDrag={(event) => {
                  const left = layoutRef.current?.getBoundingClientRect().left ?? 0;
                  setScreensWidth(clampScreensWidth(event.clientX - left));
                }}
              />
            </>
          )}
          <DemoCanvas />
        </div>
      </div>
    );
  }

  if (view === 'flow') {
    return (
      <div className="flex h-full w-full flex-col bg-background text-foreground">
        <TopBar />
        <div
          ref={layoutRef}
          className="grid min-h-0 flex-1"
          style={{
            gridTemplateColumns: `${screensWidth}px ${HANDLE_WIDTH}px ${transitionsWidth}px ${HANDLE_WIDTH}px minmax(0,1fr)`,
          }}
        >
          <ScreensPanel />
          <PanelResizeHandle
            ariaLabel="Resize screens panel"
            draggingTitle={`Screens width: ${screensWidth}px`}
            onDrag={(event) => {
              const left = layoutRef.current?.getBoundingClientRect().left ?? 0;
              setScreensWidth(clampScreensWidth(event.clientX - left));
            }}
          />
          <TransitionsPanel />
          <PanelResizeHandle
            ariaLabel="Resize transitions panel"
            draggingTitle={`Transitions width: ${transitionsWidth}px`}
            onDrag={(event) => {
              const left = layoutRef.current?.getBoundingClientRect().left ?? 0;
              setTransitionsWidth(
                clampTransitionsWidth(event.clientX - left - screensWidth - HANDLE_WIDTH),
              );
            }}
          />
          <FlowCanvas />
        </div>
        <StatusBar />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-background text-foreground">
      <TopBar
        panelControls={{
          canvasFocused,
          resourcePanelKind: canvasView === 'screen' ? 'screens' : 'components',
          screensPanelHidden,
          assistantPanelHidden,
          rightPanelHidden,
          onCanvasFocusChange: setCanvasFocused,
          onScreensPanelHiddenChange: setScreensPanelHidden,
          onAssistantPanelHiddenChange: setAssistantPanelHidden,
          onRightPanelHiddenChange: setRightPanelHidden,
        }}
      />
      <div
        ref={layoutRef}
        className="grid min-h-0 flex-1"
        style={{ gridTemplateColumns: editGridColumns }}
      >
        {showAssistantPanel && (
          <>
            <ChatPanel />
            <PanelResizeHandle
              ariaLabel="Resize assistant panel"
              draggingTitle={`Assistant width: ${chatWidth}px`}
              onDrag={(event) => {
                const rect = layoutRef.current?.getBoundingClientRect();
                const left = rect?.left ?? 0;
                setChatWidth(clampChatWidth(event.clientX - left));
              }}
            />
          </>
        )}
        {showScreensPanel && (
          <>
            {canvasView !== 'screen' ? (
              <ComponentsPanel onRequestClose={() => setScreensPanelHidden(true)} />
            ) : (
              <ScreensPanel onRequestClose={() => setScreensPanelHidden(true)} />
            )}
            <PanelResizeHandle
              ariaLabel={`Resize ${canvasView === 'screen' ? 'screens' : 'components'} panel`}
              draggingTitle={`Resource panel width: ${screensWidth}px`}
              onDrag={(event) => {
                const rect = layoutRef.current?.getBoundingClientRect();
                const left = rect?.left ?? 0;
                const resourceLeftOffset = showAssistantPanel ? chatWidth + HANDLE_WIDTH : 0;
                setScreensWidth(clampScreensWidth(event.clientX - left - resourceLeftOffset));
              }}
            />
          </>
        )}
        <CanvasArea
          resourcePanelHidden={screensPanelHidden}
          onShowResourcePanel={() => setScreensPanelHidden(false)}
        />
        {showRightPanel && (
          <>
            <PanelResizeHandle
              ariaLabel="Resize inspector panel"
              draggingTitle={`Right panel width: ${rightPanelWidth}px`}
              onDrag={(event) => {
                const rect = layoutRef.current?.getBoundingClientRect();
                const right = rect?.right ?? window.innerWidth;
                setContextWidth(clampPanelWidth(right - event.clientX, minRightPanelWidth));
              }}
              edge="left"
            />
            <ContextPanel />
          </>
        )}
      </div>
      <StatusBar />
    </div>
  );
}

function DemoChrome({
  fullscreen,
  onFullscreenChange,
  screensPanelHidden,
  onScreensPanelHiddenChange,
}: {
  fullscreen: boolean;
  onFullscreenChange: (fullscreen: boolean) => void;
  screensPanelHidden: boolean;
  onScreensPanelHiddenChange: (hidden: boolean) => void;
}) {
  const [visible, setVisible] = useState(true);
  const hoveredRef = useRef(false);
  const pickerOpenRef = useRef(false);

  useEffect(() => {
    if (!fullscreen) {
      setVisible(true);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      if (!hoveredRef.current && !pickerOpenRef.current) setVisible(false);
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [fullscreen]);

  const show = () => {
    hoveredRef.current = true;
    setVisible(true);
  };

  const hide = () => {
    hoveredRef.current = false;
    if (fullscreen && !pickerOpenRef.current) setVisible(false);
  };

  const handlePickerOpenChange = (open: boolean) => {
    pickerOpenRef.current = open;
    if (open) setVisible(true);
    else if (fullscreen && !hoveredRef.current) setVisible(false);
  };

  const chrome = (
    <>
      <TopBar
        demoControls={{
          fullscreen,
          screensPanelHidden,
          screensPanelToggleDisabled: fullscreen,
          onFullscreenChange,
          onScreensPanelHiddenChange,
        }}
      />
      {screensPanelHidden && (
        <CanvasNavigationStrip
          resourceKind="screens"
          showResourcePanelDisabled={fullscreen}
          onPickerOpenChange={handlePickerOpenChange}
          onShowResourcePanel={() => {
            if (!fullscreen) onScreensPanelHiddenChange(false);
          }}
        />
      )}
    </>
  );

  if (!fullscreen) return <div className="shrink-0">{chrome}</div>;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[70]">
      <div
        className="pointer-events-auto absolute inset-x-0 top-0 h-3"
        onPointerEnter={show}
        onPointerMove={show}
        onMouseEnter={show}
        onMouseMove={show}
        aria-hidden="true"
      />
      <div
        className={cn(
          'pointer-events-auto absolute inset-x-0 top-0 shadow-lg transition-transform duration-300 ease-out',
          visible ? 'translate-y-0' : '-translate-y-full',
        )}
        onFocusCapture={show}
        onPointerEnter={show}
        onPointerLeave={hide}
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        {chrome}
      </div>
    </div>
  );
}

function PanelResizeHandle({
  ariaLabel,
  draggingTitle,
  onDrag,
  edge = 'right',
}: {
  ariaLabel: string;
  draggingTitle: string;
  onDrag: (event: PointerEvent) => void;
  edge?: 'left' | 'right';
}) {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: PointerEvent) => {
      onDrag(event);
    };
    const onUp = () => setDragging(false);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, onDrag]);

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={draggingTitle}
      onPointerDown={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      className={cn(
        'group relative cursor-col-resize bg-background/60 outline-none transition-colors hover:bg-primary/10 focus-visible:bg-primary/10',
        edge === 'left' ? 'border-l border-border' : 'border-r border-border',
        dragging && 'bg-primary/15',
      )}
    >
      <span className="absolute left-1/2 top-1/2 h-10 w-px -translate-x-1/2 -translate-y-1/2 rounded-full bg-border transition-colors group-hover:bg-primary" />
    </button>
  );
}

function readPanelWidth(key: string, fallback: number, clamp: (value: number) => number): number {
  const saved = Number(window.localStorage.getItem(key) ?? fallback);
  return clamp(Number.isFinite(saved) ? saved : fallback);
}

function readBoolean(key: string, fallback: boolean): boolean {
  const saved = window.localStorage.getItem(key);
  return saved === null ? fallback : saved === 'true';
}

function clampScreensWidth(value: number): number {
  return clampPanelWidth(value, 160);
}

function clampTransitionsWidth(value: number): number {
  return clampPanelWidth(value, 220);
}

function clampChatWidth(value: number): number {
  return clampPanelWidth(value, 280);
}

function clampContextWidth(value: number): number {
  return clampPanelWidth(value, 280);
}

function clampPanelWidth(value: number, min: number): number {
  const rounded = Math.round(value);
  return Math.max(min, rounded);
}
