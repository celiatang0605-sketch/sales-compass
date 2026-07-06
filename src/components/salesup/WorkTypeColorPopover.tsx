import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  PRESET_SWATCHES,
  startingHexOf,
  useWorkTypeSettings,
} from "@/lib/salesup/workTypeSettings";
import { WORK_TYPE_MAP, type BuiltinWorkTypeId } from "@/lib/salesup/workTypes";

interface Props {
  workTypeId: BuiltinWorkTypeId;
  anchorRect: DOMRect;
  onClose: () => void;
}

export function WorkTypeColorPopover({ workTypeId, anchorRect, onClose }: Props) {
  const { settings, setColor, resetColor } = useWorkTypeSettings();
  const [value, setValue] = useState<string>(() => startingHexOf(workTypeId, settings));
  const ref = useRef<HTMLDivElement>(null);
  const wt = WORK_TYPE_MAP[workTypeId];

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const apply = (hex: string) => {
    setValue(hex);
    setColor(workTypeId, hex);
  };

  // Position below the anchor; clamp into viewport.
  const top = anchorRect.bottom + 6;
  const left = Math.min(
    Math.max(8, anchorRect.left),
    (typeof window !== "undefined" ? window.innerWidth : 320) - 260,
  );

  return (
    <div
      ref={ref}
      className="fixed z-50 w-[244px] rounded-xl border border-border bg-popover shadow-lg p-3"
      style={{ top, left }}
      onPointerDown={(e) => e.stopPropagation()}
      role="dialog"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium">
          颜色 · {wt?.label ?? workTypeId}
        </div>
        <button
          onClick={() => {
            resetColor(workTypeId);
            setValue(startingHexOf(workTypeId, { colors: {}, labels: {} }));
          }}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          aria-label="恢复默认颜色"
        >
          <RotateCcw className="w-3 h-3" />
          默认
        </button>
      </div>

      <div className="grid grid-cols-8 gap-1.5 mb-3">
        {PRESET_SWATCHES.map((hex) => (
          <button
            key={hex}
            onClick={() => apply(hex)}
            className="w-6 h-6 rounded-md ring-1 ring-foreground/10 hover:ring-foreground/40 transition"
            style={{ background: hex }}
            aria-label={hex}
          />
        ))}
      </div>

      <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>自定义</span>
        <input
          type="color"
          value={value}
          onChange={(e) => apply(e.target.value)}
          className="h-7 w-12 rounded border border-border bg-card cursor-pointer"
        />
        <span className="font-mono text-foreground">{value.toLowerCase()}</span>
      </label>

      <div className="mt-3 flex justify-end">
        <button
          onClick={onClose}
          className="px-2.5 py-1 rounded-md border border-border bg-card text-xs hover:bg-secondary"
        >
          完成
        </button>
      </div>
    </div>
  );
}
