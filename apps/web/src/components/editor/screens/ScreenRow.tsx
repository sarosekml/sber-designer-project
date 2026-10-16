/** One screen row: selection, health badge, actions menu. */
import {
  AlertTriangle,
  ArrowRightLeft,
  Download,
  Eye,
  EyeOff,
  FilePlus2,
  ListTodo,
  Loader2,
  MoreHorizontal,
  Pencil,
  SquareStack,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import type {
  AssistantActiveRun,
  ProjectScreen,
  ProjectScreenHealthStatus,
} from '@sber-designer/shared-types';
import { screenSurface } from '@sber-designer/shared-types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { screenDisplayPath } from '@/lib/editor-location';
import { statusChipClasses } from '@/lib/status-chip';
import { cn } from '@/lib/utils';
import {
  SCREEN_TREE_CHILD_INDENT_IN_ROW,
  SCREEN_TREE_META_SLOT,
  SCREEN_TREE_NAME_SLOT,
  SCREEN_TREE_TRAILING_SLOT,
} from './screen-tree-layout';

export function ScreenRow({
  screen,
  active,
  assistantRun,
  onSelect,
  menuOpen,
  onMenuOpenChange,
  onRename,
  onMove,
  onExport,
  onDuplicate,
  onRemove,
  onSetHealth,
  taskCount,
  showVisibilityControl,
  hiddenInFlow,
  onToggleHidden,
  thumbnailPinned,
  thumbnailFeatureEnabled,
  onToggleThumbnailPinned,
}: {
  screen: ProjectScreen;
  active: boolean;
  assistantRun: AssistantActiveRun | null;
  onSelect: () => void;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onRename: () => void;
  onMove: () => void;
  onExport: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onSetHealth: (status: ProjectScreenHealthStatus) => void;
  taskCount: number;
  showVisibilityControl: boolean;
  hiddenInFlow: boolean;
  onToggleHidden: () => void;
  /** 0135: this screen is pinned as the project cover. */
  thumbnailPinned?: boolean;
  thumbnailFeatureEnabled?: boolean;
  onToggleThumbnailPinned?: (pinned: boolean) => void;
}) {
  const screenPath = screenDisplayPath(screen);
  const healthBadge = screenHealthBadge(screen);
  const currentHealth = screen.health?.status ?? 'ok';

  return (
    <li
      data-screen-id={screen.id}
      data-active-screen={active || undefined}
      className={cn(
        'group relative grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 overflow-visible rounded-md px-2 py-1.5 text-xs transition-colors',
        active
          ? 'bg-secondary text-secondary-foreground'
          : 'hover:bg-accent hover:text-accent-foreground',
        menuOpen && 'z-50',
        hiddenInFlow && 'opacity-55',
      )}
    >
      <button
        type="button"
        data-screen-select={screen.id}
        aria-pressed={active}
        onClick={onSelect}
        title={screenPath}
        className={cn(
          'flex min-w-0 w-full items-center gap-1.5 overflow-hidden rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring',
          // 0138 A1: no permanent screen icon — the name shares the dropdown's
          // 28px child axis (row px-2 + pl-5).
          SCREEN_TREE_CHILD_INDENT_IN_ROW,
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          <span className={cn(SCREEN_TREE_NAME_SLOT, 'font-medium')}>{screen.name}</span>
          {screenSurface(screen) === 'modal' && (
            <span
              className={cn(
                SCREEN_TREE_META_SLOT,
                'gap-0.5 rounded border border-border bg-muted px-1 py-0.5 text-[9px] font-medium text-muted-foreground',
              )}
              title="Modal — overlay dialog"
            >
              <SquareStack className="size-2.5" />
              Modal
            </span>
          )}
          {assistantRun && (
            <span
              className={cn(
                SCREEN_TREE_META_SLOT,
                'gap-0.5 rounded border border-primary/30 bg-primary/10 px-1 py-0.5 text-[9px] font-medium text-primary',
              )}
              title={`Assistant ${assistantRun.status}`}
            >
              <Loader2 className="size-2.5 animate-spin" />
              running
            </span>
          )}
          {healthBadge && (
            <span
              className={cn(
                SCREEN_TREE_META_SLOT,
                'gap-0.5 rounded border px-1 py-0.5 text-[9px] font-medium',
                healthBadge.className,
              )}
              title={healthBadge.reason}
            >
              <AlertTriangle className="size-2.5" />
              {healthBadge.label}
            </span>
          )}
          {taskCount > 0 && (
            <span
              className={cn(
                SCREEN_TREE_META_SLOT,
                'gap-0.5 rounded-full bg-warning/15 px-1 py-0.5 text-[9px] font-medium text-warning',
              )}
              title={`${taskCount} linked task${taskCount === 1 ? '' : 's'}`}
            >
              <ListTodo className="size-2.5" />
              {taskCount}
            </span>
          )}
        </span>
      </button>
      <div className={SCREEN_TREE_TRAILING_SLOT}>
        {showVisibilityControl && (
          <FlowVisibilityButton hidden={hiddenInFlow} onToggle={onToggleHidden} />
        )}
        <DropdownMenu open={menuOpen} onOpenChange={onMenuOpenChange}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title="Screen actions"
              className="h-6 w-6 shrink-0 rounded p-0 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-36 text-xs">
            <MenuButton
              icon={Pencil}
              label="Rename"
              onClick={() => {
                onMenuOpenChange(false);
                onRename();
              }}
            />
            <MenuButton
              icon={ArrowRightLeft}
              label="Move"
              onClick={() => {
                onMenuOpenChange(false);
                onMove();
              }}
            />
            <MenuButton
              icon={Download}
              label="Export"
              onClick={() => {
                onMenuOpenChange(false);
                onExport();
              }}
            />
            <MenuButton
              icon={FilePlus2}
              label="Duplicate"
              onClick={() => {
                onMenuOpenChange(false);
                onDuplicate();
              }}
            />
            <MenuButton
              icon={Trash2}
              label="Delete"
              danger
              onClick={() => {
                onMenuOpenChange(false);
                onRemove();
              }}
            />
            {/* Generative thumbnail off (Settings) hides the pin outright — that
                switch is the only place the feature is turned on or off. */}
            {onToggleThumbnailPinned && thumbnailFeatureEnabled !== false ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={Boolean(thumbnailPinned)}
                  onCheckedChange={(checked) => {
                    onMenuOpenChange(false);
                    onToggleThumbnailPinned(checked === true);
                  }}
                  className="text-xs"
                  title={
                    thumbnailPinned
                      ? 'Stop pinning: the cover follows the latest generated screen again'
                      : 'Use this screen as the project cover on Home'
                  }
                >
                  Set as thumbnail
                </DropdownMenuCheckboxItem>
              </>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Status
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={currentHealth}
              onValueChange={(value) => {
                onMenuOpenChange(false);
                onSetHealth(value as ProjectScreenHealthStatus);
              }}
            >
              <DropdownMenuRadioItem value="ok" className="text-xs">
                Ready
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="needs-review" className="text-xs">
                Needs review
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="broken" className="text-xs">
                Broken
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

function FlowVisibilityButton({ hidden, onToggle }: { hidden: boolean; onToggle: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      title={hidden ? 'Show screen in Flow' : 'Hide screen in Flow'}
      className="h-6 w-6 shrink-0 rounded p-0 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100"
    >
      {hidden ? <EyeOff /> : <Eye />}
    </Button>
  );
}

function screenHealthBadge(screen: ProjectScreen): {
  label: 'broken' | 'needs-review';
  reason: string;
  className: string;
} | null {
  if (!screen.health || screen.health.status === 'ok') return null;
  if (screen.health.status === 'broken') {
    return {
      label: 'broken',
      reason: screen.health.reason,
      className: statusChipClasses.destructive,
    };
  }
  return {
    label: 'needs-review',
    reason: screen.health.reason,
    className: statusChipClasses.warning,
  };
}

function MenuButton({
  icon: Icon,
  label,
  danger = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <DropdownMenuItem
      variant={danger ? 'destructive' : 'default'}
      onSelect={() => onClick()}
      className="text-xs"
    >
      <Icon />
      {label}
    </DropdownMenuItem>
  );
}

export function isActiveAssistantRunStatus(status: AssistantActiveRun['status']): boolean {
  return status === 'queued' || status === 'running' || status === 'stopping';
}
