import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/salesup/AppShell";
import { useCustomers } from "@/lib/salesup/useCustomers";
import { useEntries } from "@/lib/salesup/storage";
import {
  ENTRY_TYPE_LABELS,
  ENTRY_WORK_AREA_LABELS,
  type Entry,
  type EntryWorkArea,
} from "@/lib/salesup/types";
import { addDays, formatDateLabel, todayKey, weekRangeOf } from "@/lib/salesup/date";

export const Route = createFileRoute("/weekly-board")({
  head: () => ({ meta: [{ title: "周看板 · Sales Up" }] }),
  component: WeeklyBoardPage,
});

type BoardView = "customer" | "non_customer";

function WeeklyBoardPage() {
  const [anchor, setAnchor] = useState(() => todayKey());
  const [view, setView] = useState<BoardView>("customer");
  const { days } = useMemo(() => weekRangeOf(anchor), [anchor]);
  const entries = useEntries();
  const { customers } = useCustomers();
  const entriesThisWeek = useMemo(
    () => entries.filter((entry) => days.includes(entry.entry_date)),
    [days, entries],
  );
  const customerRows = useMemo(
    () =>
      buildCustomerRows(
        entriesThisWeek,
        customers.map((customer) => ({ id: customer.id, name: customer.companyName })),
      ),
    [entriesThisWeek, customers],
  );
  const hiddenCustomerCount = Math.max(0, customers.length - customerRows.length);
  const nonCustomerRows = useMemo(() => buildNonCustomerRows(entriesThisWeek), [entriesThisWeek]);

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold md:text-2xl">周看板</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">按客户查看本周记录分布</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-lg border border-border bg-card">
              <button
                type="button"
                onClick={() => setAnchor(addDays(anchor, -7))}
                className="px-2.5 py-1.5 hover:bg-secondary"
                aria-label="上一周"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="min-w-[132px] border-x border-border px-3 py-1.5 text-center text-sm font-medium">
                {days[0]} ~ {days[6]}
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
            <button
              type="button"
              onClick={() => setAnchor(todayKey())}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs hover:bg-secondary"
            >
              本周
            </button>
            <div className="inline-flex rounded-lg border border-border bg-card p-1">
              <ViewButton active={view === "customer"} onClick={() => setView("customer")}>
                客户
              </ViewButton>
              <ViewButton active={view === "non_customer"} onClick={() => setView("non_customer")}>
                非客户
              </ViewButton>
            </div>
          </div>
        </div>

        {view === "customer" ? (
          <CustomerGrid days={days} rows={customerRows} hiddenCustomerCount={hiddenCustomerCount} />
        ) : (
          <NonCustomerGrid days={days} rows={nonCustomerRows} />
        )}
      </div>
    </AppShell>
  );
}

function CustomerGrid({
  days,
  rows,
  hiddenCustomerCount,
}: {
  days: string[];
  rows: CustomerRow[];
  hiddenCustomerCount: number;
}) {
  return (
    <BoardGrid days={days} firstColumnLabel="客户" rows={rows} empty="本周没有关联客户的记录">
      <p className="px-3 py-2 text-center text-xs text-muted-foreground">
        本周无记录的 {hiddenCustomerCount} 个客户已隐藏
      </p>
    </BoardGrid>
  );
}

function NonCustomerGrid({ days, rows }: { days: string[]; rows: NonCustomerRow[] }) {
  return <BoardGrid days={days} firstColumnLabel="分类" rows={rows} />;
}

type BoardRow = { id: string; name: string; entries: Entry[]; byDay: Map<string, Entry[]> };

function BoardGrid({
  days,
  firstColumnLabel,
  rows,
  empty,
  children,
}: {
  days: string[];
  firstColumnLabel: string;
  rows: BoardRow[];
  empty?: string;
  children?: React.ReactNode;
}) {
  const gridStyle = { gridTemplateColumns: "minmax(144px, 1.2fr) repeat(7, minmax(132px, 1fr))" };
  const today = todayKey();
  return (
    <section className="overflow-x-auto rounded-xl border border-border bg-border">
      <div className="min-w-[1068px] space-y-px">
        <div className="grid gap-px" style={gridStyle}>
          <div className="bg-secondary/50 px-3 py-2 text-xs font-medium text-muted-foreground">
            {firstColumnLabel}
          </div>
          {days.map((day) => (
            <BoardDayHeader key={day} day={day} />
          ))}
        </div>
        {rows.length === 0 && empty ? (
          <div className="bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            {empty}
          </div>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="grid gap-px" style={gridStyle}>
              <BoardRowLabel row={row} />
              {days.map((day) => (
                <BoardEntriesCell key={day} entries={row.byDay.get(day) ?? []} today={today} />
              ))}
            </div>
          ))
        )}
      </div>
      {children && <div className="border-t border-border bg-card">{children}</div>}
    </section>
  );
}

function BoardDayHeader({ day }: { day: string }) {
  const today = todayKey();
  const isToday = day === today;
  const isFuture = day > today;
  return (
    <div
      className={
        isToday
          ? "bg-secondary/50 px-2 py-2 text-center text-xs font-medium text-primary"
          : isFuture
            ? "bg-secondary/50 px-2 py-2 text-center text-xs text-muted-foreground"
            : "bg-secondary/50 px-2 py-2 text-center text-xs font-medium"
      }
    >
      <div>{formatDateLabel(day).slice(-6)}</div>
      <div className="mt-0.5 text-[10px] font-normal text-muted-foreground">{day}</div>
    </div>
  );
}

function BoardRowLabel({ row }: { row: BoardRow }) {
  const isEmpty = row.entries.length === 0;
  return (
    <div className="bg-card px-3 py-3">
      <div
        className={
          isEmpty
            ? "text-[11.5px] font-medium text-secondary-foreground"
            : "text-[11.5px] font-medium"
        }
      >
        {row.name}
      </div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{row.entries.length} 条</div>
    </div>
  );
}

function BoardEntriesCell({ entries, today }: { entries: Entry[]; today: string }) {
  return (
    <div className="min-h-24 bg-card p-2">
      <div className="flex flex-col gap-[7px]">
        {entries.map((entry) => (
          <BoardEntry key={entry.id} entry={entry} today={today} />
        ))}
      </div>
    </div>
  );
}

function BoardEntry({ entry, today }: { entry: Entry; today: string }) {
  const overdue =
    entry.entry_type === "todo" &&
    entry.status === "open" &&
    entry.due_date &&
    entry.due_date < today;
  const danger = entry.entry_type === "pitfall" || overdue;
  return (
    <div>
      <div
        className={
          entry.entry_type === "todo" && entry.status === "done"
            ? "break-words text-[11.5px] leading-4 text-muted-foreground line-through"
            : "break-words text-[11.5px] leading-4"
        }
      >
        {entry.content}
      </div>
      <div
        className={
          danger
            ? "mt-0.5 text-[10px] text-destructive"
            : "mt-0.5 text-[10px] text-muted-foreground"
        }
      >
        {ENTRY_TYPE_LABELS[entry.entry_type]}
        {entry.tags.length > 0 && ` · ${entry.tags.join("、")}`}
      </div>
    </div>
  );
}

function ViewButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground"
          : "rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
      }
    >
      {children}
    </button>
  );
}

type CustomerRow = BoardRow;
type NonCustomerRow = BoardRow;

const NON_CUSTOMER_AREAS: EntryWorkArea[] = ["internal", "learning", "method"];

function buildCustomerRows(
  entries: Entry[],
  customers: { id: string; name: string }[],
): CustomerRow[] {
  const customerNames = new Map(customers.map((customer) => [customer.id, customer.name]));
  const groups = new Map<string, CustomerRow>();
  for (const entry of entries) {
    if (!entry.customer_id) continue;
    const row = groups.get(entry.customer_id) ?? {
      id: entry.customer_id,
      name: customerNames.get(entry.customer_id) ?? "未命名客户",
      entries: [],
      byDay: new Map<string, Entry[]>(),
    };
    row.entries.push(entry);
    const sameDay = row.byDay.get(entry.entry_date) ?? [];
    sameDay.push(entry);
    row.byDay.set(entry.entry_date, sameDay);
    groups.set(entry.customer_id, row);
  }
  return [...groups.values()].sort(
    (a, b) => b.entries.length - a.entries.length || a.name.localeCompare(b.name),
  );
}

function buildNonCustomerRows(entries: Entry[]): NonCustomerRow[] {
  const nonCustomerEntries = entries.filter((entry) => entry.customer_id === null);
  const rows: NonCustomerRow[] = NON_CUSTOMER_AREAS.map((area) => ({
    id: area,
    name: ENTRY_WORK_AREA_LABELS[area],
    entries: nonCustomerEntries.filter((entry) => entry.work_area === area),
    byDay: new Map<string, Entry[]>(),
  }));
  const uncategorized = nonCustomerEntries.filter((entry) => entry.work_area === null);
  if (uncategorized.length > 0) {
    rows.push({ id: "uncategorized", name: "未分类", entries: uncategorized, byDay: new Map() });
  }
  for (const row of rows) {
    for (const entry of row.entries) {
      const sameDay = row.byDay.get(entry.entry_date) ?? [];
      sameDay.push(entry);
      row.byDay.set(entry.entry_date, sameDay);
    }
  }
  return rows;
}
