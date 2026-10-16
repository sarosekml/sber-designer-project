import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  filterModelSelectGroups,
  groupModelSelectOptions,
  modelIdFromModelSelectValue,
  normalizeModelSelectOptions,
  type ModelSelectOption,
} from '@/lib/model-select-options';
import { cn } from '@/lib/utils';

export function ModelSelect({
  value,
  options,
  onChange,
  includeDefault = false,
  placeholder = 'Select model',
  searchPlaceholder = 'Search models...',
  emptyLabel = 'No models found',
  disabled = false,
  align = 'end',
  className,
  triggerClassName,
}: {
  value: string;
  options: readonly ModelSelectOption[];
  onChange: (value: string) => void;
  includeDefault?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  align?: 'start' | 'center' | 'end';
  className?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());
  const positionFrameRef = useRef<number | null>(null);
  const normalizedOptions = useMemo(
    () => normalizeModelSelectOptions({ models: options, value, includeDefault }),
    [includeDefault, options, value],
  );
  const groups = useMemo(() => groupModelSelectOptions(normalizedOptions), [normalizedOptions]);
  const filteredGroups = useMemo(() => filterModelSelectGroups(groups, query), [groups, query]);
  const filteredOptionValues = useMemo(
    () => filteredGroups.flatMap((group) => group.options.map((option) => option.value)),
    [filteredGroups],
  );
  const selected = normalizedOptions.find((option) => option.value === value);
  const selectedLabel = selected?.label ?? placeholder;

  const focusOptionAt = useCallback(
    (index: number) => {
      if (filteredOptionValues.length === 0) return;
      const nextIndex = Math.min(Math.max(index, 0), filteredOptionValues.length - 1);
      optionRefs.current.get(filteredOptionValues[nextIndex]!)?.focus();
    },
    [filteredOptionValues],
  );

  const focusRelativeOption = useCallback(
    (currentValue: string, delta: number) => {
      const currentIndex = filteredOptionValues.indexOf(currentValue);
      focusOptionAt(
        currentIndex < 0 ? (delta > 0 ? 0 : filteredOptionValues.length - 1) : currentIndex + delta,
      );
    },
    [filteredOptionValues, focusOptionAt],
  );

  const updatePopoverPosition = useCallback(() => {
    if (typeof window === 'undefined') return;
    const trigger = rootRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 8;
    const maxViewportWidth = Math.max(240, window.innerWidth - viewportPadding * 2);
    const width = Math.min(Math.max(rect.width, 280), maxViewportWidth);
    const preferredLeft =
      align === 'start'
        ? rect.left
        : align === 'center'
          ? rect.left + rect.width / 2 - width / 2
          : rect.right - width;
    const left = clamp(preferredLeft, viewportPadding, window.innerWidth - viewportPadding - width);
    const below = window.innerHeight - rect.bottom - viewportPadding;
    const above = rect.top - viewportPadding;
    const openAbove = below < 180 && above > below;
    const availableHeight = Math.max(160, Math.min(352, (openAbove ? above : below) - 4));
    const top = openAbove
      ? Math.max(viewportPadding, rect.top - availableHeight - 4)
      : Math.min(rect.bottom + 4, window.innerHeight - viewportPadding - availableHeight);

    const nextStyle = {
      left: Math.round(left),
      top: Math.round(top),
      width: Math.round(width),
      minWidth: Math.round(Math.min(rect.width, width)),
      maxHeight: Math.round(availableHeight),
    } satisfies CSSProperties;
    setPopoverStyle((current) => {
      if (
        current &&
        current.left === nextStyle.left &&
        current.top === nextStyle.top &&
        current.width === nextStyle.width &&
        current.minWidth === nextStyle.minWidth &&
        current.maxHeight === nextStyle.maxHeight
      ) {
        return current;
      }
      return nextStyle;
    });
  }, [align]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      if (target instanceof Node && contentRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const handleWheel = (event: WheelEvent) => {
      const content = contentRef.current;
      if (!content) return;
      const rect = content.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      if (!inside) return;
      event.preventDefault();
      event.stopPropagation();
      content.scrollTop += event.deltaY;
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('wheel', handleWheel, { capture: true, passive: false });
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('wheel', handleWheel, { capture: true });
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setPopoverStyle(null);
      return;
    }
    let cancelled = false;
    let animationFrames = 0;
    const updateDuringMenuAnimation = () => {
      updatePopoverPosition();
      animationFrames += 1;
      if (!cancelled && animationFrames < 18) {
        positionFrameRef.current = window.requestAnimationFrame(updateDuringMenuAnimation);
      }
    };
    positionFrameRef.current = window.requestAnimationFrame(updateDuringMenuAnimation);

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updatePopoverPosition) : null;
    if (resizeObserver && rootRef.current) resizeObserver.observe(rootRef.current);
    window.addEventListener('resize', updatePopoverPosition);
    window.visualViewport?.addEventListener('resize', updatePopoverPosition);
    window.visualViewport?.addEventListener('scroll', updatePopoverPosition);
    document.addEventListener('scroll', updatePopoverPosition, true);
    return () => {
      cancelled = true;
      if (positionFrameRef.current !== null) {
        window.cancelAnimationFrame(positionFrameRef.current);
        positionFrameRef.current = null;
      }
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updatePopoverPosition);
      window.visualViewport?.removeEventListener('resize', updatePopoverPosition);
      window.visualViewport?.removeEventListener('scroll', updatePopoverPosition);
      document.removeEventListener('scroll', updatePopoverPosition, true);
    };
  }, [open, updatePopoverPosition]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const popover =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={contentRef}
            role="listbox"
            data-model-select-content="true"
            className="pointer-events-auto fixed z-[1000] overflow-y-auto overscroll-contain rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md"
            style={{
              ...popoverStyle,
              visibility: popoverStyle ? 'visible' : 'hidden',
            }}
            onClick={(event) => event.stopPropagation()}
            onPointerDownCapture={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
            onTouchMove={(event) => event.stopPropagation()}
          >
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setOpen(false);
                    triggerRef.current?.focus();
                  } else if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    focusOptionAt(0);
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    focusOptionAt(filteredOptionValues.length - 1);
                  } else if (event.key === 'End') {
                    event.preventDefault();
                    focusOptionAt(filteredOptionValues.length - 1);
                  } else if (event.key === 'Home') {
                    event.preventDefault();
                    focusOptionAt(0);
                  }
                }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="h-8 pl-8 text-sm"
              />
            </div>
            {filteredGroups.length === 0 ? (
              <div className="px-2 py-3 text-sm text-muted-foreground">{emptyLabel}</div>
            ) : (
              filteredGroups.map((group, groupIndex) => (
                <div key={group.provider || 'models'}>
                  {group.provider && (
                    <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {group.provider}
                    </div>
                  )}
                  {group.options.map((option) => {
                    const active = option.value === value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={active}
                        data-model-select-option={option.value}
                        data-model-provider={(option.provider ?? group.provider) || undefined}
                        data-model-id={modelIdFromModelSelectValue(
                          option.value,
                          option.provider ?? group.provider,
                        )}
                        disabled={option.disabled}
                        ref={(node) => {
                          if (node) optionRefs.current.set(option.value, node);
                          else optionRefs.current.delete(option.value);
                        }}
                        onKeyDown={(event) => {
                          event.stopPropagation();
                          if (event.key === 'ArrowDown') {
                            event.preventDefault();
                            focusRelativeOption(option.value, 1);
                          } else if (event.key === 'ArrowUp') {
                            event.preventDefault();
                            focusRelativeOption(option.value, -1);
                          } else if (event.key === 'Home') {
                            event.preventDefault();
                            focusOptionAt(0);
                          } else if (event.key === 'End') {
                            event.preventDefault();
                            focusOptionAt(filteredOptionValues.length - 1);
                          } else if (event.key === 'Escape') {
                            event.preventDefault();
                            setOpen(false);
                            triggerRef.current?.focus();
                          }
                        }}
                        onClick={() => {
                          onChange(option.value);
                          setOpen(false);
                        }}
                        className={cn(
                          'flex w-full min-w-0 items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50',
                          active && 'bg-accent text-accent-foreground',
                        )}
                      >
                        <span className="grid min-w-0 gap-0.5">
                          <span className="min-w-0 truncate">{option.label}</span>
                          {option.description && (
                            <span className="min-w-0 truncate text-xs text-muted-foreground">
                              {option.description}
                            </span>
                          )}
                        </span>
                        {active && <Check className="size-4 shrink-0 text-primary" />}
                      </button>
                    );
                  })}
                  {groupIndex < filteredGroups.length - 1 && (
                    <div className="-mx-1 my-1 h-px bg-border" />
                  )}
                </div>
              ))
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="relative min-w-0">
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className={cn(
          'h-9 min-w-0 justify-between overflow-hidden px-3 text-left font-normal',
          className,
          triggerClassName,
        )}
      >
        <span className="min-w-0 truncate">{selectedLabel}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </Button>
      {popover}
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
