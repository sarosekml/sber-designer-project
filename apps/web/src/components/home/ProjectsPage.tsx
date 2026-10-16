import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ArrowRight,
  Copy,
  FolderOpen,
  LayoutGrid,
  Loader2,
  PencilLine,
  Plus,
  Search,
  Upload,
} from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FolderPickerDialog } from '@/components/editor/FolderPickerDialog';
import { useProjectArtworkSrc } from '@/hooks/use-project-artwork-src';
import {
  ApiError,
  deleteProjectEntry,
  duplicateProjectEntry,
  fetchProjects,
  renameProjectEntry,
  resetProjectThumbnail,
  updateProjectThumbnail,
  type ProjectEntry,
} from '@/lib/api-client';
import {
  duplicateProjectCopyPath,
  parentPath,
  projectFolderNameFromName,
} from '@/lib/project-paths';
import { resolveDeploymentCapabilities } from '@/lib/deployment-capabilities';
import { cn } from '@/lib/utils';
import { useThemeStore } from '@/stores/theme-store';

import { ProjectCard } from './ProjectCard';
import { ProjectCreationDialog, type ProjectCreationTab } from './ProjectCreationDialog';
import {
  DEFAULT_PROJECT_THUMBNAILS,
  normalizeThumbnailPath,
  projectCoverUrl,
  projectThumbnailVariantPath,
  readImageAsDataUrl,
} from './project-thumbnails';
import { projectTypePresentation } from './project-type';
const DEPLOYMENT_CAPABILITIES = resolveDeploymentCapabilities(
  import.meta.env.VITE_SBER_DESIGNER_DEPLOYMENT_MODE,
);
const LANDING_PROJECT_LIMIT = 3;

export function ProjectsPage() {
  return <ProjectsSurface variant="page" />;
}

export function ProjectsLandingSection() {
  return <ProjectsSurface variant="landing" />;
}

function ProjectsSurface({ variant }: { variant: 'page' | 'landing' }) {
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState<ProjectCreationTab>('connect');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [thumbnailProject, setThumbnailProject] = useState<ProjectEntry | null>(null);
  const [renamingProject, setRenamingProject] = useState<ProjectEntry | null>(null);
  const [duplicatingProject, setDuplicatingProject] = useState<ProjectEntry | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    fetchProjects(ac.signal)
      .then((registry) => {
        setProjects(registry.projects);
        setError(null);
      })
      .catch((err) => {
        if (ac.signal.aborted) return;
        setError(formatError(err));
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.workspacePath.toLowerCase().includes(needle) ||
        projectTypePresentation(p.projectType).label.toLowerCase().includes(needle),
    );
  }, [projects, query]);
  const visibleProjects = variant === 'page' ? filtered : projects.slice(0, LANDING_PROJECT_LIMIT);

  const openDialog = (tab: ProjectCreationTab) => {
    setDialogTab(tab);
    setDialogOpen(true);
  };

  const handleDelete = async (entry: ProjectEntry) => {
    setProjects((prev) => prev.filter((p) => p.id !== entry.id));
    try {
      await deleteProjectEntry(entry.id);
    } catch (err) {
      setError(formatError(err));
      setProjects((prev) => [entry, ...prev]);
    }
  };

  const patchProject = (entry: ProjectEntry) => {
    setProjects((prev) => prev.map((project) => (project.id === entry.id ? entry : project)));
  };

  const handleRename = async (entry: ProjectEntry, name: string) => {
    const before = entry;
    const optimistic = { ...entry, name };
    patchProject(optimistic);
    setRenamingProject(optimistic);
    try {
      const next = await renameProjectEntry(entry.id, name);
      patchProject(next);
      setRenamingProject(next);
      setError(null);
    } catch (err) {
      patchProject(before);
      setRenamingProject(before);
      throw err;
    }
  };

  const handleDuplicate = async (
    entry: ProjectEntry,
    input: { name: string; parentDir: string },
  ) => {
    const copy = await duplicateProjectEntry(entry.id, input);
    setProjects((prev) => [copy, ...prev.filter((project) => project.id !== copy.id)]);
    setError(null);
    return copy;
  };

  const handleDefaultThumbnail = async (entry: ProjectEntry, thumbnailPath: string) => {
    const before = entry;
    const optimistic = { ...entry, thumbnailPath };
    patchProject(optimistic);
    setThumbnailProject(optimistic);
    try {
      const next = await updateProjectThumbnail(entry.id, { thumbnailPath });
      patchProject(next);
      setThumbnailProject(next);
    } catch (err) {
      patchProject(before);
      setThumbnailProject(before);
      setError(formatError(err));
    }
  };

  const handleCustomThumbnail = async (entry: ProjectEntry, file: File) => {
    try {
      const dataUrl = await readImageAsDataUrl(file);
      const next = await updateProjectThumbnail(entry.id, { dataUrl });
      patchProject(next);
      setThumbnailProject(next);
      setError(null);
    } catch (err) {
      setError(formatError(err));
    }
  };

  const handleResetThumbnail = async (entry: ProjectEntry) => {
    try {
      const next = await resetProjectThumbnail(entry.id);
      patchProject(next);
      setThumbnailProject(next);
      setError(null);
    } catch (err) {
      setError(formatError(err));
    }
  };

  const projectsSection = (
    <section
      className={variant === 'page' ? 'grid gap-4' : 'grid gap-3'}
      aria-labelledby="projects-heading"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <LayoutGrid className="size-4 text-muted-foreground" aria-hidden="true" />
          {variant === 'page' ? (
            <h1 id="projects-heading" className="text-2xl font-semibold tracking-tight">
              Projects
            </h1>
          ) : (
            <h2 id="projects-heading" className="text-sm font-semibold">
              Projects
            </h2>
          )}
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            {projects.length}
          </span>
        </div>
        {variant === 'page' ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => openDialog('connect')}>
              <FolderOpen />
              Connect repo
            </Button>
            <Button size="sm" onClick={() => openDialog('bootstrap')}>
              <Plus />
              New project
            </Button>
          </div>
        ) : (
          <a
            href="/projects"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'shrink-0')}
          >
            View all
            <ArrowRight aria-hidden="true" />
          </a>
        )}
      </div>

      {variant === 'page' && (
        <div className="flex justify-end">
          <label className="flex w-full items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm focus-within:ring-1 focus-within:ring-ring sm:max-w-sm">
            <Search className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Search projects</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects"
              className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
          {error}
        </div>
      )}

      {loading ? (
        <ProjectsLoading />
      ) : visibleProjects.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleProjects.map((entry) => (
            <ProjectCard
              key={entry.id}
              entry={entry}
              menuOpen={openMenuId === entry.id}
              onMenuOpenChange={(open) => setOpenMenuId(open ? entry.id : null)}
              onChangeThumbnail={() => {
                setOpenMenuId(null);
                setThumbnailProject(entry);
              }}
              onRename={() => {
                setOpenMenuId(null);
                setRenamingProject(entry);
              }}
              canDuplicate={DEPLOYMENT_CAPABILITIES.canDuplicateProjects}
              onDuplicate={() => {
                setOpenMenuId(null);
                setDuplicatingProject(entry);
              }}
              onDelete={() => {
                setOpenMenuId(null);
                void handleDelete(entry);
              }}
              titleLevel={variant === 'page' ? 'h2' : 'h3'}
            />
          ))}
        </div>
      ) : (
        <EmptyProjects
          query={variant === 'page' ? query : ''}
          onClearQuery={() => setQuery('')}
          onConnect={() => openDialog('connect')}
          onNew={() => openDialog('bootstrap')}
        />
      )}
    </section>
  );

  const projectDialogs = (
    <>
      <ProjectCreationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultTab={dialogTab}
      />
      <ThumbnailDialog
        project={thumbnailProject}
        open={Boolean(thumbnailProject)}
        onOpenChange={(open) => {
          if (!open) setThumbnailProject(null);
        }}
        onPickDefault={(entry, thumbnailPath) => void handleDefaultThumbnail(entry, thumbnailPath)}
        onUpload={(entry, file) => void handleCustomThumbnail(entry, file)}
        onPickGenerated={(entry) => void handleResetThumbnail(entry)}
      />
      <RenameProjectDialog
        project={renamingProject}
        open={Boolean(renamingProject)}
        onOpenChange={(open) => {
          if (!open) setRenamingProject(null);
        }}
        onRename={(entry, name) => handleRename(entry, name)}
      />
      {DEPLOYMENT_CAPABILITIES.canDuplicateProjects && (
        <DuplicateProjectDialog
          project={duplicatingProject}
          open={Boolean(duplicatingProject)}
          onOpenChange={(open) => {
            if (!open) setDuplicatingProject(null);
          }}
          onDuplicate={(entry, input) => handleDuplicate(entry, input)}
        />
      )}
    </>
  );

  if (variant === 'landing') {
    return (
      <>
        {projectsSection}
        {projectDialogs}
      </>
    );
  }

  return (
    <main className="min-h-full bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-6 py-8">{projectsSection}</div>
      {projectDialogs}
    </main>
  );
}

function RenameProjectDialog({
  project,
  open,
  onOpenChange,
  onRename,
}: {
  project: ProjectEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: (entry: ProjectEntry, name: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !project) return;
    setName(project.name);
    setError(null);
  }, [open, project]);

  if (!project) return null;

  const cleanName = name.trim();
  const canSave = cleanName.length > 0 && cleanName !== project.name && !busy;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      await onRename(project, cleanName);
      onOpenChange(false);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename project</DialogTitle>
          <DialogDescription>
            The name is stored in the project&apos;s .sber-designer/project.sdproj file.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Project name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!canSave}>
              {busy ? <Loader2 className="animate-spin" /> : <PencilLine />}
              Save name
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DuplicateProjectDialog({
  project,
  open,
  onOpenChange,
  onDuplicate,
}: {
  project: ProjectEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDuplicate: (
    entry: ProjectEntry,
    input: { name: string; parentDir: string },
  ) => Promise<ProjectEntry>;
}) {
  const [name, setName] = useState('');
  const [parentDir, setParentDir] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !project) return;
    setName(`${project.name} copy`);
    setParentDir(parentPath(project.workspacePath));
    setError(null);
  }, [open, project]);

  if (!project) return null;

  const cleanName = name.trim();
  const cleanParentDir = parentDir.trim();
  const folderName = projectFolderNameFromName(cleanName);
  const previewPath = duplicateProjectCopyPath(cleanParentDir, cleanName);
  const canDuplicate = cleanName.length > 0 && cleanParentDir.length > 0 && folderName.length > 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canDuplicate || busy) return;
    setBusy(true);
    setError(null);
    try {
      const copy = await onDuplicate(project, {
        name: cleanName,
        parentDir: cleanParentDir,
      });
      onOpenChange(false);
      window.location.assign(`/edit/${encodeURIComponent(copy.id)}`);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate project</DialogTitle>
            <DialogDescription>
              Create a new workspace folder inside the destination parent folder, then open the
              duplicate.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
            <div className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Source workspace</span>
              <div className="overflow-x-auto rounded-md border border-border bg-card px-3 py-2 font-mono text-xs text-muted-foreground">
                {project.workspacePath}
              </div>
            </div>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Copy name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
            <div className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Destination parent folder
              </span>
              <div className="flex gap-2">
                <input
                  value={parentDir}
                  onChange={(event) => setParentDir(event.target.value)}
                  placeholder="/Users/me/projects"
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => setPickerOpen(true)}
                >
                  <FolderOpen />
                  Browse
                </Button>
              </div>
            </div>
            <div className="grid gap-1.5 rounded-md border border-border bg-muted/20 px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">New workspace path</span>
              <span className="whitespace-pre-wrap break-all font-mono text-xs">
                {previewPath || 'Pick a folder'}
              </span>
              <span className="text-[11px] text-muted-foreground">
                This folder will be created; project files are copied into it.
              </span>
            </div>
            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!canDuplicate || busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Copy />}
                Duplicate &amp; open
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <FolderPickerDialog
        open={pickerOpen}
        title="Choose destination folder"
        description="The project copy will be created inside this folder."
        initialPath={cleanParentDir || parentPath(project.workspacePath)}
        onSelect={setParentDir}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}

function ThumbnailDialog({
  project,
  open,
  onOpenChange,
  onPickDefault,
  onUpload,
  onPickGenerated,
}: {
  project: ProjectEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPickDefault: (entry: ProjectEntry, thumbnailPath: string) => void;
  onUpload: (entry: ProjectEntry, file: File) => void;
  /** Selecting the generated cover simply drops the manual override. */
  onPickGenerated: (entry: ProjectEntry) => void;
}) {
  const theme = useThemeStore((state) => state.theme);
  const generativeThumbnailEnabled = useThemeStore((state) => state.generativeThumbnailEnabled);
  const [generatedAvailable, setGeneratedAvailable] = useState(false);
  const generatedSrc = project ? projectCoverUrl(project.id) : null;
  const resolvedGeneratedSrc = useProjectArtworkSrc(generatedSrc);

  useEffect(() => {
    setGeneratedAvailable(false);
  }, [generatedSrc]);

  if (!project) return null;
  const current = normalizeThumbnailPath(project.thumbnailPath);
  const usingGenerated = !project.thumbnailPath;
  // The generated cover is offered as a normal choice instead of a separate
  // "reset" control; it only exists while the feature is on and a cover has
  // actually been captured (0135 Р-7).
  const showGenerated =
    generativeThumbnailEnabled && generatedAvailable && resolvedGeneratedSrc !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[85vh] max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4 pr-12">
          <DialogTitle>Change thumbnail</DialogTitle>
          <DialogDescription>
            {generativeThumbnailEnabled
              ? 'The cover is a screenshot of the screen generated most recently. Pick a placeholder to change it for now — the next generation brings the screenshot back.'
              : 'Generative thumbnail is off, so the cover stays a placeholder. Pick one or upload a PNG, JPEG, or WebP image.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {generativeThumbnailEnabled && generatedSrc ? (
              <button
                type="button"
                onClick={() => onPickGenerated(project)}
                className={cn(
                  'overflow-hidden rounded-lg border bg-card text-left transition-colors hover:border-primary',
                  usingGenerated ? 'border-primary' : 'border-border',
                  showGenerated ? '' : 'hidden',
                )}
              >
                {resolvedGeneratedSrc ? (
                  <img
                    src={resolvedGeneratedSrc}
                    alt=""
                    onLoad={() => setGeneratedAvailable(true)}
                    onError={() => setGeneratedAvailable(false)}
                    className="aspect-[16/9] w-full object-cover"
                  />
                ) : null}
                <div className="px-3 py-2 text-xs text-muted-foreground">Generated preview</div>
              </button>
            ) : null}
            {DEFAULT_PROJECT_THUMBNAILS.map((thumbnailPath, index) => (
              <button
                key={thumbnailPath}
                type="button"
                onClick={() => onPickDefault(project, thumbnailPath)}
                className={cn(
                  'overflow-hidden rounded-lg border bg-card text-left transition-colors hover:border-primary',
                  current === thumbnailPath ? 'border-primary' : 'border-border',
                )}
              >
                <img
                  src={projectThumbnailVariantPath(thumbnailPath, theme)}
                  alt=""
                  className="aspect-[16/9] w-full object-cover"
                />
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Preview {String(index + 1).padStart(2, '0')}
                </div>
              </button>
            ))}
          </div>
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/20 px-3 py-3 text-sm transition-colors hover:border-primary hover:bg-primary/5">
            <Upload className="size-4" />
            Upload custom image
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (file) onUpload(project, file);
              }}
            />
          </label>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectsLoading() {
  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      aria-label="Loading projects"
      aria-busy="true"
    >
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="overflow-hidden rounded-lg border border-border bg-card"
          aria-hidden="true"
        >
          <div className="aspect-[16/9] animate-pulse border-b border-border bg-muted/50" />
          <div className="grid gap-2 p-3">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-muted/70" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted/60" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyProjects({
  query,
  onClearQuery,
  onConnect,
  onNew,
}: {
  query: string;
  onClearQuery: () => void;
  onConnect: () => void;
  onNew: () => void;
}) {
  return (
    <div className="grid h-56 place-items-center rounded-lg border border-border bg-card px-4 text-center">
      <div className="grid gap-3">
        <div className="mx-auto grid size-10 place-items-center rounded-md bg-muted">
          {query ? (
            <Search className="size-5 text-muted-foreground" />
          ) : (
            <Plus className="size-5" />
          )}
        </div>
        <div>
          <h2 className="text-sm font-semibold">
            {query ? 'No projects match your search' : 'No saved projects yet'}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {query ? 'Try a different name or path.' : 'Connect a repo or create a new project.'}
          </p>
        </div>
        {query ? (
          <Button variant="outline" size="sm" onClick={onClearQuery} className="mx-auto">
            Clear search
          </Button>
        ) : (
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" size="sm" onClick={onConnect}>
              <FolderOpen />
              Connect repo
            </Button>
            <Button size="sm" onClick={onNew}>
              <Plus />
              New project
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function formatError(err: unknown): string {
  if (err instanceof ApiError) return `${err.code ?? 'error'}: ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}
