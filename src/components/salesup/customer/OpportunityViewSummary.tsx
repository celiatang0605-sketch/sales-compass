import { CalendarClock, SlidersHorizontal, Timer } from "lucide-react";
import { useState } from "react";
import { getEffectiveWinRate, isStale } from "@/lib/salesup/customerTypes";
import { useStageSettings } from "@/lib/salesup/stageSettings";
import type { OpportunityWithDetails } from "@/lib/salesup/opportunityTypes";
import { StageSettingsDialog } from "./StageSettingsDialog";

function formatAmount(amount: number): string {
  return `¥${amount.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

export function OpportunityViewSummary({
  opportunities,
  today,
}: {
  opportunities: OpportunityWithDetails[];
  today: string;
}) {
  const { staleDays } = useStageSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const customerCount = new Set(opportunities.map((opportunity) => opportunity.customerId)).size;
  const totalAmount = opportunities.reduce(
    (sum, opportunity) => sum + (opportunity.amount ?? 0),
    0,
  );
  const weightedAmount = opportunities.reduce(
    (sum, opportunity) =>
      sum +
      (opportunity.amount === null
        ? 0
        : (opportunity.amount * getEffectiveWinRate(opportunity)) / 100),
    0,
  );
  const overdue = opportunities.filter(
    (opportunity) =>
      !!opportunity.nextAction &&
      !!opportunity.nextActionDate &&
      opportunity.nextActionDate < today,
  ).length;
  const stale = opportunities.filter(
    (opportunity) => opportunity.stage !== "signed" && isStale(opportunity, staleDays),
  ).length;
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">
        共{" "}
        <span className="font-semibold text-foreground tabular-nums">{opportunities.length}</span>{" "}
        个商机 · <span className="font-semibold text-foreground tabular-nums">{customerCount}</span>{" "}
        家客户 · 合计{" "}
        <span className="font-semibold text-foreground tabular-nums">
          {formatAmount(totalAmount)}
        </span>{" "}
        · 加权{" "}
        <span className="font-semibold text-foreground tabular-nums">
          {formatAmount(weightedAmount)}
        </span>
      </span>
      <span className="ml-auto inline-flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="h-3.5 w-3.5" />
          逾期 {overdue}
        </span>
        <span className="inline-flex items-center gap-1">
          <Timer className="h-3.5 w-3.5" />
          停滞 {stale}
        </span>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="inline-flex items-center gap-1 hover:text-primary"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          阈值设置
        </button>
      </span>
      {settingsOpen && <StageSettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
