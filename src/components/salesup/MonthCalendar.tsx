import { useMemo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import {
  fromDateKey,
  toDateKey,
  todayKey,
  monthDaysOf,
  SLOT_MINUTES,
  formatDuration,
} from "@/lib/salesup/date";
import { WORK_TYPE_MAP, type WorkTypeId } from "@/lib/salesup/workTypes";
import { colorOf, resolveWorkType, useWorkTypeSettings } from "@/lib/salesup/workTypeSettings";
import type { TimeBlock } from "@/lib/salesup/types";
import { cn } from "@/lib/utils";

interface Props {
  monthAnchor: string; // any date in the target month
  blocks: TimeBlock[];
  onChangeMonth: (newAnchor: string) => void;
  onSelectDay: (date: string) => void;
}

function addMonths(key: string, n: number): string {
  const d = fromDateKey(key);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return toDateKey(d);
}

function firstOfMonth(key: string): string {
  const d = fromDateKey(key);
  d.setDate(1);
  return toDateKey(d);
}

export function MonthCalendar({ monthAnchor, blocks, onChangeMonth, onSelectDay }: Props) {
  const { settings } = useWorkTypeSettings();
  const days = monthDaysOf(monthAnchor);
  const firstDay = fromDateKey(days[0]);
  const yyyy = firstDay.getFullYear();
  const mm = firstDay.getMonth() + 1;
  const today = todayKey();
  const thisMonthAnchor = firstOfMonth(todayKey());
  const isThisMonth = firstOfMonth(monthAnchor) === thisMonthAnchor;

  // Build per-day stats
  const perDay = useMemo(() => {
    const map: Record<
      string,
      {
        total: number;
        customer: number;
        byType: Record<string, number>;
        customers: string[];
      }
    > = {};
    const customerSets: Record<string, Set<string>> = {};
    for (const d of days) {
      map[d] = { total: 0, customer: 0, byType: {}, customers: [] };
      customerSets[d] = new Set();
    }
    for (const b of blocks) {
      if (!map[b.date]) continue;
      const mins = Math.max(0, b.end_slot - b.start_slot) * SLOT_MINUTES;
      if (mins === 0) continue;
      map[b.date].total += mins;
      const eff = resolveWorkType(b.work_type, settings);
      if (eff?.category === "customer_progress") {
        map[b.date].customer += mins;
      }
      map[b.date].byType[b.work_type] = (map[b.date].byType[b.work_type] ?? 0) + mins;
      if (b.customer) customerSets[b.date].add(b.customer);
    }
    for (const d of days) {
      map[d].customers = Array.from(customerSets[d]);
    }
    return map;
  }, [days, blocks]);

  // Leading blanks for Monday-start
  const leadDayNr = (firstDay.getDay() + 6) % 7;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-lg md:text-xl font-semibold">
            {yyyy} 年 {mm} 月
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            点击任意日期可跳转到当周的周时间轴
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border border-border bg-card overflow-hidden">
            <button
              onClick={() => onChangeMonth(addMonths(monthAnchor, -1))}
              className="px-2.5 py-1.5 hover:bg-secondary"
              aria-label="上一月"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 py-1.5 text-sm font-medium border-l border-r border-border min-w-[110px] text-center">
              {yyyy}-{String(mm).padStart(2, "0")}
            </div>
            <button
              onClick={() => onChangeMonth(addMonths(monthAnchor, 1))}
              className="px-2.5 py-1.5 hover:bg-secondary"
              aria-label="下一月"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => onChangeMonth(thisMonthAnchor)}
            disabled={isThisMonth}
            className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs hover:bg-secondary disabled:opacity-50"
          >
            回到本月
          </button>
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs hover:bg-secondary cursor-pointer">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>选择月份</span>
            <input
              type="month"
              className="sr-only"
              value={`${yyyy}-${String(mm).padStart(2, "0")}`}
              onChange={(e) => {
                if (!e.target.value) return;
                onChangeMonth(e.target.value + "-01");
              }}
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-[11px] text-muted-foreground">
        {["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map((d) => (
          <div key={d} className="text-center py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: leadDayNr }).map((_, i) => (
          <div key={`lead-${i}`} className="h-24 rounded-lg bg-muted/20" />
        ))}
        {days.map((d) => {
          const dt = fromDateKey(d);
          const stat = perDay[d];
          const isToday = d === today;
          const isWeekend = ((dt.getDay() + 6) % 7) >= 5;
          // Sort top work types for the color bar
          const segments = Object.entries(stat.byType)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4);
          const total = segments.reduce((s, [, v]) => s + v, 0) || 1;
          return (
            <button
              key={d}
              onClick={() => onSelectDay(d)}
              className={cn(
                "h-24 rounded-lg border bg-card p-2 text-left flex flex-col gap-1 transition-colors hover:border-foreground/40",
                isToday ? "border-primary ring-1 ring-primary/40" : "border-border",
                isWeekend && !isToday && "bg-muted/30",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-sm font-semibold",
                    isToday && "text-primary",
                  )}
                >
                  {dt.getDate()}
                </span>
                {stat.total > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {formatDuration(stat.total)}
                  </span>
                )}
              </div>
              {stat.customer > 0 && (
                <div className="text-[10px] text-muted-foreground">
                  客户 {formatDuration(stat.customer)}
                </div>
              )}
              {stat.customers.length > 0 && (
                <div className="flex flex-wrap gap-1 overflow-hidden">
                  {stat.customers.slice(0, 3).map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 max-w-full px-1.5 py-0.5 rounded-md text-[10px] leading-tight font-medium bg-background text-foreground border border-border shadow-sm"
                      title={name}
                    >
                      <span className="w-1 h-1 rounded-full bg-primary/70 shrink-0" />
                      <span className="truncate">{name}</span>
                    </span>
                  ))}
                  {stat.customers.length > 3 && (
                    <span className="text-[10px] leading-tight text-muted-foreground self-center">
                      +{stat.customers.length - 3}
                    </span>
                  )}
                </div>
              )}
              <div className="mt-auto h-1.5 rounded-full overflow-hidden bg-muted flex">
                {segments.map(([wtId, v]) => {
                  const wt = WORK_TYPE_MAP[wtId as WorkTypeId];
                  if (!wt) return null;
                  return (
                    <span
                      key={wtId}
                      style={{
                        width: `${(v / total) * 100}%`,
                        background: colorOf(wtId as WorkTypeId, settings),
                      }}
                    />
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
