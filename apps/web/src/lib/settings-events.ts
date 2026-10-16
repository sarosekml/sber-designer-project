import type { SettingsSection } from '@/components/editor/SettingsDialog';

export const OPEN_SETTINGS_EVENT = 'sber-designer.open-settings';
export const AGENT_RUNTIMES_CHANGED_EVENT = 'sber-designer:agent-runtimes-changed';

export interface OpenSettingsEventDetail {
  section?: SettingsSection | undefined;
}

export function openSettings(section?: SettingsSection): void {
  window.dispatchEvent(
    new CustomEvent<OpenSettingsEventDetail>(OPEN_SETTINGS_EVENT, { detail: { section } }),
  );
}

export function notifyAgentRuntimesChanged(): void {
  window.dispatchEvent(new CustomEvent(AGENT_RUNTIMES_CHANGED_EVENT));
}
