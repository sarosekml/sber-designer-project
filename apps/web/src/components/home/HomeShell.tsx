import { useState, type ReactNode } from 'react';
import { Settings } from 'lucide-react';

import { BrandHomeLink } from '@/components/brand/BrandMark';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { HomeRail } from './HomeRail';
import { HomeSettingsDialog } from './HomeSettingsDialog';

interface HomeShellProps {
  currentPath: string;
  children: ReactNode;
}

export function HomeShell({ currentPath, children }: HomeShellProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center border-b border-border bg-card px-4">
        <BrandHomeLink />

        <div className="ml-auto flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Settings"
                aria-haspopup="dialog"
                aria-expanded={settingsOpen}
                onClick={() => setSettingsOpen(true)}
              >
                <Settings />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Settings</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <HomeRail currentPath={currentPath} />
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</div>
      </div>

      <HomeSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
