import type { DayStats } from "@/lib/salesup/stats";
import { formatDuration } from "@/lib/salesup/date";

interface Props {
  stats: DayStats;
  title?: string;
}

export function StatsCards({ stats, title = "今日数据" }: Props) {
  const items = [
    { label: "客户推进", value: formatDuration(stats.customerProgressMinutes), tone: "primary" as const },
    { label: "内部消耗", value: formatDuration(stats.internalCostMinutes), tone: "muted" as const },
    { label: "方案准备", value: formatDuration(stats.proposalMinutes), tone: "amber" as const },
    { label: "学习复盘", value: formatDuration(stats.learningReviewMinutes), tone: "review" as const },
    {
      label: "高价值占比",
      value: `${Math.round(stats.highValueRatio * 100)}%`,
      tone: "highlight" as const,
    },
  ];
  const toneBg: Record<string, string> = {
    primary: "var(--wt-meeting-customer)",
    muted: "var(--wt-internal-meeting)",
    amber: "var(--wt-proposal)",
    review: "var(--wt-review)",
    highlight: "var(--primary)",
  };
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-2">{title}</div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {items.map((it) => (
          <div
            key={it.label}
            className="rounded-lg border border-border bg-card p-3 relative overflow-hidden"
          >
            <span
              className="absolute left-0 top-0 bottom-0 w-1"
              style={{ background: toneBg[it.tone] }}
            />
            <div className="text-[11px] text-muted-foreground">{it.label}</div>
            <div className="text-lg font-semibold mt-0.5">{it.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
