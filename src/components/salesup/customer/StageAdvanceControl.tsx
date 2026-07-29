// 看板卡片上的轻量阶段推进控件：一个箭头按钮（推进到下一阶段）+ 一个下拉选择任意阶段。
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STAGE_LABEL,
  STAGE_ORDER,
  type CustomerStage,
} from "@/lib/salesup/customerTypes";

interface Props {
  currentStage: CustomerStage;
  onPick: (stage: CustomerStage) => void;
}

export function StageAdvanceControl({ currentStage, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const idx = STAGE_ORDER.indexOf(currentStage);
  const next = idx >= 0 && idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null;

  return (
    <div ref={ref} className="relative flex items-center gap-1">
      {next && (
        <button
          type="button"
          onClick={() => onPick(next)}
          title={`推进到「${STAGE_LABEL[next]}」`}
          className="inline-flex items-center gap-0.5 h-6 px-1.5 rounded-md border border-border text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition"
        >
          推进
          <ChevronRight className="w-3 h-3" />
        </button>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="选择阶段"
        className="inline-flex items-center justify-center h-6 w-6 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition"
      >
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-1 z-30 w-40 rounded-[var(--radius)] border border-border bg-popover shadow-md p-1">
          {STAGE_ORDER.map((s, i) => {
            const isCurrent = s === currentStage;
            const backward = i < idx;
            return (
              <button
                key={s}
                type="button"
                disabled={isCurrent}
                onClick={() => {
                  setOpen(false);
                  onPick(s);
                }}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-left text-xs transition",
                  isCurrent
                    ? "bg-secondary text-secondary-foreground cursor-default"
                    : "hover:bg-muted",
                )}
              >
                <span className="truncate">{STAGE_LABEL[s]}</span>
                {isCurrent ? (
                  <span className="text-[10px] text-muted-foreground shrink-0">当前</span>
                ) : backward ? (
                  <span className="text-[10px] text-muted-foreground shrink-0">回退</span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
