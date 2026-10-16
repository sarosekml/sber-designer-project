import { ChevronDown, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AgentKitInventory } from '@/lib/api-client';

export function AgentSelectorDropdown({
  agents,
  activeAgent,
  pinnedSubagentName,
  disabled,
  title,
  onSelect,
}: {
  agents: AgentKitInventory['agents'];
  activeAgent: AgentKitInventory['agents'][number] | null;
  pinnedSubagentName: string | null;
  disabled?: boolean;
  title?: string;
  onSelect: (agentName: string) => void;
}) {
  const primaries = agents.filter((agent) => agent.mode === 'primary' || agent.mode === 'all');
  const subagents = agents.filter((agent) => agent.mode === 'subagent');
  const activeName = activeAgent?.name ?? 'ai-product-designer';
  const activeMode = pinnedSubagentName ? 'subagent' : (activeAgent?.mode ?? 'primary');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-7 min-w-0 justify-start px-2 text-left text-[11px] text-muted-foreground disabled:cursor-default"
          title={title}
          aria-label="Active agent"
        >
          <Sparkles className="size-3 shrink-0 text-primary" />
          <span className="truncate font-mono text-foreground">{activeName}</span>
          <span className="shrink-0 rounded bg-muted px-1 font-mono uppercase">{activeMode}</span>
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuRadioGroup value={activeName} onValueChange={onSelect}>
          {primaries.length > 0 && (
            <DropdownMenuLabel className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Primary
            </DropdownMenuLabel>
          )}
          {primaries.map((agent) => (
            <DropdownMenuRadioItem key={agent.name} value={agent.name} className="text-xs">
              <span className="truncate font-mono">{agent.name}</span>
            </DropdownMenuRadioItem>
          ))}
          {subagents.length > 0 && (
            <>
              {primaries.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Subagents
              </DropdownMenuLabel>
              {subagents.map((agent) => (
                <DropdownMenuRadioItem key={agent.name} value={agent.name} className="text-xs">
                  <span className="truncate font-mono">{agent.name}</span>
                </DropdownMenuRadioItem>
              ))}
            </>
          )}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
