// 0136 R14 — configure the Monaco loader to use the local bundle before any
// editor renders. This module is evaluated when the lazy Code chunk loads,
// which is strictly before React renders anything from it, so the loader is
// configured in time without the entry chunk carrying Monaco.
import '@/lib/monaco-setup';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Editor, { DiffEditor, type OnMount } from '@monaco-editor/react';
import { AlertCircle, FileCode2, GitCompareArrows, Loader2, Save, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ApiError, fetchFile, writeFile } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  findStoryImplementationReference,
  isStoryFile,
  resolveCodeModeFilePath,
  resolveScreenStoryFile,
  resolveWorkspaceSourceFilePath,
} from '@/lib/screen-source';
import { useCatalogStore } from '@/stores/catalog-store';
import { useEditorStore, type SelectedNode } from '@/stores/editor-store';
import { usePatchStore } from '@/stores/patch-store';
import { useProjectStore } from '@/stores/project-store';
import { useSandboxStore } from '@/stores/sandbox-store';
import { useThemeStore } from '@/stores/theme-store';

/**
 * Monaco-backed code view (Phase 2.6b → 3.1).
 *
 * - Loads the file referenced by the current Design selection
 *   (`selected.loc.file`) through `/api/files`.
 * - Editable. Dirty state on every change. Cmd/Ctrl-S or the Save
 *   button POSTs to `/api/files` and refreshes the baseline; HMR in
 *   the sandbox dev-server picks the change up and the iframe
 *   re-renders.
 * - Reveals the selected `(line, column)` on every selection change
 *   (and on first mount).
 *
 * Editing is intentionally direct (not through ast-bridge ops). The
 * agent route uses `apply_patch`; this is the manual-override path.
 */
export function CodeView() {
  const selected = useEditorStore((s) => s.selected);
  const activeScreenId = useEditorStore((s) => s.activeScreenId);
  const project = useProjectStore((s) => s.project);
  const catalog = useCatalogStore((s) => s.catalog);
  const session = useSandboxStore((s) => s.session);
  const appTheme = useThemeStore((s) => s.theme);
  const monacoTheme = appTheme === 'light' ? 'light' : 'vs-dark';
  const activeScreen = project?.screens.find((screen) => screen.id === activeScreenId) ?? null;
  const storySourceFilePath = resolveScreenStoryFile(activeScreen, catalog?.components);
  const selectedSourceLoc = selected?.loc?.startsWith('dom://')
    ? selected.componentLoc
    : selected?.loc;
  const selectedFilePath = resolveWorkspaceSourceFilePath(
    selectedSourceLoc,
    project?.workspacePath,
  );
  const [derivedImplementationFilePath, setDerivedImplementationFilePath] = useState<string | null>(
    null,
  );
  const [screenSourceTarget, setScreenSourceTarget] = useState<'implementation' | 'story'>(
    'implementation',
  );
  const implementationFilePath =
    activeScreen?.implementationFilePath ?? derivedImplementationFilePath ?? null;
  const filePath = resolveCodeModeFilePath({
    activeScreen,
    storySourceFilePath,
    selectedSourceLoc: selected?.loc,
    selectedComponentLoc: selected?.componentLoc,
    workspacePath: project?.workspacePath,
    derivedImplementationFilePath,
    screenSourceTarget,
  });
  const canSwitchStoryWrapper =
    Boolean(storySourceFilePath) &&
    Boolean(implementationFilePath) &&
    storySourceFilePath !== implementationFilePath;

  // Diff overlay (Phase 3.2). When an apply_patch result for this exact
  // file is in the patch-store and the user hasn't dismissed it, swap
  // Monaco for the DiffEditor.
  const patchDiff = usePatchStore((s) => (filePath ? s.diffs[filePath] : undefined));
  const dismissDiff = usePatchStore((s) => s.dismissDiff);
  const [showDiff, setShowDiff] = useState(true);
  // When a fresh diff lands, default-open it.
  useEffect(() => {
    setShowDiff(true);
  }, [patchDiff?.at]);

  useEffect(() => {
    setScreenSourceTarget('implementation');
  }, [activeScreen?.id]);

  useEffect(() => {
    setDerivedImplementationFilePath(null);
    if (!session || activeScreen?.implementationFilePath) return;
    const activeStoryId = activeScreen?.storyId;
    if (!storySourceFilePath || !isStoryFile(storySourceFilePath) || !activeStoryId) return;
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const file = await fetchFile(storySourceFilePath, ac.signal);
        if (cancelled) return;
        const reference = findStoryImplementationReference(
          storySourceFilePath,
          file.contents,
          activeStoryId,
        );
        if (reference?.filePath && reference.filePath !== storySourceFilePath) {
          setDerivedImplementationFilePath(reference.filePath);
        }
      } catch {
        // Keep the current story file open; CodeView can still show it.
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [activeScreen?.storyId, activeScreen?.implementationFilePath, session, storySourceFilePath]);

  const [original, setOriginal] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const directTargetLoc = selectedFilePath ? selectedSourceLoc : undefined;
  const directTargetLine = parseLine(directTargetLoc);
  const directTargetColumn = parseColumn(directTargetLoc);
  const fallbackTarget = useMemo(
    () => inferSelectionTarget(draft, selected, directTargetLine),
    [draft, selected, directTargetLine],
  );
  const targetLine = directTargetLine ?? fallbackTarget?.line ?? null;
  const targetColumn = directTargetColumn ?? fallbackTarget?.column ?? null;

  // Hold the Monaco editor instance so we can revealLine on selection change.
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const selectionDecorationIdsRef = useRef<string[]>([]);

  // Load the file when the path changes.
  useEffect(() => {
    if (!filePath || !session) {
      setOriginal(null);
      setDraft('');
      setError(null);
      return;
    }
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const file = await fetchFile(filePath, ac.signal);
        if (cancelled) return;
        setOriginal(file.contents);
        setDraft(file.contents);
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
        setError(formatError(err));
        setOriginal(null);
        setDraft('');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [filePath, session]);

  // Reveal selected line/column whenever it (or the file) changes.
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    selectionDecorationIdsRef.current = applySelectionDecoration(
      editor,
      monaco,
      selectionDecorationIdsRef.current,
      targetLine,
      targetColumn,
    );
  }, [filePath, targetLine, targetColumn]);

  const dirty = original !== null && draft !== original;

  const handleSave = useCallback(async () => {
    if (!filePath || !dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      await writeFile(filePath, draft);
      setOriginal(draft);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setSaving(false);
    }
  }, [filePath, draft, dirty, saving]);

  // Cmd/Ctrl-S shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        // Trigger only when this view is mounted; if the user is in another
        // mode the editor isn't visible so this hook won't run.
        e.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSave]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    selectionDecorationIdsRef.current = applySelectionDecoration(
      editor,
      monaco,
      selectionDecorationIdsRef.current,
      targetLine,
      targetColumn,
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-4 text-xs">
        <div className="flex items-center gap-2 font-medium">
          <FileCode2 className="size-3.5 text-primary" />
          <span>Code</span>
          {dirty && (
            <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-warning">
              modified
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="truncate text-muted-foreground" title={selected?.loc}>
            {filePath ?? 'no file'}
            {loading && ' · loading'}
          </span>
          {canSwitchStoryWrapper && (
            <div className="inline-flex rounded-md border border-border p-0.5">
              {[
                { id: 'implementation' as const, label: 'Implementation' },
                { id: 'story' as const, label: 'Story wrapper' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setScreenSourceTarget(item.id)}
                  className={cn(
                    'rounded px-2 py-0.5 text-[10px] transition-colors',
                    screenSourceTarget === item.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
          {patchDiff && (
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-primary">
              {patchDiff.source === 'visual' ? 'Changed by visual edit' : 'Changed by agent'}
            </span>
          )}
          {patchDiff && (
            <Button
              size="sm"
              variant={showDiff ? 'default' : 'outline'}
              onClick={() => setShowDiff((v) => !v)}
              className="h-7 px-2 text-[11px]"
              title={showDiff ? 'Hide diff overlay' : 'Show diff overlay'}
            >
              <GitCompareArrows className="size-3" />
              Diff
            </Button>
          )}
          {patchDiff && showDiff && (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => filePath && dismissDiff(filePath)}
              title="Dismiss diff"
              className="h-7 w-7"
            >
              <X className="size-3" />
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleSave()}
            disabled={!dirty || saving}
            className="h-7 px-2 text-[11px]"
            title={dirty ? 'Save (⌘S)' : 'No changes'}
          >
            {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
            Save
          </Button>
        </div>
      </div>

      {!session && (
        <div className="px-4 py-3 text-xs text-muted-foreground">
          Connect a project to read source.
        </div>
      )}

      {session && !filePath && (
        <div className="px-4 py-3 text-xs text-muted-foreground">
          Select a canvas element or choose a catalog-backed screen to open source.
        </div>
      )}

      {error && (
        <div className="m-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
          <AlertCircle className="size-3.5 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {filePath && original !== null && !error && patchDiff && showDiff && (
        <div className="min-h-0 flex-1">
          <DiffEditor
            height="100%"
            original={patchDiff.before}
            modified={patchDiff.after}
            theme={monacoTheme}
            language={detectLanguage(filePath)}
            options={{
              readOnly: true,
              renderSideBySide: false,
              minimap: { enabled: false },
              fontSize: 12,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
            }}
          />
        </div>
      )}

      {filePath && original !== null && !error && !(patchDiff && showDiff) && (
        <div className={cn('min-h-0 flex-1', saving && 'opacity-70 pointer-events-none')}>
          <Editor
            height="100%"
            path={filePath}
            value={draft}
            onChange={(v) => setDraft(v ?? '')}
            onMount={handleMount}
            theme={monacoTheme}
            language={detectLanguage(filePath)}
            options={{
              readOnly: false,
              minimap: { enabled: false },
              fontSize: 12,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
              tabSize: 2,
            }}
          />
        </div>
      )}
    </div>
  );
}

function applySelectionDecoration(
  editor: Parameters<OnMount>[0],
  monaco: Parameters<OnMount>[1],
  currentIds: string[],
  targetLine: number | null,
  targetColumn: number | null,
): string[] {
  if (!targetLine) {
    return editor.deltaDecorations(currentIds, []);
  }
  const column = targetColumn ?? 1;
  editor.revealLineInCenter(targetLine);
  editor.setPosition({ lineNumber: targetLine, column });
  return editor.deltaDecorations(currentIds, [
    {
      range: new monaco.Range(targetLine, column, targetLine, Math.max(column + 1, 2)),
      options: {
        isWholeLine: true,
        className: 'sd-code-selection-line',
        linesDecorationsClassName: 'sd-code-selection-gutter',
        overviewRuler: {
          color: 'oklch(0.72 0.2 315 / 0.8)',
          position: monaco.editor.OverviewRulerLane.Center,
        },
      },
    },
  ]);
}

function parseLine(loc: string | undefined): number | null {
  if (!loc) return null;
  const m = /^(.+):(\d+):(\d+)$/.exec(loc);
  return m ? Number(m[2]) : null;
}

function parseColumn(loc: string | undefined): number | null {
  if (!loc) return null;
  const m = /^(.+):(\d+):(\d+)$/.exec(loc);
  return m ? Number(m[3]) : null;
}

interface SelectionTarget {
  line: number;
  column: number;
}

function inferSelectionTarget(
  source: string,
  selected: SelectedNode | null,
  directLine: number | null,
): SelectionTarget | null {
  if (!source || !selected || directLine) return null;
  const candidates: Array<RegExp | string> = [];
  if (selected.componentName && /^[A-Za-z_$][\w$]*$/.test(selected.componentName)) {
    const name = escapeRegExp(selected.componentName);
    candidates.push(
      new RegExp(`<(?:${name})\\b`),
      new RegExp(`(?:function|const|class)\\s+${name}\\b`),
      new RegExp(`export\\s+(?:function|const|class)\\s+${name}\\b`),
    );
  }
  const flowId = selected.attributes?.['data-sd-flow-id'];
  if (flowId) candidates.push(`data-sd-flow-id="${flowId}"`, `data-sd-flow-id='${flowId}'`);
  const testId = selected.attributes?.['data-testid'];
  if (testId) candidates.push(`data-testid="${testId}"`, `data-testid='${testId}'`);
  const ariaLabel = selected.attributes?.['aria-label'];
  if (ariaLabel) candidates.push(`aria-label="${ariaLabel}"`, `aria-label='${ariaLabel}'`);
  const textCandidate = firstSearchableText(selected.text);
  if (textCandidate) candidates.push(textCandidate);

  for (const candidate of candidates) {
    const index =
      typeof candidate === 'string' ? source.indexOf(candidate) : source.search(candidate);
    if (index >= 0) return positionFromIndex(source, index);
  }
  return null;
}

function firstSearchableText(text: string | undefined): string | null {
  if (!text) return null;
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length < 3 || compact.length > 160) return null;
  return compact;
}

function positionFromIndex(source: string, index: number): SelectionTarget {
  const before = source.slice(0, index);
  const lines = before.split('\n');
  return {
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function detectLanguage(path: string): string {
  if (path.endsWith('.tsx') || path.endsWith('.ts')) return 'typescript';
  if (path.endsWith('.jsx') || path.endsWith('.js')) return 'javascript';
  if (path.endsWith('.css')) return 'css';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.html')) return 'html';
  if (path.endsWith('.md')) return 'markdown';
  return 'plaintext';
}

function formatError(err: unknown): string {
  if (err instanceof ApiError) return `${err.code ?? 'error'}: ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}
