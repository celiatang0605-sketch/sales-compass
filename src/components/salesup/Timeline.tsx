import { useState, useRef, useEffect, useCallback } from "react";
import { Settings2 } from "lucide-react";
import {
  TOTAL_SLOTS,
  SLOTS_PER_HOUR,
  DAY_START_HOUR,
  slotToTimeString,
} from "@/lib/salesup/date";
import { WORK_TYPE_MAP, type BuiltinWorkTypeId, type WorkTypeId } from "@/lib/salesup/workTypes";
import {
  colorOf,
  getEffectiveWorkTypes,
  labelOf,
  resolveWorkType,
  useWorkTypeSettings,
} from "@/lib/salesup/workTypeSettings";
import { WorkTypeColorPopover } from "./WorkTypeColorPopover";
import { ManageWorkTypesDialog } from "./ManageWorkTypesDialog";
import type { TimeBlock } from "@/lib/salesup/types";
import { cn } from "@/lib/utils";

interface Props {
  date: string;
  blocks: TimeBlock[];
  filter: WorkTypeId | "all";
  onSelectBlock: (block: TimeBlock) => void;
  onCreateRange: (startSlot: number, endSlot: number) => void;
}

interface CellInfo {
  block?: TimeBlock;
  isFirstOfBlock: boolean;
}

export function Timeline({ date, blocks, filter, onSelectBlock, onCreateRange }: Props) {
  const { settings } = useWorkTypeSettings();
  const cells: CellInfo[] = Array.from({ length: TOTAL_SLOTS }, () => ({ isFirstOfBlock: false }));
  for (const b of blocks) {
    for (let s = b.start_slot; s < b.end_slot && s < TOTAL_SLOTS; s++) {
      cells[s] = { block: b, isFirstOfBlock: s === b.start_slot };
    }
  }

  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const draggingRef = useRef(false);

  const inRange = (slot: number) => {
    if (dragStart == null || dragEnd == null) return false;
    const lo = Math.min(dragStart, dragEnd);
    const hi = Math.max(dragStart, dragEnd);
    return slot >= lo && slot <= hi;
  };

  const handlePointerDown = (slot: number) => {
    const cell = cells[slot];
    if (cell.block) {
      onSelectBlock(cell.block);
      return;
    }
    draggingRef.current = true;
    setDragStart(slot);
    setDragEnd(slot);
  };

  const handlePointerEnter = (slot: number) => {
    if (!draggingRef.current) return;
    // Stop at occupied cells
    if (cells[slot].block) return;
    setDragEnd(slot);
  };

  const commit = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (dragStart != null && dragEnd != null) {
      const lo = Math.min(dragStart, dragEnd);
      const hi = Math.max(dragStart, dragEnd);
      onCreateRange(lo, hi + 1);
    }
    setDragStart(null);
    setDragEnd(null);
  }, [dragStart, dragEnd, onCreateRange]);

  useEffect(() => {
    const up = () => commit();
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [commit]);

  const hours = (24 - DAY_START_HOUR);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden select-none" key={date}>
      <div className="grid" style={{ gridTemplateColumns: "56px 1fr" }}>
        {Array.from({ length: hours }).map((_, hourIdx) => {
          const hourLabel = String(DAY_START_HOUR + hourIdx).padStart(2, "0") + ":00";
          return (
            <div key={hourIdx} className="contents">
              <div className="text-[11px] text-muted-foreground py-1 pl-3 pr-2 border-b border-border flex items-start pt-1">
                {hourLabel}
              </div>
              <div className="grid grid-cols-4 border-b border-border">
                {Array.from({ length: SLOTS_PER_HOUR }).map((_, q) => {
                  const slot = hourIdx * SLOTS_PER_HOUR + q;
                  const cell = cells[slot];
                  const block = cell.block;
                  const isSelected = inRange(slot);
                  const eff = block ? resolveWorkType(block.work_type, settings) : null;
                  const dimmed = block && filter !== "all" && block.work_type !== filter;
                  const bg = block && eff
                    ? eff.colorCss
                    : isSelected
                      ? "var(--accent)"
                      : "transparent";
                  return (
                    <button
                      type="button"
                      key={slot}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        handlePointerDown(slot);
                      }}
                      onPointerEnter={() => handlePointerEnter(slot)}
                      className={cn(
                        "relative h-9 md:h-8 text-left text-[11px] leading-tight transition-opacity",
                        "border-l border-border first:border-l-0",
                        "hover:brightness-95",
                        dimmed && "opacity-30",
                      )}
                      style={{ background: bg }}
                      aria-label={`${slotToTimeString(slot)} ${block ? block.title || wt?.label : "空闲"}`}
                    >
                      {cell.isFirstOfBlock && block && (
                        <span className="absolute inset-x-1 top-0.5 truncate font-medium text-[11px] text-foreground/85">
                          {block.title || WORK_TYPE_MAP[block.work_type]?.label}
                        </span>
                      )}
                      {cell.isFirstOfBlock && block?.customer && (
                        <span className="absolute inset-x-1 bottom-0.5 truncate text-[10px] text-foreground/65">
                          @{block.customer}
                        </span>
                      )}
                      {!block && q === 0 && (
                        <span className="absolute left-1 top-0.5 text-[10px] text-muted-foreground/50">
                          {slotToTimeString(slot)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-3 py-2 border-t border-border text-[11px] text-muted-foreground bg-muted/40">
        点击或拖动空白色块创建时间段，点击已有色块编辑详情
      </div>
    </div>
  );
}

export function WorkTypeLegend({
  value,
  onChange,
}: {
  value: WorkTypeId | "all";
  onChange: (v: WorkTypeId | "all") => void;
}) {
  const { settings, setLabel } = useWorkTypeSettings();
  const [picker, setPicker] = useState<{ id: WorkTypeId; rect: DOMRect } | null>(null);
  const [editing, setEditing] = useState<{ id: WorkTypeId; value: string } | null>(null);

  const commitLabel = () => {
    if (!editing) return;
    setLabel(editing.id, editing.value);
    setEditing(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        onClick={() => onChange("all")}
        className={cn(
          "px-2.5 py-1 rounded-full text-xs border transition-colors",
          value === "all"
            ? "bg-primary text-primary-foreground border-primary"
            : "border-border bg-card hover:bg-secondary",
        )}
      >
        全部
      </button>
      {WORK_TYPES.map((wt) => {
        const selected = value === wt.id;
        const label = settings.labels[wt.id] || wt.label;
        const isEditing = editing?.id === wt.id;
        return (
          <div
            key={wt.id}
            onClick={() => {
              if (isEditing) return;
              onChange(selected ? "all" : wt.id);
            }}
            title="单击选中 · 双击文字改名 · 双击色块改颜色"
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-all cursor-pointer select-none",
              selected
                ? "border-foreground bg-foreground text-background shadow-sm ring-2 ring-foreground/20"
                : "border-border bg-card hover:bg-secondary",
            )}
          >
            <span
              onDoubleClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setPicker({ id: wt.id, rect });
              }}
              className="w-2.5 h-2.5 rounded-sm ring-1 ring-background/40 cursor-pointer"
              style={{ background: colorOf(wt.id, settings) }}
              title="双击改颜色"
            />
            {isEditing ? (
              <input
                autoFocus
                value={editing.value}
                onChange={(e) => setEditing({ id: wt.id, value: e.target.value })}
                onBlur={commitLabel}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitLabel();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setEditing(null);
                  }
                }}
                className="bg-background/80 text-foreground rounded px-1 py-0 w-20 text-xs outline-none ring-1 ring-foreground/30"
              />
            ) : (
              <span
                onDoubleClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setEditing({ id: wt.id, value: label });
                }}
                title="双击改名"
              >
                {label}
              </span>
            )}
          </div>
        );
      })}
      {picker && (
        <WorkTypeColorPopover
          workTypeId={picker.id}
          anchorRect={picker.rect}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
