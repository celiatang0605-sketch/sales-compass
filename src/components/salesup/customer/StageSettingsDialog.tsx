import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { RotateCcw, X } from "lucide-react";
import {
  STAGE_COLOR_TOKEN,
  STAGE_LABEL,
  STAGE_ORDER,
  type CustomerStage,
} from "@/lib/salesup/customerTypes";
import { useStageSettings } from "@/lib/salesup/stageSettings";

const CONFIGURABLE_STAGES = STAGE_ORDER.filter((stage) => stage !== "signed");

function inputValues(
  staleDays: Record<CustomerStage, number | null>,
): Record<CustomerStage, string> {
  return STAGE_ORDER.reduce<Record<CustomerStage, string>>(
    (values, stage) => {
      values[stage] = staleDays[stage] === null ? "" : String(staleDays[stage]);
      return values;
    },
    {} as Record<CustomerStage, string>,
  );
}

export function StageSettingsDialog({ onClose }: { onClose: () => void }) {
  const { staleDays, isCustomized, setStaleDays, resetStaleDays, resetAll } = useStageSettings();
  const thresholdsKey = useMemo(
    () => STAGE_ORDER.map((stage) => staleDays[stage]).join(","),
    [staleDays],
  );
  const [values, setValues] = useState(() => inputValues(staleDays));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    setValues(inputValues(staleDays));
  }, [staleDays, thresholdsKey]);

  const restoreValue = (stage: CustomerStage) => {
    setValues((current) => ({ ...current, [stage]: String(staleDays[stage] ?? "") }));
  };

  const changeValue = (stage: CustomerStage, value: string) => {
    setValues((current) => ({ ...current, [stage]: value }));
    const days = Number(value);
    if (Number.isInteger(days) && days >= 1 && days <= 365) setStaleDays(stage, days);
  };

  const body = (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/30 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">停滞阈值</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              每个阶段允许停留的天数，超过后标记为停滞。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-2">
          {CONFIGURABLE_STAGES.map((stage) => {
            const colorToken = STAGE_COLOR_TOKEN[stage];
            return (
              <div
                key={stage}
                className="flex items-center gap-3 border-b border-border/70 py-2.5 last:border-b-0"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: `var(${colorToken})` }}
                />
                <span className="flex-1 text-sm">{STAGE_LABEL[stage]}</span>
                {isCustomized[stage] && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    已修改
                  </span>
                )}
                {isCustomized[stage] && (
                  <button
                    type="button"
                    onClick={() => resetStaleDays(stage)}
                    className="text-[11px] text-primary hover:underline"
                  >
                    重置
                  </button>
                )}
                <input
                  type="number"
                  min={1}
                  max={365}
                  step={1}
                  value={values[stage]}
                  onChange={(event) => changeValue(stage, event.target.value)}
                  onBlur={() => restoreValue(stage)}
                  className="h-8 w-16 rounded-md border border-border bg-background px-2 text-center text-sm tabular-nums outline-none focus:border-ring"
                  aria-label={`${STAGE_LABEL[stage]}停滞阈值`}
                />
                <span className="w-3 text-xs text-muted-foreground">天</span>
              </div>
            );
          })}

          <div className="flex items-center gap-3 py-2.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: `var(${STAGE_COLOR_TOKEN.signed})` }}
            />
            <span className="flex-1 text-sm">{STAGE_LABEL.signed}</span>
            <input
              disabled
              value="—"
              className="h-8 w-16 rounded-md border border-border bg-muted px-2 text-center text-sm text-muted-foreground"
              aria-label="已签合同不判停滞"
            />
            <span className="w-10 text-xs text-muted-foreground">不判停滞</span>
          </div>
        </div>

        <footer className="flex items-center border-t border-border bg-muted/30 px-5 py-3">
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            恢复默认
          </button>
          <span className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            完成
          </button>
        </footer>
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(body, document.body);
}
