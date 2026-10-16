/** Empty state for the Screens panel. */
import { FileText, Image, Layers, Loader2, Palette, Plus, RefreshCw, Sparkles } from 'lucide-react';
import type { SberDesignerProjectKind } from '@sber-designer/shared-types';
import { Button } from '@/components/ui/button';

export type EmptyScreensStateSecondaryAction =
  | { id: 'add-design-system'; label: 'Add design system'; action: 'open-flow' }
  | { id: 'extract-reference'; label: 'Extract from reference'; action: 'prepare-assistant-prompt' }
  | { id: 'start-greybox'; label: 'Start greybox'; action: 'open-greybox-flow' }
  | { id: 'generate-prototype'; label: 'Generate prototype'; action: 'open-prototype-flow' };

const HTML_FIRST_SECONDARY_ACTIONS: EmptyScreensStateSecondaryAction[] = [
  { id: 'add-design-system', label: 'Add design system', action: 'open-flow' },
  { id: 'extract-reference', label: 'Extract from reference', action: 'prepare-assistant-prompt' },
  { id: 'start-greybox', label: 'Start greybox', action: 'open-greybox-flow' },
  { id: 'generate-prototype', label: 'Generate prototype', action: 'open-prototype-flow' },
];

export function EmptyScreensState({
  projectKind,
  sessionStatus,
  catalogLoading,
  catalogError,
  storyCount,
  onAdd,
  onAddDesignSystem,
  onExtractReference,
  onStartGreybox,
  onGeneratePrototype,
  onUseFirst,
  onRefresh,
}: {
  projectKind?: SberDesignerProjectKind | undefined;
  sessionStatus: string | null;
  catalogLoading: boolean;
  catalogError: string | null;
  storyCount: number;
  onAdd: () => void;
  onAddDesignSystem?: (() => void) | null;
  onExtractReference?: (() => void) | null;
  onStartGreybox?: (() => void) | null;
  onGeneratePrototype?: (() => void) | null;
  onUseFirst: (() => void) | null;
  onRefresh: (() => Promise<void>) | null;
}) {
  const model = buildEmptyScreensStateModel({
    projectKind,
    sessionStatus,
    catalogLoading,
    catalogError,
    storyCount,
  });

  return (
    <div className="rounded-md border border-border bg-card px-2.5 py-3 text-xs">
      <div className="mb-1.5 flex items-center gap-2 font-medium text-foreground">
        <Sparkles className="size-3.5 text-primary" />
        <span>No screens yet</span>
      </div>
      <p className="mb-3 leading-relaxed text-muted-foreground">{model.message}</p>
      <div className="grid gap-1.5">
        <Button
          size="sm"
          className="h-7 justify-start px-2"
          onClick={onAdd}
          disabled={!model.ready}
        >
          {model.projectKind === 'html-first' ? (
            <FileText className="size-3.5" />
          ) : (
            <Plus className="size-3.5" />
          )}
          {model.primaryLabel}
        </Button>
        {model.projectKind === 'html-first' &&
          model.secondaryActions.map((action) => {
            const config = secondaryActionConfig(action.id, {
              onAddDesignSystem,
              onExtractReference,
              onStartGreybox,
              onGeneratePrototype,
            });
            return (
              <Button
                key={action.id}
                size="sm"
                variant={config.variant}
                className="h-7 justify-start px-2"
                onClick={config.onClick ?? undefined}
                disabled={!model.ready || !config.onClick}
              >
                <config.Icon className="size-3.5" />
                {action.label}
              </Button>
            );
          })}
        {onUseFirst && (
          <Button
            size="sm"
            variant="secondary"
            className="h-7 justify-start px-2"
            onClick={onUseFirst}
          >
            <Layers className="size-3.5" />
            Use first story
          </Button>
        )}
        {onRefresh && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 justify-start px-2"
            onClick={() => void onRefresh()}
            disabled={catalogLoading}
          >
            {catalogLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Refresh catalog
          </Button>
        )}
      </div>
      {catalogError && (
        <p className="mt-2 break-words text-[10px] text-destructive">{catalogError}</p>
      )}
    </div>
  );
}

export interface EmptyScreensStateModel {
  projectKind?: SberDesignerProjectKind | undefined;
  ready: boolean;
  message: string;
  primaryLabel: string;
  secondaryLabels: string[];
  secondaryActions: EmptyScreensStateSecondaryAction[];
  addDesignSystemAction?: 'open-flow';
  extractReferenceAction?: 'prepare-assistant-prompt';
  startGreyboxAction?: 'open-greybox-flow';
  generatePrototypeAction?: 'open-prototype-flow';
}

export function buildEmptyScreensStateModel(input: {
  projectKind?: SberDesignerProjectKind | undefined;
  sessionStatus: string | null;
  catalogLoading: boolean;
  catalogError: string | null;
  storyCount: number;
}): EmptyScreensStateModel {
  const ready = input.sessionStatus === 'ready';
  if (input.projectKind === 'html-first') {
    return {
      projectKind: input.projectKind,
      ready,
      primaryLabel: 'Create page',
      secondaryLabels: HTML_FIRST_SECONDARY_ACTIONS.map((action) => action.label),
      secondaryActions: HTML_FIRST_SECONDARY_ACTIONS,
      addDesignSystemAction: 'open-flow',
      extractReferenceAction: 'prepare-assistant-prompt',
      startGreyboxAction: 'open-greybox-flow',
      generatePrototypeAction: 'open-prototype-flow',
      message: !input.sessionStatus
        ? 'Create or connect an HTML-first project to start adding static pages.'
        : !ready
          ? `Static preview is ${input.sessionStatus}. Pages will unlock when the sandbox is ready.`
          : 'Create a static page, connect project design-system files, or generate a first prototype.',
    };
  }
  return {
    projectKind: input.projectKind,
    ready,
    primaryLabel: 'Add screen',
    secondaryLabels: [],
    secondaryActions: [],
    message: !input.sessionStatus
      ? 'Create or connect a project to start adding screens.'
      : !ready
        ? `Storybook is ${input.sessionStatus}. Screens will unlock when the sandbox is ready.`
        : input.catalogLoading
          ? 'Indexing Storybook stories...'
          : input.catalogError
            ? 'Catalog did not load. Try refreshing it, or check Storybook logs.'
            : input.storyCount > 0
              ? 'Add a Storybook story as the first screen, or describe the screen in Assistant.'
              : 'Storybook is ready, but no stories were found yet.',
  };
}

function secondaryActionConfig(
  actionId: EmptyScreensStateSecondaryAction['id'],
  handlers: {
    onAddDesignSystem?: (() => void) | null | undefined;
    onExtractReference?: (() => void) | null | undefined;
    onStartGreybox?: (() => void) | null | undefined;
    onGeneratePrototype?: (() => void) | null | undefined;
  },
): {
  Icon: typeof Palette;
  variant: 'secondary' | 'ghost';
  onClick: (() => void) | null | undefined;
} {
  if (actionId === 'add-design-system') {
    return { Icon: Palette, variant: 'secondary', onClick: handlers.onAddDesignSystem };
  }
  if (actionId === 'extract-reference') {
    return { Icon: Image, variant: 'ghost', onClick: handlers.onExtractReference };
  }
  if (actionId === 'start-greybox') {
    return { Icon: Layers, variant: 'ghost', onClick: handlers.onStartGreybox };
  }
  return { Icon: Sparkles, variant: 'ghost', onClick: handlers.onGeneratePrototype };
}
