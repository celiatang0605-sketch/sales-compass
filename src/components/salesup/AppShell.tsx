import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Clock, CalendarCheck, CalendarRange, CalendarDays, Bell, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { to: string; label: string; icon: typeof Clock }[] = [
  { to: "/", label: "今日时间轴", icon: Clock },
  { to: "/daily", label: "日复盘", icon: CalendarCheck },
  { to: "/weekly", label: "周复盘", icon: CalendarRange },
  { to: "/monthly", label: "月复盘", icon: CalendarDays },
  { to: "/reminders", label: "提醒中心", icon: Bell },
];

const FUTURE_ITEMS = [
  { label: "客户看板", note: "后续扩展" },
  { label: "商机跟进", note: "后续扩展" },
  { label: "KPI 看板", note: "后续扩展" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col fixed inset-y-0 left-0 w-60 border-r border-border bg-card">
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground grid place-items-center font-bold">
              S
            </div>
            <div>
              <div className="text-base font-semibold leading-tight">Sales Up</div>
              <div className="text-xs text-muted-foreground">销售个人工作台</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-secondary",
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <div className="pt-4 mt-4 border-t border-border space-y-1">
            <div className="px-3 text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
              后续扩展
            </div>
            {FUTURE_ITEMS.map((f) => (
              <div
                key={f.label}
                className="flex items-center justify-between px-3 py-2 rounded-md text-sm text-muted-foreground cursor-not-allowed"
              >
                <span className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5" />
                  {f.label}
                </span>
                <span className="text-[10px] text-muted-foreground/70">{f.note}</span>
              </div>
            ))}
          </div>
        </nav>
        <div className="p-3 border-t border-border text-[11px] text-muted-foreground">
          数据当前保存于本机 (localStorage)
          <div className="mt-1 opacity-70">后续接入 Supabase 与登录</div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 bg-card/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="w-7 h-7 rounded-md bg-primary text-primary-foreground grid place-items-center text-sm font-bold">
            S
          </div>
          <span className="font-semibold">Sales Up</span>
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

      <main className="md:pl-60">
        <div className="px-4 md:px-8 py-4 md:py-6 max-w-[1400px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
