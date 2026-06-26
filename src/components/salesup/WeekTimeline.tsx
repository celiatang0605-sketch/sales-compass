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
  highlightDate?: string;
  onSelectBlock: (block: TimeBlock) => void;
  onCreateRange: (date: string, startSlot: number, endSlot: number) => void;
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
  highlightDate,
  onSelectBlock,
  onCreateRange,
}: Props) {
  // Build per-day cell arrays
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

  const inRange = (day: string, slot: number) => {
    if (dragDay !== day || dragStart == null || dragEnd == null) return false;
    const lo = Math.min(dragStart, dragEnd);
    const hi = Math.max(dragStart, dragEnd);
    return slot >= lo && slot <= hi;
  };

  const handlePointerDown = (day: string, slot: number) => {
    const cell = cellsByDay[day][slot];
    if (cell.block) {
      onSelectBlock(cell.block);
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

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden select-none">
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
                        {cell.isFirstOfBlock && block && (
                          <span className="absolute inset-x-1 top-0 truncate font-medium text-[10px] leading-[14px] text-foreground/85 pointer-events-none">
                            {block.title || WORK_TYPE_MAP[block.work_type]?.label}
                            {block.customer ? ` · ${block.customer}` : ""}
                          </span>
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
        点击或拖动任意一天的空白色块创建时间段，点击已有色块编辑详情
      </div>
    </div>
  );
}
