import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/salesup/AppShell";
import { useCustomers } from "@/lib/salesup/useCustomers";
import {
  saveWeeklyReview,
  useEntries,
  useTimeBlocks,
  useWeeklyReview,
} from "@/lib/salesup/storage";
import { type Entry } from "@/lib/salesup/types";
import { computeStats } from "@/lib/salesup/stats";
import { addDays, todayKey, weekKeyOf, weekRangeOf } from "@/lib/salesup/date";
import { Card, Empty, StatBox, TypeBars } from "./daily";
import { useWorkTypeSettings } from "@/lib/salesup/workTypeSettings";

export const Route = createFileRoute("/weekly")({
  head: () => ({ meta: [{ title: "周复盘 · Sales Up" }] }),
  component: WeeklyReviewPage,
});

function WeeklyReviewPage() {
  const [anchor, setAnchor] = useState(() => todayKey());
  const { start, end, days } = useMemo(() => weekRangeOf(anchor), [anchor]);
  const weekKey = useMemo(() => weekKeyOf(anchor), [anchor]);
  const allBlocks = useTimeBlocks();
  const allEntries = useEntries();
  const { customers } = useCustomers();
  const { settings } = useWorkTypeSettings();
  const blocks = useMemo(
    () => allBlocks.filter((block) => days.includes(block.date)),
    [allBlocks, days],
  );
  const entries = useMemo(
    () => allEntries.filter((entry) => days.includes(entry.entry_date)),
    [allEntries, days],
  );
  const stats = useMemo(() => computeStats(blocks, settings), [blocks, settings]);
  const review = useWeeklyReview(weekKey);
  const customerNames = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer.companyName])),
    [customers],
  );
  const problemTags = useMemo(
    () => groupProblemTags(entries, customerNames),
    [entries, customerNames],
  );
  const customerActivity = useMemo(
    () => groupCustomerActivity(entries, customerNames),
    [entries, customerNames],
  );
  const totalTodos = entries.filter((entry) => entry.entry_type === "todo").length;
  const doneTodos = entries.filter(
    (entry) => entry.entry_type === "todo" && entry.status === "done",
  ).length;
  const pitfallCount = entries.filter((entry) => entry.entry_type === "pitfall").length;

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold md:text-2xl">周复盘</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {weekKey} · {start} ~ {end}
            </p>
          </div>
          <div className="inline-flex overflow-hidden rounded-lg border border-border bg-card">
            <button
              type="button"
              onClick={() => setAnchor(addDays(anchor, -7))}
              className="px-2.5 py-1.5 hover:bg-secondary"
              aria-label="上一周"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-[150px] border-x border-border px-3 py-1.5 text-center text-sm font-medium">
              {weekKey}
            </div>
            <button
              type="button"
              onClick={() => setAnchor(addDays(anchor, 7))}
              className="px-2.5 py-1.5 hover:bg-secondary"
              aria-label="下一周"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatBox label="本周记录数" value={`${entries.length}`} />
          <StatBox label="待办完成" value={`${doneTodos}/${totalTodos}`} />
          <StatBox label="踩坑数" value={`${pitfallCount}`} />
          <StatBox label="高价值占比" value={`${Math.round(stats.highValueRatio * 100)}%`} />
        </div>

        <Card title="反复出现的问题">
          {problemTags.length === 0 ? (
            <Empty text="本周没有带标签的踩坑记录" />
          ) : (
            <div className="space-y-2">
              {problemTags.map((item) => (
                <div
                  key={item.tag}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <span
                    className={
                      item.count >= 3
                        ? "rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
                        : item.count === 2
                          ? "rounded-full bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning"
                          : "rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                    }
                  >
                    {item.count} 次
                  </span>
                  <span className="text-sm font-medium">{item.tag}</span>
                  <span className="text-xs text-muted-foreground">
                    涉及客户：{item.customers.join("、")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="客户动向">
          {customerActivity.length === 0 ? (
            <Empty text="本周没有关联客户的记录" />
          ) : (
            <div className="space-y-2">
              {customerActivity.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <span className="text-sm font-medium">{item.name}</span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-primary">进展 {item.progress}</span>
                    <span className="text-destructive">踩坑 {item.pitfall}</span>
                    <span className="text-muted-foreground">未完成待办 {item.openTodo}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="本周各类工作时间占比">
          <TypeBars stats={stats} limit={4} />
        </Card>

        <Card title="复盘问题">
          <ReviewField
            label="下周要改什么？"
            value={review?.next_week_focus ?? ""}
            onChange={(value) => saveWeeklyReview(weekKey, { next_week_focus: value })}
          />
        </Card>
      </div>
    </AppShell>
  );
}

function groupProblemTags(entries: Entry[], customerNames: Map<string, string>) {
  const groups = new Map<string, { count: number; customers: Set<string> }>();
  for (const entry of entries) {
    if (entry.entry_type !== "pitfall") continue;
    for (const tag of entry.tags.filter(Boolean)) {
      const group = groups.get(tag) ?? { count: 0, customers: new Set<string>() };
      group.count += 1;
      group.customers.add(
        entry.customer_id ? (customerNames.get(entry.customer_id) ?? "未命名客户") : "未关联客户",
      );
      groups.set(tag, group);
    }
  }
  return [...groups.entries()]
    .map(([tag, group]) => ({ tag, count: group.count, customers: [...group.customers] }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

function groupCustomerActivity(entries: Entry[], customerNames: Map<string, string>) {
  const groups = new Map<
    string,
    { id: string; name: string; progress: number; pitfall: number; openTodo: number; total: number }
  >();
  for (const entry of entries) {
    if (!entry.customer_id) continue;
    const group = groups.get(entry.customer_id) ?? {
      id: entry.customer_id,
      name: customerNames.get(entry.customer_id) ?? "未命名客户",
      progress: 0,
      pitfall: 0,
      openTodo: 0,
      total: 0,
    };
    group.total += 1;
    if (entry.entry_type === "progress") group.progress += 1;
    if (entry.entry_type === "pitfall") group.pitfall += 1;
    if (entry.entry_type === "todo" && entry.status === "open") group.openTodo += 1;
    groups.set(entry.customer_id, group);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

function ReviewField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-foreground/80">{label}</div>
      <textarea
        className="min-h-[80px] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="写下你的思考…"
      />
    </div>
  );
}
