/** Rename / move screen dialogs. */
import { useEffect, useState } from 'react';
import { ArrowRightLeft, Pencil } from 'lucide-react';
import type { ProjectScreen } from '@sber-designer/shared-types';
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
import { cn } from '@/lib/utils';
import { normalizeScreenFolder } from '@/lib/screen-folders';
import { Field } from './dialog-shared';

export function RenameScreenDialog({
  screen,
  onOpenChange,
  onRename,
}: {
  screen: ProjectScreen | null;
  onOpenChange: (open: boolean) => void;
  onRename: (screenId: string, name: string) => void;
}) {
  const [name, setName] = useState('');

  useEffect(() => {
    setName(screen?.name ?? '');
  }, [screen]);

  const trimmed = name.trim();
  const disabled = !screen || !trimmed || trimmed === screen.name;

  const submit = () => {
    if (!screen || disabled) return;
    onRename(screen.id, trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={screen !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename screen</DialogTitle>
          <DialogDescription>
            This updates the project screen label. Use Save to persist the change.
          </DialogDescription>
        </DialogHeader>
        <Field label="Screen name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
        </Field>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={disabled}>
            <Pencil className="size-3.5" />
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MoveScreenDialog({
  screen,
  existingFolders,
  onOpenChange,
  onMove,
}: {
  screen: ProjectScreen | null;
  existingFolders: string[];
  onOpenChange: (open: boolean) => void;
  onMove: (screenId: string, folder: string) => void;
}) {
  const [folder, setFolder] = useState('');

  useEffect(() => {
    setFolder(screen ? normalizeScreenFolder(screen.folder) : '');
  }, [screen]);

  const trimmed = folder.trim();
  const current = screen ? normalizeScreenFolder(screen.folder) : '';
  const disabled = !screen || !trimmed || trimmed === current;

  const submit = () => {
    if (!screen || disabled) return;
    onMove(screen.id, trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={screen !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move screen</DialogTitle>
          <DialogDescription>
            Choose an existing folder or type a new one. Use Save to persist the change.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="truncate text-sm font-medium">{screen?.name}</div>
          {existingFolders.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {existingFolders.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setFolder(name)}
                  className={cn(
                    'rounded-md border px-2 py-1 text-xs transition-colors',
                    normalizeScreenFolder(folder) === name
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
          <Field label="Folder name">
            <Input
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              placeholder="2026-05-10"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={disabled}>
            <ArrowRightLeft className="size-3.5" />
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
