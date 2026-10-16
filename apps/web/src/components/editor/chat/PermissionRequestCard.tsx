/** Inline permission request card for agent tool calls. */
import { AlertTriangle, Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type AgentPermissionRequest } from '@/lib/api-client';

export function PermissionRequestCard({
  request,
  activeScreen,
  remember,
  resolving,
  onRememberChange,
  onResolve,
}: {
  request: AgentPermissionRequest;
  activeScreen?: {
    name: string;
    filePath?: string | null;
    implementationFilePath?: string | null;
  } | null;
  remember: boolean;
  resolving: 'allow' | 'deny' | null;
  onRememberChange: (remember: boolean) => void;
  onResolve: (decision: 'allow' | 'deny') => void;
}) {
  const crossTarget = isCrossTargetPermission(request.resource, activeScreen);
  return (
    <div className="mx-4 mb-2 rounded-md border border-warning/35 bg-warning/10 px-3 py-2.5 text-xs">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-foreground">
            {crossTarget ? 'Cross-target permission required' : 'Permission required'}
          </div>
          <div className="mt-0.5 min-w-0 truncate text-muted-foreground">
            <span className="font-mono">{request.toolName}</span>
            {' · '}
            <span title={request.resource}>{request.resource}</span>
          </div>
          {crossTarget && (
            <p className="mt-1 text-warning-foreground">
              This run is about to edit another screen file:{' '}
              <span className="font-mono">{request.resource}</span>
              {activeScreen?.name ? ` (active screen: ${activeScreen.name})` : ''}.
            </p>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 rounded bg-background/70 px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
          {request.category} via {request.pattern}
        </div>
        <label className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          <input
            type="checkbox"
            className="size-3 shrink-0 accent-primary"
            checked={remember}
            disabled={resolving !== null}
            onChange={(event) => onRememberChange(event.currentTarget.checked)}
          />
          <span className="truncate">Always allow this session</span>
        </label>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7"
            disabled={resolving !== null}
            onClick={() => onResolve('deny')}
            title="Deny this tool call"
          >
            {resolving === 'deny' ? <Loader2 className="animate-spin" /> : <X />}
            Deny
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7"
            disabled={resolving !== null}
            onClick={() => onResolve('allow')}
            title="Approve this tool call"
          >
            {resolving === 'allow' ? <Loader2 className="animate-spin" /> : <Check />}
            Approve
          </Button>
        </div>
      </div>
    </div>
  );
}

function isCrossTargetPermission(
  resource: string,
  activeScreen:
    | {
        filePath?: string | null;
        implementationFilePath?: string | null;
      }
    | null
    | undefined,
): boolean {
  if (!activeScreen) return false;
  const normalized = normalizePath(resource);
  if (!normalized || !/\.(?:[cm]?[tj]sx?|html?)$/iu.test(normalized)) return false;
  const activeTargets = [activeScreen.filePath, activeScreen.implementationFilePath]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .map(normalizePath);
  return activeTargets.length > 0 && !activeTargets.includes(normalized);
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.?\//u, '');
}
