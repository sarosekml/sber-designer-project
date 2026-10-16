import { useCallback, useEffect, useMemo, useState } from 'react';
import { listVisibleModels } from '@sber-designer/llm-gateway';

import { capabilityBadgesForAgentTarget, resolveAgentModelTarget } from '@/lib/agent-model-target';
import {
  OPENCODE_RUNTIME_PROVIDER_ID,
  CLAUDE_CODE_RUNTIME_PROVIDER_ID,
  CODEX_RUNTIME_PROVIDER_ID,
  KIMI_RUNTIME_PROVIDER_ID,
  selectAgentRuntimeModel,
} from '@/lib/api-client';
import { promptAttachmentLimitsFromConfig } from '@/lib/chat-attachments';
import { providerStatusInfo } from '@/lib/provider-status';
import {
  ENABLED_PROVIDERS_CHANGED_EVENT,
  ENABLED_PROVIDERS_STORAGE_KEY,
  readEnabledProviderIds,
  runtimeKindForProvider,
} from '@/lib/settings-logic';
import { useAgentRuntimeInventory } from '@/stores/agent-runtime-store';
import { useEditorStore } from '@/stores/editor-store';

export function useChatProviderState() {
  const config = useEditorStore((state) => state.config);
  const active = useEditorStore((state) => state.active);
  const setActive = useEditorStore((state) => state.setActive);
  const [enabledProvidersRevision, setEnabledProvidersRevision] = useState(0);
  // Shared runtime inventory (0138 D4): Assistant, Settings and Annotate read
  // one deduplicated snapshot instead of racing separate fetchAgentRuntimes
  // calls. The store also owns the AGENT_RUNTIMES_CHANGED_EVENT refetch.
  const runtimeStatuses = useAgentRuntimeInventory((state) => state.statuses);
  const enabledRuntimeKinds = useAgentRuntimeInventory((state) => state.enabledKinds);
  const ensureRuntimesLoaded = useAgentRuntimeInventory((state) => state.ensureLoaded);
  const reloadRuntimes = useAgentRuntimeInventory((state) => state.reload);
  const updateRuntime = useAgentRuntimeInventory((state) => state.updateRuntime);

  useEffect(() => {
    void ensureRuntimesLoaded();
  }, [ensureRuntimesLoaded]);

  useEffect(() => {
    const refresh = () => setEnabledProvidersRevision((revision) => revision + 1);
    const refreshFromStorage = (event: StorageEvent) => {
      if (event.key === ENABLED_PROVIDERS_STORAGE_KEY) refresh();
    };
    window.addEventListener(ENABLED_PROVIDERS_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refreshFromStorage);
    return () => {
      window.removeEventListener(ENABLED_PROVIDERS_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refreshFromStorage);
    };
  }, []);

  const enabledApiProviderIds = useMemo(
    () => readEnabledProviderIds(config ? Object.keys(config.provider) : []),
    [config, enabledProvidersRevision],
  );
  const enabledApiProviderIdSet = useMemo(
    () => new Set(enabledApiProviderIds),
    [enabledApiProviderIds],
  );
  const activeProvider =
    active && config && enabledApiProviderIdSet.has(active.provider)
      ? config.provider[active.provider]
      : null;
  const runtimeActive =
    active?.provider === OPENCODE_RUNTIME_PROVIDER_ID ||
    active?.provider === CLAUDE_CODE_RUNTIME_PROVIDER_ID ||
    active?.provider === CODEX_RUNTIME_PROVIDER_ID ||
    active?.provider === KIMI_RUNTIME_PROVIDER_ID;
  const providerUnavailable = !active || (!runtimeActive && !activeProvider);
  const attachmentLimits = useMemo(() => promptAttachmentLimitsFromConfig(config), [config]);
  const apiModels = useMemo(
    () =>
      config
        ? listVisibleModels(config).filter((model) => enabledApiProviderIdSet.has(model.provider))
        : [],
    [config, enabledApiProviderIdSet],
  );
  const apiProviderStatuses = useMemo(
    () =>
      config
        ? Object.entries(config.provider)
            .filter(([providerId]) => enabledApiProviderIdSet.has(providerId))
            .map(([providerId, provider]) => {
              const status = providerStatusInfo(provider);
              return {
                providerId,
                label: provider.name,
                ...(status ? { statusLabel: status.label, statusTone: status.tone } : {}),
              };
            })
        : [],
    [config, enabledApiProviderIdSet],
  );

  const persistRuntimeModel = useCallback(
    async (provider: string, model: string) => {
      const kind = runtimeKindForProvider(provider);
      if (!kind) return;
      try {
        const response = await selectAgentRuntimeModel(kind, model);
        updateRuntime(response.runtime);
      } catch {
        // The request path reports runtime diagnostics if this preference cannot be saved.
      }
    },
    [updateRuntime],
  );

  const handleAssistantProviderChange = useCallback(
    (provider: string, model: string) => {
      setActive({ provider, model });
      void persistRuntimeModel(provider, model);
    },
    [persistRuntimeModel, setActive],
  );
  const handleAssistantModelChange = handleAssistantProviderChange;
  const agentTarget = useMemo(
    () => resolveAgentModelTarget({ config, active, runtimeStatuses }),
    [active, config, runtimeStatuses],
  );
  const capabilityBadges = useMemo(
    () => capabilityBadgesForAgentTarget(agentTarget),
    [agentTarget],
  );

  return {
    active,
    agentTarget,
    apiModels,
    apiProviderStatuses,
    attachmentLimits,
    capabilityBadges,
    enabledRuntimeKinds,
    handleAssistantModelChange,
    handleAssistantProviderChange,
    providerUnavailable,
    refreshRuntimeStatuses: reloadRuntimes,
    runtimeStatuses,
  };
}
