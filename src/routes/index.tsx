import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Copy, Search, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { AppShell } from "@/components/salesup/AppShell";
import { WeekTimeline } from "@/components/salesup/WeekTimeline";
import { WorkTypeLegend } from "@/components/salesup/Timeline";
import { MonthCalendar } from "@/components/salesup/MonthCalendar";
import {
  BlockDetailPanel,
  type DraftBlock,
} from "@/components/salesup/BlockDetailPanel";
import { StatsCards } from "@/components/salesup/StatsCards";
import {
  useTimeBlocks,
  useTimeBlocksForDates,
  copyBlocksFromWeek,
  upsertTimeBlock,
} from "@/lib/salesup/storage";
import { computeStats } from "@/lib/salesup/stats";
import {
  todayKey,
  addDays,
  weekRangeOf,
  getISOWeek,
  fromDateKey,
  monthDaysOf,
} from "@/lib/salesup/date";
import { isCustomerWorkType, WORK_TYPE_MAP, type WorkTypeId } from "@/lib/salesup/workTypes";
import type { TimeBlock } from "@/lib/salesup/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "周时间轴 · Sales Up" },
      { name: "description", content: "Sales Up 销售个人工作台 - 周时间轴与月度概览" },
    ],
  }),
  component: TimelinePage,
});

type ViewMode = "week" | "month";

function formatMonthDay(key: string): string {
  const d = fromDateKey(key);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function TimelinePage() {
  const [mode, setMode] = useState<ViewMode>("week");
  // Anchor date drives both week + month context
  const [anchor, setAnchor] = useState<string>(() => todayKey());
  const [filter, setFilter] = useState<WorkTypeId | "all">("all");
  const [search, setSearch] = useState("");
  const [highlightDate, setHighlightDate] = useState<string | undefined>(undefined);
  const [draft, setDraft] = useState<DraftBlock | null>(null);
  const [draftLightweight, setDraftLightweight] = useState(false);

  const week = useMemo(() => weekRangeOf(anchor), [anchor]);
  const isoInfo = useMemo(() => getISOWeek(fromDateKey(anchor)), [anchor]);
  const monthDays = useMemo(() => monthDaysOf(anchor), [anchor]);

  const allBlocks = useTimeBlocks();
  const weekBlocksAll = useTimeBlocksForDates(week.days);
  const monthBlocksAll = useTimeBlocksForDates(monthDays);

  const visibleWeekBlocks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return weekBlocksAll;
    return weekBlocksAll.filter(
      (b) =>
        b.customer.toLowerCase().includes(q) ||
        b.title.toLowerCase().includes(q) ||
        b.summary.toLowerCase().includes(q),
    );
  }, [weekBlocksAll, search]);

  const stats = useMemo(() => computeStats(weekBlocksAll), [weekBlocksAll]);

  const activeWorkType: WorkTypeId | null = filter === "all" ? null : filter;

  const onCreateRange = (date: string, startSlot: number, endSlot: number) => {
    // No active work type selected → fall back to opening an empty draft form
    if (!activeWorkType) {
      setDraftLightweight(false);
      setDraft({
        date,
        start_slot: startSlot,
        end_slot: endSlot,
        work_type: "meeting_customer",
        title: "",
        customer: "",
        summary: "",
        key_info: "",
        next_action: "",
        next_action_date: "",
        problem_tags: [],
        notes: "",
        value_level: "medium",
      });
      return;
    }

    const isCustomer = isCustomerWorkType(activeWorkType);
    // Persist a new block immediately
    const saved = upsertTimeBlock({
      date,
      start_slot: startSlot,
      end_slot: endSlot,
      work_type: activeWorkType,
      value_level: isCustomer ? "high" : "medium",
    });

    if (isCustomer) {
      // Open the full detail panel pre-loaded with the new block (default 高价值)
      setDraftLightweight(false);
      setDraft({
        id: saved.id,
        date: saved.date,
        start_slot: saved.start_slot,
        end_slot: saved.end_slot,
        work_type: saved.work_type,
        title: saved.title,
        customer: saved.customer,
        summary: saved.summary,
        key_info: saved.key_info,
        next_action: saved.next_action,
        next_action_date: saved.next_action_date,
        problem_tags: saved.problem_tags,
        notes: saved.notes,
        value_level: saved.value_level,
      });
    }
    // Non-customer types: keep activeWorkType selected for rapid subsequent creation
  };

  const onSelectBlock = (b: TimeBlock) => {
    setDraftLightweight(!isCustomerWorkType(b.work_type));
    setDraft({
      id: b.id,
      date: b.date,
      start_slot: b.start_slot,
      end_slot: b.end_slot,
      work_type: b.work_type,
      title: b.title,
      customer: b.customer,
      summary: b.summary,
      key_info: b.key_info,
      next_action: b.next_action,
      next_action_date: b.next_action_date,
      problem_tags: b.problem_tags,
      notes: b.notes,
      value_level: b.value_level,
    });
  };

  const onInlineSaveTitle = (b: TimeBlock, title: string) => {
    upsertTimeBlock({ ...b, title });
  };

  const goPrevWeek = () => setAnchor(addDays(week.start, -7));
  const goNextWeek = () => setAnchor(addDays(week.start, 7));
  const goThisWeek = () => setAnchor(todayKey());

  const copyLastWeek = () => {
    const lastWeekAnchor = addDays(week.start, -7);
    const lastWeek = weekRangeOf(lastWeekAnchor);
    const hasExisting = weekBlocksAll.length > 0;
    if (hasExisting) {
      if (!confirm("确定要复制上一周结构到当前周吗？当前周已有的时间块将被覆盖。")) return;
    } else {
      if (!confirm("确定要复制上一周结构到当前周吗？")) return;
    }
    const count = copyBlocksFromWeek(lastWeek.days, week.days);
    alert(count > 0 ? `已从上一周复制 ${count} 条时间块` : "上一周没有可复制的时间块");
  };

  const onSelectDayFromMonth = (date: string) => {
    setAnchor(date);
    setHighlightDate(date);
    setMode("week");
  };

  const todayIso = useMemo(() => getISOWeek(new Date()), []);
  const isThisWeek =
    isoInfo.year === todayIso.year && isoInfo.week === todayIso.week;

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold">
              {mode === "week" ? "周时间轴" : "月度概览"}
            </h1>
            {mode === "week" ? (
              <p className="text-xs md:text-sm text-muted-foreground mt-1">
                <span className="font-medium text-foreground">
                  {isoInfo.year} 年第 {isoInfo.week} 周
                </span>
                <span className="mx-2 text-muted-foreground/50">·</span>
                {formatMonthDay(week.start)} 至 {formatMonthDay(week.end)}
              </p>
            ) : (
              <p className="text-xs md:text-sm text-muted-foreground mt-1">
                查看一个月内每天的工作分布，点击日期跳转到当周时间轴
              </p>
            )}
          </div>

          {/* View mode switch */}
          <div className="inline-flex rounded-lg border border-border bg-card overflow-hidden">
            <button
              onClick={() => setMode("week")}
              className={cn(
                "px-3 py-1.5 text-xs",
                mode === "week"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-secondary",
              )}
            >
              周视图
            </button>
            <button
              onClick={() => setMode("month")}
              className={cn(
                "px-3 py-1.5 text-xs border-l border-border",
                mode === "month"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-secondary",
              )}
            >
              月视图
            </button>
          </div>
        </div>

        {mode === "week" ? (
          <>
            <StatsCards stats={stats} title="本周统计" />

            {/* Week navigation */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-border bg-card overflow-hidden">
                <button
                  onClick={goPrevWeek}
                  className="px-2.5 py-1.5 hover:bg-secondary"
                  aria-label="上一周"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="px-3 py-1.5 text-xs font-medium border-l border-r border-border min-w-[150px] text-center">
                  第 {isoInfo.week} 周 · {formatMonthDay(week.start)}–{formatMonthDay(week.end)}
                </div>
                <button
                  onClick={goNextWeek}
                  className="px-2.5 py-1.5 hover:bg-secondary"
                  aria-label="下一周"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={goThisWeek}
                disabled={isThisWeek}
                className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs hover:bg-secondary disabled:opacity-50"
              >
                回到本周
              </button>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs hover:bg-secondary cursor-pointer">
                <CalendarDays className="w-3.5 h-3.5" />
                <span>选择日期</span>
                <input
                  type="date"
                  className="sr-only"
                  value={anchor}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    setAnchor(e.target.value);
                    setHighlightDate(e.target.value);
                  }}
                />
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="按客户 / 标题搜索本周"
                  className="pl-8 pr-3 py-1.5 rounded-lg border border-border bg-card text-xs w-56"
                />
              </div>
              <button
                onClick={copyLastWeek}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs hover:bg-secondary"
              >
                <Copy className="w-3.5 h-3.5" />
                复制上一周结构
              </button>
            </div>

            <WorkTypeLegend value={filter} onChange={setFilter} />

            <WeekTimeline
              weekDays={week.days}
              blocks={visibleWeekBlocks}
              filter={filter}
              highlightDate={highlightDate}
              onCreateRange={onCreateRange}
              onSelectBlock={onSelectBlock}
            />
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="按客户 / 标题搜索本月"
                  className="pl-8 pr-3 py-1.5 rounded-lg border border-border bg-card text-xs w-56"
                />
              </div>
            </div>
            <MonthCalendar
              monthAnchor={anchor}
              blocks={
                search.trim()
                  ? monthBlocksAll.filter((b) => {
                      const q = search.trim().toLowerCase();
                      return (
                        b.customer.toLowerCase().includes(q) ||
                        b.title.toLowerCase().includes(q) ||
                        b.summary.toLowerCase().includes(q)
                      );
                    })
                  : monthBlocksAll
              }
              onChangeMonth={(newAnchor) => {
                setAnchor(newAnchor);
                setHighlightDate(undefined);
              }}
              onSelectDay={onSelectDayFromMonth}
            />
          </>
        )}
      </div>

      <BlockDetailPanel draft={draft} onClose={() => setDraft(null)} />
      {/* allBlocks reference keeps subscription warm for cross-view sync */}
      <span className="hidden">{allBlocks.length}</span>
    </AppShell>
  );
}
