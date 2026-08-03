import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  AlertTriangle,
  Columns3,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/salesup/AppShell";
import { OpportunityStageChangeDialog } from "@/components/salesup/customer/OpportunityStageChangeDialog";
import { OpportunityTableView } from "@/components/salesup/customer/OpportunityTableView";
import { OpportunityViewSummary } from "@/components/salesup/customer/OpportunityViewSummary";
import { StageAdvanceControl } from "@/components/salesup/customer/StageAdvanceControl";
import { cn } from "@/lib/utils";
import { todayKey } from "@/lib/salesup/date";
import { useOpportunities } from "@/lib/salesup/useOpportunities";
import { useStageSettings } from "@/lib/salesup/stageSettings";
import {
  getEffectiveWinRate,
  isStale,
  staleDays,
  SOURCE_LABEL,
  SOURCE_ORDER,
  STAGE_COLOR_TOKEN,
  STAGE_LABEL,
  STAGE_ORDER,
  STATUS_LABEL,
  type CustomerSource,
  type CustomerStage,
  type CustomerStatus,
  type StageStaleDays,
} from "@/lib/salesup/customerTypes";
import type { OpportunityWithDetails } from "@/lib/salesup/opportunityTypes";

type OpportunityView = "board" | "table";
type OpportunityStatusFilter = CustomerStatus | "all";
interface OpportunityBoardSearch {
  sources?: string;
  products?: string;
  status?: OpportunityStatusFilter;
  q?: string;
  view?: OpportunityView;
}
const VIEW_STORAGE_KEY = "salesup:opportunities:view";

function parseList(value: string | undefined): string[] {
  return value?.split(",").filter(Boolean) ?? [];
}
function isStatus(value: unknown): value is OpportunityStatusFilter {
  return (
    value === "all" ||
    value === "active" ||
    value === "won" ||
    value === "lost" ||
    value === "on_hold"
  );
}
function formatAmount(amount: number, currency: string): string {
  return `${currency === "CNY" ? "¥" : `${currency} `}${amount.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}
function stageTimestamp(opportunity: OpportunityWithDetails): number {
  const value = new Date(opportunity.stageChangedAt).getTime();
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
}

export const Route = createFileRoute("/customers/")({
  validateSearch: (search: Record<string, unknown>): OpportunityBoardSearch => ({
    sources: typeof search.sources === "string" ? search.sources : undefined,
    products: typeof search.products === "string" ? search.products : undefined,
    status: isStatus(search.status) ? search.status : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
    view: search.view === "table" || search.view === "board" ? search.view : undefined,
  }),
  head: () => ({
    meta: [
      { title: "商机看板 · Sales Up" },
      { name: "description", content: "按阶段查看进行中的商机。" },
    ],
  }),
  component: OpportunitiesBoardPage,
});

function OpportunitiesBoardPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { opportunities, loading, error, userId, refresh } = useOpportunities();
  const { staleDays: staleThresholds } = useStageSettings();
  const today = todayKey();
  const sources = useMemo(
    () =>
      parseList(search.sources).filter((source): source is CustomerSource =>
        SOURCE_ORDER.includes(source as CustomerSource),
      ),
    [search.sources],
  );
  const products = useMemo(() => parseList(search.products), [search.products]);
  const status = search.status ?? "active";
  const query = search.q ?? "";
  const [view, setView] = useState<OpportunityView>(search.view ?? "board");
  const [stageTarget, setStageTarget] = useState<{
    opportunity: OpportunityWithDetails;
    stage: CustomerStage;
  } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  useEffect(() => {
    if (search.view) {
      setView(search.view);
      return;
    }
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (saved === "board" || saved === "table") setView(saved);
  }, [search.view]);

  const setSearch = useCallback(
    (patch: Partial<OpportunityBoardSearch>) => {
      void navigate({ to: "/customers", search: (previous) => ({ ...previous, ...patch }) });
    },
    [navigate],
  );
  const changeView = (nextView: OpportunityView) => {
    setView(nextView);
    if (typeof window !== "undefined") window.localStorage.setItem(VIEW_STORAGE_KEY, nextView);
    setSearch({ view: nextView });
  };
  const toggleSource = (source: CustomerSource) =>
    setSearch({
      sources:
        (sources.includes(source)
          ? sources.filter((item) => item !== source)
          : [...sources, source]
        ).join(",") || undefined,
    });
  const toggleProduct = (product: string) =>
    setSearch({
      products:
        (products.includes(product)
          ? products.filter((item) => item !== product)
          : [...products, product]
        ).join(",") || undefined,
    });

  const allProducts = useMemo(
    () =>
      Array.from(new Set(opportunities.flatMap((opportunity) => opportunity.productLines))).sort(),
    [opportunities],
  );
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return opportunities.filter((opportunity) => {
      if (status !== "all" && opportunity.status !== status) return false;
      if (sources.length && !sources.includes(opportunity.customer.source)) return false;
      if (products.length && !opportunity.productLines.some((line) => products.includes(line)))
        return false;
      if (!keyword) return true;
      return [
        opportunity.customer.companyName,
        opportunity.name,
        ...opportunity.contacts.map((contact) => contact.name),
      ].some((value) => value.toLowerCase().includes(keyword));
    });
  }, [opportunities, products, query, sources, status]);
  const columns = useMemo(
    () =>
      STAGE_ORDER.map((stage) => ({
        stage,
        items: filtered
          .filter((opportunity) => opportunity.stage === stage)
          .sort((left, right) => stageTimestamp(left) - stageTimestamp(right)),
      })),
    [filtered],
  );
  const draggingOpportunity = useMemo(
    () => filtered.find((opportunity) => opportunity.id === draggingId) ?? null,
    [draggingId, filtered],
  );
  const showContent = !!userId && !loading && !error;
  const dragStart = (event: DragStartEvent) => setDraggingId(String(event.active.id));
  const dragEnd = (event: DragEndEvent) => {
    setDraggingId(null);
    const stage = event.over?.id ? (String(event.over.id) as CustomerStage) : null;
    const opportunity = filtered.find((item) => item.id === String(event.active.id));
    if (stage && opportunity && stage !== opportunity.stage) setStageTarget({ opportunity, stage });
  };

  return (
    <AppShell>
      <div className="mb-4 flex items-start gap-3 md:mb-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">商机看板</h1>
          <p className="mt-1 text-sm text-muted-foreground">按阶段查看进行中的商机</p>
        </div>
        <div className="inline-flex h-9 shrink-0 rounded-lg border border-border bg-card p-0.5">
          <button
            type="button"
            onClick={() => changeView("board")}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 text-xs",
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
              "inline-flex items-center gap-1 rounded-md px-2 text-xs",
              view === "table"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Columns3 className="h-3.5 w-3.5" />
            表格
          </button>
        </div>
      </div>
      {showContent && <OpportunityViewSummary opportunities={filtered} today={today} />}
      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-52 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setSearch({ q: event.target.value || undefined })}
              placeholder="搜索公司、商机或联系人"
              className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-2 text-xs outline-none focus:border-primary/60"
            />
          </label>
          <select
            value={status}
            onChange={(event) =>
              setSearch({
                status:
                  event.target.value === "active"
                    ? undefined
                    : (event.target.value as OpportunityStatusFilter),
              })
            }
            className="h-8 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary/60"
          >
            <option value="active">进行中</option>
            <option value="all">全部状态</option>
            {(["won", "lost", "on_hold"] as CustomerStatus[]).map((item) => (
              <option key={item} value={item}>
                {STATUS_LABEL[item]}
              </option>
            ))}
          </select>
        </div>
        <FilterRow label="来源">
          {SOURCE_ORDER.map((source) => (
            <Chip
              key={source}
              active={sources.includes(source)}
              onClick={() => toggleSource(source)}
            >
              {SOURCE_LABEL[source]}
            </Chip>
          ))}
        </FilterRow>
        {allProducts.length > 0 && (
          <FilterRow label="产品线">
            {allProducts.map((product) => (
              <Chip
                key={product}
                active={products.includes(product)}
                onClick={() => toggleProduct(product)}
              >
                {product}
              </Chip>
            ))}
          </FilterRow>
        )}
      </div>
      {!userId && !loading && (
        <EmptyState title="请先登录" description="商机数据按账号保存到云端。" action />
      )}
      {userId && loading && (
        <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在加载…
        </div>
      )}
      {userId && !loading && error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="font-medium">加载失败</div>
          <div className="mt-1 break-words text-xs">{error}</div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md bg-destructive px-3 text-xs text-destructive-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重试
          </button>
        </div>
      )}
      {showContent && view === "table" && (
        <OpportunityTableView opportunities={filtered} today={today} />
      )}
      {showContent && view === "board" && filtered.length === 0 && (
        <EmptyState title="暂无匹配的商机" description="试着调整来源、产品线、状态或搜索条件。" />
      )}
      {showContent && view === "board" && filtered.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={dragStart}
          onDragEnd={dragEnd}
          onDragCancel={() => setDraggingId(null)}
        >
          <div className="-mx-4 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
            <div className="flex min-w-max items-start gap-3">
              {columns.map((column) => (
                <StageColumn
                  key={column.stage}
                  stage={column.stage}
                  items={column.items}
                  dragging={!!draggingId}
                >
                  {column.items.length === 0 ? (
                    <div className="py-4 text-center text-[11px] text-muted-foreground/70">
                      暂无商机
                    </div>
                  ) : (
                    column.items.map((opportunity) => (
                      <DraggableCard key={opportunity.id} id={opportunity.id}>
                        <KanbanOpportunityCard
                          opportunity={opportunity}
                          today={today}
                          staleThresholds={staleThresholds}
                          onPickStage={(target, stage) =>
                            setStageTarget({ opportunity: target, stage })
                          }
                        />
                      </DraggableCard>
                    ))
                  )}
                </StageColumn>
              ))}
            </div>
          </div>
          <DragOverlay>
            {draggingOpportunity && (
              <div className="w-[240px] rotate-1 opacity-90 md:w-[264px]">
                <KanbanOpportunityCard
                  opportunity={draggingOpportunity}
                  today={today}
                  staleThresholds={staleThresholds}
                  onPickStage={() => {}}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
      {stageTarget && (
        <OpportunityStageChangeDialog
          opportunity={stageTarget.opportunity}
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
  items,
  dragging,
  children,
}: {
  stage: CustomerStage;
  items: OpportunityWithDetails[];
  dragging: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const amount = items.reduce((sum, opportunity) => sum + (opportunity.amount ?? 0), 0);
  const color = STAGE_COLOR_TOKEN[stage];
  return (
    <section
      className={cn(
        "w-[240px] shrink-0 rounded-xl border bg-secondary p-2.5 transition md:w-[264px]",
        isOver ? "border-primary ring-1 ring-primary/20" : "border-border",
      )}
    >
      <header className="flex items-center gap-2 px-1 pb-2.5">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: `var(${color})` }}
        />
        <span className="flex-1 text-sm font-medium">{STAGE_LABEL[stage]}</span>
        <span className="rounded-full bg-background px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
          {items.length}
        </span>
      </header>
      <div className="mb-2 px-1 text-[11px] tabular-nums text-muted-foreground">
        {items.some((item) => item.amount !== null)
          ? formatAmount(amount, items.find((item) => item.amount !== null)?.currency ?? "CNY")
          : "金额待定"}
      </div>
      <div ref={setNodeRef} className={cn("min-h-[80px] space-y-2", dragging && "min-h-[120px]")}>
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
function KanbanOpportunityCard({
  opportunity,
  today,
  staleThresholds,
  onPickStage,
}: {
  opportunity: OpportunityWithDetails;
  today: string;
  staleThresholds: StageStaleDays;
  onPickStage: (opportunity: OpportunityWithDetails, stage: CustomerStage) => void;
}) {
  const contact = opportunity.contacts.find((item) => item.isPrimary);
  const stale = opportunity.stage !== "signed" && isStale(opportunity, staleThresholds);
  const overdue =
    !!opportunity.nextAction && !!opportunity.nextActionDate && opportunity.nextActionDate < today;
  const winRate = getEffectiveWinRate(opportunity);
  const color = STAGE_COLOR_TOKEN[opportunity.stage];
  return (
    <div
      className={cn(
        "rounded-xl border bg-card px-3 py-2.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        stale
          ? "border-warning-border bg-linear-to-r from-warning-bg via-warning-bg/35 to-card"
          : "border-border",
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-semibold tracking-tight">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: `var(${color})` }}
          />
          <span className="truncate">{opportunity.customer.companyName}</span>
        </div>
        {stale ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-warning-bg px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-warning">
            <AlertTriangle className="h-3 w-3" />
            停滞 {staleDays(opportunity)} 天
          </span>
        ) : (
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            停滞 {staleDays(opportunity)} 天
          </span>
        )}
      </div>
      <div className="mt-0.5 truncate text-xs font-medium text-primary">{opportunity.name}</div>
      <div className="mt-0.5 truncate text-xs text-muted-foreground">
        {contact ? `${contact.name}${contact.title ? ` · ${contact.title}` : ""}` : ""}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        {opportunity.amount === null ? (
          <span className="text-xs text-muted-foreground">金额待定</span>
        ) : (
          <span className="text-lg font-semibold leading-none tabular-nums text-primary">
            {formatAmount(opportunity.amount, opportunity.currency)}
          </span>
        )}
        <span className="text-[11px] tabular-nums text-muted-foreground">
          赢率 {winRate}%{opportunity.winRate !== null ? " · 手动" : ""}
        </span>
      </div>
      {opportunity.productLines.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {opportunity.productLines.map((line) => (
            <span
              key={line}
              className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {line}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          下一步：{opportunity.nextAction ?? "待补充"}
          {opportunity.nextActionDate && (
            <span className={cn("ml-1 tabular-nums", overdue && "font-semibold text-overdue")}>
              {opportunity.nextActionDate}
              {overdue ? "（逾期）" : ""}
            </span>
          )}
        </span>
        <StageAdvanceControl
          currentStage={opportunity.stage}
          onPick={(stage) => onPickStage(opportunity, stage)}
        />
      </div>
    </div>
  );
}
function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto py-0.5">{children}</div>
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
        "h-7 shrink-0 rounded-full border px-2.5 text-xs transition",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
function EmptyState({
  title,
  description,
  action = false,
}: {
  title: string;
  description: string;
  action?: boolean;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border py-12 text-center">
      <Users className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{description}</div>
      {action && (
        <Link
          to="/auth"
          className="mt-3 inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs text-primary-foreground"
        >
          去登录
        </Link>
      )}
    </div>
  );
}
