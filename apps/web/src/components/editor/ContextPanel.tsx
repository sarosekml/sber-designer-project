import { lazy, Suspense, useEffect, useMemo, useState, type ComponentType } from 'react';
import type { ComponentCatalog } from '@sber-designer/shared-types';
import { BookOpen, Boxes, RefreshCw } from 'lucide-react';

import { fetchFile } from '@/lib/api-client';
import {
  collectScreenComponentUsage,
  findStoryImplementationReference,
  isStoryFile,
  resolveScreenStoryFile,
  type ScreenComponentUsage,
} from '@/lib/screen-source';
import { cn } from '@/lib/utils';
import { useCatalogStore } from '@/stores/catalog-store';
import { useEditorStore } from '@/stores/editor-store';
import { useProjectStore } from '@/stores/project-store';
import { useSandboxStore } from '@/stores/sandbox-store';
import { VisualDesignPanel } from './VisualDesignPanel';

/**
 * 0136 R14 — Monaco and the Code view load on the first switch to Code mode,
 * not with the editor shell. Switching modes must not recreate the sandbox
 * iframe (ADR-0004), and it does not: the iframe lives in the canvas, which
 * this panel never unmounts.
 */
const CodeView = lazy(() => import('./CodeView').then((module) => ({ default: module.CodeView })));

/**
 * Right-hand panel. Its content depends on the current mode:
 *  - Interact → components actually used by the active screen.
 *  - Design   → selected-node inspector (props editing — Phase 2).
 *  - Code     → source view of the file containing the selected node
 *               (Monaco IDE swaps in here in a later iteration).
 */
export function ContextPanel() {
  const mode = useEditorStore((s) => s.mode);
  const canvasView = useEditorStore((s) => s.canvasView);

  if (canvasView !== 'screen') {
    return (
      <aside className="flex min-h-0 min-w-0 flex-col border-l border-border bg-sidebar">
        <ActiveComponentView />
      </aside>
    );
  }

  return (
    <aside className="flex min-h-0 min-w-0 flex-col border-l border-border bg-sidebar">
      {mode === 'interact' && <ScreenComponentsView />}
      {mode === 'design' && <VisualDesignPanel />}
      {mode === 'code' && (
        <Suspense fallback={<CodeViewLoading />}>
          <CodeView />
        </Suspense>
      )}
    </aside>
  );
}

function CodeViewLoading() {
  return (
    <div className="grid min-h-0 flex-1 place-items-center text-sm text-muted-foreground">
      Loading code editor…
    </div>
  );
}

function PanelHeader({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex h-9 min-w-0 shrink-0 items-center justify-between gap-2 border-b border-border px-4 text-xs">
      <div className="flex min-w-0 items-center gap-2 font-medium">
        <Icon className="size-3.5 shrink-0 text-primary" />
        <span className="truncate">{title}</span>
      </div>
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        {hint && <span className="truncate text-muted-foreground">{hint}</span>}
        {action}
      </div>
    </div>
  );
}

function ActiveComponentView() {
  const catalog = useCatalogStore((s) => s.catalog);
  const activeComponentId = useEditorStore((s) => s.activeComponentId);
  const component = activeComponentId
    ? (catalog?.components.find((entry) => entry.id === activeComponentId) ?? null)
    : null;

  return (
    <>
      <PanelHeader icon={BookOpen} title="Component" hint={component?.shortName ?? 'none'} />
      <div className="min-w-0 flex-1 overflow-y-auto px-4 py-4 text-sm">
        {component ? (
          <div className="space-y-3">
            <Field label="Title" value={component.title} wrap />
            <Field label="Source" value={component.filePath} mono wrap />
            <Field
              label="Stories"
              value={component.stories.map((story) => story.name).join(', ') || 'No stories'}
              wrap
            />
            {component.description && (
              <Field label="Description" value={component.description} wrap />
            )}
            {component.descriptionLayer?.purpose && (
              <Field label="Purpose" value={component.descriptionLayer.purpose} wrap />
            )}
            <p className="text-xs text-muted-foreground">
              Storybook mode sends this component, its stories, and the component catalog to the
              assistant. Screen selection, comments, and flow context are not attached.
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground">Choose a component from the left panel.</p>
        )}
      </div>
    </>
  );
}

interface ScreenUsageState {
  loading: boolean;
  used: ScreenComponentUsage[];
  sourceFilePath: string | null;
  error: string | null;
}

const componentSourceCache = new Map<string, Promise<string | null>>();

function ScreenComponentsView() {
  const catalog = useCatalogStore((s) => s.catalog);
  const loading = useCatalogStore((s) => s.loading);
  const error = useCatalogStore((s) => s.error);
  const refresh = useCatalogStore((s) => s.refresh);
  const session = useSandboxStore((s) => s.session);
  const project = useProjectStore((s) => s.project);
  const activeScreenId = useEditorStore((s) => s.activeScreenId);
  const activeScreen = useMemo(
    () => project?.screens.find((screen) => screen.id === activeScreenId) ?? null,
    [project?.screens, activeScreenId],
  );
  const [usageState, setUsageState] = useState<ScreenUsageState>({
    loading: false,
    used: [],
    sourceFilePath: null,
    error: null,
  });

  useEffect(() => {
    if (!session || session.status !== 'ready' || !catalog || !activeScreen) {
      setUsageState({ loading: false, used: [], sourceFilePath: null, error: null });
      return;
    }
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      setUsageState((current) => ({
        loading: true,
        used: current.used,
        sourceFilePath: current.sourceFilePath,
        error: null,
      }));

      const storyFilePath = resolveScreenStoryFile(activeScreen, catalog.components);
      let sourceFilePath = activeScreen.implementationFilePath ?? null;
      if (!sourceFilePath && storyFilePath && isStoryFile(storyFilePath)) {
        try {
          const storyFile = await fetchFile(storyFilePath, ac.signal);
          const reference = findStoryImplementationReference(
            storyFilePath,
            storyFile.contents,
            activeScreen.storyId,
          );
          sourceFilePath = reference?.filePath ?? null;
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') throw err;
        }
      }

      sourceFilePath = sourceFilePath ?? activeScreen.filePath ?? storyFilePath;
      if (!sourceFilePath) {
        if (!cancelled) {
          setUsageState({
            loading: false,
            used: [],
            sourceFilePath: null,
            error: 'No source file is attached to this screen yet.',
          });
        }
        return;
      }

      const sourceFile = await fetchFile(sourceFilePath, ac.signal);
      const catalogSources = await loadCatalogSources(
        catalog,
        project?.workspacePath ?? 'workspace',
      );
      const used = collectScreenComponentUsage({
        source: sourceFile.contents,
        sourceFilePath,
        catalog,
        catalogSources,
      });
      if (!cancelled) {
        setUsageState({
          loading: false,
          used,
          sourceFilePath,
          error: null,
        });
      }
    })().catch((err) => {
      if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
      setUsageState({
        loading: false,
        used: [],
        sourceFilePath: null,
        error: formatSourceError(err),
      });
    });

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [activeScreen, catalog, project?.workspacePath, session]);

  const components = usageState.used;
  const hint = loading
    ? 'indexing…'
    : usageState.loading
      ? 'checking…'
      : activeScreen
        ? `${components.length} used`
        : catalog
          ? 'select screen'
          : 'not connected';

  const refreshButton = refresh ? (
    <button
      type="button"
      onClick={() => void refresh()}
      disabled={loading}
      title="Re-fetch /index.json bypassing the api cache"
      className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
    >
      <RefreshCw className={cn('size-3', loading && 'animate-spin')} />
    </button>
  ) : null;

  return (
    <>
      <PanelHeader icon={Boxes} title="Screen components" hint={hint} action={refreshButton} />
      <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-3">
        {!session && <ConnectHint />}
        {session && session.status !== 'ready' && <BootingHint status={session.status} />}
        {error && (
          <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
            <div className="font-medium">Failed to load catalog</div>
            <div className="opacity-80">{error}</div>
          </div>
        )}
        {usageState.error && (
          <div className="mb-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
            <div className="font-medium">Could not inspect this screen</div>
            <div className="opacity-80">{usageState.error}</div>
          </div>
        )}
        {catalog && !activeScreen && !error && (
          <p className="text-xs text-muted-foreground">
            Select a screen to see which catalog components its implementation imports.
          </p>
        )}
        {catalog && activeScreen && usageState.loading && (
          <p className="text-xs text-muted-foreground">Inspecting active screen imports…</p>
        )}
        {catalog &&
          activeScreen &&
          !usageState.loading &&
          components.length === 0 &&
          !usageState.error && (
            <div className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
              <div className="font-medium text-foreground">No catalog components detected</div>
              <p className="mt-1 leading-relaxed">
                This screen may use local wrappers, raw markup, or a source file outside the indexed
                catalog. Re-index the project after adding component descriptions.
              </p>
              {usageState.sourceFilePath && (
                <div
                  className="mt-2 truncate font-mono text-[10px]"
                  title={usageState.sourceFilePath}
                >
                  {usageState.sourceFilePath}
                </div>
              )}
            </div>
          )}
        {components.length > 0 && !usageState.loading && (
          <ul className="grid min-w-0 gap-1.5">
            {components.map((usage) => (
              <ScreenComponentCard key={usage.component.id} usage={usage} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

async function loadCatalogSources(
  catalog: ComponentCatalog,
  workspaceKey: string,
): Promise<Map<string, string>> {
  const entries = await Promise.all(
    catalog.components.map(async (component) => {
      const source = await loadCatalogComponentSource(
        workspaceKey,
        catalog.generatedAt,
        component.filePath,
      );
      return source ? ([component.filePath, source] as const) : null;
    }),
  );
  return new Map(entries.filter((entry): entry is readonly [string, string] => Boolean(entry)));
}

function loadCatalogComponentSource(
  workspaceKey: string,
  generatedAt: number,
  filePath: string,
): Promise<string | null> {
  const cacheKey = `${workspaceKey}:${generatedAt}:${filePath}`;
  const cached = componentSourceCache.get(cacheKey);
  if (cached) return cached;
  const next = fetchFile(filePath)
    .then((file) => file.contents)
    .catch(() => null);
  componentSourceCache.set(cacheKey, next);
  return next;
}

function ScreenComponentCard({ usage }: { usage: ScreenComponentUsage }) {
  const { component } = usage;
  const purpose = component.descriptionLayer?.purpose ?? firstParagraph(component.description);
  return (
    <li className="min-w-0 overflow-hidden rounded-md border border-border bg-card px-3 py-2 text-xs">
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <span className="min-w-0 truncate font-medium">{component.shortName}</span>
        <span className="min-w-0 truncate text-right text-[10px] text-muted-foreground">
          {usage.imports.join(', ')}
        </span>
      </div>
      <div className="mt-0.5 truncate text-[10px] text-muted-foreground" title={component.title}>
        {component.title}
      </div>
      {purpose && (
        <div className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">
          {purpose}
        </div>
      )}
      <div
        className="mt-1 truncate font-mono text-[10px] text-muted-foreground"
        title={component.filePath}
      >
        {component.filePath}
      </div>
    </li>
  );
}

function firstParagraph(value: string | undefined): string | null {
  const paragraph = value?.split(/\n\s*\n/)[0]?.trim();
  return paragraph || null;
}

function formatSourceError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function ConnectHint() {
  return (
    <p className="text-xs text-muted-foreground">
      Connect a project (Top bar → <span className="font-medium text-foreground">Connect</span>) to
      populate this catalog from its Storybook.
    </p>
  );
}

function BootingHint({ status }: { status: string }) {
  return (
    <p className="text-xs text-muted-foreground">
      Sandbox is <span className="font-medium text-foreground">{status}</span>… components will
      appear here as soon as Storybook is ready.
    </p>
  );
}

// CodeView is implemented in ./CodeView.tsx (Monaco editor, Phase 2.6b).

function Field({
  label,
  value,
  mono,
  wrap,
}: {
  label: string;
  value: string;
  mono?: boolean;
  wrap?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={(mono ? 'font-mono ' : '') + (wrap ? 'break-all ' : '') + 'mt-0.5 text-sm'}>
        {value}
      </div>
    </div>
  );
}
