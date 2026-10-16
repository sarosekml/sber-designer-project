import { useEffect, useState } from 'react';
import { SquareStack } from 'lucide-react';
import { Handle, type Node, type NodeProps, Position } from '@xyflow/react';
import { screenSurface, type ProjectScreen } from '@sber-designer/shared-types';

import { FLOW_HANDLES } from '@/lib/flow-graph';
import { currentFlowPreviewCapture, flowPreviewImageSrc } from '@/lib/flow-preview';
import type { NormalizedFlowViewSettings } from '@/lib/flow-view';
import { screenPreviewUrl } from '@/lib/screen-url';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/stores/editor-store';
import { useSandboxStore } from '@/stores/sandbox-store';

export interface ScreenFlowNodeData {
  [key: string]: unknown;
  screen: ProjectScreen;
  flowView: NormalizedFlowViewSettings;
  livePreviewAllowed: boolean;
  previewFrameWidth: number;
  previewRefreshKey: number;
}

export type ScreenFlowNode = Node<ScreenFlowNodeData, 'screen'>;

export function FlowScreenNode({ data, selected }: NodeProps<ScreenFlowNode>) {
  const screen = data.screen;
  const flowView = data.flowView;
  const subtitle =
    screen.kind === 'story' ? (screen.storyId ?? 'storybook') : (screen.filePath ?? 'page');
  return (
    <div
      data-active-screen={selected || undefined}
      aria-current={selected ? 'true' : undefined}
      aria-label={screen.name}
      className={cn(
        'relative flex h-full w-full flex-col rounded-md border bg-card p-3 text-left text-card-foreground',
        // Ring/outline instead of a background tint: most of the card is the
        // white preview, and a box-shadow ring never changes node geometry
        // (0138 C2).
        selected
          ? 'border-primary shadow-md ring-2 ring-primary ring-offset-2 ring-offset-background'
          : 'border-border shadow-sm',
      )}
    >
      <FlowHandles />
      <ScreenPreviewFrame
        screen={screen}
        flowView={flowView}
        livePreviewAllowed={data.livePreviewAllowed}
        previewFrameWidth={data.previewFrameWidth}
        previewRefreshKey={data.previewRefreshKey}
      />
      <div className="mt-2 min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs font-medium">{screen.name}</span>
          {screenSurface(screen) === 'modal' && (
            <span
              className="inline-flex shrink-0 items-center gap-0.5 rounded border border-border bg-muted px-1 py-0.5 text-[9px] font-medium text-muted-foreground"
              title="Modal — overlay dialog"
            >
              <SquareStack className="size-2.5" />
              Modal
            </span>
          )}
        </div>
        <div className="truncate text-[10px] opacity-60">{subtitle}</div>
        <FlowScreenNote screen={screen} visible={flowView.showDescriptions} />
      </div>
    </div>
  );
}

function FlowHandles() {
  return (
    <>
      <Handle
        id={FLOW_HANDLES.targetLeft}
        type="target"
        position={Position.Left}
        style={{ top: '34%' }}
        className="!size-2 !border-background !bg-muted-foreground"
      />
      <Handle
        id={FLOW_HANDLES.sourceLeft}
        type="source"
        position={Position.Left}
        style={{ top: '66%' }}
        className="!size-2 !border-background !bg-primary"
      />
      <Handle
        id={FLOW_HANDLES.sourceRight}
        type="source"
        position={Position.Right}
        style={{ top: '34%' }}
        className="!size-2 !border-background !bg-primary"
      />
      <Handle
        id={FLOW_HANDLES.targetRight}
        type="target"
        position={Position.Right}
        style={{ top: '66%' }}
        className="!size-2 !border-background !bg-muted-foreground"
      />
    </>
  );
}

function ScreenPreviewFrame({
  screen,
  flowView,
  livePreviewAllowed,
  previewFrameWidth,
  previewRefreshKey,
}: {
  screen: ProjectScreen;
  flowView: NormalizedFlowViewSettings;
  livePreviewAllowed: boolean;
  previewFrameWidth: number;
  previewRefreshKey: number;
}) {
  const fallbackCanvasUrl = useEditorStore((s) => s.canvasUrl);
  const session = useSandboxStore((s) => s.session);
  const url = screenPreviewUrl(screen, session?.previewUrl, fallbackCanvasUrl);
  const cached = currentFlowPreviewCapture(flowView, screen);
  const cachedSrc = cached.capture
    ? flowPreviewImageSrc(cached.capture.imagePath, cached.capture.capturedAt)
    : null;
  const thumbnailSrc = screen.thumbnail ? flowPreviewImageSrc(screen.thumbnail) : null;

  if (flowView.previewSize === 'frames') {
    return (
      <PreviewShell>
        {url && livePreviewAllowed ? (
          <LivePreviewIframe
            title={`${screen.name} preview`}
            url={url}
            frameWidth={previewFrameWidth}
            viewport={flowView.previewViewport}
            refreshKey={previewRefreshKey}
          />
        ) : cachedSrc ? (
          <CachedPreviewImage src={cachedSrc} stale={cached.stale} />
        ) : (
          <PreviewPlaceholder
            label={url ? 'Scroll into view for live preview' : 'Preview unavailable'}
          />
        )}
      </PreviewShell>
    );
  }

  return (
    <PreviewShell>
      {cachedSrc ? (
        <CachedPreviewImage src={cachedSrc} stale={cached.stale} />
      ) : thumbnailSrc ? (
        <CachedPreviewImage src={thumbnailSrc} stale={false} badge="Thumbnail" />
      ) : (
        <PreviewPlaceholder label="Preview missing" />
      )}
    </PreviewShell>
  );
}

function PreviewShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded border border-border bg-white">
      {children}
    </div>
  );
}

function CachedPreviewImage({
  src,
  stale,
  badge = 'Cached preview',
}: {
  src: string;
  stale: boolean;
  badge?: string;
}) {
  return (
    <>
      <img src={src} alt="" className="h-full w-full object-contain" />
      <PreviewBadge tone={stale ? 'warning' : 'muted'}>
        {stale ? 'Stale preview' : badge}
      </PreviewBadge>
    </>
  );
}

function LivePreviewIframe({
  title,
  url,
  frameWidth,
  viewport,
  refreshKey,
}: {
  title: string;
  url: string;
  frameWidth: number;
  viewport: { width: number; height: number };
  refreshKey: number;
}) {
  const [loaded, setLoaded] = useState(false);
  const scale = frameWidth / viewport.width;

  useEffect(() => {
    setLoaded(false);
  }, [refreshKey, url]);

  return (
    <>
      {!loaded && <PreviewPlaceholder label="Loading preview..." />}
      <iframe
        key={`${url}:${refreshKey}`}
        title={title}
        src={url}
        sandbox="allow-scripts allow-same-origin allow-forms"
        onLoad={() => setLoaded(true)}
        className={cn(
          'pointer-events-none origin-top-left border-0 bg-white transition-opacity',
          loaded ? 'opacity-100' : 'opacity-0',
        )}
        style={{
          width: viewport.width,
          height: viewport.height,
          transform: `scale(${scale})`,
        }}
      />
      {loaded && <PreviewBadge tone="live">Live preview</PreviewBadge>}
    </>
  );
}

function PreviewPlaceholder({ label }: { label: string }) {
  return (
    <div className="grid h-full w-full place-items-center bg-muted/40 px-3 text-center text-[10px] text-muted-foreground">
      {label}
    </div>
  );
}

function PreviewBadge({
  tone,
  children,
}: {
  tone: 'live' | 'muted' | 'warning';
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[9px] font-medium shadow-sm',
        tone === 'live' && 'bg-success/90 text-success-foreground',
        tone === 'muted' && 'bg-background/70 text-foreground',
        tone === 'warning' && 'bg-warning/90 text-warning-foreground',
      )}
    >
      {children}
    </span>
  );
}

function FlowScreenNote({ screen, visible }: { screen: ProjectScreen; visible: boolean }) {
  if (!visible || !screen.description) return null;
  return (
    <div className="mt-1 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
      {screen.description}
    </div>
  );
}
