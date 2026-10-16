import { useEffect, useState, type ComponentType } from 'react';
import {
  Boxes,
  Check,
  Link as LinkIcon,
  Loader2,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PencilLine,
  Play,
  Save,
  Settings,
  Workflow,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { BrandHomeLink } from '@/components/brand/BrandMark';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { OPEN_SOURCE_CONTROL_EVENT, type OpenSourceControlDetail } from '@/lib/git-events';
import { OPEN_SETTINGS_EVENT, type OpenSettingsEventDetail } from '@/lib/settings-events';
import { useProject } from '@/hooks/useProject';
import { ApiError, createShare, type ShareSnapshot } from '@/lib/api-client';
import { resolveDeploymentCapabilities } from '@/lib/deployment-capabilities';
import { useEditorStore } from '@/stores/editor-store';
import { isProjectDirty, useProjectStore } from '@/stores/project-store';
import { useSandboxStore } from '@/stores/sandbox-store';
import { useThemeStore } from '@/stores/theme-store';
import { DesignSystemBrowserDialog } from './DesignSystemBrowserDialog';
import { GitGraphDialog } from './GitGraphDialog';
import { HandoffMenu } from './HandoffMenu';
import { ModeTabs } from './ModeTabs';
import {
  PanelVisibilityControls,
  type PanelVisibilityControlsProps,
} from './PanelVisibilityControls';
import { SettingsDialog, type SettingsSection } from './SettingsDialog';
import { SourceControlPanel } from './git/SourceControlPanel';

const DEPLOYMENT_CAPABILITIES = resolveDeploymentCapabilities(
  import.meta.env.VITE_SBER_DESIGNER_DEPLOYMENT_MODE,
);

/**
 * Top bar: brand · view tabs · mode tabs · Save / server Share / Design System /
 * panel visibility / Settings.
 *
 * Git status, project path, and Git entry points live in the bottom StatusBar.
 * TopBar owns the Source Control panel + Git Graph dialog, opened by the single
 * OPEN_SOURCE_CONTROL_EVENT the footer dispatches.
 */
export function TopBar({
  panelControls,
  demoControls,
}: {
  panelControls?: PanelVisibilityControlsProps;
  demoControls?: {
    fullscreen: boolean;
    screensPanelHidden: boolean;
    screensPanelToggleDisabled: boolean;
    onFullscreenChange: (fullscreen: boolean) => void;
    onScreensPanelHiddenChange: (hidden: boolean) => void;
  };
}) {
  const view = useEditorStore((s) => s.view);
  const canvasView = useEditorStore((s) => s.canvasView);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<SettingsSection>('general');
  const [designSystemOpen, setDesignSystemOpen] = useState(false);
  const [sourceControlOpen, setSourceControlOpen] = useState(false);
  const [gitGraphOpen, setGitGraphOpen] = useState(false);
  // DS Browser is a beta module, hidden by default; the switch lives in
  // Settings → General (browser-local preference, see CLAUDE.md rule 11).
  const dsBrowserEnabled = useThemeStore((s) => s.dsBrowserEnabled);

  const project = useProjectStore((s) => s.project);
  const dirty = useProjectStore(isProjectDirty);
  const saving = useProjectStore((s) => s.saving);
  const saveError = useProjectStore((s) => s.saveError);
  const { save } = useProject();

  useEffect(() => {
    const onOpenSettings = (event: Event) => {
      const detail = (event as CustomEvent<OpenSettingsEventDetail>).detail;
      setSettingsInitialSection(detail?.section ?? 'general');
      setSettingsOpen(true);
    };
    window.addEventListener(OPEN_SETTINGS_EVENT, onOpenSettings);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, onOpenSettings);
  }, []);

  useEffect(() => {
    const onOpenSourceControl = (event: Event) => {
      const section = (event as CustomEvent<OpenSourceControlDetail>).detail?.section ?? 'changes';
      if (section === 'graph') setGitGraphOpen(true);
      else setSourceControlOpen(true);
    };
    window.addEventListener(OPEN_SOURCE_CONTROL_EVENT, onOpenSourceControl);
    return () => window.removeEventListener(OPEN_SOURCE_CONTROL_EVENT, onOpenSourceControl);
  }, []);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
      <div className="flex min-w-0 items-center gap-2">
        <BrandHomeLink title="Back to all projects" />
        <ViewTabs />
      </div>

      <div className="flex flex-1 justify-center">
        {view === 'edit' && canvasView === 'screen' && <ModeTabs />}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {view === 'demo' ? (
          <>
            {DEPLOYMENT_CAPABILITIES.canShareProjects && <ShareButton />}
            {demoControls && <DemoScreensPanelButton {...demoControls} />}
            {demoControls && <DemoFullscreenButton {...demoControls} />}
            <SettingsButton
              onOpen={() => {
                setSettingsInitialSection('general');
                setSettingsOpen(true);
              }}
            />
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void save()}
              disabled={!project || (!dirty && !saveError) || saving}
              title={dirty ? 'Save project (.sdproj)' : 'Project saved'}
            >
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              {dirty ? 'Save' : 'Saved'}
            </Button>
            {DEPLOYMENT_CAPABILITIES.canShareProjects && <ShareButton />}
            {dsBrowserEnabled && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDesignSystemOpen(true)}
                disabled={!project?.workspacePath}
                title={
                  !project?.workspacePath
                    ? 'Connect a repo to open Design System Browser'
                    : undefined
                }
              >
                <Boxes />
                DS Browser
              </Button>
            )}
            {panelControls && <PanelVisibilityControls {...panelControls} />}
            {DEPLOYMENT_CAPABILITIES.canOpenProjectInHostApps && project?.workspacePath && (
              <HandoffMenu workspacePath={project.workspacePath} projectName={project.name} />
            )}
            <SettingsButton
              onOpen={() => {
                setSettingsInitialSection('general');
                setSettingsOpen(true);
              }}
            />
          </>
        )}
      </div>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        initialSection={settingsInitialSection}
      />
      {dsBrowserEnabled && (
        <DesignSystemBrowserDialog open={designSystemOpen} onOpenChange={setDesignSystemOpen} />
      )}
      <SourceControlPanel open={sourceControlOpen} onOpenChange={setSourceControlOpen} />
      <GitGraphDialog open={gitGraphOpen} onOpenChange={setGitGraphOpen} />
    </header>
  );
}

function DemoScreensPanelButton({
  screensPanelHidden,
  screensPanelToggleDisabled,
  onScreensPanelHiddenChange,
}: {
  screensPanelHidden: boolean;
  screensPanelToggleDisabled: boolean;
  onScreensPanelHiddenChange: (hidden: boolean) => void;
}) {
  const label = screensPanelToggleDisabled
    ? 'Exit fullscreen to pin screens panel'
    : screensPanelHidden
      ? 'Show screens panel'
      : 'Hide screens panel';
  const Icon = screensPanelHidden ? PanelLeftOpen : PanelLeftClose;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={screensPanelHidden ? 'secondary' : 'ghost'}
          size="icon-sm"
          aria-label={label}
          aria-pressed={screensPanelHidden}
          disabled={screensPanelToggleDisabled}
          onClick={() => onScreensPanelHiddenChange(!screensPanelHidden)}
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function DemoFullscreenButton({
  fullscreen,
  onFullscreenChange,
}: {
  fullscreen: boolean;
  onFullscreenChange: (fullscreen: boolean) => void;
}) {
  const label = fullscreen ? 'Exit fullscreen demo' : 'Enter fullscreen demo';
  const Icon = fullscreen ? Minimize2 : Maximize2;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={fullscreen ? 'secondary' : 'ghost'}
          size="icon-sm"
          aria-label={label}
          aria-pressed={fullscreen}
          onClick={() => onFullscreenChange(!fullscreen)}
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function SettingsButton({ onOpen }: { onOpen: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={onOpen} aria-label="Settings">
          <Settings />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Settings</TooltipContent>
    </Tooltip>
  );
}

function ShareButton() {
  const session = useSandboxStore((s) => s.session);
  const project = useProjectStore((s) => s.project);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = !session || !project || project.screens.length === 0;

  const handleClick = async () => {
    if (disabled || busy) return;
    // Optional password gate (Phase 6.3). Empty string = no password.
    const pwRaw = window.prompt(
      'Optional password for this share (4–128 chars). Leave blank for an open link.',
      '',
    );
    if (pwRaw === null) return; // user cancelled
    const password = pwRaw.trim();
    if (password && (password.length < 4 || password.length > 128)) {
      setError('Password must be 4–128 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const snap: ShareSnapshot = await createShare(password ? { password } : {});
      const origin = window.location.origin;
      const url = `${origin}/share/${encodeURIComponent(snap.token)}`;
      // When a password is set, copy both — the recipient needs the
      // password to unlock. Sent as plain text on a separate line so
      // the user can decide whether to send it via the same channel.
      const clipboard = password ? `${url}\nPassword: ${password}` : url;
      await navigator.clipboard.writeText(clipboard).catch(() => undefined);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `${err.code ?? 'error'}: ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void handleClick()}
      disabled={disabled || busy}
      title={
        disabled
          ? 'Add at least one screen, then share'
          : copied
            ? 'Link copied to clipboard'
            : 'Create read-only share link'
      }
    >
      {busy ? <Loader2 className="animate-spin" /> : copied ? <Check /> : <LinkIcon />}
      {error ? 'Retry share' : copied ? 'Copied!' : 'Share'}
    </Button>
  );
}

function ViewTabs() {
  const view = useEditorStore((s) => s.view);
  const setView = useEditorStore((s) => s.setView);
  const tabs: {
    id: 'edit' | 'flow' | 'demo';
    label: string;
    icon: ComponentType<{ className?: string }>;
    disabled?: boolean;
  }[] = [
    { id: 'edit', label: 'Edit', icon: PencilLine },
    { id: 'flow', label: 'Flow', icon: Workflow },
    { id: 'demo', label: 'Demo', icon: Play },
  ];

  return (
    <Tabs
      value={view}
      onValueChange={(value) => setView(value as 'edit' | 'flow' | 'demo')}
      className="gap-0"
    >
      <TabsList variant="secondary" className="h-8 rounded-md border border-border bg-card p-0.5">
        {tabs.map(({ id, label, icon: Icon }) => (
          <TabsTrigger
            key={id}
            value={id}
            className="h-7 flex-none rounded-[5px] px-2.5 py-1 text-[11px]"
          >
            <Icon />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
