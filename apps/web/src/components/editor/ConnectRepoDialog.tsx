import { useEffect, useState } from 'react';
import { FileText, Folder, Loader2, Sparkles, Square } from 'lucide-react';
import {
  DEFAULT_HTML_DESIGN_SYSTEM_PRESET_ID,
  type HtmlDesignSystemPresetId,
  type SberDesignerProjectKind,
} from '@sber-designer/shared-types';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ApiError, scaffoldProject } from '@/lib/api-client';
import { isDuplicateNestedProjectPath, scaffoldProjectWorkspacePath } from '@/lib/project-paths';
import { cn } from '@/lib/utils';
import { useSandboxStore } from '@/stores/sandbox-store';
import type { SandboxSessionInfo } from '@/stores/sandbox-store';
import { useSandboxSession } from '@/hooks/useSandboxSession';
import { FolderPickerDialog } from './FolderPickerDialog';
import { HtmlDesignSystemPresetPicker } from './HtmlDesignSystemPresetPicker';

interface ConnectRepoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: Tab;
  onConnected?: (workspacePath: string) => void | Promise<void>;
}

type Tab = 'connect' | 'bootstrap';

export interface NewProjectKindCopy {
  optionDetail: string;
  toggleLabel: string;
  footer: string;
  description: string;
}

export function buildNewProjectKindCopy(kind: SberDesignerProjectKind): NewProjectKindCopy {
  if (kind === 'html-first') {
    return {
      optionDetail: 'Create static HTML pages with Design.md and CSS sources.',
      toggleLabel: 'Create starter files: index.html, Design.md, tokens.css, components.css.',
      footer:
        'HTML-first projects use the static preview immediately; no dependency install is required.',
      description: 'Create a static HTML project with editable pages, Design.md, and CSS sources.',
    };
  }
  return {
    optionDetail: 'Scaffold a React + Vite app for component-driven screens.',
    toggleLabel: 'Initialise Storybook 8 (recommended for component catalog indexing).',
    footer: 'First run can take ~30-60 s while dependencies install. Watch the steps list above.',
    description: 'Scaffold a React + Vite app for component-driven screens.',
  };
}

export interface NewProjectPathModeModel {
  createProjectSubfolder: boolean;
  duplicateNestedPath: boolean;
  finalWorkspacePath: string;
  folderHint: string;
  modeHint: string;
  subfolderLabel: string;
}

export function buildNewProjectPathModeModel(input: {
  parentDir: string;
  name: string;
  createProjectSubfolder: boolean;
}): NewProjectPathModeModel {
  const finalWorkspacePath = scaffoldProjectWorkspacePath(
    input.parentDir,
    input.name,
    input.createProjectSubfolder,
  );
  return {
    createProjectSubfolder: input.createProjectSubfolder,
    duplicateNestedPath:
      input.createProjectSubfolder && isDuplicateNestedProjectPath(input.parentDir, input.name),
    finalWorkspacePath,
    folderHint: input.createProjectSubfolder
      ? 'A named subfolder will be created inside this folder.'
      : 'Project files will be written directly into this folder.',
    modeHint: input.createProjectSubfolder
      ? 'The selected folder is treated as a parent directory.'
      : 'The selected folder must be empty except for system files.',
    subfolderLabel: 'Create subfolder',
  };
}

/**
 * Connect / bootstrap a project (Phase 5.4).
 *
 * - Connect: paste an absolute path → spawn its dev-server.
 * - Bootstrap: scaffold a brand-new project on disk, then spawn it.
 *   React + Vite can initialize Storybook; HTML-first uses static preview.
 */
export function ConnectRepoDialog({
  open,
  onOpenChange,
  defaultTab = 'connect',
  onConnected,
}: ConnectRepoDialogProps) {
  const session = useSandboxStore((s) => s.session);
  const blockingSession =
    session && (session.status === 'starting' || session.status === 'ready') ? session : null;
  const { stopSession } = useSandboxSession();
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setTab(defaultTab);
  }, [defaultTab, open]);

  const childProps = {
    onClose: () => onOpenChange(false),
    ...(onConnected ? { onConnected } : {}),
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await stopSession();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {blockingSession ? 'Active project' : 'Connect or bootstrap a project'}
          </DialogTitle>
          <DialogDescription>
            {blockingSession
              ? 'Currently connected. Disconnect to switch.'
              : 'Point sber-designer at an existing repo, or scaffold a fresh project on disk.'}
          </DialogDescription>
        </DialogHeader>

        {blockingSession ? (
          <ActiveSession session={blockingSession} busy={busy} onDisconnect={handleDisconnect} />
        ) : (
          <>
            <div className="inline-flex w-fit rounded-md border border-border p-0.5 text-xs">
              {[
                { id: 'connect' as const, label: 'Connect' },
                { id: 'bootstrap' as const, label: 'New project' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'rounded px-2.5 py-0.5 capitalize transition-colors',
                    tab === t.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {tab === 'connect' ? <ConnectTab {...childProps} /> : <BootstrapTab {...childProps} />}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConnectTab({
  onClose,
  onConnected,
}: {
  onClose: () => void;
  onConnected?: (workspacePath: string) => void | Promise<void>;
}) {
  const lastError = useSandboxStore((s) => s.lastError);
  const { createSession } = useSandboxSession();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleConnect = async () => {
    setBusy(true);
    try {
      const info = await createSession(draft.trim());
      if (info) {
        await onConnected?.(info.workspacePath);
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3">
      <div>
        <label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
          Absolute path
        </label>
        <PathInput
          value={draft}
          onChange={setDraft}
          placeholder="/Users/me/Work Dev/acme-design-system"
          onBrowse={() => setPickerOpen(true)}
          autoFocus
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Tip: try <code>examples/sample-storybook</code> for a quick test.
        </p>
      </div>

      {lastError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
          {lastError}
        </div>
      )}

      <Separator />

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" disabled={!draft.trim() || busy} onClick={handleConnect}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          Connect
        </Button>
      </div>

      <FolderPickerDialog
        open={pickerOpen}
        title="Pick a project folder"
        description="Choose the repo root — the folder that contains package.json."
        {...(draft.trim() ? { initialPath: draft.trim() } : {})}
        onSelect={(p) => setDraft(p)}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}

function BootstrapTab({
  onClose,
  onConnected,
}: {
  onClose: () => void;
  onConnected?: (workspacePath: string) => void | Promise<void>;
}) {
  const { createSession } = useSandboxSession();
  const [parentDir, setParentDir] = useState('');
  const [name, setName] = useState('');
  const [createProjectSubfolder, setCreateProjectSubfolder] = useState(false);
  const [projectKind, setProjectKind] = useState<SberDesignerProjectKind>('react-vite');
  const [withStorybook, setWithStorybook] = useState(true);
  const [createStarterFiles, setCreateStarterFiles] = useState(true);
  const [htmlDesignSystemPresetId, setHtmlDesignSystemPresetId] =
    useState<HtmlDesignSystemPresetId>(DEFAULT_HTML_DESIGN_SYSTEM_PRESET_ID);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [steps, setSteps] = useState<
    { name: string; ok: boolean; durationMs: number; detail?: string }[] | null
  >(null);
  const pathMode = buildNewProjectPathModeModel({
    parentDir,
    name,
    createProjectSubfolder,
  });
  const canBootstrap =
    parentDir.trim().length > 0 && name.trim().length > 0 && !pathMode.duplicateNestedPath && !busy;
  const projectKindCopy = buildNewProjectKindCopy(projectKind);

  const handleBootstrap = async () => {
    if (!canBootstrap) return;
    setBusy(true);
    setError(null);
    setSteps(null);
    try {
      const result = await scaffoldProject({
        parentDir: parentDir.trim(),
        name: name.trim(),
        createProjectSubfolder,
        projectKind,
        withStorybook: projectKind === 'react-vite' ? withStorybook : false,
        createStarterFiles: projectKind === 'html-first' ? createStarterFiles : false,
        ...(projectKind === 'html-first' && createStarterFiles ? { htmlDesignSystemPresetId } : {}),
      });
      setSteps(result.steps);
      // Spawn the new project's preview immediately. The API proxy selects
      // Storybook or static HTML from project metadata/profile.
      await createSession(result.workspacePath);
      await onConnected?.(result.workspacePath);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `${err.code ?? 'error'}: ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3">
      <Field label="Project folder" hint={pathMode.folderHint}>
        <PathInput
          value={parentDir}
          onChange={setParentDir}
          placeholder="/Users/me/Work Dev/my-app"
          onBrowse={() => setPickerOpen(true)}
        />
      </Field>

      <Field label="Project name" hint="Lowercase, hyphens, alphanumeric only.">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="my-app"
          spellCheck={false}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </Field>

      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={createProjectSubfolder}
          onChange={(e) => setCreateProjectSubfolder(e.target.checked)}
          className="size-3.5"
        />
        <span>{pathMode.subfolderLabel}</span>
      </label>

      <div className="grid gap-1 rounded-md border border-border bg-muted/20 px-3 py-2">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Workspace path
        </span>
        <span className="break-all font-mono text-xs">
          {pathMode.finalWorkspacePath || 'Pick a folder and enter a project name'}
        </span>
        <span className="text-[11px] text-muted-foreground">{pathMode.modeHint}</span>
      </div>

      {pathMode.duplicateNestedPath && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
          Selected folder already matches the project name. Turn off the subfolder option to avoid
          creating a duplicate nested folder.
        </div>
      )}

      <Field label="Project type">
        <div className="grid gap-1.5">
          {[
            {
              id: 'react-vite' as const,
              label: 'React + Vite',
              detail: buildNewProjectKindCopy('react-vite').optionDetail,
              icon: Sparkles,
            },
            {
              id: 'html-first' as const,
              label: 'HTML-first',
              detail: buildNewProjectKindCopy('html-first').optionDetail,
              icon: FileText,
            },
          ].map(({ id, label, detail, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setProjectKind(id)}
              className={cn(
                'grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors',
                projectKind === id
                  ? 'border-primary/50 bg-primary/10 text-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
              )}
            >
              <Icon className="mt-0.5 size-3.5 shrink-0" />
              <span className="min-w-0">
                <span className="block font-medium text-foreground">{label}</span>
                <span className="block leading-relaxed">{detail}</span>
              </span>
            </button>
          ))}
        </div>
      </Field>

      {projectKind === 'react-vite' ? (
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={withStorybook}
            onChange={(e) => setWithStorybook(e.target.checked)}
            className="size-3.5"
          />
          <span>{projectKindCopy.toggleLabel}</span>
        </label>
      ) : (
        <div className="grid gap-3">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={createStarterFiles}
              onChange={(e) => setCreateStarterFiles(e.target.checked)}
              className="size-3.5"
            />
            <span>{projectKindCopy.toggleLabel}</span>
          </label>
          {createStarterFiles ? (
            <Field
              label="Style preset"
              hint="Creates a complete project-owned Design.md and token set."
            >
              <HtmlDesignSystemPresetPicker
                value={htmlDesignSystemPresetId}
                onChange={setHtmlDesignSystemPresetId}
                disabled={busy}
              />
            </Field>
          ) : null}
        </div>
      )}

      {steps && (
        <ul className="grid gap-1 rounded-md border border-border bg-card px-3 py-2 text-xs">
          {steps.map((s) => (
            <li
              key={s.name}
              className={cn(
                'flex items-baseline justify-between gap-2',
                s.ok ? '' : 'text-destructive-foreground',
              )}
            >
              <span>{s.name}</span>
              <span className="text-[10px] text-muted-foreground">
                {s.ok ? `${(s.durationMs / 1000).toFixed(1)}s` : s.detail}
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
          {error}
        </div>
      )}

      <Separator />

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button size="sm" disabled={!canBootstrap} onClick={handleBootstrap}>
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
          Create &amp; connect
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">{projectKindCopy.footer}</p>

      <FolderPickerDialog
        open={pickerOpen}
        title="Pick a project folder"
        description="Choose the folder where project files should be created."
        {...(parentDir.trim() ? { initialPath: parentDir.trim() } : {})}
        onSelect={(p) => setParentDir(p)}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}

/**
 * Path input with a clickable folder icon (opens FolderPickerDialog).
 * Placeholder is rendered noticeably dimmer than real input text so
 * the user doesn't mistake the hint for a typed value (Phase 6.7+ UX
 * fix).
 */
function PathInput({
  value,
  onChange,
  placeholder,
  onBrowse,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onBrowse: () => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-background pr-1 text-sm focus-within:ring-1 focus-within:ring-ring">
      <button
        type="button"
        onClick={onBrowse}
        className="flex shrink-0 items-center gap-1 rounded-l-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title="Browse for a folder"
      >
        <Folder className="size-3.5" />
      </button>
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className="w-full bg-transparent py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
      />
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
        <span className="uppercase tracking-wide text-muted-foreground">{label}</span>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function ActiveSession({
  session,
  busy,
  onDisconnect,
}: {
  session: SandboxSessionInfo;
  busy: boolean;
  onDisconnect: () => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="rounded-md border border-border bg-card px-3 py-3 text-sm">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="font-medium">{shortPath(session.workspacePath)}</span>
          <StatusBadge status={session.status} />
        </div>
        <div className="text-xs text-muted-foreground">
          Port {session.port} · {session.previewUrl ?? 'waiting for ready signal…'}
        </div>
        {session.errorMessage && (
          <div className="mt-2 text-xs text-destructive-foreground">{session.errorMessage}</div>
        )}
      </div>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" disabled={busy} onClick={onDisconnect}>
          <Square />
          Disconnect
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'starting' | 'ready' | 'failed' | 'stopped' }) {
  const cls =
    status === 'ready'
      ? 'bg-primary/15 text-primary-foreground'
      : status === 'failed'
        ? 'bg-destructive/20 text-destructive-foreground'
        : 'bg-muted text-muted-foreground';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${cls}`}>
      {status}
    </span>
  );
}

function shortPath(p: string): string {
  if (p.length <= 48) return p;
  return '…' + p.slice(p.length - 47);
}
