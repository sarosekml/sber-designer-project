import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { Code2, MousePointerClick, Palette } from 'lucide-react';
import type { EditorMode } from '@sber-designer/shared-types';

import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDesignStore } from '@/stores/design-store';
import { useEditorStore } from '@/stores/editor-store';
import { useProjectStore } from '@/stores/project-store';

/**
 * Three modes per ADR-0004: Interact / Design / Code.
 * Hotkeys ⌘1 / ⌘2 / ⌘3.
 */
const MODES: {
  id: EditorMode;
  label: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { id: 'interact', label: 'Interact', title: 'Use the screen', icon: MousePointerClick },
  { id: 'design', label: 'Design', title: 'Edit visual source targets', icon: Palette },
  { id: 'code', label: 'Code', title: 'Edit source for the active screen', icon: Code2 },
];

export function ModeTabs() {
  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);
  const draftCount = useDesignStore((s) => s.draftChanges.length);
  const applyDraft = useDesignStore((s) => s.applyDraft);
  const applyStatus = useDesignStore((s) => s.applyStatus);
  const resetDraft = useDesignStore((s) => s.resetDraft);
  const project = useProjectStore((s) => s.project);
  const [pendingMode, setPendingMode] = useState<EditorMode | null>(null);

  const requestMode = useCallback(
    (next: EditorMode) => {
      if (next === mode) return;
      if (mode === 'design' && next !== 'design' && draftCount > 0) {
        setPendingMode(next);
        return;
      }
      setMode(next);
    },
    [draftCount, mode, setMode],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === '1') requestMode('interact');
      else if (e.key === '2') requestMode('design');
      else if (e.key === '3') requestMode('code');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestMode]);

  return (
    <Tabs
      value={mode}
      onValueChange={(value) => requestMode(value as EditorMode)}
      className="relative gap-0"
    >
      <TabsList
        aria-label="Editor mode"
        className="h-8 rounded-md border border-border bg-card p-0.5"
      >
        {MODES.map(({ id, label, title, icon: Icon }) => (
          <TabsTrigger
            key={id}
            value={id}
            title={title}
            className="h-7 flex-none rounded-[5px] px-3 py-1 text-xs"
          >
            <Icon />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      {pendingMode && (
        <div className="absolute left-0 top-9 z-30 w-72 rounded-md border border-border bg-card p-2 text-xs shadow-2xl">
          <div className="mb-2 font-medium text-foreground">Apply visual changes?</div>
          <div className="mb-2 text-muted-foreground">
            {draftCount} staged change{draftCount === 1 ? '' : 's'} will be lost if you leave
            Design.
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <Button
              type="button"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={applyStatus === 'applying'}
              onClick={async () => {
                await applyDraft(project?.workspacePath);
                if (useDesignStore.getState().applyStatus === 'success') {
                  setMode(pendingMode);
                  setPendingMode(null);
                }
              }}
            >
              Apply
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => {
                resetDraft();
                setMode(pendingMode);
                setPendingMode(null);
              }}
            >
              Discard
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => setPendingMode(null)}
            >
              Stay
            </Button>
          </div>
        </div>
      )}
    </Tabs>
  );
}
