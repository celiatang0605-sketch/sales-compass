import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  ArrowUpRight,
  Sparkles,
  Users,
  ClipboardList,
  Flame,
  Loader2,
  RefreshCw,
  Database,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/salesup/AppShell";
import {
  PRIORITY_LABEL,
  isActiveFollowup,
  type Lead,
  type LeadPriority,
} from "@/lib/salesup/expoMock";
import { todayKey } from "@/lib/salesup/date";
import { useLeads } from "@/lib/salesup/useLeads";
import { SOURCE_LABEL, SOURCE_ORDER, type CustomerSource } from "@/lib/salesup/customerTypes";
import {
  countLegacyLocalLeads,
  hasLegacyLocalLeads,
  importLegacyLocalLeads,
} from "@/lib/salesup/expoStore";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/expo/")({
  head: () => ({
    meta: [
      { title: "线索池 · Sales Up" },
      {
        name: "description",
        content: "集中管理各来源的未验证线索，完成初步接触后再转为客户。",
      },
    ],
  }),
  component: ExpoIndexPage,
});

const PRIORITY_FILTERS: (LeadPriority | "all")[] = ["all", "A", "B", "C", "D", "unrated"];

function ExpoIndexPage() {
  const [q, setQ] = useState("");
  const [priority, setPriority] = useState<LeadPriority | "all">("all");
  const [sources, setSources] = useState<CustomerSource[]>([]);
  const today = todayKey();
  const { leads, loading, error, userId, refresh } = useLeads();

  // Legacy migration banner.
  const [showLegacy, setShowLegacy] = useState(false);
  const [legacyCount, setLegacyCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const refreshLegacy = useCallback(() => {
    if (!userId) {
      setShowLegacy(false);
      return;
    }
    if (hasLegacyLocalLeads(userId)) {
      setLegacyCount(countLegacyLocalLeads());
      setShowLegacy(true);
    } else {
      setShowLegacy(false);
    }
  }, [userId]);
  useEffect(() => {
    refreshLegacy();
  }, [refreshLegacy]);

  const stats = useMemo(() => {
    const todayNew = leads.filter((l) => l.createdAt === today).length;
    const toOrganize = leads.filter(
      (l) => l.source === "expo" && l.status === "to_organize",
    ).length;
    const highPriority = leads.filter((l) => l.priority === "A").length;
    const followups = leads.filter((l) => isActiveFollowup(l, today)).length;
    return { todayNew, toOrganize, highPriority, followups };
  }, [leads, today]);

  const list = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return leads.filter((l) => {
      if (priority !== "all" && l.priority !== priority) return false;
      if (sources.length > 0 && !sources.includes(l.source)) return false;
      if (!kw) return true;
      return (
        l.company.toLowerCase().includes(kw) ||
        (l.contactName ?? "").toLowerCase().includes(kw) ||
        l.headline.toLowerCase().includes(kw)
      );
    });
  }, [leads, q, priority, sources]);

  const toggleSource = (source: CustomerSource) => {
    setSources((current) =>
      current.includes(source) ? current.filter((item) => item !== source) : [...current, source],
    );
  };

  const runImport = async () => {
    if (!userId || importing) return;
    setImporting(true);
    try {
      const res = await importLegacyLocalLeads(userId);
      if (res.imported > 0) toast.success(`已导入 ${res.imported} 条本地线索`);
      if (res.failed > 0) {
        toast.error(`${res.failed} 条导入失败，稍后可再次尝试`);
      }
      await refresh();
      // Re-evaluate the banner: if failures remain, keep showing it.
      refreshLegacy();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "导入失败");
    } finally {
      setImporting(false);
    }
  };

  return (
    <AppShell>
      {/* Header */}
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">线索池</h1>
        <p className="text-sm text-muted-foreground mt-1">
          集中管理各来源的未验证线索，完成初步接触后再转为客户。
        </p>
      </div>

      {/* Legacy import banner */}
      {showLegacy && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 md:p-4 flex items-start gap-3">
          <Database className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0 text-sm">
            <div className="font-medium text-amber-900">发现 {legacyCount} 条本地保存的线索</div>
            <div className="text-xs text-amber-800/80 mt-0.5">
              这些是 Phase 2 阶段暂存在浏览器里的记录。点击下方按钮导入到当前账号。
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={runImport}
              disabled={importing}
              className="h-8 px-3 rounded-md bg-amber-600 text-white text-xs font-medium disabled:opacity-60"
            >
              {importing ? "导入中…" : "导入到当前账号"}
            </button>
            <button
              onClick={() => setShowLegacy(false)}
              className="h-8 px-2 rounded-md text-amber-800 text-xs hover:bg-amber-500/10"
            >
              稍后
            </button>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4 md:mb-6">
        <StatCard icon={Sparkles} label="今日新增" value={stats.todayNew} tone="primary" />
        <StatCard icon={ClipboardList} label="待整理" value={stats.toOrganize} tone="amber" />
        <StatCard icon={Flame} label="高优先级" value={stats.highPriority} tone="rose" />
        <StatCard icon={Users} label="待跟进" value={stats.followups} tone="emerald" />
      </div>

      {/* Primary actions */}
      <div className="flex flex-col-reverse md:flex-row gap-2 md:items-center mb-4 md:mb-6">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索公司 / 联系人 / 需求"
              className="w-full h-10 pl-8 pr-3 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/expo/new"
            className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:bg-primary/90 active:scale-[0.99] transition"
          >
            <Plus className="w-4 h-4" />
            快速记录
          </Link>
          <a
            href="#all-leads"
            className="hidden md:inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border border-border text-sm hover:bg-secondary"
          >
            查看全部线索
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Priority filter chips */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 mb-3">
        {PRIORITY_FILTERS.map((r) => {
          const active = priority === r;
          const label = r === "all" ? "全部" : PRIORITY_LABEL[r];
          return (
            <button
              key={r}
              onClick={() => setPriority(r)}
              className={cn(
                "shrink-0 px-3 h-8 rounded-full text-xs border transition",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:text-foreground",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 mb-4">
        <span className="shrink-0 text-xs text-muted-foreground">来源</span>
        {SOURCE_ORDER.map((source) => {
          const active = sources.includes(source);
          return (
            <button
              key={source}
              onClick={() => toggleSource(source)}
              className={cn(
                "shrink-0 px-3 h-8 rounded-full text-xs border transition",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:text-foreground",
              )}
            >
              {SOURCE_LABEL[source]}
            </button>
          );
        })}
      </div>

      {/* List */}
      <section id="all-leads" className="pb-24 md:pb-6">
        {!userId && !loading && (
          <EmptyState
            title="请先登录"
            hint="线索按账号保存到云端。"
            action={{ to: "/auth", label: "去登录" }}
          />
        )}
        {userId && loading && (
          <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
            <Loader2 className="w-4 h-4 animate-spin" />
            正在加载…
          </div>
        )}
        {userId && !loading && error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-800">
            <div className="font-medium">加载失败</div>
            <div className="text-xs mt-1 break-words">{error}</div>
            <button
              onClick={() => void refresh()}
              className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-rose-600 text-white text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              重试
            </button>
          </div>
        )}
        {userId && !loading && !error && list.length === 0 && (
          <EmptyState
            title={leads.length === 0 ? "还没有线索" : "没有匹配的线索"}
            hint={leads.length === 0 ? "开始记录第一条线索吧。" : undefined}
            action={leads.length === 0 ? { to: "/expo/new", label: "开始快速记录" } : undefined}
          />
        )}
        {userId && !loading && !error && list.length > 0 && (
          <LeadTable leads={list} today={today} />
        )}
      </section>

      {/* Mobile sticky primary action */}
      <div className="md:hidden fixed bottom-4 inset-x-4 z-40">
        <Link
          to="/expo/new"
          className="w-full inline-flex items-center justify-center gap-1.5 h-12 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          快速记录
        </Link>
      </div>
    </AppShell>
  );
}

function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: { to: string; label: string };
}) {
  return (
    <div className="rounded-xl border border-dashed border-border py-12 text-center">
      <div className="text-sm font-medium text-foreground/90">{title}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      {action && (
        <Link
          to={action.to}
          className="inline-flex items-center gap-1.5 h-9 px-4 mt-4 rounded-lg bg-primary text-primary-foreground text-xs font-medium"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Sparkles;
  label: string;
  value: number;
  tone: "primary" | "amber" | "rose" | "emerald";
}) {
  const toneCls = {
    primary: "bg-primary/10 text-primary",
    amber: "bg-amber-500/10 text-amber-700",
    rose: "bg-rose-500/10 text-rose-700",
    emerald: "bg-emerald-500/10 text-emerald-700",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-card p-3 md:p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={cn("inline-flex w-6 h-6 rounded-md items-center justify-center", toneCls)}>
          <Icon className="w-3.5 h-3.5" />
        </span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
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

function leadContact(lead: Lead): string {
  return [lead.phone, lead.wechat, lead.email].filter(Boolean).join(" · ") || "—";
}

function leadNote(lead: Lead): string {
  return lead.currentNeed?.trim() || lead.rawNote.trim() || lead.headline || "—";
}

function relativeFollowupDate(lastContactedAt: string | undefined, today: string): string {
  if (!lastContactedAt) return "未跟进";

  const asUtc = (date: string) => {
    const [year, month, day] = date.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  const diff = Math.round((asUtc(today) - asUtc(lastContactedAt)) / 86_400_000);

  if (!Number.isFinite(diff)) return lastContactedAt;
  if (diff === 0) return "今天";
  if (diff === 1) return "昨天";
  if (diff > 1) return `${diff} 天前`;
  return `${Math.abs(diff)} 天后`;
}

function LeadTable({ leads, today }: { leads: Lead[]; today: string }) {
  const navigate = useNavigate();

  return (
    <div className="rounded-xl border border-border bg-card">
      <Table className="min-w-[760px] text-xs">
        <TableHeader>
          <TableRow className="h-9 hover:bg-transparent">
            <TableHead className="sticky left-0 z-20 min-w-44 bg-card px-3">公司名</TableHead>
            <TableHead className="min-w-24 px-3">分级</TableHead>
            <TableHead className="min-w-44 px-3">联系人 / 联系方式</TableHead>
            <TableHead className="min-w-64 px-3">需求或备注</TableHead>
            <TableHead className="min-w-24 px-3">来源</TableHead>
            <TableHead className="min-w-20 px-3">最近跟进</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
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
              className="h-10 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <TableCell className="sticky left-0 z-10 max-w-56 bg-card px-3 py-1.5 font-medium">
                <span className="block truncate">{lead.company || "(未命名线索)"}</span>
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
              <TableCell className="max-w-80 px-3 py-1.5">
                <span className="block truncate" title={leadNote(lead)}>
                  {leadNote(lead)}
                </span>
              </TableCell>
              <TableCell className="px-3 py-1.5 text-muted-foreground">
                {SOURCE_LABEL[lead.source]}
              </TableCell>
              <TableCell className="px-3 py-1.5 text-muted-foreground">
                {relativeFollowupDate(lead.lastContactedAt, today)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
