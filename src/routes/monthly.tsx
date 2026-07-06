import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/salesup/AppShell";
import { useTimeBlocks, useMonthlyReview, saveMonthlyReview } from "@/lib/salesup/storage";
import { computeStats, topProblemTags } from "@/lib/salesup/stats";
import {
  todayKey,
  monthKeyOf,
  monthDaysOf,
  fromDateKey,
  toDateKey,
  formatDuration,
} from "@/lib/salesup/date";
import { WORK_TYPE_MAP } from "@/lib/salesup/workTypes";
import { useWorkTypeSettings } from "@/lib/salesup/workTypeSettings";
import { Card, StatBox, TypeBars, ListOrEmpty, Empty } from "./daily";

export const Route = createFileRoute("/monthly")({
  head: () => ({ meta: [{ title: "月复盘 · Sales Up" }] }),
  component: MonthlyReviewPage,
});

function shiftMonth(key: string, n: number): string {
  const d = fromDateKey(key + "");
  const nd = new Date(d.getFullYear(), d.getMonth() + n, 1);
  return toDateKey(nd);
}

function MonthlyReviewPage() {
  const [anchor, setAnchor] = useState(() => todayKey());
  const monthKey = useMemo(() => monthKeyOf(anchor), [anchor]);
  const days = useMemo(() => monthDaysOf(anchor), [anchor]);
  const all = useTimeBlocks();
  const blocks = useMemo(() => all.filter((b) => days.includes(b.date)), [all, days]);
  const { settings } = useWorkTypeSettings();
  const stats = useMemo(() => computeStats(blocks, settings), [blocks, settings]);
  const review = useMonthlyReview(monthKey);

  // Daily trend: per-day high-value ratio + customer-progress minutes
  const dailyTrend = useMemo(() => {
    return days.map((d) => {
      const dayBlocks = blocks.filter((b) => b.date === d);
      const s = computeStats(dayBlocks, settings);
      return {
        date: d,
        total: s.totalMinutes,
        customer: s.customerProgressMinutes,
        internal: s.internalCostMinutes,
        highValueRatio: s.highValueRatio,
      };
    });
  }, [blocks, days]);

  const maxTotalDay = Math.max(1, ...dailyTrend.map((d) => d.total));

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold">月复盘</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{monthKey}</p>
          </div>
          <div className="inline-flex rounded-lg border border-border bg-card overflow-hidden">
            <button onClick={() => setAnchor(shiftMonth(anchor, -1))} className="px-2.5 py-1.5 hover:bg-secondary" aria-label="上月">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 py-1.5 text-sm font-medium border-l border-r border-border min-w-[120px] text-center">
              {monthKey}
            </div>
            <button onClick={() => setAnchor(shiftMonth(anchor, 1))} className="px-2.5 py-1.5 hover:bg-secondary" aria-label="下月">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox label="客户推进总时长" value={formatDuration(stats.customerProgressMinutes)} />
          <StatBox label="内部消耗总时长" value={formatDuration(stats.internalCostMinutes)} />
          <StatBox label="高价值占比" value={`${Math.round(stats.highValueRatio * 100)}%`} />
          <StatBox label="客户会议次数" value={`${stats.meetingCustomerCount}`} />
          <StatBox label="客户拜访次数" value={`${stats.visitCustomerCount}`} />
          <StatBox label="客户跟进次数" value={`${stats.followupCustomerCount}`} />
          <StatBox label="方案准备" value={formatDuration(stats.proposalMinutes)} />
          <StatBox label="学习复盘" value={formatDuration(stats.learningReviewMinutes)} />
        </div>

        <Card title="本月时间分配趋势 (每日)">
          {stats.totalMinutes === 0 ? (
            <Empty text="本月还没有记录" />
          ) : (
            <div className="flex items-end gap-[2px] h-32 overflow-x-auto">
              {dailyTrend.map((d) => {
                const h = (d.total / maxTotalDay) * 100;
                const dayNum = parseInt(d.date.slice(-2), 10);
                return (
                  <div
                    key={d.date}
                    className="flex flex-col items-center gap-1 shrink-0 min-w-[14px]"
                    title={`${d.date} · 客户 ${formatDuration(d.customer)} · 内部 ${formatDuration(d.internal)} · 高价值 ${Math.round(d.highValueRatio * 100)}%`}
                  >
                    <div className="w-3 md:w-4 h-24 bg-muted rounded-sm relative overflow-hidden">
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-foreground/15"
                        style={{ height: `${h}%` }}
                      />
                      <div
                        className="absolute bottom-0 left-0 right-0"
                        style={{
                          height: `${(d.customer / maxTotalDay) * 100}%`,
                          background: `var(${WORK_TYPE_MAP.meeting_customer?.colorVar ?? "--wt-meeting-customer"})`,
                        }}
                      />
                    </div>
                    <div className="text-[9px] text-muted-foreground">{dayNum}</div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-3 mt-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: `var(${WORK_TYPE_MAP.meeting_customer?.colorVar ?? "--wt-meeting-customer"})` }} />
              客户推进时长
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-foreground/15" />
              总时长
            </span>
          </div>
        </Card>

        <Card title="本月高价值时间占比趋势">
          {stats.totalMinutes === 0 ? (
            <Empty text="本月还没有记录" />
          ) : (
            <HighValueTrend data={dailyTrend} />
          )}
        </Card>

        <Card title="本月各类工作时间占比">
          <TypeBars stats={stats} />
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Card title="本月常见问题标签">
            {topProblemTags(stats.problemTagCounts, 20).length === 0 ? (
              <Empty text="本月没有问题标签" />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {topProblemTags(stats.problemTagCounts, 20).map((t) => (
                  <span
                    key={t.tag}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-destructive/10 text-destructive"
                  >
                    {t.tag}
                    <span className="opacity-60">×{t.count}</span>
                  </span>
                ))}
              </div>
            )}
          </Card>
          <Card title="本月重要注意事项">
            <ListOrEmpty
              items={stats.notes.map((n) => ({ primary: n.text }))}
              empty="本月没有注意事项"
            />
          </Card>
        </div>

        <Card title="月度复盘">
          <div className="grid md:grid-cols-3 gap-4">
            <ReviewField
              label="本月销售能力成长"
              value={review?.capability_growth ?? ""}
              onChange={(v) => saveMonthlyReview(monthKey, { capability_growth: v })}
            />
            <ReviewField
              label="本月主要卡点"
              value={review?.main_blockers ?? ""}
              onChange={(v) => saveMonthlyReview(monthKey, { main_blockers: v })}
            />
            <ReviewField
              label="下月重点改善方向"
              value={review?.next_month_focus ?? ""}
              onChange={(v) => saveMonthlyReview(monthKey, { next_month_focus: v })}
            />
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function HighValueTrend({
  data,
}: {
  data: { date: string; highValueRatio: number; total: number }[];
}) {
  const W = 600;
  const H = 100;
  const pad = 8;
  const points = data
    .map((d, i) => {
      const x = pad + ((W - pad * 2) * i) / Math.max(1, data.length - 1);
      const y = pad + (H - pad * 2) * (1 - d.highValueRatio);
      return d.total > 0 ? `${x},${y}` : null;
    })
    .filter(Boolean)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24">
      <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="var(--color-border)" />
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--color-border)" />
      <polyline fill="none" stroke="var(--color-primary)" strokeWidth={1.5} points={points} />
    </svg>
  );
}

function ReviewField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-foreground/80 mb-1.5">{label}</div>
      <textarea
        className="w-full min-h-[100px] resize-y px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-ring"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="写下你的思考…"
      />
    </div>
  );
}
