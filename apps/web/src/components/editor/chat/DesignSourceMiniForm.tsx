/** Pixso/Figma design-source mini-form for the composer. */
import { Link2, SquareMousePointer, X } from 'lucide-react';
import {
  createExternalDesignSourceTargetDefaults,
  type ExternalDesignSourceComponentPolicy,
  type ExternalDesignSourceIntent,
  type ExternalDesignSourceTargetMode,
  type ExternalDesignSourceTokenPolicy,
  type ProjectScreen,
} from '@sber-designer/shared-types';
import { cn } from '@/lib/utils';

export interface DesignSourceComposerState {
  key: string;
  targetMode: ExternalDesignSourceTargetMode;
  targetName: string;
  targetFolder: string;
  targetStoryId: string;
  targetStoryFilePath: string;
  targetImplementationFilePath: string;
  tokenPolicy: ExternalDesignSourceTokenPolicy;
  componentPolicy: ExternalDesignSourceComponentPolicy;
}

export function DesignSourceMiniForm({
  intent,
  composer,
  activeScreen,
  disabled,
  onChange,
  onDismiss,
}: {
  intent: ExternalDesignSourceIntent;
  composer: DesignSourceComposerState;
  activeScreen: ProjectScreen | null;
  disabled: boolean;
  onChange: (value: DesignSourceComposerState | null) => void;
  onDismiss: () => void;
}) {
  const sourceLabel = intent.source.kind === 'pixso' ? 'Pixso' : 'Figma';
  const inputLabel = intent.source.input === 'selection' ? 'Selected frame' : 'Link';
  const targetPath =
    composer.targetMode === 'replace-current'
      ? activeScreen?.implementationFilePath || activeScreen?.filePath || 'Active screen'
      : composer.targetImplementationFilePath;

  const updateName = (name: string) => {
    const defaults = createExternalDesignSourceTargetDefaults({
      name,
      folder: composer.targetFolder,
    });
    onChange({
      ...composer,
      targetName: name,
      targetStoryId: defaults.storyId,
      targetStoryFilePath: defaults.storyFilePath,
      targetImplementationFilePath: defaults.implementationFilePath,
    });
  };

  const updateTargetMode = (mode: ExternalDesignSourceTargetMode) => {
    onChange({
      ...composer,
      targetMode: mode,
      targetName:
        mode === 'replace-current' && activeScreen ? activeScreen.name : composer.targetName,
    });
  };

  return (
    <div className="mb-2 rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-xs">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 font-medium">
          {intent.source.input === 'selection' ? (
            <SquareMousePointer className="size-3.5 shrink-0 text-primary" />
          ) : (
            <Link2 className="size-3.5 shrink-0 text-primary" />
          )}
          <span className="truncate">Design source detected</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="rounded bg-background/80 px-1.5 py-0.5">{sourceLabel}</span>
          <span className="rounded bg-background/80 px-1.5 py-0.5">{inputLabel}</span>
          <button
            type="button"
            onClick={onDismiss}
            title="Ignore design source"
            className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-2 gap-1 rounded-md border border-border/70 bg-background/70 p-0.5">
        {(['new-screen', 'replace-current'] as ExternalDesignSourceTargetMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            disabled={disabled || (mode === 'replace-current' && !activeScreen)}
            onClick={() => updateTargetMode(mode)}
            className={cn(
              'h-7 rounded px-2 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-45',
              composer.targetMode === mode
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {mode === 'new-screen' ? 'New screen' : 'Replace current'}
          </button>
        ))}
      </div>

      <div className="grid gap-2">
        <label className="grid gap-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Target name
          </span>
          <input
            value={composer.targetName}
            disabled={disabled || composer.targetMode === 'replace-current'}
            onChange={(event) => updateName(event.currentTarget.value)}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Target path
          </span>
          <input
            value={targetPath}
            disabled={disabled || composer.targetMode === 'replace-current'}
            onChange={(event) =>
              onChange({
                ...composer,
                targetImplementationFilePath: event.currentTarget.value,
              })
            }
            className="h-8 rounded-md border border-border bg-background px-2 font-mono text-[11px] outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Tokens
            </span>
            <select
              value={composer.tokenPolicy}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  ...composer,
                  tokenPolicy: event.currentTarget.value as ExternalDesignSourceTokenPolicy,
                })
              }
              className="h-8 rounded-md border border-border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="prefer-project-tokens">Project tokens</option>
              <option value="allow-source-values">Source values</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Components
            </span>
            <select
              value={composer.componentPolicy}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  ...composer,
                  componentPolicy: event.currentTarget.value as ExternalDesignSourceComponentPolicy,
                })
              }
              className="h-8 rounded-md border border-border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="prefer-existing">Prefer existing</option>
              <option value="allow-new-components">Allow new</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}

export function composeExternalDesignSourceIntent(
  intent: ExternalDesignSourceIntent,
  composer: DesignSourceComposerState,
  activeScreen: ProjectScreen | null,
): ExternalDesignSourceIntent {
  if (composer.targetMode === 'replace-current') {
    return {
      source: intent.source,
      target: {
        mode: 'replace-current',
        name: activeScreen?.name ?? composer.targetName,
        ...(activeScreen?.filePath ? { storyFilePath: activeScreen.filePath } : {}),
        ...(activeScreen?.implementationFilePath
          ? { implementationFilePath: activeScreen.implementationFilePath }
          : {}),
      },
      policies: {
        tokens: composer.tokenPolicy,
        components: composer.componentPolicy,
      },
    };
  }

  return {
    source: intent.source,
    target: {
      mode: 'new-screen',
      name: composer.targetName,
      folder: composer.targetFolder,
      storyId: composer.targetStoryId,
      storyFilePath: composer.targetStoryFilePath,
      implementationFilePath: composer.targetImplementationFilePath,
    },
    policies: {
      tokens: composer.tokenPolicy,
      components: composer.componentPolicy,
    },
  };
}
