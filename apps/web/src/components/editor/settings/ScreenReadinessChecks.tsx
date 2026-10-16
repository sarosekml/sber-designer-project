import { useState } from 'react';
import {
  SCREEN_READINESS_CATEGORIES,
  resolveScreenReadinessProfile,
  type ScreenReadinessCategoryId,
  type ScreenReadinessProfile,
  type ScreenReadinessProfileInput,
  type ScreenReadinessProfileMode,
} from '@sber-designer/shared-types';

import { updateGenerationPipelinePreferences } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/stores/editor-store';

export function ScreenReadinessChecks() {
  const legacyEnabled = useEditorStore((s) => s.agentCraftPostCheckEnabled);
  const editorProfile = useEditorStore((s) => s.screenReadiness);
  const setEditorProfile = useEditorStore((s) => s.setScreenReadiness);
  const [saveError, setSaveError] = useState<string | null>(null);
  const profile = resolveScreenReadinessProfile(editorProfile, legacyEnabled);

  const saveProfile = (nextProfile: ScreenReadinessProfileInput | ScreenReadinessProfile) => {
    const next = resolveScreenReadinessProfile(nextProfile);
    setEditorProfile(next);
    setSaveError(null);
    void updateGenerationPipelinePreferences({ screenReadiness: next }).catch((error) => {
      setSaveError(error instanceof Error ? error.message : String(error));
    });
  };

  const enabledCount = profile.enabled
    ? Object.values(profile.categories).filter(Boolean).length
    : 0;

  return (
    <div className="grid min-w-0 gap-3 text-xs">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 rounded-md border border-border bg-background px-3 py-3">
        <div className="min-w-0">
          <div className="font-medium">Screen readiness checks</div>
          <p className="mt-1 max-w-3xl text-muted-foreground">
            Deterministic checks run after agent file edits. They do not ask design questions and
            are separate from the optional direction picker and Design Jury. Blocking findings must
            be repaired before acceptance; other findings remain visible for review.
          </p>
          <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
            <MiniBadge tone="neutral">No extra questions</MiniBadge>
            <MiniBadge tone="neutral">Agent receives findings</MiniBadge>
            <MiniBadge tone="neutral">Global user setting</MiniBadge>
          </div>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-xs">
          <span className="text-muted-foreground">Enabled</span>
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={profile.enabled}
            onChange={(event) => saveProfile({ ...profile, enabled: event.currentTarget.checked })}
          />
        </label>
      </div>

      {saveError && (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-warning">
          Could not save global readiness settings: {saveError}
        </p>
      )}

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <label className="grid min-w-[12rem] gap-1">
          <span className="text-muted-foreground">Profile</span>
          <select
            className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
            value={profile.profile}
            onChange={(event) => {
              const mode = event.currentTarget.value as ScreenReadinessProfileMode;
              saveProfile({
                enabled: profile.enabled,
                profile: mode,
                ...(mode === 'custom' ? { categories: profile.categories } : {}),
              });
            }}
          >
            <option value="standard">Standard</option>
            <option value="strict">Strict</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <MiniBadge tone={profile.enabled && enabledCount > 0 ? 'ok' : 'warn'}>
          {profile.enabled ? `${enabledCount} selected` : 'disabled'}
        </MiniBadge>
      </div>
      <p className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-muted-foreground">
        {profileDescription(profile.profile)}
      </p>

      <div className="grid min-w-0 gap-2">
        {SCREEN_READINESS_CATEGORIES.map((category) => {
          const terminalRequired = category.control === 'terminal-required';
          const checked = terminalRequired || Boolean(profile.categories[category.id]);
          const executionBadge = categoryExecutionBadge(category.execution, checked);
          return (
            <label
              key={category.id}
              className={cn(
                'grid min-w-0 gap-2 rounded-md border border-border bg-background px-3 py-2',
                !profile.enabled && 'opacity-60',
              )}
            >
              <div className="flex min-w-0 items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                  checked={checked}
                  disabled={!profile.enabled || terminalRequired}
                  onChange={(event) =>
                    saveCategory(profile, category.id, event.currentTarget.checked, saveProfile)
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="font-medium">{category.label}</span>
                    <MiniBadge tone={executionBadge.tone}>{executionBadge.label}</MiniBadge>
                    {terminalRequired && <MiniBadge tone="neutral">always required</MiniBadge>}
                  </div>
                  <p className="mt-1 text-muted-foreground">{category.description}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
                    {category.checks.map((check) => (
                      <li key={check}>{check}</li>
                    ))}
                  </ul>
                  <p className="mt-2 rounded bg-muted/50 px-2 py-1.5 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">Result: </span>
                    {category.findingImpact}
                  </p>
                </div>
              </div>
              {category.ruleIds.length > 0 && (
                <div className="ml-6 grid min-w-0 gap-1.5">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Rules used by this check
                  </span>
                  <div className="flex min-w-0 flex-wrap gap-1">
                    {category.ruleIds.map((ruleId) => (
                      <MiniBadge key={ruleId} tone="neutral">
                        {ruleId}
                      </MiniBadge>
                    ))}
                  </div>
                </div>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function profileDescription(profile: ScreenReadinessProfileMode): string {
  if (profile === 'strict') {
    return 'Strict enables every category and promotes design-system and operational should-fix findings to blocking. Planned categories still report skipped until their runners are connected.';
  }
  if (profile === 'custom') {
    return 'Custom runs only the categories selected below. Disabling a category removes its findings from the craft result; it does not remove independent terminal safety gates.';
  }
  return 'Standard runs the active source, design-system, data, UX-state and accessibility baseline. Most design and UX findings remain reviewable instead of blocking the whole run.';
}

function categoryExecutionBadge(
  execution: (typeof SCREEN_READINESS_CATEGORIES)[number]['execution'],
  checked: boolean,
): { label: string; tone: 'ok' | 'warn' | 'neutral' } {
  if (execution === 'runtime-separate') return { label: 'runtime gate', tone: 'warn' };
  if (execution === 'planned') return { label: 'planned · skipped', tone: 'warn' };
  return checked ? { label: 'active', tone: 'ok' } : { label: 'disabled', tone: 'neutral' };
}

function saveCategory(
  profile: ScreenReadinessProfile,
  category: ScreenReadinessCategoryId,
  enabled: boolean,
  saveProfile: (profile: ScreenReadinessProfileInput | ScreenReadinessProfile) => void,
) {
  saveProfile({
    enabled: profile.enabled,
    profile: 'custom',
    categories: {
      ...profile.categories,
      [category]: enabled,
    },
  });
}

function MiniBadge({
  tone,
  children,
}: {
  tone: 'ok' | 'warn' | 'neutral';
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 max-w-[14rem] items-center rounded px-1.5 text-[10px] font-medium uppercase tracking-wide',
        tone === 'ok' && 'bg-success/10 text-success',
        tone === 'warn' && 'bg-warning/10 text-warning',
        tone === 'neutral' && 'bg-muted text-muted-foreground',
      )}
      title={typeof children === 'string' ? children : undefined}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}
