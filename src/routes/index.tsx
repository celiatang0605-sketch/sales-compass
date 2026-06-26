import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Copy, Search } from "lucide-react";
import { AppShell } from "@/components/salesup/AppShell";
import { Timeline, WorkTypeLegend } from "@/components/salesup/Timeline";
import {
  BlockDetailPanel,
  type DraftBlock,
} from "@/components/salesup/BlockDetailPanel";
import { StatsCards } from "@/components/salesup/StatsCards";
import { DateSwitcher } from "@/components/salesup/DateSwitcher";
import {
  useTimeBlocksForDate,
  copyBlocksFromDate,
} from "@/lib/salesup/storage";
import { computeStats } from "@/lib/salesup/stats";
import { todayKey, addDays } from "@/lib/salesup/date";
import type { WorkTypeId } from "@/lib/salesup/workTypes";
import type { TimeBlock } from "@/lib/salesup/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "今日时间轴 · Sales Up" },
      { name: "description", content: "Sales Up 销售个人工作台 - 时间管理与日复盘" },
    ],
  }),
  component: TodayPage,
});

function TodayPage() {
  const [date, setDate] = useState(() => todayKey());
  const [filter, setFilter] = useState<WorkTypeId | "all">("all");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<DraftBlock | null>(null);

  const allBlocks = useTimeBlocksForDate(date);
  const visibleBlocks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allBlocks;
    return allBlocks.filter(
      (b) =>
        b.customer.toLowerCase().includes(q) ||
        b.title.toLowerCase().includes(q) ||
        b.summary.toLowerCase().includes(q),
    );
  }, [allBlocks, search]);

  const stats = useMemo(() => computeStats(allBlocks), [allBlocks]);

  const onCreateRange = (startSlot: number, endSlot: number) => {
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
  };

  const onSelectBlock = (b: TimeBlock) => {
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

  const copyYesterday = () => {
    if (allBlocks.length > 0) {
      if (!confirm("当前日期已有记录，复制将覆盖。继续？")) return;
    }
    const count = copyBlocksFromDate(addDays(date, -1), date);
    alert(count > 0 ? `已从昨天复制 ${count} 条时间块` : "昨天没有可复制的时间块");
  };

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold">今日时间轴</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              点击或拖动空白色块创建时间段，记录每 15 分钟的工作内容
            </p>
          </div>
          <DateSwitcher date={date} onChange={setDate} />
        </div>

        <StatsCards stats={stats} title={`${date} 数据概览`} />

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="按客户 / 标题搜索"
              className="pl-8 pr-3 py-1.5 rounded-lg border border-border bg-card text-xs w-52"
            />
          </div>
          <button
            onClick={copyYesterday}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs hover:bg-secondary"
          >
            <Copy className="w-3.5 h-3.5" />
            复制昨日结构
          </button>
        </div>

        <WorkTypeLegend value={filter} onChange={setFilter} />

        <Timeline
          date={date}
          blocks={visibleBlocks}
          filter={filter}
          onCreateRange={onCreateRange}
          onSelectBlock={onSelectBlock}
        />
      </div>

      <BlockDetailPanel draft={draft} onClose={() => setDraft(null)} />
    </AppShell>
  );
}
