import { type ComponentType } from 'react';
import {
  Maximize2,
  MessageSquare,
  MessageSquareOff,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export type PanelVisibilityControlsProps = {
  canvasFocused: boolean;
  resourcePanelKind: 'screens' | 'components';
  screensPanelHidden: boolean;
  assistantPanelHidden: boolean;
  rightPanelHidden: boolean;
  onCanvasFocusChange: (focused: boolean) => void;
  onScreensPanelHiddenChange: (hidden: boolean) => void;
  onAssistantPanelHiddenChange: (hidden: boolean) => void;
  onRightPanelHiddenChange: (hidden: boolean) => void;
};

export function PanelVisibilityControls({
  canvasFocused,
  resourcePanelKind,
  screensPanelHidden,
  assistantPanelHidden,
  rightPanelHidden,
  onCanvasFocusChange,
  onScreensPanelHiddenChange,
  onAssistantPanelHiddenChange,
  onRightPanelHiddenChange,
}: PanelVisibilityControlsProps) {
  return (
    <div
      role="group"
      aria-label="Panel visibility"
      className="inline-flex rounded-md border border-border bg-background p-0.5"
    >
      <PanelVisibilityButton
        pressed={assistantPanelHidden}
        icon={assistantPanelHidden ? MessageSquare : MessageSquareOff}
        label={assistantPanelHidden ? 'Show assistant panel' : 'Hide assistant panel'}
        onClick={() => onAssistantPanelHiddenChange(!assistantPanelHidden)}
      />
      <PanelVisibilityButton
        pressed={screensPanelHidden}
        icon={screensPanelHidden ? PanelLeftOpen : PanelLeftClose}
        label={`${screensPanelHidden ? 'Show' : 'Hide'} ${resourcePanelKind} panel`}
        onClick={() => onScreensPanelHiddenChange(!screensPanelHidden)}
      />
      <PanelVisibilityButton
        pressed={rightPanelHidden}
        icon={rightPanelHidden ? PanelRightOpen : PanelRightClose}
        label={rightPanelHidden ? 'Show inspector panel' : 'Hide inspector panel'}
        onClick={() => onRightPanelHiddenChange(!rightPanelHidden)}
      />
      <PanelVisibilityButton
        pressed={canvasFocused}
        icon={canvasFocused ? Minimize2 : Maximize2}
        label={canvasFocused ? 'Show all panels' : 'Hide all panels'}
        onClick={() => onCanvasFocusChange(!canvasFocused)}
      />
    </div>
  );
}

function PanelVisibilityButton({
  pressed,
  icon: Icon,
  label,
  onClick,
}: {
  pressed: boolean;
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={pressed ? 'secondary' : 'ghost'}
          size="icon-sm"
          aria-pressed={pressed}
          onClick={onClick}
          className="h-6 w-6 rounded-[5px] text-muted-foreground hover:text-accent-foreground"
        >
          <Icon />
          <span className="sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
