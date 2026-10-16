/**
 * Component tab (task 0133): the params a library component declares, filled in
 * from the props this usage passes. Editing a control writes the prop straight
 * into the screen source — no draft footer, because a prop change only becomes
 * visible once the component re-renders from the file.
 */
import {
  AlertTriangle,
  Loader2,
  MousePointerClick,
  RotateCcw,
  Search,
  Sparkles,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { useChat } from '@/hooks/useChat';
import {
  buildComponentParamsModel,
  canResetComponentParam,
  componentParamChange,
  effectiveParamValue,
  isValidNumberParamValue,
  isParamValueChanged,
  type ComponentParamRow,
} from '@/lib/component-params';
import type { DesignInspectResult } from '@/lib/design-types';
import { cn } from '@/lib/utils';
import { useAssistantRunStore } from '@/stores/assistant-run-store';
import { useChatStore } from '@/stores/chat-store';
import { useDesignStore } from '@/stores/design-store';

import { buildFallbackPrompt, InlineNotice, ReadOnlyRow, Section } from './shared';

/** Above this many params the list gets a filter box. */
const FILTER_THRESHOLD = 12;
const TEXT_APPLY_DEBOUNCE_MS = 350;

export function ComponentTab({
  info,
  workspacePath,
  screenId,
  onReload,
}: {
  info: DesignInspectResult;
  workspacePath?: string;
  screenId?: string;
  onReload: () => Promise<void>;
}) {
  const paramOverrides = useDesignStore((s) => s.paramOverrides);
  const paramStatus = useDesignStore((s) => s.paramStatus);
  const paramError = useDesignStore((s) => s.paramError);
  const applyComponentParam = useDesignStore((s) => s.applyComponentParam);
  const { send } = useChat();
  const runPending = useChatStore((s) => s.pending);
  const activeScreenRun = useAssistantRunStore((s) =>
    screenId
      ? Object.values(s.runs).some(
          (run) =>
            run.screenId === screenId &&
            (run.status === 'queued' || run.status === 'running' || run.status === 'stopping'),
        )
      : false,
  );
  const [filter, setFilter] = useState('');

  const instance = info.componentInstance;
  const model = buildComponentParamsModel(instance, paramOverrides);

  if (model.status === 'unavailable') {
    return (
      <InlineNotice
        icon={MousePointerClick}
        title="No component selected"
        detail={model.reason ?? ''}
      />
    );
  }

  const setParam = (row: ComponentParamRow, value: string | null) => {
    if (!instance?.baseline || !isParamValueChanged(row, value)) return;
    applyComponentParam({
      ...(workspacePath ? { workspacePath } : {}),
      ...(screenId ? { screenId } : {}),
      target: info.target,
      baseline: instance.baseline,
      prop: row.prop,
      value,
      change: componentParamChange({
        instance,
        targetId: info.target.id,
        prop: row.prop,
        control: row.control,
        value,
      }),
      reload: onReload,
    });
  };

  const query = filter.trim().toLowerCase();
  const visibleRows = query
    ? model.rows.filter(
        (row) => row.prop.toLowerCase().includes(query) || row.label?.toLowerCase().includes(query),
      )
    : model.rows;
  const writeBlockedByRun = runPending || activeScreenRun;
  const controlsDisabled = model.status === 'locked' || writeBlockedByRun;

  return (
    <div className="grid gap-4">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-foreground">{model.componentName}</div>
        <div
          className="mt-0.5 truncate text-[10px] text-muted-foreground"
          title={model.definitionFilePath}
        >
          {model.componentId
            ? `Library component · ${model.definitionFilePath ?? 'source unresolved'}`
            : (model.definitionFilePath ?? 'Project component')}
        </div>
      </div>

      {model.status === 'locked' && (
        <InlineNotice
          tone="warning"
          icon={AlertTriangle}
          title="Shared component usage"
          detail={model.reason ?? ''}
        />
      )}
      {paramError && (
        <InlineNotice
          tone="error"
          icon={AlertTriangle}
          title="Could not write the param"
          detail={paramError}
        />
      )}
      {writeBlockedByRun && model.status !== 'locked' && (
        <InlineNotice
          icon={Loader2}
          spin
          title="Assistant run in progress"
          detail="Param controls are paused while a run can write to this screen."
        />
      )}
      {model.hasSpread && model.status === 'ready' && (
        <InlineNotice
          tone="warning"
          icon={AlertTriangle}
          title="Spread props on this usage"
          detail="A spread may override these values at runtime; the written prop still lands in source."
        />
      )}

      {model.status === 'no-params' ? (
        <InlineNotice
          icon={AlertTriangle}
          title="No editable params detected"
          detail="This component exposes no simple props in its source or stories. Use Options for raw attributes, or ask the assistant."
        />
      ) : (
        <Section title={`Params${paramStatus === 'applying' ? ' · saving' : ''}`}>
          {model.rows.length > FILTER_THRESHOLD && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
              <input
                value={filter}
                onChange={(event) => setFilter(event.currentTarget.value)}
                placeholder="Filter params"
                className="h-8 w-full rounded-md border border-input bg-background pl-7 pr-2 text-xs outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          )}
          {visibleRows.map((row) => (
            <ParamControl
              key={row.prop}
              row={row}
              disabled={controlsDisabled}
              onChange={(value) => setParam(row, value)}
            />
          ))}
          {visibleRows.length === 0 && (
            <p className="text-xs text-muted-foreground">No params match this filter.</p>
          )}
        </Section>
      )}

      {model.otherProps.length > 0 && (
        <Section title="Other props from code">
          {model.otherProps.map((prop) => (
            <ReadOnlyRow
              key={prop.name}
              label={`${prop.name}${prop.value === null ? '' : `="${prop.value}"`}`}
              reason="Not declared in the component schema — edit it in Options."
            />
          ))}
        </Section>
      )}

      <Button
        size="sm"
        variant="outline"
        disabled={writeBlockedByRun}
        onClick={() =>
          void send(
            buildFallbackPrompt(
              info,
              `Change props on the <${model.componentName}> usage in ${model.instanceFilePath ?? 'the active screen'}.`,
            ),
          )
        }
      >
        <Sparkles className="size-3.5" />
        Ask Assistant
      </Button>
    </div>
  );
}

function ParamControl({
  row,
  disabled,
  onChange,
}: {
  row: ComponentParamRow;
  disabled: boolean;
  onChange: (value: string | null) => void;
}) {
  const locked = disabled || row.locked;
  const isSet = row.value !== null;
  const canReset = canResetComponentParam(row) && !disabled;
  return (
    <div className="grid gap-1">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs">
          <span className="truncate font-medium text-muted-foreground" title={row.prop}>
            {row.label ?? row.prop}
          </span>
          {row.required && (
            <span className="shrink-0 rounded bg-warning/15 px-1 text-[9px] uppercase text-warning">
              required
            </span>
          )}
          {!isSet && row.defaultValue !== undefined && (
            <span className="shrink-0 rounded bg-muted px-1 text-[9px] uppercase text-muted-foreground">
              default
            </span>
          )}
        </span>
        {canReset && (
          <button
            type="button"
            title="Reset to the component default"
            onClick={() => onChange(null)}
            className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <RotateCcw className="size-3" />
          </button>
        )}
      </div>

      {row.locked ? (
        <ReadOnlyRow
          label={row.value ?? 'expression'}
          reason={row.lockedReason ?? 'Set from an expression in code.'}
        />
      ) : row.control === 'boolean' ? (
        <BooleanControl row={row} disabled={locked} onChange={onChange} />
      ) : row.control === 'enum' ? (
        <EnumControl row={row} disabled={locked} onChange={onChange} />
      ) : (
        <TextParamControl row={row} disabled={locked} onChange={onChange} />
      )}

      {row.description && (
        <p className="text-[10px] leading-snug text-muted-foreground">{row.description}</p>
      )}
    </div>
  );
}

function BooleanControl({
  row,
  disabled,
  onChange,
}: {
  row: ComponentParamRow;
  disabled: boolean;
  onChange: (value: string | null) => void;
}) {
  const effective = effectiveParamValue(row);
  const checked = effective === 'true';
  const label =
    row.value === null
      ? row.defaultValue === undefined
        ? 'not set'
        : `default (${checked ? 'true' : 'false'})`
      : checked
        ? 'true'
        : 'false';
  return (
    <label className="flex h-8 items-center justify-between rounded-md border border-border bg-card px-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked ? 'true' : 'false')}
      />
    </label>
  );
}

function TextParamControl({
  row,
  disabled,
  onChange,
}: {
  row: ComponentParamRow;
  disabled: boolean;
  onChange: (value: string | null) => void;
}) {
  const [draft, setDraft] = useState(row.value ?? '');
  const [invalid, setInvalid] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const isValid = (value: string) => row.control !== 'number' || isValidNumberParamValue(value);
  const commit = (value: string) => {
    clearTimer();
    if (!isValid(value)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onChange(value);
  };

  useEffect(() => {
    setDraft(row.value ?? '');
    setInvalid(false);
  }, [row.value]);

  useEffect(
    () => () => {
      clearTimer();
    },
    [],
  );

  return (
    <div className="grid gap-1">
      <input
        type="text"
        inputMode={row.control === 'number' ? 'decimal' : undefined}
        value={draft}
        disabled={disabled}
        placeholder={row.defaultValue ?? ''}
        aria-invalid={invalid || undefined}
        onChange={(event) => {
          const next = event.currentTarget.value;
          setDraft(next);
          clearTimer();
          const valid = isValid(next);
          setInvalid(!valid);
          if (!valid) return;
          timer.current = setTimeout(() => commit(next), TEXT_APPLY_DEBOUNCE_MS);
        }}
        onBlur={() => {
          if (isValid(draft)) commit(draft);
          else {
            clearTimer();
            setDraft(row.value ?? '');
            setInvalid(false);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          } else if (event.key === 'Escape') {
            clearTimer();
            setDraft(row.value ?? '');
            setInvalid(false);
            event.currentTarget.blur();
          }
        }}
        className={cn(
          'h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus:ring-1 disabled:opacity-50',
          invalid ? 'border-destructive focus:ring-destructive' : 'border-input focus:ring-ring',
        )}
      />
      {invalid && <span className="text-[10px] text-destructive">Enter a finite number.</span>}
    </div>
  );
}

/** Up to five options read better as a segmented row than as a dropdown. */
const SEGMENT_LIMIT = 5;

function EnumControl({
  row,
  disabled,
  onChange,
}: {
  row: ComponentParamRow;
  disabled: boolean;
  onChange: (value: string | null) => void;
}) {
  if (row.options.length > SEGMENT_LIMIT) {
    return (
      <NativeSelect
        size="sm"
        className="w-full text-xs"
        value={row.value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value || null)}
      >
        <NativeSelectOption value="">
          {row.defaultValue ? `default (${row.defaultValue})` : 'not set'}
        </NativeSelectOption>
        {row.options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value} title={option.meaning}>
            {option.value}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {row.options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          title={option.meaning}
          onClick={() => onChange(option.value)}
          className={cn(
            'h-7 rounded-md border px-2 text-[11px] transition-colors disabled:opacity-50',
            row.value === option.value
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          {option.value}
        </button>
      ))}
    </div>
  );
}
