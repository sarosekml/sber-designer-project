/** Rename / delete folder dialogs. */
import { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
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
import { Field } from './dialog-shared';

export function RenameFolderDialog({
  folder,
  existingFolders,
  onOpenChange,
  onRename,
}: {
  folder: string | null;
  existingFolders: string[];
  onOpenChange: (open: boolean) => void;
  onRename: (from: string, to: string) => void;
}) {
  const [name, setName] = useState('');

  useEffect(() => {
    setName(folder ?? '');
  }, [folder]);

  const trimmed = name.trim();
  const duplicate = existingFolders.some(
    (existing) => existing !== folder && existing.toLowerCase() === trimmed.toLowerCase(),
  );
  const disabled = !folder || !trimmed || trimmed === folder || duplicate;

  const submit = () => {
    if (!folder || disabled) return;
    onRename(folder, trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={folder !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename folder</DialogTitle>
          <DialogDescription>
            This updates the project screen grouping. Use Save to persist the change.
          </DialogDescription>
        </DialogHeader>
        <Field label="Folder name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
        </Field>
        {duplicate && (
          <p className="text-xs text-destructive">A folder with this name already exists.</p>
        )}
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

export function DeleteFolderDialog({
  folder,
  screenCount,
  onOpenChange,
  onDelete,
}: {
  folder: string | null;
  screenCount: number;
  onOpenChange: (open: boolean) => void;
  onDelete: (folder: string) => void;
}) {
  const submit = () => {
    if (!folder) return;
    onDelete(folder);
    onOpenChange(false);
  };

  return (
    <Dialog open={folder !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete folder</DialogTitle>
          <DialogDescription>
            The folder will be removed from the Screens panel and its screens will move to
            Ungrouped. No screens or source files will be deleted.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-border bg-card px-3 py-2 text-sm">
          <div className="font-medium">{folder}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {screenCount} screen{screenCount === 1 ? '' : 's'} will be moved.
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={submit} disabled={!folder}>
            <Trash2 className="size-3.5" />
            Delete folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
