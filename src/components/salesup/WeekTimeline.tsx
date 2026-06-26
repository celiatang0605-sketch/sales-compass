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
import type { TimeBlock } from "@/lib/salesup/types";
import { cn } from "@/lib/utils";

interface Props {
  weekDays: string[]; // 7 date keys, Monday first
  blocks: TimeBlock[];
  filter: WorkTypeId | "all";
  activeWorkType?: WorkTypeId | null; // when set, drag creates with this type
  highlightDate?: string;
  onSelectBlock: (block: TimeBlock) => void;
  onCreateRange: (date: string, startSlot: number, endSlot: number) => void;
  onInlineSaveTitle?: (block: TimeBlock, title: string) => void;
}

interface CellInfo {
  block?: TimeBlock;
  isFirstOfBlock: boolean;
}

const WEEKDAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export function WeekTimeline({
  weekDays,
  blocks,
  filter,
  activeWorkType,
  highlightDate,
  onSelectBlock,
  onCreateRange,
  onInlineSaveTitle,
}: Props) {
  const cellsByDay: Record<string, CellInfo[]> = {};
  for (const d of weekDays) {
    cellsByDay[d] = Array.from({ length: TOTAL_SLOTS }, () => ({ isFirstOfBlock: false }));
  }
  for (const b of blocks) {
    const arr = cellsByDay[b.date];
    if (!arr) continue;
    for (let s = b.start_slot; s < b.end_slot && s < TOTAL_SLOTS; s++) {
      arr[s] = { block: b, isFirstOfBlock: s === b.start_slot };
    }
  }

  const [dragDay, setDragDay] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const draggingRef = useRef(false);

  // Inline title editing
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

  const inRange = (day: string, slot: number) => {
    if (dragDay !== day || dragStart == null || dragEnd == null) return false;
    const lo = Math.min(dragStart, dragEnd);
    const hi = Math.max(dragStart, dragEnd);
    return slot >= lo && slot <= hi;
  };

  const handleBlockClick = (block: TimeBlock) => {
    // Distinguish single vs double click via short timeout
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
    const cell = cellsByDay[day][slot];
    if (cell.block) {
      handleBlockClick(cell.block);
      return;
    }
    draggingRef.current = true;
    setDragDay(day);
    setDragStart(slot);
    setDragEnd(slot);
  };

  const handlePointerEnter = (day: string, slot: number) => {
    if (!draggingRef.current || dragDay !== day) return;
    if (cellsByDay[day][slot].block) return;
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
  const today = todayKey();
  const createCursor = activeWorkType ? "crosshair" : "default";

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
                <div
                  className={cn(
                    "text-sm font-semibold mt-0.5",
                    isToday && "text-primary",
                  )}
                >
                  {dt.getMonth() + 1}/{dt.getDate()}
                </div>
              </div>
            );
          })}

          {/* Slot rows */}
          {Array.from({ length: hours }).map((_, hourIdx) =>
            Array.from({ length: SLOTS_PER_HOUR }).map((_, q) => {
              const slot = hourIdx * SLOTS_PER_HOUR + q;
              const isHourStart = q === 0;
              const hourLabel = String(DAY_START_HOUR + hourIdx).padStart(2, "0") + ":00";
              return (
                <div key={slot} className="contents">
                  <div
                    className={cn(
                      "text-[10px] text-muted-foreground pr-1 text-right",
                      isHourStart ? "border-t border-border pt-0.5" : "",
                    )}
                    style={{ height: 14 }}
                  >
                    {isHourStart ? hourLabel : ""}
                  </div>
                  {weekDays.map((day) => {
                    const cell = cellsByDay[day][slot];
                    const block = cell.block;
                    const wt = block ? WORK_TYPE_MAP[block.work_type] : null;
                    const isSelected = inRange(day, slot);
                    const dimmed = block && filter !== "all" && block.work_type !== filter;
                    const isEditing = block && editingId === block.id && cell.isFirstOfBlock;
                    const bg = block && wt
                      ? `var(${wt.colorVar})`
                      : isSelected
                        ? "var(--accent)"
                        : "transparent";
                    return (
                      <button
                        type="button"
                        key={day + slot}
                        onPointerDown={(e) => {
                          if (editingId) return;
                          e.preventDefault();
                          handlePointerDown(day, slot);
                        }}
                        onPointerEnter={() => handlePointerEnter(day, slot)}
                        className={cn(
                          "relative text-left border-l border-border transition-opacity hover:brightness-95",
                          isHourStart ? "border-t" : "",
                          dimmed && "opacity-30",
                        )}
                        style={{ height: 14, background: bg }}
                        aria-label={`${day} ${slotToTimeString(slot)} ${block ? block.title || wt?.label : "空闲"}`}
                      >
                        {cell.isFirstOfBlock && block && !isEditing && (
                          <span className="absolute inset-x-1 top-0 truncate font-medium text-[10px] leading-[14px] text-foreground/85 pointer-events-none">
                            {block.title || WORK_TYPE_MAP[block.work_type]?.label}
                            {block.customer ? ` · ${block.customer}` : ""}
                          </span>
                        )}
                        {isEditing && block && (
                          <input
                            ref={editInputRef}
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={() => commitInline(block)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitInline(block);
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                setEditingId(null);
                              }
                            }}
                            placeholder={WORK_TYPE_MAP[block.work_type]?.label}
                            className="absolute left-0 right-0 z-20 px-1 text-[11px] font-medium bg-card border border-foreground/40 rounded-sm shadow"
                            style={{ top: -2, height: 20 }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            }),
          )}
        </div>
      </div>
      <div className="px-3 py-2 border-t border-border text-[11px] text-muted-foreground bg-muted/40">
        {activeWorkType
          ? "点击单格创建 15 分钟，按住拖动创建连续时间段；双击已有色块可快速改标题"
          : "先在上方选择一个工作类型再创建；双击已有色块可快速改标题"}
      </div>
    </div>
  );
}
