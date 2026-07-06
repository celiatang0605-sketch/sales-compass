import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/salesup/AppShell";
import { useTimeBlocks, useWeeklyReview, saveWeeklyReview } from "@/lib/salesup/storage";
import { computeStats, topProblemTags } from "@/lib/salesup/stats";
import {
  todayKey,
  weekKeyOf,
  weekRangeOf,
  addDays,
  formatDuration,
} from "@/lib/salesup/date";
import { Card, StatBox, TypeBars, ListOrEmpty, Empty } from "./daily";
import { useWorkTypeSettings } from "@/lib/salesup/workTypeSettings";

export const Route = createFileRoute("/weekly")({
  head: () => ({ meta: [{ title: "周复盘 · Sales Up" }] }),
  component: WeeklyReviewPage,
});

function WeeklyReviewPage() {
  const [anchor, setAnchor] = useState(() => todayKey());
  const { start, end, days } = useMemo(() => weekRangeOf(anchor), [anchor]);
  const weekKey = useMemo(() => weekKeyOf(anchor), [anchor]);
  const all = useTimeBlocks();
  const blocks = useMemo(() => all.filter((b) => days.includes(b.date)), [all, days]);
  const stats = useMemo(() => computeStats(blocks), [blocks]);
  const review = useWeeklyReview(weekKey);

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold">周复盘</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {weekKey} · {start} ~ {end}
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-border bg-card overflow-hidden">
            <button onClick={() => setAnchor(addDays(anchor, -7))} className="px-2.5 py-1.5 hover:bg-secondary" aria-label="上一周">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 py-1.5 text-sm font-medium border-l border-r border-border min-w-[150px] text-center">
              {weekKey}
            </div>
            <button onClick={() => setAnchor(addDays(anchor, 7))} className="px-2.5 py-1.5 hover:bg-secondary" aria-label="下一周">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox label="客户会议次数" value={`${stats.meetingCustomerCount}`} />
          <StatBox label="客户拜访次数" value={`${stats.visitCustomerCount}`} />
          <StatBox label="客户跟进次数" value={`${stats.followupCustomerCount}`} />
          <StatBox label="高价值占比" value={`${Math.round(stats.highValueRatio * 100)}%`} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox label="客户推进" value={formatDuration(stats.customerProgressMinutes)} />
          <StatBox label="内部消耗" value={formatDuration(stats.internalCostMinutes)} />
          <StatBox label="方案准备" value={formatDuration(stats.proposalMinutes)} />
          <StatBox label="学习复盘" value={formatDuration(stats.learningReviewMinutes)} />
        </div>

        <Card title="本周各类工作时间占比">
          <TypeBars stats={stats} />
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Card title="出现频率最高的问题标签">
            {topProblemTags(stats.problemTagCounts, 12).length === 0 ? (
              <Empty text="本周没有问题标签" />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {topProblemTags(stats.problemTagCounts, 12).map((t) => (
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
          <Card title="本周所有下一步动作">
            <ListOrEmpty
              items={stats.nextActions.map((a) => ({
                primary: a.text,
                secondary: a.date ? `截止 ${a.date}` : "",
              }))}
              empty="本周没有下一步动作"
            />
          </Card>
        </div>

        <Card title="本周所有注意事项">
          <ListOrEmpty
            items={stats.notes.map((n) => ({ primary: n.text }))}
            empty="本周没有注意事项"
          />
        </Card>

        <Card title="本周复盘">
          <div className="grid md:grid-cols-2 gap-4">
            <ReviewField
              label="本周最有效的销售动作"
              value={review?.effective_actions ?? ""}
              onChange={(v) => saveWeeklyReview(weekKey, { effective_actions: v })}
            />
            <ReviewField
              label="本周反复出现的问题"
              value={review?.recurring_problems ?? ""}
              onChange={(v) => saveWeeklyReview(weekKey, { recurring_problems: v })}
            />
            <ReviewField
              label="本周我学到的销售经验"
              value={review?.lessons_learned ?? ""}
              onChange={(v) => saveWeeklyReview(weekKey, { lessons_learned: v })}
            />
            <ReviewField
              label="下周重点推进事项"
              value={review?.next_week_focus ?? ""}
              onChange={(v) => saveWeeklyReview(weekKey, { next_week_focus: v })}
            />
          </div>
        </Card>
      </div>
    </AppShell>
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
        className="w-full min-h-[80px] resize-y px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-ring"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="写下你的思考…"
      />
    </div>
  );
}
