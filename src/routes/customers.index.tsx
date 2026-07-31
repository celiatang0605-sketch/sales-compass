import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Plus,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Users,
  Columns3,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/salesup/AppShell";
import { StageAdvanceControl } from "@/components/salesup/customer/StageAdvanceControl";
import { StageChangeDialog } from "@/components/salesup/customer/StageChangeDialog";
import { CustomerTableView } from "@/components/salesup/customer/CustomerTableView";
import { CustomerViewSummary } from "@/components/salesup/customer/CustomerViewSummary";
import { useCustomers } from "@/lib/salesup/useCustomers";
import { todayKey } from "@/lib/salesup/date";
import {
  isStale,
  staleDays,
  effectiveWinRate,
  ROLE_LABEL,
  SOURCE_LABEL,
  SOURCE_ORDER,
  STAGE_COLOR_TOKEN,
  STAGE_LABEL,
  STAGE_ORDER,
  type Customer,
  type CustomerSource,
  type CustomerStage,
} from "@/lib/salesup/customerTypes";

const BOARD_STAGES = STAGE_ORDER;
const CUSTOMER_VIEW_STORAGE_KEY = "salesup:customers:view";
type CustomerView = "board" | "table";

export const Route = createFileRoute("/customers/")({
  head: () => ({
    meta: [
      { title: "客户看板 · Sales Up" },
      {
        name: "description",
        content: "按阶段查看进行中的客户与商机，识别停滞与逾期跟进。",
      },
      { property: "og:title", content: "客户看板 · Sales Up" },
      {
        property: "og:description",
        content: "按阶段查看进行中的客户与商机，识别停滞与逾期跟进。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomersBoardPage,
});

function formatAmount(amount: number, currency: string): string {
  const symbol = currency === "CNY" ? "¥" : currency + " ";
  if (amount >= 10000) {
    const w = amount / 10000;
    return `${symbol}${w % 1 === 0 ? w : w.toFixed(1)} 万`;
  }
  return `${symbol}${amount.toLocaleString("zh-CN")}`;
}

function stageChangedAtTimestamp(customer: Customer): number {
  const timestamp = new Date(customer.stageChangedAt).getTime();
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}

function CustomersBoardPage() {
  const { customers, loading, error, userId, refresh } = useCustomers();
  const [sources, setSources] = useState<CustomerSource[]>([]);
  const [productLines, setProductLines] = useState<string[]>([]);
  const [stageTarget, setStageTarget] = useState<{
    customer: Customer;
    stage: CustomerStage;
  } | null>(null);
  const [view, setView] = useState<CustomerView>("board");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(CUSTOMER_VIEW_STORAGE_KEY);
    if (saved === "board" || saved === "table") setView(saved);
  }, []);

  const active = useMemo(() => customers.filter((c) => c.status === "active"), [customers]);

  const allProductLines = useMemo(() => {
    const set = new Set<string>();
    for (const c of customers) for (const p of c.productLines) set.add(p);
    return Array.from(set).sort();
  }, [customers]);

  const allFiltered = useMemo(() => {
    return customers.filter((c) => {
      if (sources.length > 0 && !sources.includes(c.source)) return false;
      if (productLines.length > 0 && !c.productLines.some((p) => productLines.includes(p)))
        return false;
      return true;
    });
  }, [customers, sources, productLines]);

  const filtered = useMemo(
    () => allFiltered.filter((customer) => customer.status === "active"),
    [allFiltered],
  );

  const today = todayKey();

  const boardCustomers = filtered;

  const columns = useMemo(
    () =>
      BOARD_STAGES.map((stage) => ({
        stage,
        items: boardCustomers
          .filter((c) => c.stage === stage)
          .sort((a, b) => stageChangedAtTimestamp(a) - stageChangedAtTimestamp(b)),
      })),
    [boardCustomers],
  );

  const [tableVisibleCustomers, setTableVisibleCustomers] = useState<Customer[]>(filtered);
  const handleTableVisibleCustomersChange = useCallback((nextCustomers: Customer[]) => {
    setTableVisibleCustomers(nextCustomers);
  }, []);

  const toggle = <T,>(list: T[], v: T, set: (n: T[]) => void) => {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  };

  const showBoard = !!userId && !loading && !error;

  const changeView = (nextView: CustomerView) => {
    setView(nextView);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CUSTOMER_VIEW_STORAGE_KEY, nextView);
    }
  };

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const draggingCustomer = useMemo(
    () => boardCustomers.find((c) => c.id === draggingId) ?? null,
    [boardCustomers, draggingId],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  const handleDragStart = (e: DragStartEvent) => {
    setDraggingId(String(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const activeId = String(e.active.id);
    setDraggingId(null);
    const overStage = e.over?.id ? (String(e.over.id) as CustomerStage) : null;
    if (!overStage) return;
    const cust = boardCustomers.find((c) => c.id === activeId);
    if (!cust || cust.stage === overStage) return;
    setStageTarget({ customer: cust, stage: overStage });
  };

  return (
    <AppShell>
      <div className="mb-4 md:mb-6 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">客户看板</h1>
          <p className="text-sm text-muted-foreground mt-1">
            按阶段查看进行中的客户，识别停滞与逾期跟进。
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="inline-flex h-9 rounded-lg border border-border bg-card p-0.5">
            <button
              type="button"
              onClick={() => changeView("board")}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 text-xs transition",
                view === "board"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              看板
            </button>
            <button
              type="button"
              onClick={() => changeView("table")}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 text-xs transition",
                view === "table"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Columns3 className="h-3.5 w-3.5" />
              表格
            </button>
          </div>
          <Link
            to="/customers/new"
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:bg-primary/90 transition"
          >
            <Plus className="w-4 h-4" />
            新建客户
          </Link>
        </div>
      </div>

      {showBoard && (
        <CustomerViewSummary
          customers={view === "table" ? tableVisibleCustomers : boardCustomers}
          today={today}
        />
      )}

      {/* 筛选 */}
      <div className="space-y-2 mb-4">
        <FilterRow label="来源">
          {SOURCE_ORDER.map((s) => (
            <Chip
              key={s}
              active={sources.includes(s)}
              onClick={() => toggle(sources, s, setSources)}
            >
              {SOURCE_LABEL[s]}
            </Chip>
          ))}
        </FilterRow>
        {allProductLines.length > 0 && (
          <FilterRow label="产品线">
            {allProductLines.map((p) => (
              <Chip
                key={p}
                active={productLines.includes(p)}
                onClick={() => toggle(productLines, p, setProductLines)}
              >
                {p}
              </Chip>
            ))}
          </FilterRow>
        )}
      </div>

      {/* 状态 */}
      {!userId && !loading && (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <div className="text-sm font-medium">请先登录</div>
          <div className="text-xs text-muted-foreground mt-1">客户数据按账号保存到云端。</div>
          <Link
            to="/auth"
            className="mt-3 inline-flex h-8 px-3 items-center rounded-md bg-primary text-primary-foreground text-xs"
          >
            去登录
          </Link>
        </div>
      )}

      {userId && loading && (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
          <Loader2 className="w-4 h-4 animate-spin" />
          正在加载…
        </div>
      )}

      {userId && !loading && error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="font-medium">加载失败</div>
          <div className="text-xs mt-1 break-words">{error}</div>
          <button
            onClick={() => void refresh()}
            className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-destructive text-destructive-foreground text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            重试
          </button>
        </div>
      )}

      {showBoard && view === "board" && boardCustomers.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <Users className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
          <div className="text-sm font-medium">
            {active.length === 0
              ? "还没有进行中的客户"
              : filtered.length === 0
                ? "没有匹配的客户"
                : "暂无机会确认及之后的客户"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {active.length === 0
              ? "从「新建客户」开始建立你的看板。"
              : filtered.length === 0
                ? "试着放宽来源或产品线筛选。"
                : "在看板中开始推进客户。"}
          </div>
        </div>
      )}

      {showBoard && view === "board" && boardCustomers.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDraggingId(null)}
        >
          <div className="-mx-4 md:-mx-8 px-4 md:px-8 overflow-x-auto pb-4">
            <div className="flex gap-3 min-w-max items-start">
              {columns.map((col) => (
                <StageColumn
                  key={col.stage}
                  stage={col.stage}
                  count={col.items.length}
                  dragging={!!draggingId}
                >
                  {col.items.length === 0 && (
                    <div className="text-[11px] text-muted-foreground/70 text-center py-4">
                      暂无客户
                    </div>
                  )}
                  {col.items.map((c) => (
                    <DraggableCard key={c.id} id={c.id}>
                      <KanbanCustomerCard
                        customer={c}
                        today={today}
                        onPickStage={(cust, s) => setStageTarget({ customer: cust, stage: s })}
                      />
                    </DraggableCard>
                  ))}
                </StageColumn>
              ))}
            </div>
          </div>
          <DragOverlay>
            {draggingCustomer ? (
              <div className="w-[240px] md:w-[264px] opacity-90 rotate-1">
                <KanbanCustomerCard
                  customer={draggingCustomer}
                  today={today}
                  onPickStage={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {showBoard && view === "table" && (
        <CustomerTableView
          customers={allFiltered}
          today={today}
          onRefresh={refresh}
          onVisibleCustomersChange={handleTableVisibleCustomersChange}
        />
      )}

      {stageTarget && (
        <StageChangeDialog
          customer={stageTarget.customer}
          targetStage={stageTarget.stage}
          onClose={() => setStageTarget(null)}
          onChanged={() => void refresh()}
        />
      )}
    </AppShell>
  );
}

function StageColumn({
  stage,
  count,
  dragging,
  children,
}: {
  stage: CustomerStage;
  count: number;
  dragging: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const colorToken = STAGE_COLOR_TOKEN[stage];
  return (
    <section
      className={cn(
        "w-[240px] md:w-[264px] shrink-0 rounded-xl border bg-secondary p-2.5 transition",
        isOver ? "border-primary ring-1 ring-primary/20" : "border-border",
      )}
    >
      <header className="flex items-center gap-2 px-1 py-0.5 pb-2.5">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: `var(${colorToken})` }}
        />
        <span className="flex-1 text-sm font-medium">{STAGE_LABEL[stage]}</span>
        <span className="min-w-5 rounded-full bg-background px-1.5 py-0.5 text-center text-[11px] text-muted-foreground tabular-nums">
          {count}
        </span>
      </header>
      <div ref={setNodeRef} className={cn("space-y-2 min-h-[80px]", dragging && "min-h-[120px]")}>
        {children}
      </div>
    </section>
  );
}

function DraggableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn("touch-manipulation", isDragging && "opacity-40")}
    >
      {children}
    </div>
  );
}

function KanbanCustomerCard({
  customer,
  today,
  onPickStage,
}: {
  customer: Customer;
  today: string;
  onPickStage: (customer: Customer, stage: CustomerStage) => void;
}) {
  const showsStale = customer.stage !== "signed";
  const stale = showsStale && isStale(customer);
  const days = staleDays(customer);
  const winRate = effectiveWinRate(customer);
  const overdue =
    !!customer.nextAction && !!customer.nextActionDate && customer.nextActionDate < today;
  const colorToken = STAGE_COLOR_TOKEN[customer.stage];

  return (
    <div
      className={cn(
        "rounded-xl border bg-card px-3 py-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        stale
          ? "border-warning-border bg-linear-to-r from-warning-bg via-warning-bg/35 to-card"
          : "border-border",
      )}
    >
      <Link to="/customers/$id" params={{ id: customer.id }} className="block min-w-0">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-semibold tracking-tight">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: `var(${colorToken})` }}
            />
            <span className="truncate">{customer.companyName}</span>
          </div>
          {showsStale &&
            (stale ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-warning-bg px-1.5 py-0.5 text-[11px] font-semibold text-warning tabular-nums">
                <AlertTriangle className="h-3 w-3" />
                停滞 {days} 天
              </span>
            ) : (
              <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                停滞 {days} 天
              </span>
            ))}
        </div>

        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {customer.contactName ?? "未填联系人"}
          {customer.contactTitle ? ` · ${customer.contactTitle}` : ""}
          {customer.decisionRole !== "unknown" ? ` · ${ROLE_LABEL[customer.decisionRole]}` : ""}
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          {customer.amount === null ? (
            <span className="text-xs text-muted-foreground">金额待定</span>
          ) : (
            <span className="text-[21px] font-semibold leading-none tracking-tight text-primary tabular-nums">
              {formatAmount(customer.amount, customer.currency)}
            </span>
          )}
          <div className="w-24 shrink-0">
            <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>赢率</span>
              <span className="font-semibold text-foreground tabular-nums">{winRate}%</span>
            </div>
            <div className="h-[3px] overflow-hidden rounded-full bg-border/70">
              <div className="h-full rounded-full bg-primary" style={{ width: `${winRate}%` }} />
            </div>
          </div>
        </div>
      </Link>

      <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
        <Link
          to="/customers/$id"
          params={{ id: customer.id }}
          className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
        >
          下一步：{customer.nextAction ?? "待补充"}
          {customer.nextActionDate && (
            <span className={cn("ml-1 tabular-nums", overdue && "font-semibold text-overdue")}>
              {customer.nextActionDate}
              {overdue ? "（逾期）" : ""}
            </span>
          )}
        </Link>
        <StageAdvanceControl
          currentStage={customer.stage}
          onPick={(stage) => onPickStage(customer, stage)}
        />
      </div>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-[11px] text-muted-foreground w-10">{label}</span>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 px-2.5 h-7 rounded-full text-xs border transition",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-muted-foreground border-border hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
