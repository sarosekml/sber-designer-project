import { FilePlus2, Layers, Loader2, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { CatalogStory } from '@/lib/screen-panel-actions';
import { Field } from './dialog-shared';
import { FolderSelect } from './NewScreenBlankFields';

export function NewScreenCatalogFields({
  stories,
  selectedStory,
  error,
  name,
  selectedFolderValue,
  creationFolders,
  resolvedFolder,
  busy,
  onNameChange,
  onFolderChange,
  onStorySelect,
}: {
  stories: CatalogStory[];
  selectedStory: CatalogStory | null;
  error: string | null;
  name: string;
  selectedFolderValue: string;
  creationFolders: readonly string[];
  resolvedFolder: string;
  busy: boolean;
  onNameChange: (value: string) => void;
  onFolderChange: (value: string) => void;
  onStorySelect: (story: CatalogStory) => void;
}) {
  if (stories.length === 0) {
    return (
      <div className="grid min-w-0 gap-3">
        <p className="px-1 py-3 text-sm text-muted-foreground">
          Catalog is empty. Connect a project and wait for Storybook to come up.
        </p>
        {error && <ErrorMessage error={error} />}
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-3">
      {error && <ErrorMessage error={error} />}
      {selectedStory ? (
        <div className="grid min-w-0 gap-3">
          <div className="min-w-0 overflow-hidden rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <div
              className="truncate font-medium"
              title={`${selectedStory.component.shortName} · ${selectedStory.story.name}`}
            >
              {selectedStory.component.shortName} · {selectedStory.story.name}
            </div>
            <div
              className="mt-0.5 truncate text-xs text-muted-foreground"
              title={`${selectedStory.component.title} · ${selectedStory.component.filePath}`}
            >
              {selectedStory.component.title} · {selectedStory.component.filePath}
            </div>
          </div>
          <Field label="Screen name">
            <Input
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Deal page"
            />
          </Field>
          <FolderSelect
            value={selectedFolderValue}
            folders={creationFolders}
            disabled={busy}
            onChange={onFolderChange}
          />
          <div className="min-w-0 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
            New editable story will be created in{' '}
            <span className="font-mono text-foreground">Screens/{resolvedFolder}</span>. The
            selected Storybook template stays unchanged.
          </div>
        </div>
      ) : (
        <ul className="grid max-h-[60vh] min-w-0 gap-1 overflow-y-auto overflow-x-hidden pr-1">
          {stories.map((entry) => (
            <li key={entry.story.id} className="min-w-0">
              <button
                onClick={() => onStorySelect(entry)}
                disabled={busy}
                title={`${entry.component.shortName} · ${entry.story.name} · ${entry.component.title}`}
                className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(120px,220px)] items-baseline gap-3 rounded-md border border-border bg-card px-3 py-2 text-left text-sm hover:border-primary/30 hover:bg-card/80 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span
                  className="min-w-0 truncate font-medium"
                  title={`${entry.component.shortName} · ${entry.story.name}`}
                >
                  {entry.component.shortName} · {entry.story.name}
                </span>
                <span
                  className="min-w-0 truncate text-right text-[10px] text-muted-foreground"
                  title={entry.component.title}
                >
                  {entry.component.title}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ErrorMessage({ error }: { error: string }) {
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
      {error}
    </div>
  );
}

export function NewScreenDialogFooter({
  tab,
  busy,
  projectAvailable,
  modalFieldsInvalid,
  shouldAskAssistant,
  isModalSurface,
  selectedStory,
  name,
  onClose,
  onCreateBlank,
  onBack,
  onPinStory,
  onCreateFromStory,
}: {
  tab: 'blank' | 'catalog';
  busy: boolean;
  projectAvailable: boolean;
  modalFieldsInvalid: boolean;
  shouldAskAssistant: boolean;
  isModalSurface: boolean;
  selectedStory: CatalogStory | null;
  name: string;
  onClose: () => void;
  onCreateBlank: () => void;
  onBack: () => void;
  onPinStory: () => void;
  onCreateFromStory: () => void;
}) {
  return (
    <DialogFooter
      data-slot="new-screen-dialog-footer"
      className="shrink-0 border-t border-border px-6 py-4"
    >
      {tab === 'blank' ? (
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onCreateBlank}
            disabled={!projectAvailable || busy || modalFieldsInvalid}
          >
            {busy ? (
              <Loader2 className="animate-spin" />
            ) : shouldAskAssistant ? (
              <Sparkles />
            ) : (
              <FilePlus2 />
            )}
            {shouldAskAssistant
              ? isModalSurface
                ? 'Create modal & ask Assistant'
                : 'Create & ask Assistant'
              : isModalSurface
                ? 'Create modal'
                : 'Create screen'}
          </Button>
        </>
      ) : selectedStory ? (
        <div className="flex w-full min-w-0 justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} disabled={busy}>
            Back
          </Button>
          <div className="flex min-w-0 gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onPinStory}
              disabled={!projectAvailable || busy}
            >
              <Layers className="size-3.5" />
              Pin original
            </Button>
            <Button
              size="sm"
              onClick={onCreateFromStory}
              disabled={!projectAvailable || !name.trim() || busy}
            >
              {busy ? <Loader2 className="animate-spin" /> : <FilePlus2 />}
              Create editable copy
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
      )}
    </DialogFooter>
  );
}
