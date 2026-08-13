import { useState, useRef, useEffect, useCallback } from "react";
import {
  TOTAL_SLOTS,
  SLOTS_PER_HOUR,
  DAY_START_HOUR,
  SLOT_MINUTES,
  formatDuration,
  slotToTimeString,
  fromDateKey,
  todayKey,
} from "@/lib/salesup/date";
import { WORK_TYPE_MAP, type WorkTypeId } from "@/lib/salesup/workTypes";
import {
  colorOf,
  labelOf,
  resolveWorkType,
  subTextOn,
  textOn,
  useWorkTypeSettings,
} from "@/lib/salesup/workTypeSettings";
import type { TimeBlock } from "@/lib/salesup/types";
import { cn } from "@/lib/utils";

interface Props {
  weekDays: string[]; // 7 date keys, Monday first
  blocks: TimeBlock[];
  filter: WorkTypeId | "all";
  activeWorkType?: WorkTypeId | null;
  highlightDate?: string;
  selectedBlockId?: string | null;
  onSelectBlock: (block: TimeBlock) => void;
  onCreateRange: (date: string, startSlot: number, endSlot: number) => void;
  onMoveBlock?: (block: TimeBlock, date: string, startSlot: number, endSlot: number) => void;
  onInlineSaveTitle?: (block: TimeBlock, title: string) => void;
}

const WEEKDAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const SLOT_HEIGHT = 14; // px per 15-min slot
const HOUR_HEIGHT = SLOT_HEIGHT * SLOTS_PER_HOUR; // 56px
const MOVE_THRESHOLD = 4;
const AUTO_SCROLL_EDGE = 48;
const AUTO_SCROLL_MAX_SPEED = 16;
const RESIZE_EDGE_PX = 6;
const MIN_MOVE_CENTER_PX = 4;

type BlockInteractionMode = "move" | "resize-start" | "resize-end";

type MovingBlock = {
  block: TimeBlock;
  pointerId: number;
  startX: number;
  startY: number;
  startScrollTop: number;
  hasDragged: boolean;
  mode: BlockInteractionMode;
  previewDate: string;
  previewStart: number;
  previewEnd: number;
};

function getBlockInteractionMode(element: HTMLDivElement, clientY: number): BlockInteractionMode {
  const bounds = element.getBoundingClientRect();
  // A one-slot block is only 12px tall after its visual inset. Shrink its edge zones
  // just enough to leave a 4px center strip for moving the complete block.
  const edgeSize = Math.min(RESIZE_EDGE_PX, Math.max(3, (bounds.height - MIN_MOVE_CENTER_PX) / 2));
  const offsetY = clientY - bounds.top;
  if (offsetY <= edgeSize) return "resize-start";
  if (offsetY >= bounds.height - edgeSize) return "resize-end";
  return "move";
}

export function WeekTimeline({
  weekDays,
  blocks,
  filter,
  activeWorkType,
  highlightDate,
  selectedBlockId,
  onSelectBlock,
  onCreateRange,
  onMoveBlock,
  onInlineSaveTitle,
}: Props) {
  const { settings } = useWorkTypeSettings();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Map blocks per day; also build occupancy for drag collision.
  const blocksByDay: Record<string, TimeBlock[]> = {};
  const occupancyByDay: Record<string, (TimeBlock | undefined)[]> = {};
  for (const d of weekDays) {
    blocksByDay[d] = [];
    occupancyByDay[d] = Array.from({ length: TOTAL_SLOTS }, () => undefined);
  }
  for (const b of blocks) {
    if (!blocksByDay[b.date]) continue;
    blocksByDay[b.date].push(b);
    for (let s = b.start_slot; s < b.end_slot && s < TOTAL_SLOTS; s++) {
      occupancyByDay[b.date][s] = b;
    }
  }

  // ---- drag state for creation ----
  const [dragDay, setDragDay] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const draggingRef = useRef(false);

  // ---- drag state for moving existing blocks ----
  const [movingBlock, setMovingBlock] = useState<MovingBlock | null>(null);
  const movingBlockRef = useRef<MovingBlock | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const autoScrollVelocityRef = useRef(0);
  const restoreUserSelectRef = useRef<string | null>(null);
  const finishMovingBlockRef = useRef<(commitMove: boolean) => void>(() => undefined);
  const blockPointerListenersRef = useRef<{
    move: (event: PointerEvent) => void;
    up: (event: PointerEvent) => void;
    cancel: (event: PointerEvent) => void;
  } | null>(null);

  // ---- inline edit state ----
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const clickTimerRef = useRef<number | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      const el = editInputRef.current;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, [editingId]);

  const commitInline = (block: TimeBlock | undefined) => {
    if (!block) {
      setEditingId(null);
      return;
    }
    if (onInlineSaveTitle && editingTitle !== block.title) {
      onInlineSaveTitle(block, editingTitle);
    }
    setEditingId(null);
  };

  const handleBlockClick = (block: TimeBlock) => {
    if (clickTimerRef.current != null) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      // Double click → inline edit
      setEditingTitle(block.title || "");
      setEditingId(block.id);
      return;
    }
    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null;
      onSelectBlock(block);
    }, 230);
  };

  const stopAutoScroll = () => {
    autoScrollVelocityRef.current = 0;
    if (autoScrollFrameRef.current != null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  };

  const restoreSelection = () => {
    if (restoreUserSelectRef.current != null) {
      document.body.style.userSelect = restoreUserSelectRef.current;
      restoreUserSelectRef.current = null;
    }
  };

  const detachBlockPointerListeners = () => {
    const listeners = blockPointerListenersRef.current;
    if (!listeners) return;
    window.removeEventListener("pointermove", listeners.move);
    window.removeEventListener("pointerup", listeners.up);
    window.removeEventListener("pointercancel", listeners.cancel);
    blockPointerListenersRef.current = null;
  };

  const updateMovingPreview = (clientX: number, clientY: number) => {
    const moving = movingBlockRef.current;
    if (!moving?.hasDragged) return;
    const scrollDelta = (scrollRef.current?.scrollTop ?? 0) - moving.startScrollTop;
    const slotDelta = Math.round((clientY - moving.startY + scrollDelta) / SLOT_HEIGHT);
    const element = document.elementFromPoint(clientX, clientY);
    const day = element?.closest<HTMLElement>("[data-timeline-day]")?.dataset.timelineDay;
    const duration = moving.block.end_slot - moving.block.start_slot;
    const preview =
      moving.mode === "move"
        ? {
            previewDate: day && weekDays.includes(day) ? day : moving.previewDate,
            previewStart: Math.max(
              0,
              Math.min(TOTAL_SLOTS - duration, moving.block.start_slot + slotDelta),
            ),
            previewEnd: 0,
          }
        : moving.mode === "resize-start"
          ? {
              previewDate: moving.block.date,
              previewStart: Math.max(
                0,
                Math.min(moving.block.end_slot - 1, moving.block.start_slot + slotDelta),
              ),
              previewEnd: moving.block.end_slot,
            }
          : {
              previewDate: moving.block.date,
              previewStart: moving.block.start_slot,
              previewEnd: Math.max(
                moving.block.start_slot + 1,
                Math.min(TOTAL_SLOTS, moving.block.end_slot + slotDelta),
              ),
            };
    if (moving.mode === "move") preview.previewEnd = preview.previewStart + duration;
    if (
      preview.previewDate === moving.previewDate &&
      preview.previewStart === moving.previewStart &&
      preview.previewEnd === moving.previewEnd
    ) {
      return;
    }
    const next = { ...moving, ...preview };
    movingBlockRef.current = next;
    setMovingBlock(next);
  };

  const updateAutoScroll = (clientX: number, clientY: number) => {
    const container = scrollRef.current;
    if (!container || !movingBlockRef.current?.hasDragged) return;
    const bounds = container.getBoundingClientRect();
    const above = Math.max(0, AUTO_SCROLL_EDGE - (clientY - bounds.top));
    const below = Math.max(0, AUTO_SCROLL_EDGE - (bounds.bottom - clientY));
    autoScrollVelocityRef.current = above
      ? -Math.ceil((above / AUTO_SCROLL_EDGE) * AUTO_SCROLL_MAX_SPEED)
      : below
        ? Math.ceil((below / AUTO_SCROLL_EDGE) * AUTO_SCROLL_MAX_SPEED)
        : 0;

    if (autoScrollVelocityRef.current === 0 || autoScrollFrameRef.current != null) return;
    const tick = () => {
      const activeContainer = scrollRef.current;
      const pointer = lastPointerRef.current;
      if (!activeContainer || !pointer || autoScrollVelocityRef.current === 0) {
        autoScrollFrameRef.current = null;
        return;
      }
      const previousTop = activeContainer.scrollTop;
      activeContainer.scrollTop += autoScrollVelocityRef.current;
      if (activeContainer.scrollTop === previousTop) {
        autoScrollVelocityRef.current = 0;
        autoScrollFrameRef.current = null;
        return;
      }
      updateMovingPreview(pointer.x, pointer.y);
      autoScrollFrameRef.current = window.requestAnimationFrame(tick);
    };
    autoScrollFrameRef.current = window.requestAnimationFrame(tick);
  };

  const finishMovingBlock = (commitMove: boolean) => {
    const moving = movingBlockRef.current;
    if (!moving) return;
    detachBlockPointerListeners();
    stopAutoScroll();
    movingBlockRef.current = null;
    lastPointerRef.current = null;
    restoreSelection();
    setMovingBlock(null);
    if (!moving.hasDragged) {
      if (commitMove) handleBlockClick(moving.block);
      return;
    }
    if (commitMove) {
      onMoveBlock?.(moving.block, moving.previewDate, moving.previewStart, moving.previewEnd);
    }
  };
  finishMovingBlockRef.current = finishMovingBlock;

  const moveMovingBlock = (pointerId: number, clientX: number, clientY: number) => {
    const moving = movingBlockRef.current;
    if (!moving || moving.pointerId !== pointerId) return;
    lastPointerRef.current = { x: clientX, y: clientY };
    if (!moving.hasDragged) {
      if (Math.hypot(clientX - moving.startX, clientY - moving.startY) < MOVE_THRESHOLD) return;
      const active = { ...moving, hasDragged: true };
      movingBlockRef.current = active;
      setMovingBlock(active);
      restoreUserSelectRef.current = document.body.style.userSelect;
      document.body.style.userSelect = "none";
    }
    updateMovingPreview(clientX, clientY);
    updateAutoScroll(clientX, clientY);
  };

  const handleBlockPointerDown = (event: React.PointerEvent<HTMLDivElement>, block: TimeBlock) => {
    if (event.button !== 0 || editingId) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const moving: MovingBlock = {
      block,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startScrollTop: scrollRef.current?.scrollTop ?? 0,
      hasDragged: false,
      mode: getBlockInteractionMode(event.currentTarget, event.clientY),
      previewDate: block.date,
      previewStart: block.start_slot,
      previewEnd: block.end_slot,
    };
    movingBlockRef.current = moving;
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    setMovingBlock(moving);
    detachBlockPointerListeners();
    const listeners = {
      move: (nativeEvent: PointerEvent) =>
        moveMovingBlock(nativeEvent.pointerId, nativeEvent.clientX, nativeEvent.clientY),
      up: (nativeEvent: PointerEvent) => {
        if (movingBlockRef.current?.pointerId === nativeEvent.pointerId) finishMovingBlock(true);
      },
      cancel: (nativeEvent: PointerEvent) => {
        if (movingBlockRef.current?.pointerId === nativeEvent.pointerId) finishMovingBlock(false);
      },
    };
    blockPointerListenersRef.current = listeners;
    window.addEventListener("pointermove", listeners.move);
    window.addEventListener("pointerup", listeners.up);
    window.addEventListener("pointercancel", listeners.cancel);
  };

  const handleMovePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    moveMovingBlock(event.pointerId, event.clientX, event.clientY);
  };

  const handleMovePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (movingBlockRef.current?.pointerId === event.pointerId) finishMovingBlock(true);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !movingBlockRef.current) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      finishMovingBlockRef.current(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  const handlePointerDown = (day: string, slot: number) => {
    if (editingId) return;
    const occupied = occupancyByDay[day][slot];
    if (occupied) {
      handleBlockClick(occupied);
      return;
    }
    draggingRef.current = true;
    setDragDay(day);
    setDragStart(slot);
    setDragEnd(slot);
  };

  const handlePointerEnter = (day: string, slot: number) => {
    if (!draggingRef.current || dragDay !== day) return;
    if (occupancyByDay[day][slot]) return;
    setDragEnd(slot);
  };

  const commit = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (dragDay != null && dragStart != null && dragEnd != null) {
      const lo = Math.min(dragStart, dragEnd);
      const hi = Math.max(dragStart, dragEnd);
      onCreateRange(dragDay, lo, hi + 1);
    }
    setDragDay(null);
    setDragStart(null);
    setDragEnd(null);
  }, [dragDay, dragStart, dragEnd, onCreateRange]);

  useEffect(() => {
    const up = () => commit();
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [commit]);

  const hours = 24 - DAY_START_HOUR;
  const totalHeight = TOTAL_SLOTS * SLOT_HEIGHT;
  const today = todayKey();
  const createCursor = activeWorkType ? "crosshair" : "default";

  const dragRange =
    dragDay && dragStart != null && dragEnd != null
      ? { day: dragDay, lo: Math.min(dragStart, dragEnd), hi: Math.max(dragStart, dragEnd) }
      : null;

  return (
    <div
      className="bg-card rounded-xl border border-border overflow-hidden select-none"
      style={{ cursor: createCursor }}
    >
      <div
        ref={scrollRef}
        className="overflow-auto max-h-[calc(100vh-14rem)] touch-none"
        onPointerMove={handleMovePointerMove}
        onPointerUp={handleMovePointerUp}
        onPointerCancel={() => finishMovingBlock(false)}
      >
        <div
          className="grid min-w-[760px]"
          style={{ gridTemplateColumns: "48px repeat(7, minmax(96px, 1fr))" }}
        >
          {/* Header row */}
          <div className="border-b border-border bg-muted/40" />
          {weekDays.map((d) => {
            const dt = fromDateKey(d);
            const idx = (dt.getDay() + 6) % 7;
            const isToday = d === today;
            const isHl = d === highlightDate;
            const isWeekend = idx >= 5;
            return (
              <div
                key={d}
                className={cn(
                  "relative sticky top-0 z-30 border-b border-l border-border bg-card px-2 py-2 text-center",
                )}
              >
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-0",
                    isToday && "bg-primary/10",
                    isHl && !isToday && "bg-accent",
                    isWeekend && !isToday && !isHl && "bg-muted/30",
                  )}
                />
                <div className="relative text-[11px] text-muted-foreground">
                  {WEEKDAY_LABELS[idx]}
                </div>
                <div
                  className={cn("relative text-sm font-semibold mt-0.5", isToday && "text-primary")}
                >
                  {dt.getMonth() + 1}/{dt.getDate()}
                </div>
              </div>
            );
          })}

          {/* Body row: hour-labels column + 7 day columns */}
          <div
            className="relative border-r border-border"
            style={{ height: totalHeight }}
            aria-hidden
          >
            {Array.from({ length: hours }).map((_, hourIdx) => (
              <div
                key={hourIdx}
                className="absolute right-1 text-[10px] text-muted-foreground text-right"
                style={{ top: hourIdx * HOUR_HEIGHT, lineHeight: "12px" }}
              >
                {String(DAY_START_HOUR + hourIdx).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {weekDays.map((day) => (
            <DayColumn
              key={day}
              day={day}
              hours={hours}
              totalHeight={totalHeight}
              dayBlocks={blocksByDay[day]}
              filter={filter}
              settings={settings}
              selectedBlockId={selectedBlockId ?? null}
              movingBlockId={movingBlock?.hasDragged ? movingBlock.block.id : null}
              movingBlockMode={movingBlock?.hasDragged ? movingBlock.mode : null}
              dragRange={dragRange?.day === day ? { lo: dragRange.lo, hi: dragRange.hi } : null}
              movingPreview={
                movingBlock?.hasDragged && movingBlock.previewDate === day
                  ? {
                      block: movingBlock.block,
                      startSlot: movingBlock.previewStart,
                      endSlot: movingBlock.previewEnd,
                    }
                  : null
              }
              editingId={editingId}
              editingTitle={editingTitle}
              editInputRef={editInputRef}
              onInputChange={setEditingTitle}
              onCommitInline={commitInline}
              onCancelInline={() => setEditingId(null)}
              onPointerDown={handlePointerDown}
              onPointerEnter={handlePointerEnter}
              onBlockPointerDown={handleBlockPointerDown}
            />
          ))}
        </div>
      </div>
      <div className="px-3 py-2 border-t border-border text-[11px] text-muted-foreground bg-muted/40">
        {activeWorkType
          ? "点击单格创建 15 分钟，按住拖动创建连续时间段；Enter 确认，Backspace 删除，Esc 取消选中"
          : "先在上方选择一个工作类型再创建；点选色块可在右侧面板编辑详情"}
      </div>
    </div>
  );
}

// ---------------- DayColumn ----------------

interface DayColumnProps {
  day: string;
  hours: number;
  totalHeight: number;
  dayBlocks: TimeBlock[];
  filter: WorkTypeId | "all";
  settings: ReturnType<typeof useWorkTypeSettings>["settings"];
  selectedBlockId: string | null;
  movingBlockId: string | null;
  movingBlockMode: BlockInteractionMode | null;
  dragRange: { lo: number; hi: number } | null;
  movingPreview: { block: TimeBlock; startSlot: number; endSlot: number } | null;
  editingId: string | null;
  editingTitle: string;
  editInputRef: React.RefObject<HTMLInputElement | null>;
  onInputChange: (v: string) => void;
  onCommitInline: (b: TimeBlock | undefined) => void;
  onCancelInline: () => void;
  onPointerDown: (day: string, slot: number) => void;
  onPointerEnter: (day: string, slot: number) => void;
  onBlockPointerDown: (event: React.PointerEvent<HTMLDivElement>, block: TimeBlock) => void;
}

function DayColumn({
  day,
  hours,
  totalHeight,
  dayBlocks,
  filter,
  settings,
  selectedBlockId,
  movingBlockId,
  movingBlockMode,
  dragRange,
  movingPreview,
  editingId,
  editingTitle,
  editInputRef,
  onInputChange,
  onCommitInline,
  onCancelInline,
  onPointerDown,
  onPointerEnter,
  onBlockPointerDown,
}: DayColumnProps) {
  return (
    <div
      className="relative border-l border-border"
      style={{ height: totalHeight }}
      data-timeline-day={day}
    >
      {/* Hour grid lines */}
      {Array.from({ length: hours }).map((_, hourIdx) => (
        <div
          key={hourIdx}
          className="absolute left-0 right-0 border-t border-border"
          style={{ top: hourIdx * HOUR_HEIGHT }}
        />
      ))}
      {/* Quarter-hour minor lines */}
      {Array.from({ length: TOTAL_SLOTS }).map((_, slot) =>
        slot % SLOTS_PER_HOUR !== 0 ? (
          <div
            key={`q-${slot}`}
            className="absolute left-0 right-0 border-t border-border/40"
            style={{ top: slot * SLOT_HEIGHT }}
          />
        ) : null,
      )}

      {/* Drag selection overlay */}
      {dragRange && (
        <div
          className="absolute left-0 right-0 bg-accent/70 pointer-events-none"
          style={{
            top: dragRange.lo * SLOT_HEIGHT,
            height: (dragRange.hi - dragRange.lo + 1) * SLOT_HEIGHT,
          }}
        />
      )}

      {/* Pointer-event capture: invisible 15-min cells */}
      {Array.from({ length: TOTAL_SLOTS }).map((_, slot) => (
        <button
          type="button"
          key={slot}
          onPointerDown={(e) => {
            e.preventDefault();
            onPointerDown(day, slot);
          }}
          onPointerEnter={() => onPointerEnter(day, slot)}
          className="absolute left-0 right-0 bg-transparent"
          style={{ top: slot * SLOT_HEIGHT, height: SLOT_HEIGHT }}
          aria-label={`${day} ${slotToTimeString(slot)}`}
        />
      ))}

      {/* Merged block overlays */}
      {dayBlocks.map((block) => {
        const eff = resolveWorkType(block.work_type, settings);
        if (!eff) return null;
        const dimmed = filter !== "all" && block.work_type !== filter;
        const isEditing = editingId === block.id;
        const isSelected = selectedBlockId === block.id;
        const isMoving = movingBlockId === block.id;
        const isResizing = isMoving && movingBlockMode !== "move";
        const top = block.start_slot * SLOT_HEIGHT;
        const height = Math.max(SLOT_HEIGHT, (block.end_slot - block.start_slot) * SLOT_HEIGHT);
        const bg = colorOf(block.work_type, settings);
        const fg = textOn(block.work_type, settings);
        const sub = subTextOn(block.work_type, settings);
        const wtLabel = labelOf(block.work_type, settings);

        return (
          <div
            key={block.id}
            className={cn(
              "absolute z-10 left-0.5 right-0.5 rounded-md shadow-sm overflow-hidden transition-opacity",
              dimmed && "opacity-30",
              isMoving && "opacity-35 cursor-grabbing",
              isSelected && "ring-2 ring-foreground ring-offset-1 ring-offset-card z-10",
            )}
            style={{
              top: top + 1,
              height: height - 2,
              background: bg,
              cursor: isResizing ? "ns-resize" : isMoving ? "grabbing" : "grab",
            }}
            onPointerMove={(event) => {
              if (isMoving || isEditing) return;
              event.currentTarget.style.cursor =
                getBlockInteractionMode(event.currentTarget, event.clientY) === "move"
                  ? "grab"
                  : "ns-resize";
            }}
            onPointerDown={(e) => {
              if (isEditing) return;
              onBlockPointerDown(e, block);
            }}
          >
            {!isEditing && (
              <BlockContent block={block} wtLabel={wtLabel} height={height} fg={fg} sub={sub} />
            )}
            {isEditing && (
              <BlockEditor
                block={block}
                value={editingTitle}
                inputRef={editInputRef}
                fg={fg}
                onChange={onInputChange}
                onCommit={() => onCommitInline(block)}
                onCancel={onCancelInline}
              />
            )}
          </div>
        );
      })}

      {movingPreview &&
        (() => {
          const previewHeight = Math.max(
            SLOT_HEIGHT,
            (movingPreview.endSlot - movingPreview.startSlot) * SLOT_HEIGHT,
          );
          const bg = colorOf(movingPreview.block.work_type, settings);
          const fg = textOn(movingPreview.block.work_type, settings);
          return (
            <div
              className="absolute left-0.5 right-0.5 rounded-md shadow-md pointer-events-none z-20 px-1.5 py-1 text-[10px] font-medium overflow-hidden"
              style={{
                top: movingPreview.startSlot * SLOT_HEIGHT + 1,
                height: previewHeight - 2,
                background: bg,
                color: fg,
              }}
            >
              {slotToTimeString(movingPreview.startSlot)} –{" "}
              {slotToTimeString(movingPreview.endSlot)} ·{" "}
              {formatDuration((movingPreview.endSlot - movingPreview.startSlot) * SLOT_MINUTES)}
            </div>
          );
        })()}
    </div>
  );
}

// ---------------- Block content (read mode) ----------------

function BlockContent({
  block,
  wtLabel,
  height,
  fg,
  sub,
}: {
  block: TimeBlock;
  wtLabel: string;
  height: number;
  fg: string;
  sub: string;
}) {
  const hasCustomer = !!block.customer;
  const hasTitle = !!block.title;
  // Primary: prefer title; else customer name; else work type label.
  const primary = hasTitle ? block.title : hasCustomer ? block.customer : wtLabel;
  const compact = height < SLOT_HEIGHT * 2;
  // Show customer as its own line when both title and customer exist and there's room.
  const showCustomerLine =
    hasCustomer && hasTitle && block.title !== block.customer && height >= SLOT_HEIGHT * 2;
  // For compact blocks with both, inline the customer after the title.
  const showInlineCustomer = hasCustomer && hasTitle && block.title !== block.customer && compact;
  const showSummary = height >= SLOT_HEIGHT * 4 && !!block.summary;

  return (
    <div
      className={cn(
        "h-full w-full px-1.5 flex flex-col gap-0.5 overflow-hidden",
        compact ? "py-0" : "py-1",
      )}
      style={{ color: fg }}
    >
      <div
        className={cn(
          "font-medium leading-tight break-words",
          compact ? "text-[10px] truncate" : "text-[11px]",
        )}
      >
        {primary}
        {showInlineCustomer && (
          <span className="ml-1 inline-flex items-center gap-0.5 align-middle px-1 py-px rounded-sm text-[9px] font-medium bg-card/85 text-foreground ring-1 ring-foreground/15 backdrop-blur-sm">
            <span className="w-1 h-1 rounded-full bg-foreground/60" />
            <span className="truncate max-w-[80px]">{block.customer}</span>
          </span>
        )}
      </div>
      {showCustomerLine && (
        <div>
          <span className="inline-flex items-center gap-1 max-w-full px-1.5 py-0.5 rounded-md text-[10px] font-medium leading-tight bg-card/85 text-foreground ring-1 ring-foreground/15 shadow-sm backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-foreground/60 shrink-0" />
            <span className="truncate">{block.customer}</span>
          </span>
        </div>
      )}
      {showSummary && (
        <div
          className="text-[10px] leading-snug break-words overflow-hidden"
          style={{
            color: sub,
            display: "-webkit-box",
            WebkitLineClamp: Math.max(1, Math.floor((height - 28) / 12)),
            WebkitBoxOrient: "vertical",
          }}
        >
          {block.summary}
        </div>
      )}
    </div>
  );
}

// ---------------- Block content (edit mode) ----------------

function BlockEditor({
  block,
  value,
  inputRef,
  fg,
  onChange,
  onCommit,
  onCancel,
}: {
  block: TimeBlock;
  value: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  fg: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="h-full w-full p-1" onPointerDown={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder={WORK_TYPE_MAP[block.work_type]?.label}
        className="w-full h-full bg-card/95 rounded-sm px-1.5 py-1 text-[11px] font-medium border border-foreground/30 outline-none ring-1 ring-foreground/10"
        style={{ color: "var(--foreground)" }}
        aria-label="编辑色块标题"
      />
      {/* keep fg referenced for unused-var lint */}
      <span className="hidden" style={{ color: fg }} />
    </div>
  );
}
