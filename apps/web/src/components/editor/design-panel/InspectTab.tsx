/** Inspect tab: live style inspection and quick visual controls. */
import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Box,
  Loader2,
  Palette,
  RotateCcw,
  Save,
  Type,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  designCapabilityAllows,
  designCapabilityReason,
  hasDesignSourceTarget,
} from '@/lib/design-capabilities';
import type { DesignInspectResult, VisualChange } from '@/lib/design-types';
import {
  colorInputValue,
  FONT_WEIGHT_OPTIONS,
  formatPxValue,
  LIVE_INSPECT_STYLE_PROPERTIES,
  postLiveInspectReset,
  postLiveInspectStyle,
  pxNumber,
  TEXT_ALIGN_OPTIONS,
  type LiveInspectStyleProperty,
} from '@/lib/live-inspect';
import { cn } from '@/lib/utils';
import { useDesignStore } from '@/stores/design-store';
import { useEditorStore } from '@/stores/editor-store';

import { draftStyleValue, Field, InlineNotice, LockedNotice, Section, targetLoc } from './shared';

const ALIGN_ICONS: Record<
  (typeof TEXT_ALIGN_OPTIONS)[number],
  React.ComponentType<{ className?: string }>
> = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
  justify: AlignJustify,
};

export function InspectTab({
  selectedInfo,
  selected,
  workspacePath,
  onReload,
}: {
  selectedInfo: DesignInspectResult;
  selected: NonNullable<ReturnType<typeof useEditorStore.getState>['selected']>;
  workspacePath?: string;
  onReload: () => Promise<void>;
}) {
  const target = selectedInfo.target;
  return (
    <div className="grid min-w-0 gap-4">
      <LiveInspectPanel
        info={selectedInfo}
        selected={selected}
        {...(workspacePath ? { workspacePath } : {})}
        onReload={onReload}
      />
      {!selectedInfo.editable && (
        <LockedNotice reason={selectedInfo.reason ?? 'This target is read-only.'} />
      )}
      <Section title="Target">
        {target.componentName && <Field label="Component" value={target.componentName} mono />}
        {target.componentLoc && (
          <Field label="Component source" value={target.componentLoc} mono wrap />
        )}
        <Field label="Tag" value={target.tagName.toLowerCase()} mono />
        <Field label="Project support" value={selectedInfo.projectSupport} mono />
        <Field label="Source scope" value={selectedInfo.sourceScope} mono />
        <Field label="Source kind" value={target.sourceKind} mono />
        {target.filePath && (
          <Field
            label="Source file"
            value={`${target.filePath}:${target.line}:${target.column}`}
            mono
            wrap
          />
        )}
        {target.selector && <Field label="Flow selector" value={target.selector} mono wrap />}
        {target.text && <Field label="Text" value={target.text} wrap />}
        {target.componentPath && target.componentPath.length > 0 && (
          <Field label="Component path" value={target.componentPath.join(' → ')} wrap />
        )}
        <Field
          label="Bounds"
          value={`${Math.round(target.rect.width)}x${Math.round(target.rect.height)}`}
          mono
        />
      </Section>
      <Section title="Capabilities">
        {Object.entries(selectedInfo.capabilities).map(([name, capability]) => (
          <div
            key={name}
            className="min-w-0 overflow-hidden rounded-md border border-border bg-card px-2 py-1.5 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-mono text-foreground">{name}</span>
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px]',
                  capability.status === 'editable'
                    ? 'bg-primary/15 text-primary'
                    : capability.status === 'unmapped'
                      ? 'bg-warning/15 text-warning'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {capability.status}
              </span>
            </div>
            {capability.operations.length > 0 && (
              <div className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                {capability.operations.join(', ')}
              </div>
            )}
            {capability.reason && (
              <div className="mt-1 text-[10px] text-muted-foreground">{capability.reason}</div>
            )}
          </div>
        ))}
      </Section>
      {selectedInfo.jsx && (
        <Section title="JSX">
          <Field label="Element" value={selectedInfo.jsx.tagName} mono />
          <Field label="Kind" value={selectedInfo.jsx.isComponent ? 'component' : 'DOM element'} />
          <Field
            label="Children"
            value={
              selectedInfo.jsx.childrenEditable === false
                ? (selectedInfo.jsx.childrenReason ?? 'read-only')
                : (selectedInfo.jsx.childrenText ?? 'none')
            }
            wrap
          />
          <div className="grid gap-1.5">
            {selectedInfo.jsx.props.length === 0 ? (
              <p className="text-xs text-muted-foreground">No props on this JSX target.</p>
            ) : (
              selectedInfo.jsx.props.map((prop) => (
                <div
                  key={`${prop.name}:${prop.kind}`}
                  className="min-w-0 overflow-hidden rounded-md border border-border bg-card px-2 py-1.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-mono text-foreground">{prop.name}</span>
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-[10px]',
                        prop.editable
                          ? 'bg-primary/15 text-primary'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {prop.editable ? prop.kind : 'locked'}
                    </span>
                  </div>
                  {prop.value !== null && (
                    <div className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                      {prop.value}
                    </div>
                  )}
                  {prop.reason && (
                    <div className="mt-1 text-[10px] text-muted-foreground">{prop.reason}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </Section>
      )}
      <Button size="sm" variant="outline" onClick={() => void onReload()} className="w-full">
        <RotateCcw className="size-3.5" />
        Reload selection
      </Button>
    </div>
  );
}

function LiveInspectPanel({
  info,
  selected,
  workspacePath,
  onReload,
}: {
  info: DesignInspectResult;
  selected: NonNullable<ReturnType<typeof useEditorStore.getState>['selected']>;
  workspacePath?: string;
  onReload: () => Promise<void>;
}) {
  const previewWindow = useDesignStore((s) => s.previewWindow);
  const changes = useDesignStore((s) => s.draftChanges);
  const upsertChange = useDesignStore((s) => s.upsertChange);
  const removeChange = useDesignStore((s) => s.removeChange);
  const applyDraft = useDesignStore((s) => s.applyDraft);
  const applyStatus = useDesignStore((s) => s.applyStatus);
  const [previewDraft, setPreviewDraft] = useState<
    Partial<Record<LiveInspectStyleProperty, string>>
  >({});
  const target = info.target;
  const loc = targetLoc(target);
  const inspectId = selected.inspectId ?? target.inspectId;
  const computedStyles = selected.computedStyles ?? target.computedStyles ?? {};
  const selectionNotice = selected.selectionNotice ?? target.selectionNotice;
  const sourceReady = hasDesignSourceTarget(info) && Boolean(target.filePath && loc);
  const styleEditable =
    sourceReady &&
    designCapabilityAllows(info, 'style', 'set-style') &&
    info.styles?.styleEditable !== false;
  const canPreview = Boolean(previewWindow && inspectId);
  const saveLockedReason = designCapabilityReason(
    info,
    ['style'],
    'This target cannot be saved through inline style edits.',
  );
  const targetLiveInspectChanges = changes.filter(
    (change): change is Extract<VisualChange, { kind: 'set-style' | 'remove-style' }> =>
      change.targetId === target.id &&
      (change.kind === 'set-style' || change.kind === 'remove-style') &&
      (LIVE_INSPECT_STYLE_PROPERTIES as readonly string[]).includes(change.property),
  );

  useEffect(() => {
    setPreviewDraft({});
  }, [target.id]);

  const setStyle = (property: LiveInspectStyleProperty, value: string, label: string) => {
    setPreviewDraft((current) => ({ ...current, [property]: value }));
    if (value) {
      const normalized = postLiveInspectStyle(previewWindow, inspectId, { [property]: value });
      const normalizedValue = normalized[property];
      if (!normalizedValue) return;
      if (!target.filePath || !loc || !styleEditable) return;
      upsertChange({
        kind: 'set-style',
        targetId: target.id,
        filePath: target.filePath,
        loc,
        property,
        value: normalizedValue,
        label,
      });
      return;
    }
    postLiveInspectReset(previewWindow, inspectId, [property]);
    if (!target.filePath || !loc || !styleEditable) return;
    upsertChange({
      kind: 'remove-style',
      targetId: target.id,
      filePath: target.filePath,
      loc,
      property,
      label,
    });
  };

  const valueFor = (property: LiveInspectStyleProperty): string =>
    previewDraft[property] ??
    draftStyleValue(changes, target.id, property) ??
    info.styles?.styleObject?.[property] ??
    computedStyles[property] ??
    '';

  return (
    <Section title="Live inspect">
      <div className="min-w-0 overflow-hidden rounded-md border border-primary/25 bg-primary/5 px-3 py-2">
        <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-foreground">
              {target.componentName ?? target.tagName.toLowerCase()}
            </div>
            <div className="truncate font-mono text-[10px] text-muted-foreground">
              {target.filePath ? `${target.filePath}:${target.line}:${target.column}` : target.loc}
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
            preview
          </span>
        </div>

        {!inspectId && (
          <InlineNotice
            tone="warning"
            icon={AlertTriangle}
            title="Live preview unavailable"
            detail="Select the element again after the preview bridge is ready."
          />
        )}
        {selectionNotice && (
          <div className="mb-2">
            <InlineNotice
              tone="warning"
              icon={AlertTriangle}
              title="Ancestor selected"
              detail={selectionNotice}
            />
          </div>
        )}
        {!styleEditable && (
          <div className="mb-2">
            <InlineNotice
              tone="warning"
              icon={AlertTriangle}
              title="Source save locked"
              detail={
                canPreview
                  ? `${saveLockedReason} You can preview styles here, but saving requires a source-backed JSX target or an Assistant patch.`
                  : `${saveLockedReason} Select the element again after the preview bridge is ready, or use Ask Assistant for a source patch.`
              }
            />
          </div>
        )}

        <div className="grid min-w-0 gap-3">
          <InspectControlGroup icon={Palette} title="Colors">
            <InspectColorControl
              label="Text"
              value={valueFor('color')}
              disabled={!canPreview}
              onChange={(value) => setStyle('color', value, 'Text color')}
            />
            <InspectColorControl
              label="Background"
              value={valueFor('backgroundColor')}
              disabled={!canPreview}
              onChange={(value) => setStyle('backgroundColor', value, 'Background color')}
            />
          </InspectControlGroup>

          <InspectControlGroup icon={Type} title="Typography">
            <InspectRangeControl
              label="Size"
              value={valueFor('fontSize')}
              min={8}
              max={96}
              disabled={!canPreview}
              onChange={(value) => setStyle('fontSize', value, 'Font size')}
            />
            <InspectDatalistControl
              label="Weight"
              value={valueFor('fontWeight')}
              options={FONT_WEIGHT_OPTIONS}
              disabled={!canPreview}
              onChange={(value) => setStyle('fontWeight', value, 'Font weight')}
            />
            <InspectAlignControl
              label="Align"
              value={valueFor('textAlign')}
              disabled={!canPreview}
              onChange={(value) => setStyle('textAlign', value, 'Text align')}
            />
          </InspectControlGroup>

          <InspectControlGroup icon={Box} title="Spacing & shape">
            <InspectRangeControl
              label="Padding"
              value={valueFor('padding')}
              min={0}
              max={96}
              disabled={!canPreview}
              onChange={(value) => setStyle('padding', value, 'Padding')}
            />
            <InspectRangeControl
              label="Margin"
              value={valueFor('margin')}
              min={-64}
              max={96}
              disabled={!canPreview}
              onChange={(value) => setStyle('margin', value, 'Margin')}
            />
            <InspectRangeControl
              label="Radius"
              value={valueFor('borderRadius')}
              min={0}
              max={80}
              disabled={!canPreview}
              onChange={(value) => setStyle('borderRadius', value, 'Radius')}
            />
          </InspectControlGroup>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-w-0"
            disabled={applyStatus === 'applying'}
            onClick={() => {
              setPreviewDraft({});
              targetLiveInspectChanges.forEach(removeChange);
              postLiveInspectReset(previewWindow, inspectId, LIVE_INSPECT_STYLE_PROPERTIES);
            }}
          >
            <RotateCcw className="size-3.5" />
            Reset element
          </Button>
          <Button
            type="button"
            size="sm"
            className="min-w-0"
            disabled={
              !styleEditable || targetLiveInspectChanges.length === 0 || applyStatus === 'applying'
            }
            title={styleEditable ? 'Save visual changes to source' : saveLockedReason}
            onClick={async () => {
              await applyDraft(workspacePath);
              if (useDesignStore.getState().applyStatus === 'success') {
                setPreviewDraft({});
                await onReload();
              }
            }}
          >
            {applyStatus === 'applying' ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            Save to source
          </Button>
        </div>
      </div>
    </Section>
  );
}

function InspectControlGroup({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-2">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase text-muted-foreground">
        <Icon className="size-3" />
        {title}
      </div>
      <div className="grid min-w-0 gap-2">{children}</div>
    </div>
  );
}

function InspectColorControl({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid min-w-0 grid-cols-[76px_34px_minmax(0,1fr)] items-center gap-2 text-xs">
      <span className="truncate text-muted-foreground" title={label}>
        {label}
      </span>
      <input
        type="color"
        value={colorInputValue(value)}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
        title={`${label} color picker`}
        className="h-7 w-8 rounded-md border border-input bg-background p-0.5 outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
      />
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="h-8 min-w-0 rounded-md border border-input bg-background px-2 font-mono text-xs outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
      />
    </label>
  );
}

function InspectRangeControl({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const sliderValue = Math.max(min, Math.min(max, pxNumber(value, min)));
  return (
    <label className="grid min-w-0 grid-cols-[76px_minmax(0,1fr)] items-center gap-2 text-xs">
      <span className="truncate text-muted-foreground" title={label}>
        {label}
      </span>
      <div className="grid min-w-0 grid-cols-[minmax(64px,1fr)_72px] items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          value={sliderValue}
          disabled={disabled}
          onChange={(event) => onChange(formatPxValue(Number(event.currentTarget.value)))}
          className="min-w-0 accent-primary disabled:opacity-50"
        />
        <input
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value)}
          className="h-8 min-w-0 rounded-md border border-input bg-background px-2 font-mono text-xs outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
        />
      </div>
    </label>
  );
}

function InspectDatalistControl({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid min-w-0 grid-cols-[76px_minmax(0,1fr)] items-center gap-2 text-xs">
      <span className="truncate text-muted-foreground" title={label}>
        {label}
      </span>
      <input
        list="live-inspect-font-weight-options"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="h-8 min-w-0 rounded-md border border-input bg-background px-2 font-mono text-xs outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
      />
      <datalist id="live-inspect-font-weight-options">
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </label>
  );
}

function InspectAlignControl({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[76px_minmax(0,1fr)] items-center gap-2 text-xs">
      <span className="truncate text-muted-foreground" title={label}>
        {label}
      </span>
      <div className="grid min-w-0 grid-cols-4 gap-1 rounded-md border border-input bg-background p-1">
        {TEXT_ALIGN_OPTIONS.map((option) => {
          const Icon = ALIGN_ICONS[option];
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              disabled={disabled}
              title={`Align ${option}`}
              onClick={() => onChange(option)}
              className={cn(
                'flex h-7 min-w-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50',
                active &&
                  'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
              )}
            >
              <Icon className="size-3.5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
