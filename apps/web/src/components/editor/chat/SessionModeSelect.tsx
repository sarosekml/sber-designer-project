import { useState } from 'react';
import type { AssistantSessionMode } from '@sber-designer/shared-types';
import { ChevronDown, FileText, MessageCircleQuestion, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const MODES: Array<{
  value: AssistantSessionMode;
  label: string;
  cost: string;
  bars: number;
  summary: string;
  typicalUsage: string;
  bestFor: string;
  examples: [string, string, string];
  icon: typeof Sparkles;
}> = [
  {
    value: 'ask',
    label: 'Ask',
    cost: 'Light',
    bars: 1,
    summary:
      'Quick answers about the connected project, screens, components, and decisions without changing files.',
    typicalUsage: 'Read-only project access; nothing is generated, so it uses the least.',
    bestFor:
      'Exploring the catalog, reviewing a screen, comparing approaches, or clarifying a task.',
    examples: [
      'Which catalog components fit a dense data table?',
      'Review the active screen and list concrete improvements.',
      'What does the selected component do and where is it used?',
    ],
    icon: MessageCircleQuestion,
  },
  {
    value: 'plan',
    label: 'Plan',
    cost: 'Standard',
    bars: 2,
    summary: 'Creates an editable Markdown plan before implementation.',
    typicalUsage: 'Writes one Markdown plan under .sber-designer/plans/ and never touches screens.',
    bestFor:
      'Screen briefs, redesign plans, multi-screen flows, and broad requests worth confirming.',
    examples: [
      'Draft a brief for a client onboarding screen.',
      'Plan the redesign of the current screen first.',
      'Turn this task into an implementation plan.',
    ],
    icon: FileText,
  },
  {
    value: 'design',
    label: 'Design',
    cost: 'Heavy',
    bars: 3,
    summary: 'Creates or edits concrete screens and components.',
    typicalUsage: 'Runs the full workflow and edits project files, so a run can use the most.',
    bestFor: 'Generating a screen, applying a redesign, wiring a flow, or fixing render issues.',
    examples: [
      'Create a portfolio dashboard screen from this brief.',
      'Apply the design system to the current screen.',
      'Wire these three screens into a clickable demo flow.',
    ],
    icon: Sparkles,
  },
];

export function SessionModeSelect({
  value,
  onChange,
  onExampleSelect,
}: {
  value: AssistantSessionMode;
  onChange: (mode: AssistantSessionMode) => void;
  onExampleSelect?: (example: string) => void;
}) {
  const [previewMode, setPreviewMode] = useState<AssistantSessionMode | null>(null);
  const active = MODES.find((mode) => mode.value === value) ?? MODES[2]!;
  const preview = MODES.find((mode) => mode.value === previewMode) ?? active;
  const ActiveIcon = active.icon;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 min-w-28 justify-between px-2 text-xs"
          aria-label="Chat session mode"
          title={`${active.label}: ${active.summary}`}
        >
          <span className="flex items-center gap-1.5">
            <ActiveIcon className="size-3.5 text-primary" />
            {active.label}
          </span>
          <ChevronDown className="size-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-80">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => onChange(next as AssistantSessionMode)}
        >
          {MODES.map((mode) => {
            const Icon = mode.icon;
            return (
              <DropdownMenuRadioItem
                key={mode.value}
                value={mode.value}
                className="items-start gap-2 py-2.5"
                onPointerEnter={() => setPreviewMode(mode.value)}
                onFocus={() => setPreviewMode(mode.value)}
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{mode.label}</span>
                    <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <span className="flex h-3 items-end gap-0.5" aria-hidden="true">
                        {[1, 2, 3].map((bar) => (
                          <span
                            key={bar}
                            className={cn(
                              'w-1 rounded-sm bg-muted',
                              bar <= mode.bars && 'bg-primary',
                            )}
                            style={{ height: `${bar * 3 + 2}px` }}
                          />
                        ))}
                      </span>
                      {mode.cost}
                    </span>
                  </span>
                  <span className="block text-[11px] leading-4 text-muted-foreground">
                    {mode.summary}
                  </span>
                </span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
        <div className="border-t border-border px-2 py-2.5">
          <div className="text-[10px] leading-4 text-muted-foreground">
            <strong className="font-medium text-foreground">Typical usage:</strong>{' '}
            {preview.typicalUsage}
          </div>
          <div className="mt-1 text-[10px] leading-4 text-muted-foreground">
            <strong className="font-medium text-foreground">Best for:</strong> {preview.bestFor}
          </div>
          <div className="mt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Try asking
          </div>
          <div className="mt-1.5 space-y-1">
            {preview.examples.map((example) => (
              <button
                key={example}
                type="button"
                className="block w-full rounded bg-muted/60 px-2 py-1.5 text-left font-mono text-[10px] leading-4 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => {
                  onChange(preview.value);
                  onExampleSelect?.(example);
                }}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
