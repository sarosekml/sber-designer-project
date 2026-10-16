import { CircleHelp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const HARNESS_OPTIONS_TOOLTIP =
  'One-off harness options for this run only. Defaults come from Settings → Harness setup; changing them here does not update the global settings.';

export function GenerationRunOptions({
  directionPicker,
  wireframe,
  designJury,
  disabled,
  onDirectionPickerChange,
  onWireframeChange,
  onDesignJuryChange,
}: {
  directionPicker: boolean;
  wireframe: boolean;
  designJury: boolean;
  disabled: boolean;
  onDirectionPickerChange: (checked: boolean) => void;
  onWireframeChange: (checked: boolean) => void;
  onDesignJuryChange: (checked: boolean) => void;
}) {
  return (
    <div className="grid min-w-0 gap-2">
      <div className="flex min-w-0 items-center gap-1.5 px-0.5">
        <span aria-hidden="true" className="text-xs font-medium text-foreground">
          Harness
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="About one-off harness options"
              className="size-4 rounded-full p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
            >
              <CircleHelp className="size-3.5" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" align="start" sideOffset={6} className="max-w-xs">
            {HARNESS_OPTIONS_TOOLTIP}
          </TooltipContent>
        </Tooltip>
      </div>
      <fieldset className="grid min-w-0 gap-2" disabled={disabled}>
        <legend className="sr-only">Harness</legend>
        <GenerationRunOption
          checked={directionPicker}
          label="Choose a design direction"
          description="Pause before generation and choose one of three clickable composition directions."
          onChange={onDirectionPickerChange}
        />
        <GenerationRunOption
          checked={wireframe}
          label="Start with wireframe"
          description="Ask Assistant for a greybox first pass before final visual polish."
          onChange={onWireframeChange}
        />
        <GenerationRunOption
          checked={designJury}
          label="Run Design Jury"
          description="Score the generated screen with five reviewers and allow one focused revision."
          onChange={onDesignJuryChange}
        />
        <p className="px-0.5 text-[11px] text-muted-foreground">
          These options are used only when an Assistant instruction starts a generation run.
        </p>
      </fieldset>
    </div>
  );
}

function GenerationRunOption({
  checked,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-14 min-w-0 cursor-pointer items-start gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="mt-0.5 size-4 shrink-0 accent-primary"
      />
      <span className="min-w-0">
        <span className="font-medium text-foreground">{label}</span>
        <span className="mt-0.5 block">{description}</span>
      </span>
    </label>
  );
}
