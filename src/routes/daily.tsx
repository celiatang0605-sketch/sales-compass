import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/salesup/AppShell";
import { DateSwitcher } from "@/components/salesup/DateSwitcher";
import { useTimeBlocksForDate, useDailyReview, saveDailyReview } from "@/lib/salesup/storage";
import { computeStats, topProblemTags } from "@/lib/salesup/stats";
import { todayKey, formatDuration } from "@/lib/salesup/date";
import { WORK_TYPES, WORK_TYPE_MAP } from "@/lib/salesup/workTypes";
import { getEffectiveWorkTypes, useWorkTypeSettings } from "@/lib/salesup/workTypeSettings";

export const Route = createFileRoute("/daily")({
  head: () => ({ meta: [{ title: "日复盘 · Sales Up" }] }),
  component: DailyReviewPage,
});

function DailyReviewPage() {
  const [date, setDate] = useState(() => todayKey());
  const blocks = useTimeBlocksForDate(date);
  const { settings } = useWorkTypeSettings();
  const stats = useMemo(() => computeStats(blocks, settings), [blocks, settings]);
  const review = useDailyReview(date);

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold">日复盘</h1>
            <p className="text-xs text-muted-foreground mt-0.5">按选中日期汇总当天工作</p>
          </div>
          <DateSwitcher date={date} onChange={setDate} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox label="高价值占比" value={`${Math.round(stats.highValueRatio * 100)}%`} />
          <StatBox label="客户相关总时长" value={formatDuration(stats.customerProgressMinutes)} />
          <StatBox label="内部消耗总时长" value={formatDuration(stats.internalCostMinutes)} />
          <StatBox label="今日总记录" value={`${blocks.length} 条`} />
        </div>

        <Card title="时间分配">
          <TypeBars stats={stats} />
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Card title="简短记录">
            <ListOrEmpty
              items={stats.summaries.map((s) => ({
                primary: s.title || "(无标题)",
                secondary: s.text,
              }))}
              empty="今日还没有简短记录"
            />
          </Card>
          <Card title="下一步动作">
            <ListOrEmpty
              items={stats.nextActions.map((a) => ({
                primary: a.text,
                secondary: a.date ? `截止 ${a.date}` : "",
              }))}
              empty="今日还没有下一步动作"
            />
          </Card>
          <Card title="问题标签">
            {topProblemTags(stats.problemTagCounts, 20).length === 0 ? (
              <Empty text="今日没有问题标签" />
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
          <Card title="注意事项">
            <ListOrEmpty
              items={stats.notes.map((n) => ({ primary: n.text }))}
              empty="今日没有注意事项"
            />
          </Card>
        </div>

        <Card title="复盘问题">
          <div className="space-y-4">
            <ReviewField
              label="今天最重要的客户推进是什么？"
              value={review?.top_customer_progress ?? ""}
              onChange={(v) => saveDailyReview(date, { top_customer_progress: v })}
            />
            <ReviewField
              label="今天最大的卡点是什么？"
              value={review?.biggest_blocker ?? ""}
              onChange={(v) => saveDailyReview(date, { biggest_blocker: v })}
            />
            <ReviewField
              label="明天最需要优先处理什么？"
              value={review?.tomorrow_priority ?? ""}
              onChange={(v) => saveDailyReview(date, { tomorrow_priority: v })}
            />
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

export function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-0.5">{value}</div>
    </div>
  );
}

export function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function TypeBars({ stats }: { stats: ReturnType<typeof computeStats> }) {
  const total = Math.max(1, stats.totalMinutes);
  const rows = WORK_TYPES.map((wt) => ({
    wt,
    minutes: stats.byType[wt.id] ?? 0,
  })).filter((r) => r.minutes > 0);
  if (rows.length === 0) return <Empty text="还没有记录数据" />;
  return (
    <div className="space-y-2">
      {rows.map(({ wt, minutes }) => {
        const pct = (minutes / total) * 100;
        return (
          <div key={wt.id} className="flex items-center gap-2 text-xs">
            <div className="w-20 shrink-0 text-foreground/80">{wt.label}</div>
            <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: `var(${wt.colorVar})` }}
              />
            </div>
            <div className="w-16 text-right tabular-nums text-muted-foreground">
              {formatDuration(minutes)}
            </div>
            <div className="w-10 text-right tabular-nums text-muted-foreground">
              {Math.round(pct)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ListOrEmpty({
  items,
  empty,
}: {
  items: { primary: string; secondary?: string }[];
  empty: string;
}) {
  if (items.length === 0) return <Empty text={empty} />;
  return (
    <ul className="space-y-2 text-sm">
      {items.map((it, i) => (
        <li key={i} className="border-l-2 border-primary/40 pl-3">
          <div className="text-foreground/90">{it.primary}</div>
          {it.secondary && (
            <div className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">
              {it.secondary}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="text-xs text-muted-foreground py-2">{text}</div>;
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
        className="w-full min-h-[70px] resize-y px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-ring"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="写下你的思考…"
      />
    </div>
  );
}

// also export work-type map for siblings
export { WORK_TYPE_MAP };
