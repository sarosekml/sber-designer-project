/**
 * Settings dialog shell: section navigation and panel routing. Section
 * panels live in ./settings/* and the pure logic in @/lib/settings-logic
 * (task 0078, KT3a); this file re-exports the public surface so existing
 * imports of ./SettingsDialog (including the co-located test) keep working.
 */
import { useEffect, useMemo, useState } from 'react';
import { listVisibleModels } from '@sber-designer/llm-gateway';
import {
  Boxes,
  FileText,
  GitPullRequestArrow,
  Info,
  Link2,
  ListChecks,
  MonitorCog,
  Settings2,
  Sparkles,
  Terminal,
  Workflow,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEditorStore } from '@/stores/editor-store';
import { useProjectStore } from '@/stores/project-store';
import {
  type SettingsSection,
  SYSTEM_SETTINGS_SECTION_IDS,
  normalizeEnabledProviderIds,
  readEnabledProviderIds,
  resolveActiveAfterProviderEnablement,
  writeEnabledProviderIds,
} from '@/lib/settings-logic';
import { ProjectSettingsPanel } from './settings/project';
import { AgentKitPanel } from './AgentKitPanel';
import { LlmProvidersSettingsPanel } from './settings/providers';
import { GeneralSettingsPanel } from './settings/general';
import { McpServersSettingsPanel } from './settings/mcp-servers';
import { GenerationPipelineSettings } from './settings/GenerationPipelineSettings';
import { AboutSettingsPanel } from './settings/about';

export {
  ASSET_PACK_OUTSIDE_WORKSPACE_WARNING,
  ASSET_PACK_SOURCE_HINT,
  DEFAULT_ASSET_PACK_NAME,
  DEFAULT_ICON_SOURCE_NAME,
  ICON_SOURCE_HINT,
  normalizeAssetPackKinds,
  normalizeEnabledProviderIds,
  resolveActiveAfterProviderEnablement,
  resolveAssetFolderPickerInitialPath,
  resolveAssetPackSourceWarning,
  resolveIconSourceMode,
  resolveInitialAssetPackState,
  resolveInitialIconSourceState,
  resolveNextExternalAssetSources,
  resolveNextAssetPackSettings,
  type SettingsSection,
} from '@/lib/settings-logic';

const SETTINGS_SECTIONS: {
  id: SettingsSection;
  label: string;
  description: string;
  icon: typeof FileText;
}[] = [
  {
    id: 'general',
    label: 'General',
    description: 'Theme and product preferences',
    icon: Settings2,
  },
  {
    id: 'llm',
    label: 'LLM providers',
    description: 'API providers and local CLI agents',
    icon: Terminal,
  },
  {
    id: 'agent',
    label: 'Agent kit',
    description: '.agents prompts, skills, docs',
    icon: Sparkles,
  },
  {
    id: 'generation',
    label: 'Harness setup',
    description: 'Defaults, review, and readiness',
    icon: Workflow,
  },
  {
    id: 'mcp',
    label: 'MCP servers',
    description: 'API tool servers and permissions',
    icon: Link2,
  },
  {
    id: 'project',
    label: 'Project',
    description: 'Name, workspace, export templates',
    icon: MonitorCog,
  },
  {
    id: 'indexing',
    label: 'Indexing',
    description: 'DESIGN.md and agent context',
    icon: Boxes,
  },
  {
    id: 'git',
    label: 'Git and PR',
    description: 'Workspace branch workflow',
    icon: GitPullRequestArrow,
  },
  {
    id: 'tasks',
    label: 'Task tracker',
    description: 'Linear and Jira task sources',
    icon: ListChecks,
  },
  {
    id: 'about',
    label: 'About',
    description: 'Version, build, author, and license',
    icon: Info,
  },
];

const SETTINGS_GROUPS: {
  label: string;
  sectionIds: SettingsSection[];
}[] = [
  {
    label: 'System',
    sectionIds: [...SYSTEM_SETTINGS_SECTION_IDS],
  },
  {
    label: 'Project',
    sectionIds: ['project', 'indexing', 'git', 'tasks'],
  },
];

const SETTINGS_SECTION_BY_ID = new Map(SETTINGS_SECTIONS.map((section) => [section.id, section]));

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSection?: SettingsSection;
  scope?: 'all' | 'system';
}

/**
 * Settings → LLM providers. Picks the active (provider, model) pair.
 *
 * Layout choices follow Builder.io Fusion's "Settings → Advanced → AI"
 * (one dropdown for the active model, plus admin-restrict notice) but
 * the data model is opencode-style: providers come from
 * sber-designer.json, env-vars resolved server-side. See ADR-0005.
 *
 * Local CLI providers use their own installed auth and stream through
 * /api/chat/stream; API providers still route through llm-gateway.
 */

export function SettingsDialog({
  open,
  onOpenChange,
  initialSection,
  scope = 'all',
}: SettingsDialogProps) {
  const [section, setSection] = useState<SettingsSection>('general');
  const visibleGroups =
    scope === 'system'
      ? SETTINGS_GROUPS.filter((group) => group.label === 'System')
      : SETTINGS_GROUPS;
  const config = useEditorStore((s) => s.config);
  const configError = useEditorStore((s) => s.configError);
  const active = useEditorStore((s) => s.active);
  const setActive = useEditorStore((s) => s.setActive);
  const project = useProjectStore((s) => s.project);
  const patchProject = useProjectStore((s) => s.patch);
  const providerKeys = useMemo(() => (config ? Object.keys(config.provider) : []), [config]);
  const providerKeysKey = providerKeys.join('|');
  const [enabledProvidersSnapshot, setEnabledProvidersSnapshot] = useState<{
    providerKeysKey: string;
    ids: string[];
  }>({ providerKeysKey: '', ids: [] });
  const enabledProvidersReady = enabledProvidersSnapshot.providerKeysKey === providerKeysKey;
  const enabledProviderIds = enabledProvidersReady ? enabledProvidersSnapshot.ids : [];

  useEffect(() => {
    if (!open) return;
    setSection((current) => {
      const requested = initialSection ?? current;
      return scope === 'system' && !isSystemSettingsSection(requested) ? 'general' : requested;
    });
  }, [initialSection, open, scope]);

  useEffect(() => {
    setEnabledProvidersSnapshot({
      providerKeysKey,
      ids: readEnabledProviderIds(providerKeys),
    });
  }, [providerKeys, providerKeysKey]);

  const allModels = useMemo(() => (config ? listVisibleModels(config) : []), [config]);
  const models = useMemo(
    () => allModels.filter((model) => enabledProviderIds.includes(model.provider)),
    [allModels, enabledProviderIds],
  );

  useEffect(() => {
    const nextActive = resolveActiveAfterProviderEnablement({
      active,
      configLoaded: config !== null,
      enabledProviderIds,
      enabledProvidersReady,
      models,
    });
    if (nextActive !== undefined) setActive(nextActive);
  }, [active, config, enabledProviderIds, enabledProvidersReady, models, setActive]);

  const setProviderEnabled = (providerId: string, enabled: boolean) => {
    setEnabledProvidersSnapshot((snapshot) => {
      const current =
        snapshot.providerKeysKey === providerKeysKey
          ? snapshot.ids
          : readEnabledProviderIds(providerKeys);
      const known = providerKeys.length > 0 ? providerKeys : current;
      const normalized = normalizeEnabledProviderIds(current, known);
      const next = enabled
        ? [...normalized, providerId]
        : normalized.filter((id) => id !== providerId);
      const unique = normalizeEnabledProviderIds(next, known);
      writeEnabledProviderIds(unique);
      return { providerKeysKey, ids: unique };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[min(900px,calc(100vh-2rem))] w-[min(1380px,calc(100vw-2rem))] max-w-none overflow-hidden p-0">
        <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[250px_minmax(0,1fr)] md:grid-rows-1">
          <aside className="min-h-0 border-b border-border bg-muted/30 px-4 py-4 md:flex md:flex-col md:border-b-0 md:border-r md:py-6">
            <DialogHeader className="mb-4 text-left md:mb-6">
              <DialogTitle>Settings</DialogTitle>
              <DialogDescription className="text-xs leading-relaxed">
                {scope === 'system'
                  ? 'Agent, generation, model, tool, and product preferences.'
                  : 'Project controls, LLM providers, and product preferences.'}
              </DialogDescription>
            </DialogHeader>

            <Tabs
              orientation="vertical"
              value={section}
              onValueChange={(value) => setSection(value as SettingsSection)}
              className="gap-0"
            >
              <TabsList
                aria-label="Settings sections"
                className="grid h-auto w-full gap-3 bg-transparent p-0"
              >
                {visibleGroups.map((group) => (
                  <div key={group.label} className="min-w-0">
                    <div className="mb-1.5 flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      <span className="truncate">{group.label}</span>
                    </div>
                    <div className="grid gap-1.5">
                      {group.sectionIds.map((sectionId) => {
                        const item = SETTINGS_SECTION_BY_ID.get(sectionId);
                        if (!item) return null;
                        const Icon = item.icon;
                        return (
                          <TabsTrigger
                            key={item.id}
                            value={item.id}
                            className="grid h-auto min-w-44 flex-none grid-cols-[20px_minmax(0,1fr)] justify-start gap-3 rounded-md px-3 py-2.5 text-left text-muted-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground md:w-full [&::after]:hidden"
                          >
                            <Icon className="mt-0.5 size-4 shrink-0" />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">
                                {item.label}
                              </span>
                              <span className="hidden truncate text-[11px] opacity-70 md:block">
                                {item.description}
                              </span>
                            </span>
                          </TabsTrigger>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </TabsList>
            </Tabs>
          </aside>

          <section className="min-h-0 min-w-0 overflow-y-auto px-4 py-5 md:px-8 md:py-7">
            <SettingsSectionHeader section={section} />
            {section === 'llm' ? (
              <LlmProvidersSettingsPanel
                configError={configError}
                active={active}
                setActive={setActive}
                models={models}
                enabledProviderIds={enabledProviderIds}
                onProviderEnabledChange={setProviderEnabled}
              />
            ) : section === 'mcp' ? (
              <McpServersSettingsPanel />
            ) : section === 'general' ? (
              <GeneralSettingsPanel />
            ) : section === 'agent' ? (
              <AgentKitPanel />
            ) : section === 'generation' ? (
              <GenerationPipelineSettings />
            ) : section === 'about' ? (
              <AboutSettingsPanel />
            ) : (
              <ProjectSettingsPanel
                project={project}
                onPatchProject={patchProject}
                section={section}
                onClose={() => onOpenChange(false)}
              />
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SettingsSectionHeader({ section }: { section: SettingsSection }) {
  const item = SETTINGS_SECTION_BY_ID.get(section) ?? SETTINGS_SECTIONS[0]!;
  const Icon = item.icon;
  return (
    <div className="mb-6 flex min-w-0 items-start gap-3">
      <Icon className="mt-1 size-5 shrink-0 text-primary" />
      <div className="min-w-0">
        <h2 className="text-xl font-semibold tracking-tight">{item.label}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
      </div>
    </div>
  );
}

function isSystemSettingsSection(section: SettingsSection): boolean {
  return (SYSTEM_SETTINGS_SECTION_IDS as readonly SettingsSection[]).includes(section);
}
