import type { DayStats } from "@/lib/salesup/stats";
import { formatDuration } from "@/lib/salesup/date";
import { useWorkTypeSettings } from "@/lib/salesup/workTypeSettings";

interface Props {
  stats: DayStats;
  title?: string;
}

export function StatsCards({ stats, title = "今日数据" }: Props) {
  const { settings } = useWorkTypeSettings();

  const baseItems: { key: string; label: string; value: string; bg: string }[] = [
    {
      key: "customer",
      label: "客户推进",
      value: formatDuration(stats.customerProgressMinutes),
      bg: "var(--wt-meeting-customer)",
    },
    {
      key: "internal",
      label: "内部消耗",
      value: formatDuration(stats.internalCostMinutes),
      bg: "var(--wt-internal-meeting)",
    },
    {
      key: "proposal",
      label: "方案准备",
      value: formatDuration(stats.proposalMinutes),
      bg: "var(--wt-proposal)",
    },
    {
      key: "learning",
      label: "学习复盘",
      value: formatDuration(stats.learningReviewMinutes),
      bg: "var(--wt-review)",
    },
    {
      key: "highvalue",
      label: "高价值占比",
      value: `${Math.round(stats.highValueRatio * 100)}%`,
      bg: "var(--primary)",
    },
  ];

  // Extra cards for user-added custom stat categories (only when they have data).
  const extra = settings.customCategories
    .map((c) => ({
      key: c.id,
      label: c.label,
      value: formatDuration(stats.byCategory[c.id] ?? 0),
      bg: "var(--accent)",
    }))
    .filter((it) => (stats.byCategory[it.key] ?? 0) > 0);

  const items = [...baseItems, ...extra];

  return (
    <div>
      <div className="text-xs text-muted-foreground mb-2">{title}</div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {items.map((it) => (
          <div
            key={it.key}
            className="rounded-lg border border-border bg-card p-3 relative overflow-hidden"
          >
            <span
              className="absolute left-0 top-0 bottom-0 w-1"
              style={{ background: it.bg }}
            />
            <div className="text-[11px] text-muted-foreground">{it.label}</div>
            <div className="text-lg font-semibold mt-0.5">{it.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
