import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Clock,
  CalendarCheck,
  CalendarRange,
  Table2,
  CalendarDays,
  Bell,
  Lock,
  LogOut,
  Upload,
  Loader2,
  Cloud,
  CloudOff,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  PhoneCall,
  Users,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QuickCapture } from "@/components/salesup/QuickCapture";
import { useAuth, signOut } from "@/lib/salesup/auth";
import {
  initSync,
  migrateLocalToCloud,
  hasLegacyLocalData,
  onSyncState,
  type SyncState,
} from "@/lib/salesup/sync";

const NAV_ITEMS: { to: string; label: string; icon: typeof Clock }[] = [
  { to: "/", label: "时间轴", icon: Clock },
  { to: "/daily", label: "日复盘", icon: CalendarCheck },
  { to: "/weekly", label: "周复盘", icon: CalendarRange },
  { to: "/weekly-board", label: "周看板", icon: Table2 },
  { to: "/monthly", label: "月复盘", icon: CalendarDays },
  { to: "/reminders", label: "提醒中心", icon: Bell },
  { to: "/leads", label: "线索池", icon: Sparkles },
  { to: "/calls", label: "拨打打卡", icon: PhoneCall },
  { to: "/customers", label: "客户看板", icon: Users },
];

const FUTURE_ITEMS = [
  { label: "商机跟进", note: "后续扩展" },
  { label: "KPI 看板", note: "后续扩展" },
];

const SIDEBAR_COLLAPSED_KEY = "salesup:ui:sidebar-collapsed";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { session, user, loading } = useAuth();
  const [hasLegacy, setHasLegacy] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [sync, setSync] = useState<SyncState | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSidebarCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
  }, []);

  useEffect(() => {
    initSync();
    const unsub = onSyncState(setSync);
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    if (session) setHasLegacy(hasLegacyLocalData());
  }, [session]);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const onMigrate = async () => {
    if (migrating) return;
    if (!confirm("将把本机已保存的时间块和提醒导入到云端，按当前账号隔离。继续？")) return;
    setMigrating(true);
    const res = await migrateLocalToCloud();
    setMigrating(false);
    if (res.errors.length > 0) {
      alert(`导入完成，但有错误：\n${res.errors.join("\n")}`);
    } else {
      alert(`已导入 ${res.blocks} 条时间块，${res.reminders} 条提醒。`);
    }
    setHasLegacy(hasLegacyLocalData());
  };

  const onSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  const toggleSidebar = () => {
    const nextCollapsed = !sidebarCollapsed;
    setSidebarCollapsed(nextCollapsed);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(nextCollapsed));
    }
  };

  if (loading || !session) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex md:flex-col fixed inset-y-0 left-0 border-r border-border bg-card transition-[width] duration-200 ease-out",
          sidebarCollapsed ? "w-16" : "w-60",
        )}
      >
        <div className={cn("py-5 border-b border-border", sidebarCollapsed ? "px-2" : "px-5")}>
          <div
            className={cn(
              "flex items-center",
              sidebarCollapsed ? "flex-col gap-2" : "justify-between gap-3",
            )}
          >
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground grid place-items-center font-bold">
              S
            </div>
            <div className={cn(sidebarCollapsed && "hidden")}>
              <div className="text-base font-semibold leading-tight">Sales Up</div>
              <div className="text-xs text-muted-foreground">销售个人工作台</div>
            </div>
            <button
              type="button"
              onClick={toggleSidebar}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
              title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
        <nav className={cn("flex-1 space-y-1 overflow-y-auto", sidebarCollapsed ? "p-2" : "p-3")}>
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                title={item.label}
                className={cn(
                  "flex items-center py-2 rounded-md text-sm transition-colors",
                  sidebarCollapsed ? "justify-center px-2" : "gap-2 px-3",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-secondary",
                )}
              >
                <Icon className="w-4 h-4" />
                <span className={cn(sidebarCollapsed && "hidden")}>{item.label}</span>
              </Link>
            );
          })}
          <div
            className={cn(
              "pt-4 mt-4 border-t border-border space-y-1",
              sidebarCollapsed && "pt-3 mt-3",
            )}
          >
            <div
              className={cn(
                "px-3 text-[11px] uppercase tracking-wider text-muted-foreground mb-1",
                sidebarCollapsed && "hidden",
              )}
            >
              后续扩展
            </div>
            {FUTURE_ITEMS.map((f) => (
              <div
                key={f.label}
                title={f.label}
                className={cn(
                  "flex items-center py-2 rounded-md text-sm text-muted-foreground cursor-not-allowed",
                  sidebarCollapsed ? "justify-center px-2" : "justify-between px-3",
                )}
              >
                <span className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5" />
                  <span className={cn(sidebarCollapsed && "hidden")}>{f.label}</span>
                </span>
                <span
                  className={cn(
                    "text-[10px] text-muted-foreground/70",
                    sidebarCollapsed && "hidden",
                  )}
                >
                  {f.note}
                </span>
              </div>
            ))}
          </div>
        </nav>
        <div className={cn("border-t border-border space-y-2", sidebarCollapsed ? "p-2" : "p-3")}>
          {hasLegacy && (
            <button
              onClick={onMigrate}
              disabled={migrating}
              title="导入本地数据"
              aria-label="导入本地数据"
              className={cn(
                "w-full inline-flex items-center justify-center py-1.5 rounded-md text-xs bg-primary/10 text-primary hover:bg-primary/15 disabled:opacity-50",
                sidebarCollapsed ? "gap-0 px-1.5 text-[0px]" : "gap-1.5 px-2.5",
              )}
            >
              {migrating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              导入本地数据
            </button>
          )}
          <SyncStatusBadge sync={sync} compact={sidebarCollapsed} />
          <div
            className={cn(
              "flex items-center gap-2 text-[11px] text-muted-foreground",
              sidebarCollapsed ? "justify-center" : "justify-between",
            )}
          >
            <span
              className={cn("truncate flex-1", sidebarCollapsed && "hidden")}
              title={user?.email ?? ""}
            >
              {user?.email}
            </span>
            <button
              onClick={onSignOut}
              className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
              aria-label="退出登录"
              title="退出登录"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 bg-card/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="w-7 h-7 rounded-md bg-primary text-primary-foreground grid place-items-center text-sm font-bold">
            S
          </div>
          <span className="font-semibold">Sales Up</span>
          <span className="flex-1" />
          {hasLegacy && (
            <button
              onClick={onMigrate}
              disabled={migrating}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] bg-primary/10 text-primary disabled:opacity-50"
            >
              {migrating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Upload className="w-3 h-3" />
              )}
              导入
            </button>
          )}
          <button
            onClick={onSignOut}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground"
            aria-label="退出登录"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        <nav className="flex overflow-x-auto px-2 pb-2 gap-1 no-scrollbar">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-full text-xs whitespace-nowrap",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main
        className={cn(
          "transition-[padding] duration-200 ease-out",
          sidebarCollapsed ? "md:pl-16" : "md:pl-60",
        )}
      >
        <header className="hidden md:flex sticky top-0 z-30 justify-end border-b border-border bg-card/95 px-8 py-3 backdrop-blur">
          <button
            type="button"
            onClick={() => setQuickCaptureOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            快速记录
          </button>
        </header>
        <div className="px-4 md:px-8 py-4 md:py-6 max-w-[1400px] mx-auto">{children}</div>
      </main>
      <QuickCapture open={quickCaptureOpen} onOpenChange={setQuickCaptureOpen} />
    </div>
  );
}

function SyncStatusBadge({ sync, compact = false }: { sync: SyncState | null; compact?: boolean }) {
  const s = sync;
  const source = s?.source === "supabase" ? "Supabase" : "本地";
  let icon = <Cloud className="w-3 h-3" />;
  let label = "已同步";
  let cls = "text-primary";
  if (!s || s.source !== "supabase") {
    icon = <CloudOff className="w-3 h-3" />;
    label = "未登录";
    cls = "text-muted-foreground";
  } else if (s.status === "syncing") {
    icon = <Loader2 className="w-3 h-3 animate-spin" />;
    label = "正在同步";
    cls = "text-primary";
  } else if (s.status === "error") {
    icon = <AlertCircle className="w-3 h-3" />;
    label = "保存失败";
    cls = "text-destructive";
  } else if (s.status === "saved") {
    icon = <CheckCircle2 className="w-3 h-3" />;
    label = "已保存到 Supabase";
    cls = "text-primary";
  }
  if (compact) {
    return (
      <div
        className="rounded-md border border-border bg-background/50 p-1.5 grid place-items-center"
        title={`${label}（来源：${source}）`}
        aria-label={`${label}，来源：${source}`}
      >
        <span className={cls}>{icon}</span>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-border bg-background/50 px-2 py-1.5 space-y-0.5">
      <div className="flex items-center gap-1.5 text-[11px]">
        <span className={cls + " inline-flex items-center gap-1"}>
          {icon}
          {label}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground/70">源：{source}</span>
      </div>
      {s?.lastError && (
        <div className="text-[10px] text-destructive truncate" title={s.lastError}>
          {s.lastError}
        </div>
      )}
    </div>
  );
}
