import {
  useRef,
  type ClipboardEventHandler,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SetStateAction,
} from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Loader2,
  PenLine,
  Redo2,
  SendHorizontal,
  Square,
  TextCursorInput,
  Type,
  Undo2,
  X,
} from 'lucide-react';

import {
  MARK_STROKE_COLOR,
  MARK_TEXT_FONT_FAMILY,
  MARK_TEXT_LINE_HEIGHT,
  markTextFontPx,
  type CanvasMarkImage,
  type MarkSubmitAction,
  type MarkTextLabel,
  type MarkTool,
} from '@/lib/canvas-mark';
import type { MarkCapabilityNotice } from '@/lib/mark-preflight';
import { cn } from '@/lib/utils';

const TOOL_OPTIONS: { tool: MarkTool; label: string; icon: typeof Square }[] = [
  { tool: 'box', label: 'Box select', icon: Square },
  { tool: 'pen', label: 'Pen', icon: PenLine },
  { tool: 'text', label: 'Text', icon: Type },
];

export function MarkTextLabels({
  labels,
  editingTextId,
  markTool,
  frameHeight,
  textWrapRefs,
  textAreaRefs,
  autosizeTextArea,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onTextChange,
  onTextBlur,
  onRemove,
}: {
  labels: MarkTextLabel[];
  editingTextId: number | null;
  markTool: MarkTool;
  frameHeight: number;
  textWrapRefs: RefObject<Map<number, HTMLDivElement>>;
  textAreaRefs: RefObject<Map<number, HTMLTextAreaElement>>;
  autosizeTextArea: (element: HTMLTextAreaElement | null) => void;
  onPointerDown: (event: ReactPointerEvent, label: MarkTextLabel) => void;
  onPointerMove: (event: ReactPointerEvent, label: MarkTextLabel) => void;
  onPointerUp: (event: ReactPointerEvent, label: MarkTextLabel) => void;
  onTextChange: (id: number, text: string) => void;
  onTextBlur: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  const fontPx = markTextFontPx(frameHeight);
  return (
    <div className="pointer-events-none absolute inset-0 z-[1]">
      {labels.map((label) => {
        const editing = editingTextId === label.id;
        return (
          <div
            key={label.id}
            ref={(element) => {
              if (element) textWrapRefs.current.set(label.id, element);
              else textWrapRefs.current.delete(label.id);
            }}
            className="group absolute"
            onPointerDown={(event) => onPointerDown(event, label)}
            onPointerMove={(event) => onPointerMove(event, label)}
            onPointerUp={(event) => onPointerUp(event, label)}
            onPointerCancel={(event) => onPointerUp(event, label)}
            style={{
              left: `${label.x * 100}%`,
              top: `${label.y * 100}%`,
              pointerEvents: markTool === 'text' ? 'auto' : 'none',
              cursor: editing ? 'default' : 'move',
              touchAction: 'none',
            }}
          >
            <textarea
              ref={(element) => {
                if (element) {
                  textAreaRefs.current.set(label.id, element);
                  autosizeTextArea(element);
                } else {
                  textAreaRefs.current.delete(label.id);
                }
              }}
              value={label.text}
              wrap="off"
              rows={1}
              spellCheck={false}
              readOnly={!editing}
              aria-label="Mark text label"
              onChange={(event) => {
                onTextChange(label.id, event.target.value);
                autosizeTextArea(event.currentTarget);
              }}
              onBlur={() => onTextBlur(label.id)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.stopPropagation();
                  event.currentTarget.blur();
                }
              }}
              className="block resize-none overflow-hidden whitespace-pre border-none bg-transparent p-0 font-semibold outline-none"
              style={{
                color: MARK_STROKE_COLOR,
                caretColor: MARK_STROKE_COLOR,
                fontFamily: MARK_TEXT_FONT_FAMILY,
                fontSize: fontPx,
                lineHeight: MARK_TEXT_LINE_HEIGHT,
                minWidth: Math.max(2, Math.round(fontPx * 0.5)),
                textShadow: '0 0 3px rgba(255,255,255,0.75)',
                pointerEvents: editing ? 'auto' : 'none',
                userSelect: editing ? 'text' : 'none',
                cursor: editing ? 'text' : 'move',
              }}
            />
            {markTool === 'text' && (
              <button
                type="button"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={() => onRemove(label.id)}
                aria-label="Remove text label"
                className="absolute -right-2 -top-2 hidden h-[15px] w-[15px] items-center justify-center rounded-full border border-border bg-background text-foreground shadow transition-colors hover:bg-accent hover:text-accent-foreground group-hover:inline-flex"
              >
                <X className="size-2" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function MarkDock({
  warning,
  capabilityNotice,
  images,
  setImages,
  sending,
  markTool,
  setMarkTool,
  toolMenuOpen,
  setToolMenuOpen,
  toolMenuRef,
  historyCounts,
  onUndo,
  onRedo,
  fileInputRef,
  addImageFiles,
  note,
  setNote,
  onNotePaste,
  submitAction,
  setSubmitAction,
  submitMenuOpen,
  setSubmitMenuOpen,
  submitMenuRef,
  canSubmit,
  canSend,
  sendDisabledReason,
  onSubmit,
}: {
  warning: string | null;
  /** Live vision preflight for the resolved target (0138 D5). */
  capabilityNotice: MarkCapabilityNotice | null;
  images: CanvasMarkImage[];
  setImages: Dispatch<SetStateAction<CanvasMarkImage[]>>;
  sending: boolean;
  markTool: MarkTool;
  setMarkTool: (tool: MarkTool) => void;
  toolMenuOpen: boolean;
  setToolMenuOpen: Dispatch<SetStateAction<boolean>>;
  toolMenuRef: RefObject<HTMLDivElement | null>;
  historyCounts: { undo: number; redo: number };
  onUndo: () => void;
  onRedo: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  addImageFiles: (files: FileList | File[] | null) => Promise<void>;
  note: string;
  setNote: (note: string) => void;
  onNotePaste: ClipboardEventHandler<HTMLInputElement>;
  submitAction: MarkSubmitAction;
  setSubmitAction: (action: MarkSubmitAction) => void;
  submitMenuOpen: boolean;
  setSubmitMenuOpen: Dispatch<SetStateAction<boolean>>;
  submitMenuRef: RefObject<HTMLDivElement | null>;
  canSubmit: boolean;
  canSend: boolean;
  sendDisabledReason: string | undefined;
  onSubmit: (action: MarkSubmitAction) => Promise<void>;
}) {
  const noteInputRef = useRef<HTMLInputElement | null>(null);
  const currentTool = TOOL_OPTIONS.find((item) => item.tool === markTool) ?? TOOL_OPTIONS[0]!;
  const CurrentToolIcon = currentTool.icon;
  const submitOptions = [
    {
      action: 'send' as const,
      label: 'Send',
      icon: SendHorizontal,
      enabled: canSend,
      title: sendDisabledReason ?? 'Send the mark to the assistant',
    },
    {
      action: 'draft' as const,
      label: 'Add to input',
      icon: TextCursorInput,
      enabled: canSubmit,
      title: 'Stage the mark in the chat composer without sending',
    },
  ];
  const currentSubmit =
    submitOptions.find((item) => item.action === submitAction) ?? submitOptions[0]!;
  const CurrentSubmitIcon = currentSubmit.icon;
  const dockButton =
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40';
  const menuItem =
    'flex w-full items-center gap-2 whitespace-nowrap rounded-sm px-2 py-1.5 text-left text-xs text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40';
  // Clearing only touches the message: marks, labels and attachments stay
  // (0138 D3), and focus returns to the input.
  const clearNote = () => {
    if (!note || sending) return;
    setNote('');
    noteInputRef.current?.focus();
  };

  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-4 z-[2] flex justify-center">
      <div className="flex max-w-full flex-col items-center gap-2">
        {capabilityNotice && (
          <div
            role={capabilityNotice.level === 'blocked' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto max-w-lg rounded-md border px-3.5 py-1.5 text-xs shadow-lg',
              // Text inherits the border hue (not -foreground, which is tuned
              // for solid destructive fills) so it stays readable on the
              // translucent tint in both themes.
              capabilityNotice.level === 'blocked'
                ? 'border-destructive/40 bg-destructive/10 text-destructive'
                : 'border-warning/30 bg-warning/10 text-warning',
            )}
          >
            {capabilityNotice.message}
          </div>
        )}
        {warning && (
          <div
            role="status"
            className="pointer-events-auto max-w-full rounded-md border border-border bg-popover px-3.5 py-1.5 text-xs text-popover-foreground shadow-lg"
          >
            {warning}
          </div>
        )}
        {images.length > 0 && (
          <div className="pointer-events-auto flex max-w-full items-center gap-1.5 overflow-x-auto rounded-lg border border-border bg-popover p-1.5 shadow-lg">
            {images.map((image, index) => (
              <div key={`${image.name}-${index}`} className="relative shrink-0">
                <img
                  src={image.dataUrl}
                  alt={image.name}
                  title={image.name}
                  className="block h-11 w-11 rounded-md border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={() => setImages((current) => current.filter((_, i) => i !== index))}
                  disabled={sending}
                  aria-label="Remove attached image"
                  className="absolute -right-1.5 -top-1.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <X className="size-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {/*
          0138 D2: drawing controls and the composer are separate groups; the
          composer (input + clear + submit) never wraps internally — on a
          narrow viewport it moves to its own line as one unit. There is no
          close button here: X means "Clear message" only, closing the layer
          stays on the Annotate toolbar toggle and Escape (0138 D3).
        */}
        <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1 rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-lg">
          <div className="flex shrink-0 items-center gap-1">
            <div ref={toolMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setToolMenuOpen((open) => !open)}
                disabled={sending}
                aria-haspopup="menu"
                aria-expanded={toolMenuOpen}
                title={currentTool.label}
                data-testid="mark-tool-select"
                className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-md px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <CurrentToolIcon className="size-3.5" />
                <ChevronDown className="size-3 opacity-75" />
              </button>
              {toolMenuOpen && (
                <div
                  role="menu"
                  className="absolute bottom-[calc(100%+8px)] left-0 z-10 flex min-w-36 flex-col gap-0.5 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
                >
                  {TOOL_OPTIONS.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <button
                        key={item.tool}
                        type="button"
                        role="menuitemradio"
                        aria-checked={markTool === item.tool}
                        disabled={sending}
                        onClick={() => {
                          setMarkTool(item.tool);
                          setToolMenuOpen(false);
                        }}
                        className={cn(
                          menuItem,
                          markTool === item.tool && 'bg-accent text-accent-foreground',
                        )}
                      >
                        <ItemIcon className="size-3.5" />
                        <span className="flex-1">{item.label}</span>
                        {markTool === item.tool && <Check className="size-3.5" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onUndo}
              disabled={historyCounts.undo === 0 || sending}
              title="Undo"
              aria-label="Undo"
              className={dockButton}
            >
              <Undo2 className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={historyCounts.redo === 0 || sending}
              title="Redo"
              aria-label="Redo"
              className={dockButton}
            >
              <Redo2 className="size-3.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                void addImageFiles(event.target.files);
                event.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              title="Attach image"
              aria-label="Attach image"
              className={dockButton}
            >
              <ImagePlus className="size-3.5" />
            </button>
          </div>
          <div aria-hidden="true" className="h-5 w-px shrink-0 self-center bg-border" />
          <div
            data-testid="mark-composer"
            className="flex min-w-[240px] max-w-full flex-1 flex-nowrap items-center gap-1"
          >
            <input
              ref={noteInputRef}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              onPaste={onNotePaste}
              disabled={sending}
              placeholder="Add a note for this mark"
              data-testid="mark-note-input"
              className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-[13px] text-foreground outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
                void onSubmit(submitAction);
              }}
            />
            <button
              type="button"
              onClick={clearNote}
              disabled={!note || sending}
              title="Clear message"
              aria-label="Clear message"
              data-testid="mark-clear-note"
              className={dockButton}
            >
              <X className="size-3.5" />
            </button>
            <div ref={submitMenuRef} className="relative inline-flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => void onSubmit(submitAction)}
                disabled={sending || !currentSubmit.enabled}
                title={currentSubmit.title}
                aria-label={currentSubmit.label}
                data-testid="mark-submit"
                className="inline-flex h-8 min-w-9 items-center justify-center rounded-l-md bg-primary pl-3 pr-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CurrentSubmitIcon className="size-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setSubmitMenuOpen((open) => !open)}
                disabled={sending || !canSubmit}
                aria-haspopup="menu"
                aria-expanded={submitMenuOpen}
                aria-label="Submit options"
                className="inline-flex h-8 w-6 items-center justify-center rounded-r-md border-l border-primary-foreground/25 bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitMenuOpen ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronUp className="size-3.5" />
                )}
              </button>
              {submitMenuOpen && (
                <div
                  role="menu"
                  className="absolute bottom-[calc(100%+8px)] right-0 z-10 flex min-w-44 flex-col gap-0.5 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
                >
                  {submitOptions.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <button
                        key={item.action}
                        type="button"
                        role="menuitemradio"
                        aria-checked={submitAction === item.action}
                        disabled={sending || !item.enabled}
                        title={item.title}
                        onClick={() => {
                          setSubmitAction(item.action);
                          setSubmitMenuOpen(false);
                          void onSubmit(item.action);
                        }}
                        className={cn(
                          menuItem,
                          submitAction === item.action && 'bg-accent text-accent-foreground',
                        )}
                      >
                        <ItemIcon className="size-3.5" />
                        <span className="flex-1">{item.label}</span>
                        {submitAction === item.action && <Check className="size-3.5" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
