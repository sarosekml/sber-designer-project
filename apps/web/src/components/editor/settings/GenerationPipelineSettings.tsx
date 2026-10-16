import { useState } from 'react';
import type { ResolvedGenerationPipelineDefaults } from '@sber-designer/shared-types';

import { Separator } from '@/components/ui/separator';
import { updateGenerationPipelinePreferences } from '@/lib/api-client';
import { useEditorStore } from '@/stores/editor-store';

import { ScreenReadinessChecks } from './ScreenReadinessChecks';

export function GenerationPipelineSettings() {
  const defaults = useEditorStore((state) => state.generationDefaults);
  const setGenerationDefaults = useEditorStore((state) => state.setGenerationDefaults);
  const [saveError, setSaveError] = useState<string | null>(null);

  const saveDefaults = (next: ResolvedGenerationPipelineDefaults) => {
    setGenerationDefaults(next);
    setSaveError(null);
    void updateGenerationPipelinePreferences({ generationDefaults: next }).catch((error) => {
      setSaveError(error instanceof Error ? error.message : String(error));
    });
  };

  return (
    <div className="grid min-w-0 gap-6">
      <section className="grid min-w-0 gap-3" aria-labelledby="generation-defaults-heading">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id="generation-defaults-heading" className="text-sm font-semibold">
              Global defaults
            </h3>
            <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
              Applied to future screen generation in every project opened by this user. Add a screen
              can override each option for one run without changing these defaults.
            </p>
          </div>
          <span className="rounded bg-muted px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Saved in sber-designer
          </span>
        </div>

        {saveError && (
          <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            Could not save global generation defaults: {saveError}
          </p>
        )}

        <div className="grid min-w-0 gap-2">
          <GenerationDefaultToggle
            checked={defaults.directionPicker}
            label="Choose a design direction"
            description="Before Assistant fills a new screen, pause on three clickable composition directions."
            scope="New screens"
            onChange={(directionPicker) => saveDefaults({ ...defaults, directionPicker })}
          />
          <GenerationDefaultToggle
            checked={defaults.wireframe}
            label="Start with wireframe"
            description="Begin new screen generation with a greybox structure before visual polish."
            scope="New screens"
            onChange={(wireframe) => saveDefaults({ ...defaults, wireframe })}
          />
          <GenerationDefaultToggle
            checked={defaults.designJury}
            label="Run Design Jury"
            description="After screen-changing Act runs, score the result with five reviewers and allow one focused revision."
            scope="Screen runs"
            onChange={(designJury) => saveDefaults({ ...defaults, designJury })}
          />
        </div>
      </section>

      <Separator />

      <section className="grid min-w-0 gap-3" aria-labelledby="readiness-defaults-heading">
        <div>
          <h3 id="readiness-defaults-heading" className="text-sm font-semibold">
            Screen readiness DoR
          </h3>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Deterministic checks run after file edits and return findings to Assistant without
            adding another user question.
          </p>
        </div>
        <ScreenReadinessChecks />
      </section>
    </div>
  );
}

function GenerationDefaultToggle({
  checked,
  label,
  description,
  scope,
  onChange,
}: {
  checked: boolean;
  label: string;
  description: string;
  scope: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-14 min-w-0 cursor-pointer items-start gap-3 rounded-md border border-border bg-background px-3 py-3 text-xs">
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 accent-primary"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{label}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {scope}
          </span>
        </span>
        <span className="mt-1 block text-muted-foreground">{description}</span>
      </span>
      <span className="shrink-0 font-medium text-muted-foreground">{checked ? 'On' : 'Off'}</span>
    </label>
  );
}
