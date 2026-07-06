import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useCallback } from "react";
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
  deleteTimeBlock,
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
import { type WorkTypeId } from "@/lib/salesup/workTypes";
import { isCustomerRelated, useWorkTypeSettings } from "@/lib/salesup/workTypeSettings";
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

function blockToDraft(b: TimeBlock): DraftBlock {
  return {
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
  };
}

function TimelinePage() {
  const [mode, setMode] = useState<ViewMode>("week");
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

  const closeDraft = useCallback(() => setDraft(null), []);

  const onCreateRange = (date: string, startSlot: number, endSlot: number) => {
    const wt: WorkTypeId = activeWorkType ?? "meeting_customer";
    const isCustomer = isCustomerWorkType(wt);
    const saved = upsertTimeBlock({
      date,
      start_slot: startSlot,
      end_slot: endSlot,
      work_type: wt,
      value_level: isCustomer ? "high" : "medium",
    });
    // Created block stays selected so Enter/Backspace shortcuts apply.
    setDraftLightweight(!isCustomer);
    setDraft(blockToDraft(saved));
  };

  const onSelectBlock = (b: TimeBlock) => {
    setDraftLightweight(!isCustomerWorkType(b.work_type));
    setDraft(blockToDraft(b));
  };

  const onInlineSaveTitle = (b: TimeBlock, title: string) => {
    upsertTimeBlock({ ...b, title });
  };

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!draft?.id) return;
      const t = e.target as HTMLElement | null;
      // Ignore when focused in an input / textarea / contenteditable
      if (t) {
        const tag = t.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          t.isContentEditable
        ) {
          return;
        }
      }
      if (e.key === "Enter") {
        e.preventDefault();
        setDraft(null);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setDraft(null);
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        if (confirm("确定删除当前时间块吗？")) {
          deleteTimeBlock(draft.id);
          setDraft(null);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draft]);

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
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px] lg:gap-5">
        <div className="space-y-4 min-w-0">
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
                    className="pl-8 pr-3 py-1.5 rounded-lg border border-border bg-card text-xs w-48"
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
                activeWorkType={activeWorkType}
                highlightDate={highlightDate}
                selectedBlockId={draft?.id ?? null}
                onCreateRange={onCreateRange}
                onSelectBlock={onSelectBlock}
                onInlineSaveTitle={onInlineSaveTitle}
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

        {/* Right sticky detail panel (desktop) / bottom sheet (mobile) */}
        <aside className="hidden lg:block">
          <div className="sticky top-4 h-[calc(100vh-2rem)]">
            <BlockDetailPanel
              draft={draft}
              lightweight={draftLightweight}
              embedded
              onClose={closeDraft}
            />
          </div>
        </aside>

        {/* Mobile bottom-sheet variant: renders only when a draft is active */}
        <div className="lg:hidden">
          {draft && (
            <BlockDetailPanel
              draft={draft}
              lightweight={draftLightweight}
              embedded
              onClose={closeDraft}
            />
          )}
        </div>
      </div>

      <span className="hidden">{allBlocks.length}</span>
    </AppShell>
  );
}
