import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ExitLeadInput, LeadPoolLead } from "@/lib/salesup/leadRepository";

const INVALID_REASONS = [
  "联系不上",
  "明确拒绝",
  "暂无需求",
  "已有供应商",
  "业务不对口",
  "其他",
] as const;
type ExitType = "paused" | "invalid";

function dateAfter(days: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

interface Props {
  lead: LeadPoolLead;
  initialType?: ExitType;
  onClose: () => void;
  onConfirm: (input: ExitLeadInput) => Promise<void>;
}

export function LeadExitDialog({ lead, initialType = "paused", onClose, onConfirm }: Props) {
  const [type, setType] = useState<ExitType>(initialType);
  const [resumeOn, setResumeOn] = useState(() => dateAfter(30));
  const [pausedReason, setPausedReason] = useState("");
  const [invalidReason, setInvalidReason] = useState<(typeof INVALID_REASONS)[number] | "">("");
  const [customReason, setCustomReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (saving) return;
    let input: ExitLeadInput;
    if (type === "paused") {
      if (!resumeOn || resumeOn < dateAfter(1)) {
        setError("请选择明天或之后的回捞日期。");
        return;
      }
      input = { type, resumeOn, reason: pausedReason.trim() || undefined };
    } else {
      const reason = invalidReason === "其他" ? customReason.trim() : invalidReason;
      if (!reason) {
        setError("请选择或填写无法推进的原因。");
        return;
      }
      input = { type, reason };
    }

    setSaving(true);
    setError(null);
    try {
      await onConfirm(input);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作失败，请稍后重试。");
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md gap-0 rounded-[var(--radius)] border-border bg-card p-0">
        <DialogHeader className="border-b border-border px-4 py-3 text-left">
          <DialogTitle className="text-base">移出线索池</DialogTitle>
          <DialogDescription className="text-xs">
            {lead.company || "未命名线索"} 将不再出现在当前活跃阶段卡片中。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-4 py-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType("paused")}
              className={cn(
                "rounded-[var(--radius)] border px-3 py-2 text-left text-xs transition",
                type === "paused"
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40",
              )}
            >
              <span className="block font-medium text-sm">暂不跟进</span>
              <span className="mt-0.5 block">到期后自动回捞</span>
            </button>
            <button
              type="button"
              onClick={() => setType("invalid")}
              className={cn(
                "rounded-[var(--radius)] border px-3 py-2 text-left text-xs transition",
                type === "invalid"
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40",
              )}
            >
              <span className="block font-medium text-sm">无法推进</span>
              <span className="mt-0.5 block">保留原因，用于复盘</span>
            </button>
          </div>

          {type === "paused" ? (
            <div className="space-y-3">
              <label className="block text-xs font-medium">
                回捞日期 <span className="text-destructive">*</span>
                <input
                  type="date"
                  min={dateAfter(1)}
                  value={resumeOn}
                  onChange={(event) => setResumeOn(event.target.value)}
                  className="mt-1.5 block h-10 w-full rounded-[var(--radius)] border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
                />
              </label>
              <label className="block text-xs font-medium">
                原因 <span className="font-normal text-muted-foreground">（选填）</span>
                <textarea
                  value={pausedReason}
                  onChange={(event) => setPausedReason(event.target.value)}
                  rows={3}
                  placeholder="例如：对方预算需等下个季度确认"
                  className="mt-1.5 block w-full resize-y rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/60"
                />
              </label>
            </div>
          ) : (
            <div>
              <div className="mb-1.5 text-xs font-medium">
                原因 <span className="text-destructive">*</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {INVALID_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setInvalidReason(reason)}
                    className={cn(
                      "rounded-full border px-2.5 py-1.5 text-xs transition",
                      invalidReason === reason
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              {invalidReason === "其他" && (
                <textarea
                  value={customReason}
                  onChange={(event) => setCustomReason(event.target.value)}
                  rows={3}
                  autoFocus
                  placeholder="请说明原因"
                  className="mt-3 block w-full resize-y rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/60"
                />
              )}
            </div>
          )}

          {error && (
            <div className="rounded-[var(--radius)] border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border bg-background/60 px-4 py-3 sm:space-x-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-9 rounded-[var(--radius)] border border-border px-3.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-60"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius)] bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            确认移出
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
