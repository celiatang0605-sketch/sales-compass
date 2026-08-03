import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  BookOpenCheck,
  CircleMinus,
  ClipboardCheck,
  Database,
  Loader2,
  MessageCirclePlus,
  PhoneCall,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { LeadExitDialog } from "@/components/salesup/lead/LeadExitDialog";
import { AppShell } from "@/components/salesup/AppShell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SOURCE_LABEL, SOURCE_ORDER, type CustomerSource } from "@/lib/salesup/customerTypes";
import { todayKey } from "@/lib/salesup/date";
import {
  countLegacyLocalLeads,
  hasLegacyLocalLeads,
  importLegacyLocalLeads,
} from "@/lib/salesup/expoStore";
import { PRIORITY_LABEL, type LeadPriority } from "@/lib/salesup/expoMock";
import type { ExitLeadInput, LeadPoolLead } from "@/lib/salesup/leadRepository";
import {
  LEAD_STAGES,
  LEAD_STAGE_LABEL,
  type LeadStage,
  type LeadStageAction,
} from "@/lib/salesup/leadTypes";
import { useLeadPool } from "@/lib/salesup/useLeadPool";
import { cn } from "@/lib/utils";

const PRIORITY_FILTERS: (LeadPriority | "all")[] = ["all", "A", "B", "C", "D", "unrated"];

interface LeadPoolSearch {
  priority?: LeadPriority | "all";
  sources?: string;
  stage?: LeadStage;
  organize?: boolean;
  q?: string;
}

const STAGE_ACTION: Record<
  LeadStage,
  { label: string; icon: typeof BookOpenCheck; action?: LeadStageAction }
> = {
  research: { label: "标记已背调", icon: BookOpenCheck, action: "research" },
  call: { label: "标记已致电", icon: PhoneCall, action: "call" },
  add_wechat: { label: "标记已加微信", icon: MessageCirclePlus, action: "add_wechat" },
  send_intro: { label: "标记已发介绍", icon: Send, action: "send_intro" },
  need_discovery: { label: "标记已挖到需求", icon: ClipboardCheck, action: "need_discovery" },
  ready_to_convert: { label: "转为客户", icon: BadgeCheck },
};

const STAGE_ICON: Record<LeadStage, typeof BookOpenCheck> = {
  research: BookOpenCheck,
  call: PhoneCall,
  add_wechat: MessageCirclePlus,
  send_intro: Send,
  need_discovery: ClipboardCheck,
  ready_to_convert: BadgeCheck,
};

const STAGE_CARD_CLASS: Record<LeadStage, string> = {
  research: "lead-stage-card--research",
  call: "lead-stage-card--call",
  add_wechat: "lead-stage-card--add-wechat",
  send_intro: "lead-stage-card--send-intro",
  need_discovery: "lead-stage-card--need-discovery",
  ready_to_convert: "lead-stage-card--ready-to-convert",
};

function parseSources(value: string): CustomerSource[] {
  return value
    .split(",")
    .filter((source): source is CustomerSource => SOURCE_ORDER.includes(source as CustomerSource));
}

export const Route = createFileRoute("/expo/")({
  validateSearch: (search: Record<string, unknown>): LeadPoolSearch => ({
    priority:
      typeof search.priority === "string" &&
      PRIORITY_FILTERS.includes(search.priority as LeadPriority | "all")
        ? (search.priority as LeadPriority | "all")
        : undefined,
    sources: typeof search.sources === "string" ? search.sources : undefined,
    stage:
      typeof search.stage === "string" && LEAD_STAGES.includes(search.stage as LeadStage)
        ? (search.stage as LeadStage)
        : undefined,
    organize:
      search.organize === true || search.organize === "true" || search.organize === "1"
        ? true
        : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  head: () => ({
    meta: [
      { title: "线索池 · Sales Up" },
      { name: "description", content: "集中管理各来源线索，按下一步动作推进。" },
    ],
  }),
  component: ExpoIndexPage,
});

function ExpoIndexPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const today = todayKey();
  const { pool, loading, error, userId, refresh, advance, exit, resume } = useLeadPool();
  const priority = search.priority ?? "all";
  const query = search.q ?? "";
  const sources = useMemo(() => parseSources(search.sources ?? ""), [search.sources]);
  const [showLegacy, setShowLegacy] = useState(false);
  const [legacyCount, setLegacyCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const setSearch = useCallback(
    (patch: Partial<typeof search>) => {
      void navigate({ to: "/expo", search: (previous) => ({ ...previous, ...patch }) });
    },
    [navigate],
  );

  const refreshLegacy = useCallback(() => {
    if (!userId) {
      setShowLegacy(false);
      return;
    }
    setLegacyCount(countLegacyLocalLeads());
    setShowLegacy(hasLegacyLocalLeads(userId));
  }, [userId]);

  useEffect(() => {
    refreshLegacy();
  }, [refreshLegacy]);

  const allVisibleLeads = useMemo(
    () => (search.organize ? (pool?.needsOrganizeLeads ?? []) : (pool?.leads ?? [])),
    [pool, search.organize],
  );
  const list = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return allVisibleLeads.filter((lead) => {
      if (!search.organize && search.stage && lead.leadStage !== search.stage) return false;
      if (priority !== "all" && lead.priority !== priority) return false;
      if (sources.length > 0 && !sources.includes(lead.source)) return false;
      if (!keyword) return true;
      return (
        lead.company.toLowerCase().includes(keyword) ||
        lead.contactName.toLowerCase().includes(keyword) ||
        lead.headline.toLowerCase().includes(keyword)
      );
    });
  }, [allVisibleLeads, priority, query, search.organize, search.stage, sources]);

  const toggleSource = (source: CustomerSource) => {
    const next = sources.includes(source)
      ? sources.filter((item) => item !== source)
      : [...sources, source];
    setSearch({ sources: next.join(",") });
  };

  const toggleStage = (stage: LeadStage) => {
    setSearch({ stage: search.stage === stage ? undefined : stage, organize: false });
  };

  const toggleOrganize = () => {
    setSearch({ organize: !search.organize, stage: undefined });
  };

  const runImport = async () => {
    if (!userId || importing) return;
    setImporting(true);
    try {
      const result = await importLegacyLocalLeads(userId);
      if (result.imported > 0) toast.success(`已导入 ${result.imported} 条本地线索`);
      if (result.failed > 0) toast.error(`${result.failed} 条导入失败，请稍后重试`);
      await refresh();
      refreshLegacy();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "导入失败");
    } finally {
      setImporting(false);
    }
  };

  const runAdvance = async (leadId: string, action: LeadStageAction) => {
    if (pendingId) return;
    setPendingId(leadId);
    try {
      await advance(leadId, action);
      toast.success("已推进到下一步");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "推进失败，请稍后重试");
    } finally {
      setPendingId(null);
    }
  };

  const runExit = async (leadId: string, input: ExitLeadInput) => {
    setPendingId(leadId);
    try {
      await exit(leadId, input);
      toast.success(input.type === "paused" ? "已暂不跟进，到期后会自动回捞" : "已移出线索池");
    } finally {
      setPendingId(null);
    }
  };

  const runResume = async (leadId: string) => {
    if (pendingId) return;
    setPendingId(leadId);
    try {
      await resume(leadId);
      toast.success("已恢复跟进");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "恢复失败，请稍后重试");
    } finally {
      setPendingId(null);
    }
  };

  const activeTotal = pool?.leads.length ?? 0;

  return (
    <AppShell>
      <div className="mb-4 md:mb-5">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">线索池</h1>
        <p className="mt-1 text-sm text-muted-foreground">围绕下一步动作，集中推进活跃线索。</p>
      </div>

      {showLegacy && (
        <div className="mb-4 flex items-start gap-3 rounded-[var(--radius)] border border-border bg-secondary/50 p-3 md:p-4">
          <Database className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-medium">发现 {legacyCount} 条本地保存的线索</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              导入后会归入当前账号的线索池。
            </div>
          </div>
          <button
            type="button"
            onClick={() => void runImport()}
            disabled={importing}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-60"
          >
            {importing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            导入
          </button>
        </div>
      )}

      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
        <span>今日新增 {pool?.todayNewCount ?? 0}</span>
        <span>·</span>
        <span>线索池总量 {activeTotal}</span>
        <span>·</span>
        <button
          type="button"
          onClick={toggleOrganize}
          className={cn(
            "transition hover:text-foreground",
            pool && pool.needsOrganizeCount > 0 ? "text-destructive" : "text-muted-foreground",
            search.organize && "font-medium underline underline-offset-4",
          )}
        >
          待整理 {pool?.needsOrganizeCount ?? 0}
        </button>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {LEAD_STAGES.map((stage) => {
          const Icon = STAGE_ICON[stage];
          const selected = search.stage === stage && !search.organize;
          return (
            <button
              key={stage}
              type="button"
              onClick={() => toggleStage(stage)}
              className={cn(
                "min-w-0 rounded-xl border border-border bg-card p-2.5 text-left transition",
                STAGE_CARD_CLASS[stage],
                selected && "lead-stage-card--selected",
              )}
            >
              <span className="lead-stage-label flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="lead-stage-icon">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="truncate">{LEAD_STAGE_LABEL[stage]}</span>
              </span>
              <span className="mt-1.5 block text-2xl font-semibold leading-none tabular-nums">
                {pool?.stageCounts[stage] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex flex-col-reverse gap-2 md:mb-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setSearch({ q: event.target.value })}
            placeholder="搜索公司 / 联系人 / 需求"
            className="h-10 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/expo/new"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            快速记录
          </Link>
          <a
            href="#all-leads"
            className="hidden h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-secondary md:inline-flex"
          >
            查看列表
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {PRIORITY_FILTERS.map((filterPriority) => (
          <button
            key={filterPriority}
            type="button"
            onClick={() => setSearch({ priority: filterPriority })}
            className={cn(
              "h-8 shrink-0 rounded-full border px-3 text-xs transition",
              priority === filterPriority
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            {filterPriority === "all" ? "全部评级" : PRIORITY_LABEL[filterPriority]}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-1.5 overflow-x-auto pb-1">
        <span className="shrink-0 text-xs text-muted-foreground">来源</span>
        {SOURCE_ORDER.map((source) => (
          <button
            key={source}
            type="button"
            onClick={() => toggleSource(source)}
            className={cn(
              "h-8 shrink-0 rounded-full border px-3 text-xs transition",
              sources.includes(source)
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            {SOURCE_LABEL[source]}
          </button>
        ))}
      </div>

      <section id="all-leads" className="pb-24 md:pb-6">
        {!userId && !loading && (
          <EmptyState
            title="请先登录"
            hint="线索按账号保存到云端。"
            action={{ to: "/auth", label: "去登录" }}
          />
        )}
        {userId && loading && <LoadingState />}
        {userId && !loading && error && <ErrorState error={error} onRetry={refresh} />}
        {userId && !loading && !error && list.length === 0 && (
          <EmptyState
            title={allVisibleLeads.length === 0 ? "这里还没有线索" : "没有匹配的线索"}
            hint={allVisibleLeads.length === 0 ? "开始记录第一条线索吧。" : undefined}
            action={
              allVisibleLeads.length === 0 ? { to: "/expo/new", label: "快速记录" } : undefined
            }
          />
        )}
        {userId && !loading && !error && list.length > 0 && (
          <LeadTable
            leads={list}
            today={today}
            pendingId={pendingId}
            onAdvance={runAdvance}
            onExit={runExit}
            onResume={runResume}
          />
        )}
      </section>

      <div className="fixed inset-x-4 bottom-4 z-40 md:hidden">
        <Link
          to="/expo/new"
          className="inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-full bg-primary text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20"
        >
          <Plus className="h-4 w-4" />
          快速记录
        </Link>
      </div>
    </AppShell>
  );
}

function LoadingState() {
  return (
    <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-12 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      正在加载…
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => Promise<void> }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
      <div className="font-medium">加载失败</div>
      <div className="mt-1 break-words text-xs">{error}</div>
      <button
        type="button"
        onClick={() => void onRetry()}
        className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs text-primary-foreground"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        重试
      </button>
    </div>
  );
}

function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: { to: "/auth" | "/expo/new"; label: string };
}) {
  return (
    <div className="rounded-xl border border-dashed border-border py-12 text-center">
      <div className="text-sm font-medium text-foreground/90">{title}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      {action && (
        <Link
          to={action.to}
          className="mt-4 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

const TABLE_PRIORITY_STYLE: Record<LeadPriority, string> = {
  A: "border-primary/20 bg-primary/10 text-primary",
  B: "border-chart-2/30 bg-chart-2/15 text-foreground",
  C: "border-chart-3/30 bg-chart-3/15 text-foreground",
  D: "border-border bg-muted text-muted-foreground",
  unrated: "border-border bg-background text-muted-foreground border-dashed",
};

function leadContact(lead: LeadPoolLead): string {
  return [lead.phone, lead.wechat, lead.email].filter(Boolean).join(" · ") || "—";
}

function leadNote(lead: LeadPoolLead): string {
  return lead.currentNeed?.trim() || lead.rawNote.trim() || lead.headline || "—";
}

function isReclaimed(lead: LeadPoolLead, today: string): boolean {
  return lead.status === "paused" && !!lead.resumeOn && lead.resumeOn <= today;
}

interface LeadTableProps {
  leads: LeadPoolLead[];
  today: string;
  pendingId: string | null;
  onAdvance: (leadId: string, action: LeadStageAction) => Promise<void>;
  onExit: (leadId: string, input: ExitLeadInput) => Promise<void>;
  onResume: (leadId: string) => Promise<void>;
}

function LeadTable({ leads, today, pendingId, onAdvance, onExit, onResume }: LeadTableProps) {
  const navigate = useNavigate();
  const [exitTarget, setExitTarget] = useState<LeadPoolLead | null>(null);

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table className="min-w-[940px] text-xs">
          <TableHeader>
            <TableRow className="h-9 hover:bg-transparent">
              <TableHead className="sticky left-0 z-20 min-w-44 bg-card px-3">公司</TableHead>
              <TableHead className="min-w-24 px-3">评级</TableHead>
              <TableHead className="min-w-44 px-3">联系人 / 联系方式</TableHead>
              <TableHead className="min-w-48 px-3">需求或备注</TableHead>
              <TableHead className="min-w-20 px-3">来源</TableHead>
              <TableHead className="min-w-24 px-3">下一步</TableHead>
              <TableHead className="min-w-40 px-3 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => {
              const action = STAGE_ACTION[lead.leadStage];
              const ActionIcon = action.icon;
              const reclaimed = isReclaimed(lead, today);
              const busy = pendingId === lead.id;
              return (
                <TableRow
                  key={lead.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => void navigate({ to: "/expo/$id", params: { id: lead.id } })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void navigate({ to: "/expo/$id", params: { id: lead.id } });
                    }
                  }}
                  className="h-12 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <TableCell className="sticky left-0 z-10 max-w-56 bg-card px-3 py-1.5 font-medium">
                    <span className="block truncate">{lead.company || "（未命名线索）"}</span>
                    {reclaimed && (
                      <span className="mt-0.5 inline-block rounded border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[10px] font-normal text-primary">
                        已回捞
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-1.5">
                    <span
                      className={cn(
                        "inline-flex h-5 items-center rounded border px-1.5 text-[10px] font-medium",
                        TABLE_PRIORITY_STYLE[lead.priority],
                      )}
                    >
                      {PRIORITY_LABEL[lead.priority]}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-52 px-3 py-1.5 leading-4">
                    <span className="block truncate">{lead.contactName.trim() || "—"}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {leadContact(lead)}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-60 px-3 py-1.5">
                    <span className="block truncate" title={leadNote(lead)}>
                      {leadNote(lead)}
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-1.5 text-muted-foreground">
                    {SOURCE_LABEL[lead.source]}
                  </TableCell>
                  <TableCell className="px-3 py-1.5">
                    <span className="text-muted-foreground">
                      {LEAD_STAGE_LABEL[lead.leadStage]}
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-1.5">
                    <div
                      className="flex items-center justify-end gap-1.5"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {reclaimed && (
                        <button
                          type="button"
                          onClick={() => void onResume(lead.id)}
                          disabled={busy}
                          className="inline-flex h-7 items-center gap-1 rounded-md border border-primary/40 px-2 text-[11px] text-primary disabled:opacity-60"
                        >
                          {busy ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3 w-3" />
                          )}
                          恢复跟进
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={!action.action || busy}
                        onClick={() => action.action && void onAdvance(lead.id, action.action)}
                        className={cn(
                          "inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] disabled:cursor-not-allowed disabled:opacity-50",
                          action.action
                            ? `lead-stage-action--${lead.leadStage}`
                            : "border border-border bg-muted text-muted-foreground",
                        )}
                      >
                        {busy ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <ActionIcon className="h-3 w-3" />
                        )}
                        {action.label}
                      </button>
                      <button
                        type="button"
                        onClick={() => setExitTarget(lead)}
                        disabled={busy}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                        aria-label="移出线索池"
                        title="移出线索池"
                      >
                        <CircleMinus className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {exitTarget && (
        <LeadExitDialog
          lead={exitTarget}
          onClose={() => setExitTarget(null)}
          onConfirm={(input) => onExit(exitTarget.id, input)}
        />
      )}
    </>
  );
}
