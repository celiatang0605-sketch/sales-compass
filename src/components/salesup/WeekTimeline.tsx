import { useState, useRef, useEffect, useCallback } from "react";
import {
  TOTAL_SLOTS,
  SLOTS_PER_HOUR,
  DAY_START_HOUR,
  slotToTimeString,
  fromDateKey,
  todayKey,
} from "@/lib/salesup/date";
import { WORK_TYPE_MAP, type WorkTypeId } from "@/lib/salesup/workTypes";
import {
  colorOf,
  labelOf,
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
  onInlineSaveTitle?: (block: TimeBlock, title: string) => void;
}

const WEEKDAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const SLOT_HEIGHT = 14; // px per 15-min slot
const HOUR_HEIGHT = SLOT_HEIGHT * SLOTS_PER_HOUR; // 56px

export function WeekTimeline({
  weekDays,
  blocks,
  filter,
  activeWorkType,
  highlightDate,
  selectedBlockId,
  onSelectBlock,
  onCreateRange,
  onInlineSaveTitle,
}: Props) {
  const { settings } = useWorkTypeSettings();

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
      <div className="overflow-x-auto">
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
                  "border-b border-l border-border px-2 py-2 text-center",
                  isToday && "bg-primary/10",
                  isHl && !isToday && "bg-accent",
                  isWeekend && !isToday && !isHl && "bg-muted/30",
                )}
              >
                <div className="text-[11px] text-muted-foreground">{WEEKDAY_LABELS[idx]}</div>
                <div className={cn("text-sm font-semibold mt-0.5", isToday && "text-primary")}>
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
              dragRange={dragRange?.day === day ? { lo: dragRange.lo, hi: dragRange.hi } : null}
              editingId={editingId}
              editingTitle={editingTitle}
              editInputRef={editInputRef}
              onInputChange={setEditingTitle}
              onCommitInline={commitInline}
              onCancelInline={() => setEditingId(null)}
              onPointerDown={handlePointerDown}
              onPointerEnter={handlePointerEnter}
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
  dragRange: { lo: number; hi: number } | null;
  editingId: string | null;
  editingTitle: string;
  editInputRef: React.RefObject<HTMLInputElement | null>;
  onInputChange: (v: string) => void;
  onCommitInline: (b: TimeBlock | undefined) => void;
  onCancelInline: () => void;
  onPointerDown: (day: string, slot: number) => void;
  onPointerEnter: (day: string, slot: number) => void;
}

function DayColumn({
  day,
  hours,
  totalHeight,
  dayBlocks,
  filter,
  settings,
  selectedBlockId,
  dragRange,
  editingId,
  editingTitle,
  editInputRef,
  onInputChange,
  onCommitInline,
  onCancelInline,
  onPointerDown,
  onPointerEnter,
}: DayColumnProps) {
  return (
    <div className="relative border-l border-border" style={{ height: totalHeight }}>
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
        const wt = WORK_TYPE_MAP[block.work_type];
        if (!wt) return null;
        const dimmed = filter !== "all" && block.work_type !== filter;
        const isEditing = editingId === block.id;
        const isSelected = selectedBlockId === block.id;
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
              "absolute left-0.5 right-0.5 rounded-md shadow-sm overflow-hidden transition-opacity",
              dimmed && "opacity-30",
              isSelected && "ring-2 ring-foreground ring-offset-1 ring-offset-card z-10",
            )}
            style={{
              top: top + 1,
              height: height - 2,
              background: bg,
              cursor: "pointer",
            }}
            onPointerDown={(e) => {
              if (isEditing) return;
              e.preventDefault();
              e.stopPropagation();
              onPointerDown(day, block.start_slot);
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
  const showInlineCustomer =
    hasCustomer && hasTitle && block.title !== block.customer && compact;
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
          <span
            className="ml-1 inline-flex items-center gap-0.5 align-middle px-1 py-px rounded-sm text-[9px] font-medium bg-card/85 text-foreground ring-1 ring-foreground/15 backdrop-blur-sm"
          >
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
