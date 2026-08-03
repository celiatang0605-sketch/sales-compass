import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, CornerUpLeft, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { slotToTimeString, todayKey } from "@/lib/salesup/date";
import { changeOpportunityStage } from "@/lib/salesup/opportunityRepository";
import { useCustomerDayBlocks } from "@/lib/salesup/useCustomerDayBlocks";
import { STAGE_LABEL, STAGE_ORDER, type CustomerStage } from "@/lib/salesup/customerTypes";
import type { Opportunity, OpportunityWithDetails } from "@/lib/salesup/opportunityTypes";

interface Props {
  opportunity: OpportunityWithDetails;
  targetStage: CustomerStage;
  onClose: () => void;
  onChanged?: (updated: Opportunity) => void;
}

/** 商机阶段确认，复用客户看板的原因与时间块留痕交互。 */
export function OpportunityStageChangeDialog({
  opportunity,
  targetStage,
  onClose,
  onChanged,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [reason, setReason] = useState("");
  const [blockId, setBlockId] = useState<string | null>(null);
  const [markWon, setMarkWon] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const date = todayKey();
  const { blocks, loading: blocksLoading } = useCustomerDayBlocks({
    date,
    customerId: opportunity.customerId,
    companyName: opportunity.customer.companyName,
  });
  const fromIndex = STAGE_ORDER.indexOf(opportunity.stage);
  const toIndex = STAGE_ORDER.indexOf(targetStage);
  const isBackward = toIndex < fromIndex;
  const isSigned = targetStage === "signed";

  useEffect(() => {
    setMounted(true);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const confirm = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await changeOpportunityStage({
        opportunity,
        fromStage: opportunity.stage,
        toStage: targetStage,
        reason,
        relatedBlockId: blockId,
        markWon: isSigned && markWon,
      });
      toast.success(`${isBackward ? "已回退到" : "已推进到"}「${STAGE_LABEL[targetStage]}」`);
      onChanged?.(updated);
      onClose();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "保存失败，请重试。";
      setError(message);
      toast.error(message);
      setSaving(false);
    }
  };

  if (!mounted) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-0 md:items-center md:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-[var(--radius)] border border-border bg-card shadow-lg md:max-w-lg md:rounded-[var(--radius)]">
        <header className="flex items-start gap-2 border-b border-border bg-secondary/50 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {isBackward ? (
                <CornerUpLeft className="h-3.5 w-3.5" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5" />
              )}
              <span className="truncate">
                {opportunity.customer.companyName} · {opportunity.name}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-sm font-medium">
              <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                {STAGE_LABEL[opportunity.stage]}
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {STAGE_LABEL[targetStage]}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 p-4">
          <label className="block text-sm font-medium">
            {isBackward ? "回退原因" : "推进原因"}
            <span className="ml-1 text-[11px] font-normal text-muted-foreground">选填</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              autoFocus
              className="mt-1.5 w-full resize-y rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/60"
            />
          </label>
          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium">关联今天的记录</span>
              <span className="text-[11px] tabular-nums text-muted-foreground">{date}</span>
            </div>
            {blocksLoading && (
              <div className="inline-flex items-center gap-1.5 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                正在查找当天记录…
              </div>
            )}
            {!blocksLoading && blocks.length === 0 && (
              <div className="rounded-[var(--radius)] border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
                今天还没有关联到该客户的时间块，可以先不选。
              </div>
            )}
            {!blocksLoading && blocks.length > 0 && (
              <div className="space-y-1.5">
                {blocks.map((block) => {
                  const selected = blockId === block.id;
                  return (
                    <button
                      key={block.id}
                      type="button"
                      onClick={() => setBlockId(selected ? null : block.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-[var(--radius)] border px-3 py-2 text-left text-xs",
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background hover:border-primary/40",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border",
                          selected ? "border-primary bg-primary" : "border-border",
                        )}
                      >
                        {selected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {slotToTimeString(block.startSlot)}–{slotToTimeString(block.endSlot)}
                      </span>
                      <span className="truncate">
                        {block.title || block.customer || "未命名记录"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {isSigned && (
            <label className="flex cursor-pointer items-start gap-2 rounded-[var(--radius)] border border-border bg-muted/40 px-3 py-2.5">
              <input
                type="checkbox"
                checked={markWon}
                onChange={(event) => setMarkWon(event.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 accent-[var(--primary)]"
              />
              <span className="text-xs">
                <span className="font-medium">同时标记为「已赢」</span>
                <span className="mt-0.5 block text-muted-foreground">
                  商机状态将从进行中改为已赢。
                </span>
              </span>
            </label>
          )}
          {error && (
            <div className="rounded-[var(--radius)] border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>
        <footer className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-background/60 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-[var(--radius)] border border-border px-3.5 text-sm text-muted-foreground hover:text-foreground"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius)] bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isBackward ? "确认回退" : "确认推进"}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
