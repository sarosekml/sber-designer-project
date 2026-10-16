import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentEntry } from '@sber-designer/shared-types';
import {
  BookOpen,
  Component,
  CopyPlus,
  FilePlus2,
  Loader2,
  MessageSquareText,
  MoreHorizontal,
  PanelLeftClose,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useChat } from '@/hooks/useChat';
import { componentDisplayPath } from '@/lib/editor-location';
import { groupCatalogComponents } from '@/lib/component-groups';
import { useStartDescriptionInterview } from '@/lib/use-start-description-interview';
import { cn } from '@/lib/utils';
import { useCatalogStore } from '@/stores/catalog-store';
import { useChatStore } from '@/stores/chat-store';
import { useEditorStore } from '@/stores/editor-store';
import { useSandboxStore } from '@/stores/sandbox-store';

export function ComponentsPanel({ onRequestClose }: { onRequestClose?: () => void } = {}) {
  const catalog = useCatalogStore((s) => s.catalog);
  const loading = useCatalogStore((s) => s.loading);
  const error = useCatalogStore((s) => s.error);
  const refresh = useCatalogStore((s) => s.refresh);
  const session = useSandboxStore((s) => s.session);
  const activeComponentId = useEditorStore((s) => s.activeComponentId);
  const setActiveComponentId = useEditorStore((s) => s.setActiveComponentId);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSeed, setCreateSeed] = useState<ComponentEntry | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const startInterview = useStartDescriptionInterview();

  const components = catalog?.components ?? [];
  const grouped = useMemo(() => groupCatalogComponents(components), [components]);
  const hint = loading ? 'indexing...' : catalog ? `${components.length}` : 'not connected';

  useEffect(() => {
    if (components.length === 0) {
      setActiveComponentId(null);
      return;
    }
    if (activeComponentId && !components.some((component) => component.id === activeComponentId)) {
      setActiveComponentId(null);
    }
  }, [activeComponentId, components, setActiveComponentId]);

  const openCreateDialog = (seed: ComponentEntry | null = null) => {
    setCreateSeed(seed);
    setCreateOpen(true);
  };

  return (
    <aside className="flex min-h-0 min-w-0 flex-col border-r border-border bg-sidebar">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3 text-xs">
        <div className="flex min-w-0 items-center gap-2 font-medium">
          <BookOpen className="size-3.5 shrink-0 text-primary" />
          <span className="truncate">Components</span>
          <span className="text-muted-foreground">({hint})</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => void refresh?.()}
            disabled={!refresh || loading}
            title="Refresh component catalog"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
          </button>
          <button
            type="button"
            onClick={() => openCreateDialog()}
            title="Create component"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <FilePlus2 className="size-3.5" />
          </button>
          {onRequestClose && (
            <button
              type="button"
              onClick={onRequestClose}
              title="Hide components panel"
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <PanelLeftClose className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto px-2 py-3">
        {!session && <PanelHint>Connect a project to inspect Storybook components.</PanelHint>}
        {session && session.status !== 'ready' && (
          <PanelHint>
            Storybook is {session.status}; components will appear when it is ready.
          </PanelHint>
        )}
        {error && (
          <div className="mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
            <div className="font-medium">Failed to load catalog</div>
            <div className="break-words opacity-80">{error}</div>
          </div>
        )}
        {components.length === 0 && !error && session?.status === 'ready' && (
          <PanelHint>Storybook is ready but has no indexed components yet.</PanelHint>
        )}
        <div className="grid gap-3">
          {grouped.map((group) => (
            <section key={group.name} className="min-w-0">
              <div className="mb-1.5 flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <span className="truncate">{group.name}</span>
                <span>{group.components.length}</span>
              </div>
              <ul className="grid gap-1">
                {group.components.map((component) => (
                  <ComponentRow
                    key={component.id}
                    component={component}
                    active={activeComponentId === component.id}
                    menuOpen={openMenuId === component.id}
                    onSelect={() =>
                      setActiveComponentId(component.id === activeComponentId ? null : component.id)
                    }
                    onMenuOpenChange={(open) => setOpenMenuId(open ? component.id : null)}
                    onDuplicate={() => openCreateDialog(component)}
                    onDescribe={() =>
                      void startInterview({
                        componentId: component.id,
                        componentName: component.shortName,
                      })
                    }
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
      <NewComponentDialog
        open={createOpen}
        basedOn={createSeed}
        components={components}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCreateSeed(null);
        }}
      />
    </aside>
  );
}

function PanelHint({ children }: { children: React.ReactNode }) {
  return <p className="px-1 py-2 text-xs text-muted-foreground">{children}</p>;
}

function ComponentRow({
  component,
  active,
  menuOpen,
  onSelect,
  onMenuOpenChange,
  onDuplicate,
  onDescribe,
}: {
  component: ComponentEntry;
  active: boolean;
  menuOpen: boolean;
  onSelect: () => void;
  onMenuOpenChange: (open: boolean) => void;
  onDuplicate: () => void;
  onDescribe: () => void;
}) {
  const rowRef = useRef<HTMLLIElement | null>(null);
  const componentPath = componentDisplayPath(component);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && rowRef.current?.contains(target)) return;
      onMenuOpenChange(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onMenuOpenChange(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen, onMenuOpenChange]);

  return (
    <li
      ref={rowRef}
      className={cn(
        'group relative grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 overflow-visible rounded-md px-2.5 py-2 text-xs transition-colors',
        active
          ? 'bg-secondary text-secondary-foreground'
          : 'hover:bg-accent hover:text-accent-foreground',
        menuOpen && 'z-50',
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <Component className="size-3.5 shrink-0 text-muted-foreground" />
        <button
          type="button"
          onClick={onSelect}
          title={componentPath}
          className="min-w-0 flex-1 overflow-hidden text-left"
        >
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="truncate font-medium">{component.shortName}</span>
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {component.stories.length}
            </span>
          </div>
        </button>
      </div>
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onMenuOpenChange(!menuOpen);
          }}
          title="Component actions"
          className="grid size-6 place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 data-[open=true]:opacity-100"
          data-open={menuOpen}
        >
          <MoreHorizontal className="size-3.5" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-7 z-50 min-w-40 rounded-md border border-border bg-popover p-1 text-xs text-popover-foreground shadow-lg">
            <button
              type="button"
              onClick={() => {
                onMenuOpenChange(false);
                onDuplicate();
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <CopyPlus className="size-3.5" />
              Duplicate as new
            </button>
            <button
              type="button"
              onClick={() => {
                onMenuOpenChange(false);
                onDescribe();
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <MessageSquareText className="size-3.5" />
              Describe component
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

export function NewComponentDialog({
  open,
  basedOn,
  components,
  onOpenChange,
}: {
  open: boolean;
  basedOn: ComponentEntry | null;
  components: readonly ComponentEntry[];
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState('New component');
  const [purpose, setPurpose] = useState('');
  const [family, setFamily] = useState('Components');
  const [busy, setBusy] = useState(false);
  const setSessionMode = useChatStore((s) => s.setSessionMode);
  const { send } = useChat();
  const duplicate = components.some(
    (component) => component.shortName.toLowerCase() === name.trim().toLowerCase(),
  );
  const validName = /^[A-Z][A-Za-z0-9]*$/.test(name.trim());

  useEffect(() => {
    if (!open) return;
    setName(basedOn ? `${basedOn.shortName}Copy` : 'NewComponent');
    setFamily(basedOn ? storybookFamily(basedOn.title) : 'Components');
    setPurpose('');
  }, [basedOn, open]);

  const handleSubmit = async () => {
    if (!name.trim() || busy || duplicate || !validName) return;
    setBusy(true);
    try {
      setSessionMode('design');
      onOpenChange(false);
      await send(buildNewComponentPrompt({ name, purpose, family, basedOn }));
      setName('NewComponent');
      setPurpose('');
      setFamily('Components');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{basedOn ? 'Duplicate component' : 'Create component'}</DialogTitle>
          <DialogDescription>
            Ask Assistant to add a reusable component and Storybook story to this project.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {basedOn && (
            <div className="rounded-md border border-border bg-card px-3 py-2 text-xs">
              <div className="text-muted-foreground">Based on</div>
              <div className="mt-0.5 truncate font-medium">{basedOn.shortName}</div>
              <div className="truncate font-mono text-[10px] text-muted-foreground">
                {basedOn.filePath}
              </div>
            </div>
          )}
          <Field label="Component name">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Status badge"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
          {!validName && name.trim() && (
            <p className="text-xs text-destructive">
              Use a PascalCase component name, for example StatusBadge.
            </p>
          )}
          {duplicate && (
            <p className="text-xs text-destructive">A component with this name already exists.</p>
          )}
          <Field label="Family">
            <input
              value={family}
              onChange={(event) => setFamily(event.target.value)}
              placeholder="Components"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
          <Field label="Purpose">
            <textarea
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              placeholder="Describe where this component is used, expected states, variants, and important props."
              rows={4}
              className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void handleSubmit()}
              disabled={!name.trim() || busy || duplicate || !validName}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Create with Assistant
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function buildNewComponentPrompt({
  name,
  purpose,
  family,
  basedOn,
}: {
  name: string;
  purpose: string;
  family: string;
  basedOn: ComponentEntry | null;
}): string {
  return `[storybook-mode] ${basedOn ? 'Create a new reusable Storybook component based on an existing one.' : 'Create a new reusable Storybook component.'}

Component:
- name: ${name.trim()}
- Storybook family/title prefix: ${family.trim() || 'Components'}
${basedOn ? `- Based on: ${basedOn.shortName} (${basedOn.filePath})\n- Source Storybook title: ${basedOn.title}` : ''}

Purpose:
${purpose.trim() || 'Infer practical usage from the current design system and nearby components.'}

Requirements:
- Read DESIGN.md, component-selection-map.md, the active catalog, and nearby component source files before editing.
- If .sber-designer/component-template.md exists, follow it.
- Add or update a Storybook story so the component appears in the catalog.
- Keep the component reusable and project-native; do not create a one-off screen.
- If this is based on another component, copy it as a starting point and do not modify the original.
- When done, summarize the files changed and the Storybook story title.`;
}

function storybookFamily(title: string): string {
  const parts = title.split('/').filter(Boolean);
  if (parts.length <= 1) return 'Components';
  return parts.slice(0, -1).join('/');
}
