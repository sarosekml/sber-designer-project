import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  KeyRound,
  MoreHorizontal,
  Search,
  Shield,
  ShieldOff,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  deleteAdminUser,
  getAdminUserStorage,
  listAdminUsers,
  listAdminTrash,
  resetAdminUserPassword,
  updateAdminUser,
  type AdminTrashEntry,
  type AdminTrashPreview,
  type AdminUser,
} from '@/lib/api/admin';

import { UserTrashSection } from './UserTrashSection';

export function filterAdminUsers(users: AdminUser[], query: string): AdminUser[] {
  const normalized = query.trim().toLocaleLowerCase('en-US');
  if (!normalized) return users;
  return users.filter((user) =>
    `${user.email}\n${user.displayName}\n${user.role}\n${user.status}`
      .toLocaleLowerCase('en-US')
      .includes(normalized),
  );
}

export function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{
    user: AdminUser;
    temporaryPassword: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletePreview, setDeletePreview] = useState<AdminTrashPreview | null>(null);
  const [deletePreviewLoading, setDeletePreviewLoading] = useState(false);
  const [trashEntries, setTrashEntries] = useState<AdminTrashEntry[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([listAdminUsers(controller.signal), listAdminTrash(controller.signal)])
      .then(([nextUsers, nextTrash]) => {
        setUsers(nextUsers);
        setTrashEntries(nextTrash);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(errorMessage(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const visibleUsers = useMemo(() => filterAdminUsers(users, query), [query, users]);

  const updateUser = async (
    user: AdminUser,
    patch: { role?: 'admin' | 'member'; status?: 'active' | 'disabled' },
  ) => {
    setBusyId(user.id);
    setError(null);
    try {
      const updated = await updateAdminUser(user.id, patch);
      setUsers((current) =>
        current.map((candidate) => (candidate.id === updated.id ? updated : candidate)),
      );
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusyId(null);
    }
  };

  const resetPassword = async (user: AdminUser) => {
    setBusyId(user.id);
    setError(null);
    try {
      const result = await resetAdminUserPassword(user.id);
      setUsers((current) =>
        current.map((candidate) => (candidate.id === result.user.id ? result.user : candidate)),
      );
      setResetResult(result);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleteConfirmation.trim() !== deleteTarget.email) return;
    setBusyId(deleteTarget.id);
    setError(null);
    try {
      const result = await deleteAdminUser(deleteTarget.id, deleteConfirmation.trim());
      setUsers((current) => current.filter((candidate) => candidate.id !== deleteTarget.id));
      setTrashEntries((current) => [result.trashEntry, ...current]);
      setDeleteTarget(null);
      setDeleteConfirmation('');
      setDeletePreview(null);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusyId(null);
    }
  };

  const openDeleteDialog = async (user: AdminUser) => {
    setDeleteTarget(user);
    setDeleteConfirmation('');
    setDeletePreview(null);
    setDeletePreviewLoading(true);
    try {
      setDeletePreview(await getAdminUserStorage(user.id));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setDeletePreviewLoading(false);
    }
  };

  return (
    <main className="min-h-full bg-background">
      <header className="flex min-h-12 items-center justify-between gap-4 border-b border-border bg-card px-5 py-2">
        <div>
          <h1 className="text-sm font-semibold">Users</h1>
          <p className="text-xs text-muted-foreground">
            Manage access to this sber-designer server.
          </p>
        </div>
        <Badge variant="outline">
          {users.length} {users.length === 1 ? 'account' : 'accounts'}
        </Badge>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-8">
        <section className="grid gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">User accounts</h2>
              <p className="text-sm text-muted-foreground">
                Roles, account status, and password recovery.
              </p>
            </div>
            <label className="relative block w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search users"
                className="pl-9"
                aria-label="Search users"
              />
            </label>
          </div>

          {error ? (
            <p
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/35 hover:bg-muted/35">
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleUsers.map((user) => (
                  <TableRow key={user.id} data-state={busyId === user.id ? 'selected' : undefined}>
                    <TableCell>
                      <div className="grid min-w-44 gap-0.5">
                        <span className="font-medium">{user.displayName}</span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.status === 'active' ? 'outline' : 'destructive'}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatAdminDate(user.createdAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {user.lastLoginAt ? formatAdminDate(user.lastLoginAt) : 'Never'}
                    </TableCell>
                    <TableCell>
                      <UserActions
                        user={user}
                        disabled={busyId === user.id}
                        onAccessChange={(patch) => void updateUser(user, patch)}
                        onResetPassword={() => void resetPassword(user)}
                        onDelete={() => void openDeleteDialog(user)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && visibleUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                      No users match this search.
                    </TableCell>
                  </TableRow>
                ) : null}
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                      Loading users…
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </section>

        <UserTrashSection
          entries={trashEntries}
          users={users}
          onEntriesChange={setTrashEntries}
          onError={setError}
        />
      </div>

      <TemporaryPasswordDialog result={resetResult} onClose={() => setResetResult(null)} />
      <DeleteUserDialog
        user={deleteTarget}
        confirmation={deleteConfirmation}
        preview={deletePreview}
        previewLoading={deletePreviewLoading}
        busy={Boolean(deleteTarget && busyId === deleteTarget.id)}
        onConfirmationChange={setDeleteConfirmation}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteConfirmation('');
          setDeletePreview(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </main>
  );
}

function UserActions({
  user,
  disabled,
  onAccessChange,
  onResetPassword,
  onDelete,
}: {
  user: AdminUser;
  disabled: boolean;
  onAccessChange: (patch: { role?: 'admin' | 'member'; status?: 'active' | 'disabled' }) => void;
  onResetPassword: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-label={`Actions for ${user.email}`}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          onSelect={() => onAccessChange({ role: user.role === 'admin' ? 'member' : 'admin' })}
        >
          {user.role === 'admin' ? <ShieldOff /> : <Shield />}
          {user.role === 'admin' ? 'Change to member' : 'Promote to admin'}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            onAccessChange({ status: user.status === 'active' ? 'disabled' : 'active' })
          }
        >
          {user.status === 'active' ? <UserX /> : <UserCheck />}
          {user.status === 'active' ? 'Disable account' : 'Enable account'}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onResetPassword}>
          <KeyRound /> Reset password
        </DropdownMenuItem>
        {user.status === 'disabled' ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 /> Delete account
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TemporaryPasswordDialog({
  result,
  onClose,
}: {
  result: { user: AdminUser; temporaryPassword: string } | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Dialog open={Boolean(result)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Temporary password</DialogTitle>
          <DialogDescription>
            Share this password securely with {result?.user.email}. It is shown only in this dialog.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
          <code className="min-w-0 flex-1 select-all overflow-x-auto px-2 text-sm">
            {result?.temporaryPassword}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!result) return;
              void navigator.clipboard
                .writeText(result.temporaryPassword)
                .then(() => setCopied(true));
            }}
          >
            {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Existing sessions were revoked. The user must change this password after signing in.
        </p>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserDialog({
  user,
  confirmation,
  preview,
  previewLoading,
  busy,
  onConfirmationChange,
  onClose,
  onConfirm,
}: {
  user: AdminUser | null;
  confirmation: string;
  preview: AdminTrashPreview | null;
  previewLoading: boolean;
  busy: boolean;
  onConfirmationChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={Boolean(user)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {user?.email}?</DialogTitle>
          <DialogDescription>
            The account and all sessions will be deleted. Projects and user data will move to the
            admin trash, where they remain until an administrator restores or purges them.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
          {previewLoading ? (
            <span className="text-muted-foreground">Calculating project storage…</span>
          ) : preview ? (
            <div className="grid gap-1">
              <span>
                {preview.projects.length} {preview.projects.length === 1 ? 'project' : 'projects'} ·{' '}
                {formatBytes(preview.totalBytes)}
              </span>
              <span
                className={preview.riskyProjects > 0 ? 'text-destructive' : 'text-muted-foreground'}
              >
                {preview.riskyProjects} not pushed anywhere
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground">Project storage could not be calculated.</span>
          )}
        </div>
        <div className="grid gap-2">
          <label htmlFor="delete-user-confirmation" className="text-sm font-medium">
            Type <span className="font-mono">{user?.email}</span> to confirm
          </label>
          <Input
            id="delete-user-confirmation"
            value={confirmation}
            onChange={(event) => onConfirmationChange(event.target.value)}
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={busy || previewLoading || confirmation.trim() !== user?.email}
          >
            Delete account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatAdminDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
