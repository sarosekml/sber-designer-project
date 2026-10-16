import { useMemo, useState } from 'react';
import { AlertTriangle, ArchiveRestore, FolderGit2, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  purgeAdminTrash,
  restoreAdminTrashProject,
  type AdminTrashEntry,
  type AdminTrashProject,
  type AdminUser,
} from '@/lib/api/admin';

export function UserTrashSection({
  entries,
  users,
  onEntriesChange,
  onError,
}: {
  entries: AdminTrashEntry[];
  users: AdminUser[];
  onEntriesChange: (entries: AdminTrashEntry[]) => void;
  onError: (message: string) => void;
}) {
  const activeUsers = useMemo(() => users.filter((user) => user.status === 'active'), [users]);
  const [restoreTarget, setRestoreTarget] = useState<{
    entry: AdminTrashEntry;
    project: AdminTrashProject;
  } | null>(null);
  const [targetUserId, setTargetUserId] = useState('');
  const [purgeTarget, setPurgeTarget] = useState<{
    entry: AdminTrashEntry;
    project?: AdminTrashProject;
  } | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);

  const openRestore = (entry: AdminTrashEntry, project: AdminTrashProject) => {
    setRestoreTarget({ entry, project });
    setTargetUserId(activeUsers[0]?.id ?? '');
  };

  const restore = async () => {
    if (!restoreTarget || !targetUserId) return;
    setBusy(true);
    try {
      const result = await restoreAdminTrashProject(
        restoreTarget.entry.entryId,
        restoreTarget.project.folder,
        targetUserId,
      );
      onEntriesChange(
        entries.map((entry) =>
          entry.entryId === result.manifest.entryId ? result.manifest : entry,
        ),
      );
      setRestoreTarget(null);
    } catch (error) {
      onError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const purge = async () => {
    if (!purgeTarget || confirmation.trim() !== purgeConfirmation(purgeTarget)) return;
    setBusy(true);
    try {
      const result = await purgeAdminTrash(purgeTarget.entry.entryId, purgeTarget.project?.folder);
      onEntriesChange(
        result.purgedEntry
          ? entries.filter((entry) => entry.entryId !== purgeTarget.entry.entryId)
          : entries.map((entry) =>
              entry.entryId === result.manifest?.entryId ? result.manifest : entry,
            ),
      );
      setPurgeTarget(null);
      setConfirmation('');
    } catch (error) {
      onError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="grid gap-4 border-t border-border pt-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Trash</h2>
          <p className="text-sm text-muted-foreground">
            Restore deleted-user projects or permanently remove them. Trash is never cleared
            automatically.
          </p>
        </div>
        <Badge variant="outline">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </Badge>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-5 py-8 text-sm text-muted-foreground">
          Trash is empty.
        </div>
      ) : (
        <div className="grid gap-3">
          {entries.map((entry) => (
            <article key={entry.entryId} className="rounded-lg border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{entry.user.email}</div>
                  <div className="text-xs text-muted-foreground">
                    Deleted {formatDate(entry.deletedAt)} · {entry.projects.length}{' '}
                    {entry.projects.length === 1 ? 'project' : 'projects'} ·{' '}
                    {formatBytes(entry.totalBytes)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {entry.riskyProjects > 0 ? (
                    <Badge variant="destructive">
                      <AlertTriangle /> {entry.riskyProjects} not pushed anywhere
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Remote-backed</Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      setPurgeTarget({ entry });
                      setConfirmation('');
                    }}
                  >
                    <Trash2 /> Purge entry
                  </Button>
                </div>
              </div>

              <details className="border-t border-border">
                <summary className="cursor-pointer px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/30">
                  View projects
                </summary>
                <div className="grid divide-y divide-border border-t border-border">
                  {entry.projects.length === 0 ? (
                    <p className="px-4 py-4 text-xs text-muted-foreground">
                      All projects from this entry have been restored or purged.
                    </p>
                  ) : (
                    entry.projects.map((project) => (
                      <div key={project.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <FolderGit2 className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-40 flex-1">
                          <div className="truncate text-sm font-medium">{project.name}</div>
                          <div className="truncate font-mono text-[11px] text-muted-foreground">
                            {project.folder} · {formatBytes(project.sizeBytes)}
                          </div>
                        </div>
                        <ProjectRiskBadges project={project} />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={activeUsers.length === 0}
                          onClick={() => openRestore(entry, project)}
                        >
                          <ArchiveRestore /> Restore to user…
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setPurgeTarget({ entry, project });
                            setConfirmation('');
                          }}
                        >
                          <Trash2 /> Purge
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </details>
            </article>
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(restoreTarget)}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore {restoreTarget?.project.name}</DialogTitle>
            <DialogDescription>
              Move this project into an active user’s private project folder and add it to their
              Projects home.
            </DialogDescription>
          </DialogHeader>
          <NativeSelect
            className="w-full"
            value={targetUserId}
            onChange={(event) => setTargetUserId(event.target.value)}
          >
            {activeUsers.map((user) => (
              <NativeSelectOption key={user.id} value={user.id}>
                {user.displayName} — {user.email}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void restore()} disabled={busy || !targetUserId}>
              Restore project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(purgeTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setPurgeTarget(null);
            setConfirmation('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently purge?</DialogTitle>
            <DialogDescription>
              This cannot be undone. Type{' '}
              <span className="font-mono">{purgeTarget ? purgeConfirmation(purgeTarget) : ''}</span>{' '}
              to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurgeTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void purge()}
              disabled={
                busy || !purgeTarget || confirmation.trim() !== purgeConfirmation(purgeTarget)
              }
            >
              Purge permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ProjectRiskBadges({ project }: { project: AdminTrashProject }) {
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant={project.hasRemote ? 'outline' : 'destructive'}>
        {project.hasRemote ? 'Has remote' : 'No remote'}
      </Badge>
      {project.uncommitted ? <Badge variant="destructive">Uncommitted</Badge> : null}
      {project.unpushedCommits > 0 ? (
        <Badge variant="destructive">{project.unpushedCommits} unpushed</Badge>
      ) : null}
    </div>
  );
}

function purgeConfirmation(target: {
  entry: AdminTrashEntry;
  project?: AdminTrashProject;
}): string {
  return target.project?.folder ?? target.entry.entryId;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
