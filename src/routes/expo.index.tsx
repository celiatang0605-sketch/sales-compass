import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  ArrowUpRight,
  AlertCircle,
  Sparkles,
  Users,
  ClipboardList,
  Flame,
  Clock,
  Loader2,
  RefreshCw,
  Database,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/salesup/AppShell";
import {
  PRIORITY_LABEL,
  PRIORITY_STYLE,
  STATUS_LABEL,
  isActiveFollowup,
  isOverdue,
  type ExpoLead,
  type ExpoPriority,
} from "@/lib/salesup/expoMock";
import { todayKey } from "@/lib/salesup/date";
import { useExpoLeads } from "@/lib/salesup/useExpoLeads";
import {
  countLegacyLocalLeads,
  hasLegacyLocalLeads,
  importLegacyLocalLeads,
} from "@/lib/salesup/expoStore";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/expo/")({
  head: () => ({
    meta: [
      { title: "展会线索 · Sales Up" },
      {
        name: "description",
        content: "快速记录展会现场信息，整理高价值客户并推进下一步。",
      },
    ],
  }),
  component: ExpoIndexPage,
});

const PRIORITY_FILTERS: (ExpoPriority | "all")[] = ["all", "A", "B", "C", "D", "unrated"];

function ExpoIndexPage() {
  const [q, setQ] = useState("");
  const [priority, setPriority] = useState<ExpoPriority | "all">("all");
  const today = todayIso();
  const { leads, loading, error, userId, refresh } = useExpoLeads();

  // Legacy migration banner.
  const [showLegacy, setShowLegacy] = useState(false);
  const [legacyCount, setLegacyCount] = useState(0);
  const [importing, setImporting] = useState(false);
  useEffect(() => {
    if (!userId) {
      setShowLegacy(false);
      return;
    }
    if (hasLegacyLocalLeads(userId)) {
      setLegacyCount(countLegacyLocalLeads());
      setShowLegacy(true);
    }
  }, [userId]);

  const stats = useMemo(() => {
    const todayNew = leads.filter((l) => l.createdAt === today).length;
    const toOrganize = leads.filter((l) => l.status === "to_organize").length;
    const highPriority = leads.filter((l) => l.priority === "A").length;
    const followups = leads.filter((l) => !CLOSED_STATUSES.has(l.status)).length;
    return { todayNew, toOrganize, highPriority, followups };
  }, [leads, today]);

  const list = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return leads.filter((l) => {
      if (priority !== "all" && l.priority !== priority) return false;
      if (!kw) return true;
      return (
        l.company.toLowerCase().includes(kw) ||
        (l.contactName ?? "").toLowerCase().includes(kw) ||
        l.headline.toLowerCase().includes(kw)
      );
    });
  }, [leads, q, priority]);

  const runImport = async () => {
    if (!userId || importing) return;
    setImporting(true);
    try {
      const res = await importLegacyLocalLeads(userId);
      if (res.imported > 0) toast.success(`已导入 ${res.imported} 条本地线索`);
      if (res.failed > 0) toast.error(`${res.failed} 条导入失败，本地数据已保留`);
      setShowLegacy(false);
      await refresh();
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
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">展会线索</h1>
        <p className="text-sm text-muted-foreground mt-1">
          快速记录现场信息，整理高价值客户并推进下一步。
        </p>
      </div>

      {/* Legacy import banner */}
      {showLegacy && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 md:p-4 flex items-start gap-3">
          <Database className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0 text-sm">
            <div className="font-medium text-amber-900">
              发现 {legacyCount} 条本地保存的展会线索
            </div>
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

      {/* List */}
      <section id="all-leads" className="space-y-2.5 pb-24 md:pb-6">
        {!userId && !loading && (
          <EmptyState
            title="请先登录"
            hint="展会线索按账号保存到云端。"
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
            hint={leads.length === 0 ? "去展会现场记录第一条吧。" : undefined}
            action={
              leads.length === 0 ? { to: "/expo/new", label: "开始快速记录" } : undefined
            }
          />
        )}
        {userId &&
          !loading &&
          !error &&
          list.map((l) => <LeadCard key={l.id} lead={l} />)}
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

function LeadCard({ lead }: { lead: ExpoLead }) {
  const overdue = lead.nextActionDate && isOverdue(lead.nextActionDate);
  return (
    <Link
      to="/expo/$id"
      params={{ id: lead.id }}
      className="block rounded-xl border border-border bg-card p-3 md:p-4 hover:border-primary/40 hover:shadow-sm transition"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm md:text-base truncate">
              {lead.company || "(未命名线索)"}
            </span>
            <span
              className={cn(
                "px-1.5 h-5 inline-flex items-center rounded border text-[10px] font-medium",
                PRIORITY_STYLE[lead.priority],
              )}
            >
              {PRIORITY_LABEL[lead.priority]}
            </span>
            <span className="px-1.5 h-5 inline-flex items-center rounded bg-secondary text-secondary-foreground text-[10px]">
              {STATUS_LABEL[lead.status]}
            </span>
          </div>
          {lead.contactName && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {lead.contactName}
              {lead.contactTitle ? ` · ${lead.contactTitle}` : ""}
            </div>
          )}
          <p className="text-sm text-foreground/90 mt-2 line-clamp-2">{lead.headline}</p>
          <div className="mt-2.5 flex items-center gap-2 flex-wrap text-xs">
            {lead.nextActionDate && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Clock className="w-3 h-3" />
                下一步 {lead.nextActionDate}
              </span>
            )}
            {lead.nextAction && (
              <>
                <span className="text-muted-foreground/60">·</span>
                <span className="truncate text-foreground/80">{lead.nextAction}</span>
              </>
            )}
            {overdue && (
              <span className="inline-flex items-center gap-1 px-1.5 h-5 rounded bg-rose-500/10 text-rose-700 text-[10px] border border-rose-500/15">
                <AlertCircle className="w-3 h-3" />
                已逾期
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
