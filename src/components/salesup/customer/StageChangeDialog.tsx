// 阶段推进对话框：点击触发（本步不做拖拽）。
// 数据层调用全部走 customerRepository / hooks，组件内不直接调 supabase。
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, CornerUpLeft, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { slotToTimeString, todayKey } from "@/lib/salesup/date";
import { changeCustomerStage } from "@/lib/salesup/customerRepository";
import { useCustomerDayBlocks } from "@/lib/salesup/useCustomerDayBlocks";
import {
  STAGE_LABEL,
  STAGE_ORDER,
  type Customer,
  type CustomerStage,
} from "@/lib/salesup/customerTypes";

interface Props {
  customer: Customer;
  targetStage: CustomerStage;
  onClose: () => void;
  /** 推进成功后回调，用于刷新列表 / 详情。 */
  onChanged?: (updated: Customer) => void;
}

export function StageChangeDialog({ customer, targetStage, onClose, onChanged }: Props) {
  const [mounted, setMounted] = useState(false);
  const [reason, setReason] = useState("");
  const [blockId, setBlockId] = useState<string | null>(null);
  const [markWon, setMarkWon] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const date = todayKey();
  const { blocks, loading: blocksLoading } = useCustomerDayBlocks({
    date,
    customerId: customer.id,
    companyName: customer.companyName,
  });

  const fromIndex = STAGE_ORDER.indexOf(customer.stage);
  const toIndex = STAGE_ORDER.indexOf(targetStage);
  const isBackward = toIndex < fromIndex;
  const isSigned = targetStage === "signed";

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleConfirm = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await changeCustomerStage({
        customerId: customer.id,
        fromStage: customer.stage,
        toStage: targetStage,
        reason,
        relatedBlockId: blockId,
        markWon: isSigned && markWon,
      });
      toast.success(
        isBackward
          ? `已回退到「${STAGE_LABEL[targetStage]}」`
          : `已推进到「${STAGE_LABEL[targetStage]}」`,
      );
      onChanged?.(updated);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败，请重试。";
      setError(msg);
      toast.error(msg);
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-foreground/30 p-0 md:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full md:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-[var(--radius)] md:rounded-[var(--radius)] border border-border bg-card shadow-lg">
        {/* 头部：阶段变化 */}
        <header
          className={cn(
            "flex items-start gap-2 px-4 py-3 border-b border-border",
            isBackward ? "bg-muted/70" : "bg-secondary/50",
          )}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {isBackward ? (
                <>
                  <CornerUpLeft className="w-3.5 h-3.5" />
                  阶段回退
                </>
              ) : (
                <>
                  <ArrowRight className="w-3.5 h-3.5" />
                  阶段推进
                </>
              )}
              <span className="truncate">· {customer.companyName}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm font-medium">
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full border text-xs",
                  isBackward
                    ? "border-border text-muted-foreground"
                    : "border-border text-muted-foreground",
                )}
              >
                {STAGE_LABEL[customer.stage]}
              </span>
              {isBackward ? (
                <CornerUpLeft className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              )}
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-xs",
                  isBackward
                    ? "bg-muted text-foreground/80 border border-dashed border-border"
                    : "bg-primary text-primary-foreground",
                )}
              >
                {STAGE_LABEL[targetStage]}
              </span>
            </div>
            {isBackward && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                这是一次回退，建议写清楚回退原因，方便复盘。
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="p-4 space-y-4">
          {/* 推进原因 */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              {isBackward ? "因为什么回退？" : "因为什么推进？"}
              <span className="ml-1 text-[11px] font-normal text-muted-foreground">选填</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              autoFocus
              placeholder={
                isBackward
                  ? "例：对接人离职，需求需要重新确认，回到需求确认阶段。"
                  : "例：今天和王总过完需求清单，确认了三个投放市场和预算区间，可以进入方案确认。"
              }
              className="w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/60 resize-y"
            />
          </div>

          {/* 关联今天的记录 */}
          <div>
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <span className="text-sm font-medium">关联今天的记录</span>
              <span className="text-[11px] text-muted-foreground tabular-nums">{date}</span>
            </div>
            {blocksLoading && (
              <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                正在查找当天记录…
              </div>
            )}
            {!blocksLoading && blocks.length === 0 && (
              <div className="rounded-[var(--radius)] border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
                今天还没有关联到这个客户的时间块，可以先不选。
              </div>
            )}
            {!blocksLoading && blocks.length > 0 && (
              <div className="space-y-1.5">
                {blocks.map((b) => {
                  const active = blockId === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBlockId(active ? null : b.id)}
                      className={cn(
                        "w-full flex items-center gap-2 rounded-[var(--radius)] border px-3 py-2 text-left text-xs transition",
                        active
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background hover:border-primary/40",
                      )}
                    >
                      <span
                        className={cn(
                          "shrink-0 w-3.5 h-3.5 rounded-full border inline-flex items-center justify-center",
                          active ? "border-primary bg-primary" : "border-border",
                        )}
                      >
                        {active && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {slotToTimeString(b.startSlot)}–{slotToTimeString(b.endSlot)}
                      </span>
                      <span className="truncate">{b.title || b.customer || "未命名记录"}</span>
                    </button>
                  );
                })}
                {blockId && (
                  <button
                    type="button"
                    onClick={() => setBlockId(null)}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    取消选择
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 已签合同：是否同时标记为已赢 */}
          {isSigned && (
            <label className="flex items-start gap-2 rounded-[var(--radius)] border border-border bg-muted/40 px-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={markWon}
                onChange={(e) => setMarkWon(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 accent-[var(--primary)]"
              />
              <span className="text-xs leading-snug">
                <span className="font-medium">是否同时标记为「已赢」？</span>
                <span className="block text-muted-foreground mt-0.5">
                  勾选后客户状态会从「进行中」切换为「已赢」，并从进行中看板移出。
                </span>
              </span>
            </label>
          )}

          {error && (
            <div className="rounded-[var(--radius)] border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive break-words">
              {error}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-background/60 sticky bottom-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3.5 rounded-[var(--radius)] border border-border text-sm text-muted-foreground hover:text-foreground"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={saving}
            className="h-9 px-4 rounded-[var(--radius)] bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isBackward ? "确认回退" : "确认推进"}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
