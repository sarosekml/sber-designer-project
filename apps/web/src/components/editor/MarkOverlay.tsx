import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ClipboardEvent as ReactClipboardEvent,
  type RefObject,
} from 'react';
import {
  CANVAS_MARK_EVENT,
  clamp01,
  isMeaningfulBox,
  markSceneBounds,
  dataUrlByteSize,
  normalizedRectFromPoints,
  paintMarkScene,
  summarizeScene,
  type CanvasMarkEventDetail,
  type CanvasMarkImage,
  type MarkPoint,
  type MarkRect,
  type MarkScene,
  type MarkStroke,
  type MarkSubmitAction,
  type MarkTextLabel,
  type MarkTool,
} from '@/lib/canvas-mark';
import {
  compositeMarkScreenshot,
  requestCanvasSnapshotWithRetry,
  scrollCanvasBy,
} from '@/lib/canvas-snapshot';
import { resolveAgentModelTarget } from '@/lib/agent-model-target';
import { markCapabilityNotice } from '@/lib/mark-preflight';
import { IMAGE_ATTACHMENT_MAX_BYTES } from '@/lib/chat-attachments';
import { useChatStore } from '@/stores/chat-store';
import { useEditorStore } from '@/stores/editor-store';
import { useProjectStore } from '@/stores/project-store';
import { useAgentRuntimeInventory } from '@/stores/agent-runtime-store';
import { MAX_ATTACHMENTS, readAsDataUrl } from './chat/attachments';
import { MarkDock, MarkTextLabels } from './MarkOverlayControls';

/**
 * Mark layer (0127): a drawing surface over the live canvas iframe.
 *
 * Box-select, freehand pen, and droppable text labels in red marker; a note
 * input and image attachments; submits everything to the assistant as one
 * message (composited screenshot + structured block) via CANVAS_MARK_EVENT,
 * which ChatPanel turns into a normal chat send.
 *
 * A layer over the current mode, not a fourth EditorMode (ADR-0004).
 * Reference UX: Open Design's Mark tool. All state dies on unmount — closing
 * the layer discards not-yet-sent marks, like the reference.
 */

interface MarkOverlayProps {
  iframeRef: RefObject<HTMLIFrameElement | null>;
}

interface HistoryEntry {
  kind: 'box' | 'stroke';
  box?: MarkRect;
  stroke?: MarkStroke;
}

export function MarkOverlay({ iframeRef }: MarkOverlayProps) {
  const setMarkActive = useEditorStore((s) => s.setMarkActive);
  const activeScreenId = useEditorStore((s) => s.activeScreenId);
  const activeScreen = useProjectStore(
    (s) => s.project?.screens.find((screen) => screen.id === activeScreenId) ?? null,
  );
  const chatPending = useChatStore((s) => s.pending);
  // Resolved target from the shared runtime inventory (0138 D4/D5): the
  // preflight notices update live when the Active model changes, without a
  // second runtime fetch.
  const config = useEditorStore((s) => s.config);
  const active = useEditorStore((s) => s.active);
  const runtimeStatuses = useAgentRuntimeInventory((s) => s.statuses);
  const ensureRuntimesLoaded = useAgentRuntimeInventory((s) => s.ensureLoaded);
  useEffect(() => {
    void ensureRuntimesLoaded();
  }, [ensureRuntimesLoaded]);
  const agentTarget = useMemo(
    () => resolveAgentModelTarget({ config, active, runtimeStatuses }),
    [active, config, runtimeStatuses],
  );
  const capabilityNotice = useMemo(() => markCapabilityNotice(agentTarget), [agentTarget]);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boxesRef = useRef<MarkRect[]>([]);
  const strokesRef = useRef<MarkStroke[]>([]);
  const historyRef = useRef<HistoryEntry[]>([]);
  const redoRef = useRef<HistoryEntry[]>([]);
  const drawingRef = useRef<MarkStroke | null>(null);
  const boxDraftRef = useRef<{ start: MarkPoint; current: MarkPoint } | null>(null);
  const redrawFrameRef = useRef<number | null>(null);

  const [textLabels, setTextLabels] = useState<MarkTextLabel[]>([]);
  const textLabelsRef = useRef<MarkTextLabel[]>([]);
  const textIdRef = useRef(0);
  const [editingTextId, setEditingTextId] = useState<number | null>(null);
  const textAreaRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map());
  const textWrapRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const textDragRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    curX: number;
    curY: number;
    moved: boolean;
  } | null>(null);
  const lastTextTapRef = useRef<{ id: number; time: number } | null>(null);

  // 0138 D1: a fresh overlay always opens on Pen; an explicit Box/Text
  // choice survives until the layer closes.
  const [markTool, setMarkTool] = useState<MarkTool>('pen');
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const [submitAction, setSubmitAction] = useState<MarkSubmitAction>('send');
  const [submitMenuOpen, setSubmitMenuOpen] = useState(false);
  const [note, setNote] = useState('');
  const [images, setImages] = useState<CanvasMarkImage[]>([]);
  const [sending, setSending] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [historyCounts, setHistoryCounts] = useState({ undo: 0, redo: 0 });
  const [hasInk, setHasInk] = useState(false);
  const [frameHeight, setFrameHeight] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toolMenuRef = useRef<HTMLDivElement | null>(null);
  const submitMenuRef = useRef<HTMLDivElement | null>(null);

  const currentScene = useCallback(
    (): MarkScene => ({
      boxes: boxesRef.current,
      strokes: strokesRef.current,
      texts: textLabelsRef.current,
    }),
    [],
  );

  const syncHistoryState = useCallback(() => {
    setHistoryCounts({ undo: historyRef.current.length, redo: redoRef.current.length });
    setHasInk(boxesRef.current.length > 0 || strokesRef.current.length > 0);
  }, []);

  const commitTextLabels = useCallback((next: MarkTextLabel[]) => {
    textLabelsRef.current = next;
    setTextLabels(next);
  }, []);

  const redraw = useCallback(() => {
    const cvs = canvasRef.current;
    const ctx = cvs?.getContext('2d');
    if (!cvs || !ctx) return;
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    const dpr = window.devicePixelRatio || 1;
    const width = cvs.width;
    const height = cvs.height;
    const scene: MarkScene = {
      boxes: boxDraftRef.current
        ? [
            ...boxesRef.current,
            normalizedRectFromPoints(boxDraftRef.current.start, boxDraftRef.current.current),
          ]
        : boxesRef.current,
      strokes: drawingRef.current
        ? [...strokesRef.current, drawingRef.current]
        : strokesRef.current,
      // DOM textareas render the labels; the canvas only paints ink.
      texts: [],
    };
    paintMarkScene(ctx, scene, width, height, { strokeScale: dpr });
  }, []);

  const scheduleRedraw = useCallback(() => {
    if (redrawFrameRef.current !== null) return;
    redrawFrameRef.current = requestAnimationFrame(() => {
      redrawFrameRef.current = null;
      redraw();
    });
  }, [redraw]);

  useEffect(
    () => () => {
      if (redrawFrameRef.current !== null) cancelAnimationFrame(redrawFrameRef.current);
    },
    [],
  );

  // Size the canvas to the frame; re-fit on container resize.
  useEffect(() => {
    const wrap = wrapRef.current;
    const cvs = canvasRef.current;
    if (!wrap || !cvs) return;
    const resize = () => {
      const width = wrap.offsetWidth;
      const height = wrap.offsetHeight;
      const dpr = window.devicePixelRatio || 1;
      cvs.width = Math.max(1, Math.floor(width * dpr));
      cvs.height = Math.max(1, Math.floor(height * dpr));
      cvs.style.width = `${width}px`;
      cvs.style.height = `${height}px`;
      setFrameHeight(height);
      redraw();
    };
    resize();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [redraw]);

  const undoMark = useCallback(() => {
    if (sending) return;
    if (boxDraftRef.current) {
      boxDraftRef.current = null;
      redraw();
      return;
    }
    const entry = historyRef.current.pop();
    if (!entry) return;
    if (entry.kind === 'box') boxesRef.current = boxesRef.current.slice(0, -1);
    else strokesRef.current = strokesRef.current.slice(0, -1);
    redoRef.current.push(entry);
    syncHistoryState();
    redraw();
  }, [redraw, sending, syncHistoryState]);

  const redoMark = useCallback(() => {
    if (sending) return;
    const entry = redoRef.current.pop();
    if (!entry) return;
    if (entry.kind === 'box' && entry.box) boxesRef.current = [...boxesRef.current, entry.box];
    if (entry.kind === 'stroke' && entry.stroke) {
      strokesRef.current = [...strokesRef.current, entry.stroke];
    }
    historyRef.current.push(entry);
    syncHistoryState();
    redraw();
  }, [redraw, sending, syncHistoryState]);

  // Escape exits the layer (menus and label editing consume it first);
  // Cmd/Ctrl+Z undoes, +Shift redoes.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMarkActive(false);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redoMark();
        else undoMark();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [redoMark, setMarkActive, undoMark]);

  // Close dropdown menus on outside pointer / Escape (capture phase so the
  // overlay's own Escape-to-exit handler does not fire for the same press).
  useEffect(() => {
    if (!toolMenuOpen && !submitMenuOpen) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (toolMenuRef.current?.contains(target) || submitMenuRef.current?.contains(target)) return;
      setToolMenuOpen(false);
      setSubmitMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setToolMenuOpen(false);
      setSubmitMenuOpen(false);
    }
    window.addEventListener('mousedown', onPointerDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onPointerDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [submitMenuOpen, toolMenuOpen]);

  // Wheel over the layer scrolls the page underneath. Native listener because
  // React wheel handlers are passive and cannot preventDefault.
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    function onWheel(event: WheelEvent) {
      const iframe = iframeRef.current;
      if (!iframe) return;
      scrollCanvasBy(iframe, event.deltaX, event.deltaY);
      event.preventDefault();
    }
    cvs.addEventListener('wheel', onWheel, { passive: false });
    return () => cvs.removeEventListener('wheel', onWheel);
  }, [iframeRef]);

  function pointFromEvent(event: ReactPointerEvent): MarkPoint {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
    return {
      x: clamp01((event.clientX - rect.left) / rect.width),
      y: clamp01((event.clientY - rect.top) / rect.height),
    };
  }

  // Pointer capture keeps a drag alive when it leaves the frame, but it is a
  // nicety: capturing an inactive pointer throws NotFoundError (synthetic and
  // automation events), and that must never abort the drawing handler.
  function capturePointer(target: EventTarget | null, pointerId: number) {
    try {
      (target as Element | null)?.setPointerCapture?.(pointerId);
    } catch {
      // Best-effort only.
    }
  }

  function releasePointer(target: EventTarget | null, pointerId: number) {
    try {
      (target as Element | null)?.releasePointerCapture?.(pointerId);
    } catch {
      // Best-effort only.
    }
  }

  function onPointerDown(event: ReactPointerEvent) {
    if (sending) return;
    event.preventDefault();
    if (markTool === 'text') {
      const point = pointFromEvent(event);
      const id = (textIdRef.current += 1);
      commitTextLabels([...textLabelsRef.current, { id, x: point.x, y: point.y, text: '' }]);
      setEditingTextId(id);
      return;
    }
    capturePointer(event.target, event.pointerId);
    const point = pointFromEvent(event);
    if (markTool === 'box') {
      boxDraftRef.current = { start: point, current: point };
      redraw();
      return;
    }
    drawingRef.current = { points: [point] };
    redraw();
  }

  function onPointerMove(event: ReactPointerEvent) {
    if (sending) return;
    event.preventDefault();
    if (boxDraftRef.current) {
      boxDraftRef.current.current = pointFromEvent(event);
      scheduleRedraw();
      return;
    }
    if (!drawingRef.current) return;
    drawingRef.current.points.push(pointFromEvent(event));
    scheduleRedraw();
  }

  function onPointerUp(event: ReactPointerEvent) {
    if (sending) return;
    event.preventDefault();
    if (redrawFrameRef.current !== null) {
      cancelAnimationFrame(redrawFrameRef.current);
      redrawFrameRef.current = null;
    }
    if (boxDraftRef.current) {
      boxDraftRef.current.current = pointFromEvent(event);
      const next = normalizedRectFromPoints(boxDraftRef.current.start, boxDraftRef.current.current);
      boxDraftRef.current = null;
      if (isMeaningfulBox(next)) {
        boxesRef.current = [...boxesRef.current, next];
        historyRef.current.push({ kind: 'box', box: next });
        redoRef.current = [];
      }
      syncHistoryState();
      redraw();
      return;
    }
    if (!drawingRef.current) return;
    if (drawingRef.current.points.length > 1) {
      strokesRef.current = [...strokesRef.current, drawingRef.current];
      historyRef.current.push({ kind: 'stroke', stroke: drawingRef.current });
      redoRef.current = [];
      syncHistoryState();
    }
    drawingRef.current = null;
    redraw();
  }

  // ---- text labels ---------------------------------------------------------

  const autosizeTextArea = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.width = '0px';
    el.style.height = '0px';
    el.style.width = `${el.scrollWidth + 2}px`;
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  function updateTextLabel(id: number, text: string) {
    commitTextLabels(
      textLabelsRef.current.map((label) => (label.id === id ? { ...label, text } : label)),
    );
  }

  function removeTextLabel(id: number) {
    textAreaRefs.current.delete(id);
    commitTextLabels(textLabelsRef.current.filter((label) => label.id !== id));
  }

  function handleTextBlur(id: number) {
    setEditingTextId((current) => (current === id ? null : current));
    const label = textLabelsRef.current.find((item) => item.id === id);
    if (label && label.text.trim() === '') removeTextLabel(id);
  }

  useEffect(() => {
    if (editingTextId === null) return;
    const el = textAreaRefs.current.get(editingTextId);
    if (el) {
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
    }
  }, [editingTextId, textLabels]);

  useEffect(() => {
    textAreaRefs.current.forEach((el) => autosizeTextArea(el));
  }, [frameHeight, textLabels, autosizeTextArea]);

  function onTextPointerDown(event: ReactPointerEvent, label: MarkTextLabel) {
    if (editingTextId === label.id) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    capturePointer(event.currentTarget, event.pointerId);
    textDragRef.current = {
      id: label.id,
      startX: (event.clientX - rect.left) / rect.width,
      startY: (event.clientY - rect.top) / rect.height,
      originX: label.x,
      originY: label.y,
      curX: label.x,
      curY: label.y,
      moved: false,
    };
  }

  function onTextPointerMove(event: ReactPointerEvent, label: MarkTextLabel) {
    const drag = textDragRef.current;
    if (!drag || drag.id !== label.id) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const nx = clamp01(drag.originX + ((event.clientX - rect.left) / rect.width - drag.startX));
    const ny = clamp01(drag.originY + ((event.clientY - rect.top) / rect.height - drag.startY));
    drag.curX = nx;
    drag.curY = ny;
    if (Math.abs(nx - drag.originX) > 0.002 || Math.abs(ny - drag.originY) > 0.002)
      drag.moved = true;
    const el = event.currentTarget as HTMLElement;
    el.style.left = `${nx * 100}%`;
    el.style.top = `${ny * 100}%`;
  }

  function onTextPointerUp(event: ReactPointerEvent, label: MarkTextLabel) {
    const drag = textDragRef.current;
    if (!drag || drag.id !== label.id) return;
    releasePointer(event.currentTarget, event.pointerId);
    textDragRef.current = null;
    if (drag.moved) {
      commitTextLabels(
        textLabelsRef.current.map((item) =>
          item.id === label.id ? { ...item, x: drag.curX, y: drag.curY } : item,
        ),
      );
      lastTextTapRef.current = null;
      return;
    }
    const prev = lastTextTapRef.current;
    if (prev && prev.id === label.id && event.timeStamp - prev.time < 320) {
      lastTextTapRef.current = null;
      setEditingTextId(label.id);
    } else {
      lastTextTapRef.current = { id: label.id, time: event.timeStamp };
    }
  }

  // ---- attachments ---------------------------------------------------------

  async function addImageFiles(files: FileList | File[] | null) {
    if (!files) return;
    const incoming = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (incoming.length === 0) return;
    const room = Math.max(0, MAX_ATTACHMENTS - 1 - images.length);
    const next: CanvasMarkImage[] = [];
    for (const file of incoming.slice(0, room)) {
      if (file.size > IMAGE_ATTACHMENT_MAX_BYTES) {
        setWarning(`${file.name} is larger than the image attachment limit.`);
        continue;
      }
      next.push({
        name: file.name,
        mimeType: file.type || 'image/png',
        size: file.size,
        dataUrl: await readAsDataUrl(file),
      });
    }
    if (next.length > 0) setImages((current) => [...current, ...next]);
  }

  function onNotePaste(event: ReactClipboardEvent<HTMLInputElement>) {
    const files = event.clipboardData?.files;
    if (!files || files.length === 0) return;
    event.preventDefault();
    void addImageFiles(files);
  }

  // ---- submit --------------------------------------------------------------

  const hasMarks = hasInk || textLabels.some((label) => label.text.trim().length > 0);
  const canSubmit = hasMarks || Boolean(note.trim()) || images.length > 0;
  const sendBlockedByCapability = capabilityNotice?.level === 'blocked';
  const canSend = canSubmit && !chatPending && !sendBlockedByCapability;
  const sendDisabledReason = chatPending
    ? 'The assistant is busy with a run — use “Add to input” and send when it finishes.'
    : sendBlockedByCapability
      ? capabilityNotice?.message
      : undefined;

  function measuredTextRects(): MarkRect[] {
    const overlayRect = canvasRef.current?.getBoundingClientRect();
    if (!overlayRect || overlayRect.width <= 0 || overlayRect.height <= 0) return [];
    const rects: MarkRect[] = [];
    for (const label of textLabelsRef.current) {
      if (label.text.trim().length === 0) continue;
      const el = textWrapRefs.current.get(label.id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      rects.push({
        x: clamp01((rect.left - overlayRect.left) / overlayRect.width),
        y: clamp01((rect.top - overlayRect.top) / overlayRect.height),
        width: rect.width / overlayRect.width,
        height: rect.height / overlayRect.height,
      });
    }
    return rects;
  }

  async function submit(action: MarkSubmitAction) {
    if (sending || !canSubmit) return;
    if (action === 'send' && chatPending) return;
    // Capability may have changed between render and click; the disabled
    // button is only the first line of defence (0138 D6 has the boundary
    // check on the chat side as the second).
    if (action === 'send' && sendBlockedByCapability) return;
    setWarning(null);
    setSending(true);
    try {
      const wrap = wrapRef.current;
      const frameSize = {
        width: wrap?.offsetWidth ?? 0,
        height: wrap?.offsetHeight ?? 0,
      };
      const scene = currentScene();
      const iframe = iframeRef.current;
      let screenshot: CanvasMarkImage | null = null;
      const snapshot = iframe ? await requestCanvasSnapshotWithRetry(iframe) : null;
      if (snapshot) {
        const dataUrl = await compositeMarkScreenshot(snapshot, scene, frameSize);
        if (dataUrl) {
          const stamp = new Date().toISOString().replace(/[:.]/g, '-');
          screenshot = {
            name: `canvas-mark-${stamp}.png`,
            mimeType: 'image/png',
            size: dataUrlByteSize(dataUrl),
            dataUrl,
          };
        }
      }
      if (!screenshot && hasMarks && !note.trim() && images.length === 0) {
        // Ink-only marks are pure pixels; without a capture there is nothing
        // meaningful to send. A note or image still carries intent, so those
        // fall through and go out with the structured region block only.
        setWarning(
          'Could not capture the canvas. Add a short note (or retry) so the mark still makes sense.',
        );
        return;
      }
      const detail: CanvasMarkEventDetail = {
        action,
        note: note.trim(),
        screenshot,
        extraImages: images,
        scene: summarizeScene(scene),
        bounds: markSceneBounds(scene, measuredTextRects()),
        frameSize,
        screen: activeScreen
          ? {
              id: activeScreen.id,
              name: activeScreen.name,
              ...(activeScreen.filePath ? { filePath: activeScreen.filePath } : {}),
            }
          : null,
      };
      const result = await new Promise<{ ok: boolean; message?: string }>((resolve) => {
        let settled = false;
        const finish = (value: { ok: boolean; message?: string }) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        window.setTimeout(
          () => finish({ ok: false, message: 'The mark could not be delivered to the chat.' }),
          60000,
        );
        detail.ack = finish;
        window.dispatchEvent(new CustomEvent(CANVAS_MARK_EVENT, { detail }));
      });
      if (!result.ok) {
        setWarning(result.message ?? 'The mark could not be delivered to the chat.');
        return;
      }
      boxesRef.current = [];
      strokesRef.current = [];
      historyRef.current = [];
      redoRef.current = [];
      drawingRef.current = null;
      boxDraftRef.current = null;
      commitTextLabels([]);
      setEditingTextId(null);
      setNote('');
      setImages([]);
      syncHistoryState();
      redraw();
      setWarning(
        hasMarks && !screenshot
          ? 'Sent without a screenshot — the note and marked region went out as text.'
          : null,
      );
    } finally {
      setSending(false);
    }
  }

  // ---- render --------------------------------------------------------------

  return (
    <div ref={wrapRef} data-testid="mark-overlay" className="absolute inset-0 z-30">
      <canvas
        ref={canvasRef}
        data-testid="mark-overlay-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="absolute inset-0 select-none"
        style={{
          cursor: markTool === 'text' ? 'text' : 'crosshair',
          touchAction: 'none',
        }}
      />
      <MarkTextLabels
        labels={textLabels}
        editingTextId={editingTextId}
        markTool={markTool}
        frameHeight={frameHeight}
        textWrapRefs={textWrapRefs}
        textAreaRefs={textAreaRefs}
        autosizeTextArea={autosizeTextArea}
        onPointerDown={onTextPointerDown}
        onPointerMove={onTextPointerMove}
        onPointerUp={onTextPointerUp}
        onTextChange={updateTextLabel}
        onTextBlur={handleTextBlur}
        onRemove={removeTextLabel}
      />
      <MarkDock
        warning={warning}
        capabilityNotice={capabilityNotice}
        images={images}
        setImages={setImages}
        sending={sending}
        markTool={markTool}
        setMarkTool={setMarkTool}
        toolMenuOpen={toolMenuOpen}
        setToolMenuOpen={setToolMenuOpen}
        toolMenuRef={toolMenuRef}
        historyCounts={historyCounts}
        onUndo={undoMark}
        onRedo={redoMark}
        fileInputRef={fileInputRef}
        addImageFiles={addImageFiles}
        note={note}
        setNote={setNote}
        onNotePaste={onNotePaste}
        submitAction={submitAction}
        setSubmitAction={setSubmitAction}
        submitMenuOpen={submitMenuOpen}
        setSubmitMenuOpen={setSubmitMenuOpen}
        submitMenuRef={submitMenuRef}
        canSubmit={canSubmit}
        canSend={canSend}
        sendDisabledReason={sendDisabledReason}
        onSubmit={submit}
      />
    </div>
  );
}
