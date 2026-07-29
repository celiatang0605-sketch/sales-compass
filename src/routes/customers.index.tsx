import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  CalendarClock,
  Timer,
  Briefcase,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/salesup/AppShell";
import { StageAdvanceControl } from "@/components/salesup/customer/StageAdvanceControl";
import { StageChangeDialog } from "@/components/salesup/customer/StageChangeDialog";
import { useCustomers } from "@/lib/salesup/useCustomers";
import { todayKey } from "@/lib/salesup/date";
import {
  isStale,
  staleDays,
  ROLE_LABEL,
  SOURCE_LABEL,
  SOURCE_ORDER,
  STAGE_DEFAULT_WIN_RATE,
  STAGE_LABEL,
  STAGE_ORDER,
  type Customer,
  type CustomerSource,
  type CustomerStage,
} from "@/lib/salesup/customerTypes";


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

function CustomersBoardPage() {
  const { customers, loading, error, userId, refresh } = useCustomers();
  const [sources, setSources] = useState<CustomerSource[]>([]);
  const [productLines, setProductLines] = useState<string[]>([]);
  const [stageTarget, setStageTarget] = useState<{
    customer: Customer;
    stage: CustomerStage;
  } | null>(null);


  const active = useMemo(
    () => customers.filter((c) => c.status === "active"),
    [customers],
  );

  const allProductLines = useMemo(() => {
    const set = new Set<string>();
    for (const c of customers) for (const p of c.productLines) set.add(p);
    return Array.from(set).sort();
  }, [customers]);

  const filtered = useMemo(() => {
    return active.filter((c) => {
      if (sources.length > 0 && !sources.includes(c.source)) return false;
      if (
        productLines.length > 0 &&
        !c.productLines.some((p) => productLines.includes(p))
      )
        return false;
      return true;
    });
  }, [active, sources, productLines]);

  const today = todayKey();

  const stats = useMemo(() => {
    let followupToday = 0;
    let stalled = 0;
    for (const c of filtered) {
      if (c.nextAction && c.nextActionDate && c.nextActionDate <= today)
        followupToday += 1;
      if (isStale(c)) stalled += 1;
    }
    return { total: filtered.length, followupToday, stalled };
  }, [filtered, today]);

  const columns = useMemo(
    () =>
      STAGE_ORDER.map((stage) => ({
        stage,
        items: filtered.filter((c) => c.stage === stage),
      })),
    [filtered],
  );

  const toggle = <T,>(list: T[], v: T, set: (n: T[]) => void) => {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  };

  const showBoard = !!userId && !loading && !error;

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const draggingCustomer = useMemo(
    () => filtered.find((c) => c.id === draggingId) ?? null,
    [filtered, draggingId],
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
    const cust = filtered.find((c) => c.id === activeId);
    if (!cust || cust.stage === overStage) return;
    setStageTarget({ customer: cust, stage: overStage });
  };


  return (
    <AppShell>
      <div className="mb-4 md:mb-6 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
            客户看板
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            按阶段查看进行中的客户，识别停滞与逾期跟进。
          </p>
        </div>
        <Link
          to="/customers/new"
          className="shrink-0 inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:bg-primary/90 transition"
        >
          <Plus className="w-4 h-4" />
          新建客户
        </Link>
      </div>

      {/* 顶部统计条 */}
      <div className="grid grid-cols-3 gap-2 md:gap-3 mb-4">
        <StatCell icon={Briefcase} label="进行中商机" value={stats.total} />
        <StatCell
          icon={CalendarClock}
          label="今日待跟进"
          value={stats.followupToday}
        />
        <StatCell icon={Timer} label="停滞" value={stats.stalled} />
      </div>

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
          <div className="text-xs text-muted-foreground mt-1">
            客户数据按账号保存到云端。
          </div>
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

      {showBoard && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <Users className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
          <div className="text-sm font-medium">
            {active.length === 0 ? "还没有进行中的客户" : "没有匹配的客户"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {active.length === 0
              ? "从「新建客户」开始建立你的看板。"
              : "试着放宽来源或产品线筛选。"}
          </div>
        </div>
      )}

      {showBoard && filtered.length > 0 && (
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
                      <CustomerCard
                        customer={c}
                        today={today}
                        onPickStage={(cust, s) =>
                          setStageTarget({ customer: cust, stage: s })
                        }
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
                <CustomerCard
                  customer={draggingCustomer}
                  today={today}
                  onPickStage={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
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
  return (
    <section
      className={cn(
        "w-[240px] md:w-[264px] shrink-0 rounded-[var(--radius)] border bg-card/60 transition",
        isOver ? "border-primary bg-primary/5" : "border-border",
      )}
    >
      <header className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
        <span className="text-xs font-medium">{STAGE_LABEL[stage]}</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {count}
        </span>
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          "p-2 space-y-2 min-h-[80px]",
          dragging && "min-h-[120px]",
        )}
      >
        {children}
      </div>
    </section>
  );
}

function DraggableCard({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
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


function CustomerCard({
  customer,
  today,
  onPickStage,
}: {
  customer: Customer;
  today: string;
  onPickStage: (customer: Customer, stage: CustomerStage) => void;
}) {
  const stale = isStale(customer);
  const days = staleDays(customer);
  const stageRate = STAGE_DEFAULT_WIN_RATE[customer.stage];
  const overdue =
    !!customer.nextAction &&
    !!customer.nextActionDate &&
    customer.nextActionDate < today;

  return (
    <div
      className={cn(
        "rounded-[var(--radius)] border bg-card px-3 py-2.5 text-left shadow-sm transition hover:border-primary/40",
        stale ? "border-border border-l-2 border-l-muted-foreground/50 bg-muted/40" : "border-border",
      )}
    >
    <Link
      to="/customers/$id"
      params={{ id: customer.id }}
      className="block"
    >

      <div className="text-sm font-medium leading-snug truncate">
        {customer.companyName}
      </div>

      {(customer.contactName || customer.contactTitle) && (
        <div className="mt-0.5 text-xs text-muted-foreground truncate">
          {customer.contactName ?? "未填联系人"}
          {customer.contactTitle ? ` · ${customer.contactTitle}` : ""}
          {customer.decisionRole !== "unknown"
            ? ` · ${ROLE_LABEL[customer.decisionRole]}`
            : ""}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        {customer.amount !== null && (
          <span className="px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground tabular-nums">
            {formatAmount(customer.amount, customer.currency)}
          </span>
        )}
        <span className="px-1.5 py-0.5 rounded-md border border-border text-muted-foreground tabular-nums">
          {customer.winRate !== null
            ? `赢率 ${customer.winRate}%（阶段 ${stageRate}%）`
            : `赢率 ${stageRate}%`}
        </span>
        <span
          className={cn(
            "px-1.5 py-0.5 rounded-md tabular-nums",
            stale
              ? "bg-muted text-foreground/80 inline-flex items-center gap-1"
              : "text-muted-foreground",
          )}
        >
          {stale && <AlertTriangle className="w-3 h-3" />}
          停滞 {days} 天
        </span>
      </div>

      {customer.nextAction && (
        <div className="mt-2 pt-2 border-t border-border/70 text-[11px] leading-snug">
          <span className="text-muted-foreground">下一步：</span>
          <span className="text-foreground">{customer.nextAction}</span>
          {customer.nextActionDate && (
            <span
              className={cn(
                "ml-1 tabular-nums",
                overdue
                  ? "text-destructive font-medium"
                  : "text-muted-foreground",
              )}
            >
              {customer.nextActionDate}
              {overdue ? "（逾期）" : ""}
            </span>
          )}
        </div>
      )}
      </Link>

      <div className="mt-2 pt-2 border-t border-border/70 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground truncate">
          {STAGE_LABEL[customer.stage]}
        </span>
        <StageAdvanceControl
          currentStage={customer.stage}
          onPick={(s) => onPickStage(customer, s)}
        />
      </div>
    </div>
  );
}


function StatCell({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Briefcase;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-[11px] text-muted-foreground w-10">
        {label}
      </span>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {children}
      </div>
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
