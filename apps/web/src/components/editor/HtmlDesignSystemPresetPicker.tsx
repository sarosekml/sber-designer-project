import {
  HTML_DESIGN_SYSTEM_PRESETS,
  type HtmlDesignSystemPresetId,
} from '@sber-designer/shared-types';
import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

export function HtmlDesignSystemPresetPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: HtmlDesignSystemPresetId;
  onChange: (value: HtmlDesignSystemPresetId) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Style preset">
      {HTML_DESIGN_SYSTEM_PRESETS.map((preset) => {
        const selected = value === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(preset.id)}
            className={cn(
              'grid min-w-0 gap-1 rounded-md border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              selected
                ? 'border-primary/55 bg-primary/10 text-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
            )}
          >
            <span className="flex items-center justify-between gap-2 text-xs font-medium text-foreground">
              {preset.name}
              {selected ? <Check className="size-3.5 shrink-0 text-primary" /> : null}
            </span>
            <span className="text-[11px] leading-relaxed">{preset.description}</span>
          </button>
        );
      })}
    </div>
  );
}
