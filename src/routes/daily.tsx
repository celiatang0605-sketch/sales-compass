import { createFileRoute } from "@tanstack/react-router";
import { Check, MoreHorizontal } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AppShell } from "@/components/salesup/AppShell";
import { DateSwitcher } from "@/components/salesup/DateSwitcher";
import { useCustomers } from "@/lib/salesup/useCustomers";
import {
  saveDailyReview,
  upsertEntry,
  useDailyReview,
  useEntries,
  useTimeBlocksForDate,
} from "@/lib/salesup/storage";
import {
  ENTRY_QUADRANT_LABELS,
  ENTRY_TYPE_LABELS,
  type Entry,
  type EntryType,
} from "@/lib/salesup/types";
import { computeStats } from "@/lib/salesup/stats";
import { formatDuration, todayKey, toDateKey } from "@/lib/salesup/date";
import { getEffectiveWorkTypes, useWorkTypeSettings } from "@/lib/salesup/workTypeSettings";

export const Route = createFileRoute("/daily")({
  head: () => ({ meta: [{ title: "日复盘 · Sales Up" }] }),
  component: DailyReviewPage,
});

const ORGANIZED_ENTRY_IDS_KEY = "salesup:daily:organized-entry-ids";

function DailyReviewPage() {
  const [date, setDate] = useState(() => todayKey());
  const [selectedType, setSelectedType] = useState<EntryType | "all">("all");
  const [organizedEntryIds, setOrganizedEntryIds] = useState<string[]>([]);
  const blocks = useTimeBlocksForDate(date);
  const entries = useEntries();
  const { customers } = useCustomers();
  const { settings } = useWorkTypeSettings();
  const stats = useMemo(() => computeStats(blocks, settings), [blocks, settings]);
  const review = useDailyReview(date);
  const today = todayKey();

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = JSON.parse(window.localStorage.getItem(ORGANIZED_ENTRY_IDS_KEY) ?? "[]");
      if (Array.isArray(saved))
        setOrganizedEntryIds(saved.filter((id): id is string => typeof id === "string"));
    } catch {
      setOrganizedEntryIds([]);
    }
  }, []);

  const customerNames = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer.companyName])),
    [customers],
  );
  const todayEntries = useMemo(
    () => entries.filter((entry) => entry.entry_date === date).sort(sortEntries),
    [date, entries],
  );
  const pendingNotes = useMemo(
    () =>
      entries.filter(
        (entry) =>
          entry.entry_type === "note" &&
          entry.created_at === entry.updated_at &&
          isCreatedOn(entry, today) &&
          !organizedEntryIds.includes(entry.id),
      ),
    [entries, organizedEntryIds, today],
  );
  const openTodos = useMemo(
    () =>
      entries
        .filter((entry) => entry.entry_type === "todo" && entry.status === "open")
        .sort((a, b) => compareOpenTodos(a, b, today)),
    [entries, today],
  );
  const overdueCount = openTodos.filter((entry) => entry.due_date && entry.due_date < today).length;
  const typeCounts = useMemo(
    () =>
      todayEntries.reduce(
        (counts, entry) => {
          counts[entry.entry_type] += 1;
          return counts;
        },
        { progress: 0, pitfall: 0, note: 0, todo: 0, idea: 0 } satisfies Record<EntryType, number>,
      ),
    [todayEntries],
  );
  const visibleEntries =
    selectedType === "all"
      ? todayEntries
      : todayEntries.filter((entry) => entry.entry_type === selectedType);

  const markPendingNotesOrganized = () => {
    const next = [...new Set([...organizedEntryIds, ...pendingNotes.map((entry) => entry.id)])];
    setOrganizedEntryIds(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ORGANIZED_ENTRY_IDS_KEY, JSON.stringify(next));
    }
  };

  const completeTodo = (entry: Entry) => {
    upsertEntry({
      id: entry.id,
      entry_type: entry.entry_type,
      entry_date: entry.entry_date,
      status: "done",
    });
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold">日复盘</h1>
            <p className="text-xs text-muted-foreground mt-0.5">回看当天记录与行动</p>
          </div>
          <DateSwitcher date={date} onChange={setDate} />
        </div>

        {pendingNotes.length > 0 && (
          <section className="rounded-xl border border-warning-border bg-warning-bg p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-warning">
                待整理 · {pendingNotes.length} 条
              </div>
              <button
                type="button"
                onClick={markPendingNotesOrganized}
                className="rounded-md border border-warning-border bg-card px-2.5 py-1.5 text-xs font-medium text-warning hover:bg-secondary"
              >
                全部标为注意
              </button>
            </div>
            <div className="mt-2 space-y-1 text-xs text-foreground/80">
              {pendingNotes.map((entry) => (
                <div key={entry.id} className="truncate">
                  {entry.content}
                </div>
              ))}
            </div>
          </section>
        )}

        <Card
          title={`未完成待办 · ${openTodos.length}`}
          action={
            overdueCount > 0 ? (
              <span className="text-xs font-medium text-destructive">逾期 {overdueCount} 条</span>
            ) : undefined
          }
        >
          {openTodos.length === 0 ? (
            <Empty text="当前没有未完成待办" />
          ) : (
            <div className="divide-y divide-border">
              {openTodos.map((entry) => (
                <div key={entry.id} className="flex items-start gap-2 py-2.5 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    onClick={() => completeTodo(entry)}
                    className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border border-muted-foreground text-transparent hover:border-primary hover:text-primary"
                    aria-label={`完成待办：${entry.content}`}
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <EntryCopy entry={entry} customerNames={customerNames} today={today} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="flex flex-wrap gap-1.5 rounded-xl border border-border bg-card p-2">
          <FilterButton active={selectedType === "all"} onClick={() => setSelectedType("all")}>
            今日全部 {todayEntries.length}
          </FilterButton>
          {(Object.keys(ENTRY_TYPE_LABELS) as EntryType[]).map((type) => (
            <FilterButton
              key={type}
              active={selectedType === type}
              onClick={() => setSelectedType(type)}
            >
              {ENTRY_TYPE_LABELS[type]} {typeCounts[type]}
            </FilterButton>
          ))}
        </div>

        <Card title="今日记录流">
          {visibleEntries.length === 0 ? (
            <Empty text={todayEntries.length === 0 ? "当天暂无记录" : "当前筛选下暂无记录"} />
          ) : (
            <div className="divide-y divide-border">
              {visibleEntries.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="mt-0.5 shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
                    {ENTRY_TYPE_LABELS[entry.entry_type]}
                  </span>
                  <EntryCopy entry={entry} customerNames={customerNames} today={today} />
                  {entry.entry_type === "todo" ? (
                    <button
                      type="button"
                      onClick={() => entry.status === "open" && completeTodo(entry)}
                      disabled={entry.status !== "open"}
                      className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-muted-foreground text-muted-foreground hover:border-primary hover:text-primary disabled:border-primary disabled:bg-primary disabled:text-primary-foreground"
                      aria-label={entry.status === "open" ? "完成待办" : "待办已完成"}
                    >
                      {entry.status === "done" && <Check className="h-3.5 w-3.5" />}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="mt-0.5 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      aria-label="更多操作"
                      title="更多操作"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="复盘问题">
          <ReviewField
            label="今天最大的卡点是什么？"
            value={review?.biggest_blocker ?? ""}
            onChange={(value) => saveDailyReview(date, { biggest_blocker: value })}
          />
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          今日 {todayEntries.length} 条记录 · 客户相关{" "}
          {formatDuration(stats.customerProgressMinutes)} · 内部消耗{" "}
          {formatDuration(stats.internalCostMinutes)} · 高价值占比{" "}
          {Math.round(stats.highValueRatio * 100)}%
        </p>
      </div>
    </AppShell>
  );
}

function EntryCopy({
  entry,
  customerNames,
  today,
}: {
  entry: Entry;
  customerNames: Map<string, string>;
  today: string;
}) {
  const meta = entryMeta(entry, customerNames, today);
  const overdue =
    entry.entry_type === "todo" &&
    entry.status === "open" &&
    entry.due_date &&
    entry.due_date < today;
  return (
    <div className="min-w-0 flex-1">
      <div
        className={
          entry.status === "done"
            ? "text-[15px] leading-6 text-muted-foreground line-through"
            : "text-[15px] leading-6"
        }
      >
        {entry.content}
      </div>
      {meta.length > 0 && (
        <div
          className={
            overdue ? "mt-0.5 text-xs text-destructive" : "mt-0.5 text-xs text-muted-foreground"
          }
        >
          {meta.join(" · ")}
        </div>
      )}
    </div>
  );
}

function entryMeta(entry: Entry, customerNames: Map<string, string>, today: string): string[] {
  const meta: string[] = [];
  if (entry.focus_date === today) meta.push("今日重点");
  if (entry.due_date) {
    const days = Math.floor(
      (new Date(`${today}T00:00:00`).getTime() - new Date(`${entry.due_date}T00:00:00`).getTime()) /
        86400000,
    );
    meta.push(entry.due_date < today ? `逾期 ${days} 天` : `截止日 ${entry.due_date}`);
  } else if (entry.entry_type === "todo") {
    meta.push("无截止日");
  }
  const customerName = entry.customer_id ? customerNames.get(entry.customer_id) : undefined;
  if (customerName) meta.push(customerName);
  if (entry.quadrant) meta.push(ENTRY_QUADRANT_LABELS[entry.quadrant]);
  meta.push(...entry.tags.filter(Boolean));
  return meta;
}

function isCreatedOn(entry: Entry, date: string): boolean {
  const created = new Date(entry.created_at);
  return !Number.isNaN(created.getTime()) && toDateKey(created) === date;
}

function compareOpenTodos(a: Entry, b: Entry, today: string): number {
  const aOverdue = Boolean(a.due_date && a.due_date < today);
  const bOverdue = Boolean(b.due_date && b.due_date < today);
  if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
  if (!a.due_date !== !b.due_date) return a.due_date ? -1 : 1;
  return (a.due_date ?? "").localeCompare(b.due_date ?? "") || sortEntries(a, b);
}

function sortEntries(a: Entry, b: Entry): number {
  return a.position - b.position || b.created_at.localeCompare(a.created_at);
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-md bg-primary px-2.5 py-1.5 text-xs text-primary-foreground"
          : "rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
      }
    >
      {children}
    </button>
  );
}

export function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold">{value}</div>
    </div>
  );
}

export function Card({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">{title}</div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function TypeBars({
  stats,
  limit,
}: {
  stats: ReturnType<typeof computeStats>;
  limit?: number;
}) {
  const { settings } = useWorkTypeSettings();
  const [expanded, setExpanded] = useState(false);
  const total = Math.max(1, stats.totalMinutes);
  const rows = getEffectiveWorkTypes(settings)
    .map((wt) => ({ wt, minutes: stats.byType[wt.id] ?? 0 }))
    .filter((row) => row.minutes > 0);
  if (rows.length === 0) return <Empty text="还没有记录数据" />;
  const visibleRows = limit && !expanded ? rows.slice(0, limit) : rows;
  return (
    <div className="space-y-2">
      {visibleRows.map(({ wt, minutes }) => {
        const pct = (minutes / total) * 100;
        return (
          <div key={wt.id} className="flex items-center gap-2 text-xs">
            <div className="w-20 shrink-0 truncate text-foreground/80">{wt.label}</div>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: wt.colorCss }}
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
      {limit && rows.length > limit && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="w-full pt-1 text-center text-xs text-primary hover:underline"
        >
          {expanded ? "收起" : `展开全部 ${rows.length} 项`}
        </button>
      )}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="py-2 text-xs text-muted-foreground">{text}</div>;
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
      {items.map((item, index) => (
        <li key={index} className="border-l-2 border-primary/40 pl-3">
          <div className="text-foreground/90">{item.primary}</div>
          {item.secondary && (
            <div className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">
              {item.secondary}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
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
